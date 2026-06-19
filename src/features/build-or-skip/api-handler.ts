import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { BuildOrSkipResult } from "./types"

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

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`build-or-skip:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "judge") {
      const { allowed: aiOk } = aiLimiter.check(`build-or-skip-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const idea = body.idea as string
      const timeAvailable = (body.timeAvailable as string) ?? ""
      const skills = (body.skills as string) ?? ""
      const goal = (body.goal as string) ?? ""

      if (!idea?.trim()) throw new ApiError("idea required", 400)

      const prompt = `You are a brutally honest startup advisor. Judge whether this idea is worth building.

Idea: "${idea}"
Time available: ${timeAvailable || "not specified"}
Skills: ${skills || "not specified"}
Goal: ${goal || "not specified"}

Return ONLY valid JSON:
{
  "verdict": "BUILD" | "SKIP" | "PIVOT",
  "confidence": <0-100 integer>,
  "headline": "<2-3 word verdict headline, e.g. 'Ship it!' or 'Hard pass'>",
  "snarkyQuote": "<witty one-liner about the idea>",
  "for": ["<reason to build>", "<reason to build>"],
  "against": ["<reason not to build>", "<reason not to build>"],
  "risks": ["<risk 1>", "<risk 2>"],
  "prediction": "<what happens if they build this in 3-6 months>",
  "pivotSuggestion": "<if verdict is PIVOT: what to change. Otherwise omit or leave empty>"
}

Rules:
- Be honest, not encouraging
- for: 2-4 items
- against: 2-4 items
- risks: 1-3 items
- Confidence must reflect genuine assessment
- snarkyQuote: funny but insightful
- If verdict is SKIP, pivotSuggestion should still offer a potential angle
- JSON only, no markdown`

      const result = await geminiJSON(req, prompt) as BuildOrSkipResult
      return NextResponse.json({ ok: true, result })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
