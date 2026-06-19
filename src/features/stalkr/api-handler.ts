import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { HNMention } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 10, windowMs: 60000 })

async function geminiJSON(req: Request, prompt: string): Promise<unknown> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(cleaned)
}

async function fetchHNMentions(brandName: string): Promise<HNMention[]> {
  try {
    const encoded = encodeURIComponent(brandName)
    const res = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${encoded}&hitsPerPage=5&tags=story`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json() as {
      hits: Array<{
        title?: string
        url?: string
        points?: number
        num_comments?: number
        created_at?: string
        objectID: string
      }>
    }
    return data.hits.map((h) => ({
      title: h.title ?? "(no title)",
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points ?? 0,
      numComments: h.num_comments ?? 0,
      createdAt: h.created_at ?? "",
      objectID: h.objectID,
    }))
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`stalkr:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "analyze") {
      const { allowed: aiOk } = aiLimiter.check(`stalkr-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const brandName = body.brandName as string
      const brandUrl = (body.brandUrl as string | undefined) ?? ""

      if (!brandName?.trim()) throw new ApiError("brandName required", 400)

      const [hnMentions] = await Promise.all([fetchHNMentions(brandName)])

      const hnSummary = hnMentions.length > 0
        ? hnMentions.map((m) => `- "${m.title}" (${m.points} pts, ${m.numComments} comments)`).join("\n")
        : "No HN mentions found."

      const prompt = `You are a brand analyst. Analyze this brand and return a detailed assessment.

Brand name: "${brandName}"
${brandUrl ? `Brand URL: ${brandUrl}` : ""}

HN Mentions:
${hnSummary}

Return ONLY valid JSON:
{
  "sentiment": "<positive|neutral|negative|mixed>",
  "sentimentSummary": "<2-3 sentences about the brand's online sentiment>",
  "nameScore": <0-100 integer overall brand name score>,
  "nameScoreBreakdown": {
    "memorability": <0-25>,
    "pronounceability": <0-25>,
    "uniqueness": <0-25>,
    "domainFriendly": <0-25>
  },
  "nameScoreReasoning": "<2-3 sentences explaining the name score>",
  "seoKeywords": ["<keyword1>", "<keyword2>", "<keyword3>", "<keyword4>", "<keyword5>"],
  "searchLinks": [
    { "label": "Google", "url": "https://www.google.com/search?q=${encodeURIComponent(brandName)}" },
    { "label": "HN Search", "url": "https://hn.algolia.com/?query=${encodeURIComponent(brandName)}" },
    { "label": "Twitter/X", "url": "https://twitter.com/search?q=${encodeURIComponent(brandName)}" },
    { "label": "Reddit", "url": "https://www.reddit.com/search/?q=${encodeURIComponent(brandName)}" }
  ],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"]
}

Rules:
- nameScore = sum of breakdown scores (max 100)
- Be honest, even critical if warranted
- seoKeywords: terms this brand should rank for
- improvements: actionable brand/name improvements
- strengths: what the brand does well
- JSON only, no markdown`

      const aiData = await geminiJSON(req, prompt) as {
        sentiment: "positive" | "neutral" | "negative" | "mixed"
        sentimentSummary: string
        nameScore: number
        nameScoreBreakdown: { memorability: number; pronounceability: number; uniqueness: number; domainFriendly: number }
        nameScoreReasoning: string
        seoKeywords: string[]
        searchLinks: Array<{ label: string; url: string }>
        improvements: string[]
        strengths: string[]
      }

      return NextResponse.json({
        ok: true,
        data: {
          brandName,
          url: brandUrl,
          hnMentions,
          ...aiData,
        },
      })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
