import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"

const limiter = rateLimit({ max: 15, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`net-worth:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "ai-insights") {
      const { netWorth, totalAssets, totalLiabilities, breakdown } = body
      if (!breakdown) throw new ApiError("breakdown required", 400)

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

      const prompt = `You are a personal finance advisor. Analyze this net worth breakdown and provide 3 specific, actionable insights.

Net Worth: $${netWorth?.toLocaleString() ?? 0}
Total Assets: $${totalAssets?.toLocaleString() ?? 0}
Total Liabilities: $${totalLiabilities?.toLocaleString() ?? 0}

Asset/Liability Breakdown:
${JSON.stringify(breakdown, null, 2)}

Return a JSON array of exactly 3 insight objects:
[
  {
    "title": "Short title",
    "insight": "Specific, actionable advice in 2-3 sentences.",
    "type": "warning" | "tip" | "positive"
  }
]

Focus on: emergency fund adequacy, diversification, debt management, retirement readiness. Return only valid JSON array.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new ApiError("AI returned invalid response", 500)
      const insights = JSON.parse(jsonMatch[0])
      return NextResponse.json({ insights })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
