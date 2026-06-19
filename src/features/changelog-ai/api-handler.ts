import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { ChangelogEntry, ToneId } from "./types"

const aiLimiter = rateLimit({ max: 8, windowMs: 60000 })

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

    const prompt = `You are a technical writer specializing in user-facing changelogs. Transform these raw commits/PR descriptions into a polished changelog.

RAW INPUT:
${rawInput}

TONE: ${toneGuide[tone as ToneId] ?? toneGuide.friendly}
USE EMOJIS IN TITLES: ${useEmojis ? "yes" : "no"}

Transform each commit/change into a user-facing changelog entry. Group them by type.

Rules for transformation:
- "fix: resolve null ptr in auth" → "Fixed a crash that occurred when logging in with certain email formats"
- "feat: add dark mode" → "Added dark mode support — your eyes will thank you"  
- "chore: upgrade deps" → Put in Improvements as "Updated internal dependencies for better stability"
- "refactor: extract service" → Skip or put in Improvements if user-visible
- Focus on WHAT CHANGED FOR THE USER, not HOW it was implemented
- Keep technical details for the technicalDetails field

Return a JSON array:
[
  {
    "type": "feature | improvement | fix | breaking | deprecation",
    "title": "short title (max 60 chars)",
    "description": "user-facing description (1-2 sentences, what changed and why it matters)",
    "technicalDetails": "optional: implementation details for devs (null if not needed)",
    "rawCommit": "the original commit/PR line this came from"
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
        entries: rawInput.split("\n").filter(Boolean).slice(0, 10).map((line: string) => ({
          id: crypto.randomUUID(),
          type: "improvement",
          title: line.slice(0, 60),
          description: line,
          rawCommit: line,
        })),
      })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
