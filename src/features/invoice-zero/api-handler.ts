import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"

const limiter = rateLimit({ max: 30, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 5, windowMs: 60000 })

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`invoice-zero:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const body = await req.json()
    const { action } = body

    if (action === "ai-generate") {
      const { allowed } = aiLimiter.check(`invoice-zero-ai:${uid}:${ip}`)
      if (!allowed) throw new ApiError("AI rate limit exceeded (5/min)", 429)

      const { description } = body
      if (!description) throw new ApiError("description required", 400)

      const key = getGeminiKey(req)

      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `You are an invoice assistant. Parse the following description and extract invoice details.

Description: "${description}"

Return valid JSON matching this structure:
{
  "clientName": "string",
  "clientEmail": "string (guess if not mentioned, e.g. client@example.com)",
  "businessName": "string (use 'Your Business' if not mentioned)",
  "lineItems": [
    { "description": "string", "quantity": number, "unitPrice": number }
  ],
  "dueInDays": number (default 30 if not specified),
  "notes": "string",
  "taxRate": number (0 if not mentioned),
  "currency": "USD" (or EUR/GBP/INR/CAD/AUD if mentioned)
}

Rules:
- Split the total across line items logically
- If only a total is mentioned with one task, make 1 line item with quantity=1
- Extract revision counts as separate line items if mentioned
- dueInDays: extract from "payment due in X days" or similar phrases
- Return only the JSON, no markdown, no explanation`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        const data = JSON.parse(text)
        return NextResponse.json({ ok: true, data })
      } catch {
        return NextResponse.json({
          ok: true,
          data: {
            clientName: "",
            clientEmail: "",
            businessName: "",
            lineItems: [{ description: description, quantity: 1, unitPrice: 0 }],
            dueInDays: 30,
            notes: "",
            taxRate: 0,
            currency: "USD",
          },
        })
      }
    }

    const { allowed } = limiter.check(`invoice-zero:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
