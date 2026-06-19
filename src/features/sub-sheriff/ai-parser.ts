import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"
import { lookupService } from "./service-db"
import type { ParsedSubscription, BillingCycle, Category } from "./types"
import { toMonthly } from "./types"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

async function parseWithAI(req: Request, emailText: string): Promise<ParsedSubscription[]> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const prompt = `You are an expert at extracting SaaS subscription information from email text.

Analyze the following email content and extract ALL subscription/billing information you find.

For each subscription found, extract:
- name: company/service name
- rawAmount: the exact dollar amount billed
- billingCycle: "monthly" | "annual" | "quarterly" | "weekly" | "one-time"
- category: one of "dev-tools" | "design" | "productivity" | "media" | "ai-llm" | "cloud-hosting" | "marketing" | "security" | "finance" | "other"
- renewalDate: next renewal date in ISO format (YYYY-MM-DD) if mentioned, null otherwise
- url: website URL if mentioned, null otherwise
- confidence: 0.0-1.0 how confident you are this is a real subscription

Rules:
- Only include items that are clearly recurring subscriptions or billing receipts
- Do not include one-time purchases unless they are clearly subscription-based
- Amounts should be in USD (convert if necessary)
- If annual, set rawAmount to the annual price

Return ONLY a JSON array. No explanation.

Example:
[
  {
    "name": "GitHub Copilot",
    "rawAmount": 10,
    "billingCycle": "monthly",
    "category": "dev-tools",
    "renewalDate": "2026-07-15",
    "url": "github.com",
    "confidence": 0.95
  }
]

Email content:
${emailText.slice(0, 15000)}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    // Extract JSON from response
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as ParsedSubscription[]

    // Enrich with our service DB
    return parsed.map((item) => {
      const dbEntry = lookupService(item.name)
      return {
        ...item,
        category: dbEntry?.category ?? item.category,
        cancelUrl: dbEntry?.cancelUrl,
      }
    })
  } catch {
    return []
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()

    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`sub-sheriff-ai:${ip}`)
    if (!allowed) throw new ApiError("Too many requests — wait a minute", 429)

    const body = await req.json()
    const { emailText } = body

    if (!emailText || typeof emailText !== "string") {
      throw new ApiError("emailText is required", 400)
    }

    if (emailText.trim().length < 20) {
      throw new ApiError("Email text is too short", 400)
    }

    const subscriptions = await parseWithAI(req, emailText)

    // Enrich with monthly amount
    const enriched = subscriptions
      .filter((s) => s.confidence >= 0.5)
      .map((s) => ({
        ...s,
        amount: toMonthly(s.rawAmount, s.billingCycle),
      }))

    return NextResponse.json({ subscriptions: enriched })
  } catch (err) {
    return handleApiError(err)
  }
}
