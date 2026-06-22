import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { geminiJSON } from "@/lib/gemini"
import type { ViralPostInput, ViralPostResult } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`viral-post:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "generate") {
      const { allowed: aiOk } = aiLimiter.check(`viral-post-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const input = body.input as ViralPostInput
      if (!input?.topic?.trim()) throw new ApiError("topic required", 400)

      const FORMAT_INSTRUCTIONS: Record<string, string> = {
        "hot-take": "Write a bold, polarizing opinion that will spark heated discussion. Start with the most provocative statement.",
        "contrarian": "Go against the popular consensus. Challenge what everyone believes with evidence and logic.",
        "listicle": "Create a punchy list of insights, tips, or observations. Use numbers and keep each point sharp.",
        "story": "Tell a compelling personal story with a clear arc: setup, conflict, resolution. Make it relatable.",
        "how-to": "Write a clear, actionable step-by-step guide that delivers immediate value.",
        "unpopular-opinion": "State something most people in the industry won't say out loud. Be honest but respectful.",
        "prediction": "Make a bold, specific prediction about the near future. Back it up with reasoning.",
        "roast": "Satirically roast a common trend, tool, or practice in the industry. Be witty, not mean.",
      }

      const PLATFORM_RULES: Record<string, string> = {
        twitter: "Max 280 characters. Use line breaks for readability. Include 1-2 relevant hashtags at the end.",
        linkedin: "Professional but engaging. 1-3 paragraphs. Use line breaks. End with a question to drive comments.",
        reddit: "Write as a text post. Be detailed, authentic, and community-aware. No self-promotion.",
        hn: "Write as a 'Show HN' or text post. Technical, informative, no marketing fluff.",
      }

      const prompt = `You are an expert viral content creator. Generate a viral post.

Topic: "${input.topic}"
Context: ${input.context || "none"}
Format: ${input.format} — ${FORMAT_INSTRUCTIONS[input.format]}
Platform: ${input.platform} — ${PLATFORM_RULES[input.platform]}
${input.angle ? `Angle: ${input.angle}` : ""}

Return ONLY valid JSON:
{
  "posts": [
    {
      "platform": "${input.platform}",
      "content": "<the full post content, platform-optimized>",
      "engagementScore": <0-100>,
      "engagementReasoning": "<1-2 sentences explaining the score>",
      "bestTimeToPost": "<specific day and time recommendation>",
      "hashtags": ["<hashtag1>", "<hashtag2>"]
    }
  ],
  "hookAlternatives": ["<hook alternative 1>", "<hook alternative 2>", "<hook alternative 3>"],
  "threadVersion": "<if platform is twitter: a 3-tweet thread version, otherwise omit>"
}

Rules:
- posts array should have exactly 1 entry for the requested platform
- engagementScore: based on hook strength, emotional resonance, shareability
- hookAlternatives: 3 different opening lines
- Content must be genuinely good, not generic
- JSON only, no markdown`

      const result = await geminiJSON(req, prompt) as ViralPostResult
      return NextResponse.json({ ok: true, result })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
