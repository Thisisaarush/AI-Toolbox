import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import { getSystemPrompt } from "./templates"
import { CONTRACT_META, JURISDICTION_META } from "./types"
import type { ContractType, Jurisdiction } from "./types"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`contract-gen:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "generate-contract") {
      const { contractType, jurisdiction, fieldValues } = body as {
        contractType: ContractType
        jurisdiction: Jurisdiction
        fieldValues: Record<string, string>
      }

      if (!contractType || !jurisdiction) throw new ApiError("contractType and jurisdiction required", 400)

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

      const systemPrompt = getSystemPrompt(CONTRACT_META[contractType]?.label ?? contractType, JURISDICTION_META[jurisdiction] ?? jurisdiction)

      const fieldsSummary = Object.entries(fieldValues)
        .filter(([, v]) => v?.trim())
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")

      const prompt = `${systemPrompt}

Use these specific details provided by the user:
${fieldsSummary}

Generate the complete contract document now. Make it detailed, professional, and legally sound.`

      const result = await model.generateContent(prompt)
      const contractText = result.response.text()
      return NextResponse.json({ contractText })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
