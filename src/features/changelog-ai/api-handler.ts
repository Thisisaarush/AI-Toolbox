import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ChangelogEntry, ChangeType, ToneId } from "./types"

const aiLimiter = rateLimit({ max: 8, windowMs: 60000 })

/**
 * Pre-filter commits by conventional commit prefixes so the AI can focus on
 * rewriting descriptions rather than categorizing.
 */
function preFilterCommit(line: string): { type: ChangeType; line: string } {
  const lower = line.toLowerCase().trimStart()

  if (/^(feat|feature|add)[\s:(]/.test(lower)) return { type: "feature", line }
  if (/^(fix|bug|hotfix|bugfix)[\s:(]/.test(lower)) return { type: "fix", line }
  if (/^(perf|optimize|performance)[\s:(]/.test(lower)) return { type: "improvement", line }
  if (/^breaking[\s:(]/.test(lower) || /\bBREAKING[_\s]CHANGE\b/.test(line)) return { type: "breaking", line }
  if (/^(deprecate|remove|deprecated)[\s:(]/.test(lower)) return { type: "deprecation", line }

  return { type: "improvement", line }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = aiLimiter.check(`changelog-ai:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Rate limit: 8 generations per minute", 429)

    const body = await req.json()
    const { action } = body
    if (action !== "generate") throw new ApiError(`Unknown action: ${action}`, 400)

    const { rawInput, tone, useEmojis } = body
    if (!rawInput?.trim()) throw new ApiError("rawInput required", 400)

    const key = process.env.GEMINI_API_KEY
    if (!key) throw new ApiError("AI not configured", 503)

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const toneGuide: Record<ToneId, string> = {
      friendly: "Write in a warm, approachable tone. Use 'you' and 'we'. Make technical changes feel accessible.",
      professional: "Write in a formal, business-appropriate tone. Clear and precise. No slang.",
      technical: "Write for a technical audience. Include technical context. Precise language.",
    }

    // Pre-filter each non-empty line and annotate with suggested type
    const lines = rawInput.split("\n").filter((l: string) => l.trim())
    const annotated = lines.map((l: string) => {
      const { type } = preFilterCommit(l)
      return `[SUGGESTED_TYPE: ${type}] ${l}`
    })
    const annotatedInput = annotated.join("\n")

    const prompt = `You are a technical writer specializing in user-facing changelogs. Transform these raw commits/PR descriptions into a polished changelog.

Each line has been pre-annotated with [SUGGESTED_TYPE: <type>] based on conventional commit prefixes. Use the suggested type unless you have strong reason to change it (e.g. the commit message contradicts it). This way you can focus entirely on writing great descriptions.

PRE-ANNOTATED INPUT:
${annotatedInput}

TONE: ${toneGuide[tone as ToneId] ?? toneGuide.friendly}
USE EMOJIS IN TITLES: ${useEmojis ? "yes" : "no"}

Transform each commit/change into a user-facing changelog entry. Focus on WHAT CHANGED FOR THE USER, not HOW it was implemented.

Examples of good transformations:
- "[SUGGESTED_TYPE: fix] fix: resolve null ptr in auth" → title: "Fixed login crash", description: "Fixed a crash that occurred when logging in with certain email formats"
- "[SUGGESTED_TYPE: feature] feat: add dark mode" → title: "Dark mode support", description: "Added dark mode — your eyes will thank you for late-night sessions"
- "[SUGGESTED_TYPE: improvement] chore: upgrade deps" → title: "Dependency updates", description: "Updated internal dependencies for better stability and security"
- "[SUGGESTED_TYPE: improvement] refactor: extract service" → skip if not user-visible, otherwise put in Improvements

Return a JSON array:
[
  {
    "type": "feature | improvement | fix | breaking | deprecation",
    "title": "short title (max 60 chars)",
    "description": "user-facing description (1-2 sentences, what changed and why it matters)",
    "technicalDetails": "optional: implementation details for devs (null if not needed)",
    "rawCommit": "the original commit/PR line this came from (without the [SUGGESTED_TYPE:...] prefix)"
  }
]

Only return valid JSON array, no markdown fences.`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const rawEntries = JSON.parse(text)
      const entries: ChangelogEntry[] = rawEntries.map((e: Omit<ChangelogEntry, "id">) => ({
        id: crypto.randomUUID(),
        type: e.type ?? "improvement",
        title: e.title ?? "Update",
        description: e.description ?? "",
        technicalDetails: e.technicalDetails ?? undefined,
        rawCommit: e.rawCommit ?? undefined,
      }))
      return NextResponse.json({ ok: true, entries })
    } catch {
      return NextResponse.json({
        ok: true,
        entries: lines.slice(0, 10).map((line: string) => {
          const { type } = preFilterCommit(line)
          return {
            id: crypto.randomUUID(),
            type,
            title: line.replace(/^\[SUGGESTED_TYPE:[^\]]+\]\s*/, "").slice(0, 60),
            description: line,
            rawCommit: line,
          }
        }),
      })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
