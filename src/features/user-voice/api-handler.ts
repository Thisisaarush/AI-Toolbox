import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { UserVoiceInput, UserVoiceResult } from "./types"

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
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`user-voice:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "simulate") {
      const { allowed: aiOk } = aiLimiter.check(`user-voice-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const input = body.input as UserVoiceInput
      if (!input?.productName?.trim()) throw new ApiError("productName required", 400)

      const prompt = `You are a product researcher who simulates real user reactions. Create 5 diverse user personas and their reactions to this product.

Product: ${input.productName}
Description: ${input.description}
Target user: ${input.targetUser}
Stage: ${input.stage}
Assumption being tested: ${input.assumption}

Create 5 diverse personas with different demographics, tech savviness, and perspectives. At least 1 should be skeptical, 1 confused, 1 excited, and 1 neutral.

Return ONLY valid JSON:
{
  "personas": [
    {
      "name": "<realistic name>",
      "role": "<job title or role>",
      "age": <realistic age>,
      "techSavvy": "low" | "medium" | "high",
      "reaction": "excited" | "skeptical" | "neutral" | "confused" | "disappointed",
      "firstImpression": "<2-3 sentence first impression>",
      "topConcern": "<their biggest concern>",
      "featureRequests": ["<feature request 1>", "<feature request 2>"],
      "willingToPay": "<e.g. '$0', '$5/mo', '$20 one-time'>",
      "likeliness": <1-10>,
      "quote": "<a short, authentic-sounding quote about the product>"
    }
  ],
  "insights": {
    "avgLikeliness": <average of all likeliness scores>,
    "topConcerns": ["<concern 1>", "<concern 2>", "<concern 3>"],
    "topRequests": ["<request 1>", "<request 2>", "<request 3>"],
    "paymentConsensus": "<summary of willingness to pay>",
    "biggestRisk": "<the #1 risk to product success>",
    "fastestWin": "<the easiest quick win to improve the product>"
  },
  "actionItems": ["<action 1>", "<action 2>", "<action 3>", "<action 4>"],
  "validationScore": <0-100>,
  "validationSummary": "<1-2 sentence summary of validation results>"
}

Rules:
- Personas must feel real and diverse
- At least 3 different reactions among the 5
- actionItems: 3-5 specific, actionable next steps
- Be honest — don't sugarcoat
- JSON only, no markdown`

      const result = await geminiJSON(req, prompt) as UserVoiceResult
      return NextResponse.json({ ok: true, result })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
