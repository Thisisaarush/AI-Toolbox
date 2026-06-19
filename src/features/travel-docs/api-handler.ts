import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"

const limiter   = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 5,  windowMs: 60000 })

async function geminiJSON(prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new ApiError("AI not configured", 503)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(text)
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`travel-docs:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const body = await req.json()
    const { action } = body

    if (action === "doc-checklist") {
      const { allowed } = aiLimiter.check(`travel-docs-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { destination, origin, purpose } = body
      if (!destination) throw new ApiError("destination required", 400)
      const prompt = `You are a travel document expert. Generate a document checklist for someone traveling from "${origin || "USA"}" to "${destination}" for "${purpose || "leisure"}".

Return JSON array of objects:
[
  { "label": "Passport (valid 6+ months)", "notes": "Check expiry date", "expiring": true },
  { "label": "Tourist Visa", "notes": "Apply 4-6 weeks in advance", "expiring": false }
]

Include: visa requirements, passport validity, travel insurance, vaccinations/health documents, driving license if relevant, any country-specific requirements.
Return 6-12 items. JSON only.`
      const data = await geminiJSON(prompt)
      return NextResponse.json({ ok: true, data })
    }

    if (action === "packing-list") {
      const { allowed } = aiLimiter.check(`travel-docs-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { destination, durationDays, purpose, season } = body
      if (!destination) throw new ApiError("destination required", 400)
      const prompt = `You are a travel packing expert. Generate a packing list for:
- Destination: ${destination}
- Duration: ${durationDays || 7} days
- Purpose: ${purpose || "leisure"}
- Season/Weather: ${season || "unknown"}

Return JSON array grouped by category:
[
  { "category": "Clothing", "label": "T-shirts", "qty": 5 },
  { "category": "Electronics", "label": "Phone charger", "qty": 1 },
  { "category": "Documents", "label": "Passport", "qty": 1 },
  { "category": "Toiletries", "label": "Toothbrush", "qty": 1 }
]

Include 25-40 items across categories: Clothing, Electronics, Documents, Toiletries, Health, Accessories, Footwear, Entertainment. JSON only.`
      const data = await geminiJSON(prompt)
      return NextResponse.json({ ok: true, data })
    }

    const { allowed } = limiter.check(`travel-docs:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}
