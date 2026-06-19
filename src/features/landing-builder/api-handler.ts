import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { LandingInput, LandingOutput } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 8, windowMs: 60000 })

async function geminiJSON(req: Request, prompt: string): Promise<unknown> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(cleaned)
}

function buildFullPrompt(input: LandingInput): string {
  return `You are an expert landing page copywriter. Generate compelling landing page content for this product.

Product: ${input.productName}
One-liner: ${input.oneLiner}
Target audience: ${input.targetAudience}
Key features: ${input.features.filter(Boolean).join(", ")}
Pricing type: ${input.pricingType}
Tone: ${input.tone}
${input.competitor ? `Main competitor to differentiate from: ${input.competitor}` : ""}

Return ONLY valid JSON matching this exact shape:
{
  "hero": {
    "headline": "<powerful, benefit-focused headline, 5-10 words>",
    "subheadline": "<2-sentence description that expands on headline>",
    "ctaPrimary": "<primary CTA button text>",
    "ctaSecondary": "<secondary CTA button text>",
    "socialProof": "<short social proof text, e.g. 'Join 1,200+ developers'>"
  },
  "features": [
    { "title": "<feature name>", "description": "<1-2 sentence benefit-focused description>", "icon": "<single emoji>" }
  ],
  "howItWorks": [
    { "step": 1, "title": "<step title>", "description": "<1-sentence description>" }
  ],
  "testimonials": [
    { "quote": "<realistic testimonial>", "author": "<realistic name>", "role": "<job title>", "company": "<company name>" }
  ],
  "pricing": [
    { "name": "<tier name>", "price": "<price string, e.g. '$29/mo'>", "description": "<1-sentence>", "features": ["<feature>"], "cta": "<CTA text>", "highlighted": false }
  ],
  "faq": [
    { "question": "<common question>", "answer": "<concise answer>" }
  ],
  "cta": {
    "headline": "<closing CTA headline>",
    "subtext": "<1-2 sentences>",
    "buttonText": "<CTA button text>"
  },
  "seo": {
    "metaTitle": "<SEO title, 50-60 chars>",
    "metaDescription": "<SEO description, 150-160 chars>",
    "keywords": ["<keyword1>", "<keyword2>"],
    "ogTitle": "<OG title>",
    "ogDescription": "<OG description>"
  }
}

Rules:
- features: exactly 6 items
- howItWorks: 3-4 steps
- testimonials: exactly 3
- pricing: 2-3 tiers based on pricing type (1 tier if 'free')
- faq: 5-6 items
- Tone: ${input.tone} — match the writing style accordingly
- JSON only, no markdown`
}

function buildSectionPrompt(input: LandingInput, section: string, currentContent: string): string {
  return `You are an expert landing page copywriter. Regenerate only the "${section}" section of this landing page.

Product: ${input.productName}
One-liner: ${input.oneLiner}
Target audience: ${input.targetAudience}
Tone: ${input.tone}

Current ${section} content:
${currentContent}

Return ONLY valid JSON for the "${section}" section, matching the same structure as the current content but with fresh, improved copy.
JSON only, no markdown.`
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`landing-builder:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "generate") {
      const { allowed: aiOk } = aiLimiter.check(`landing-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const input = body.input as LandingInput
      if (!input?.productName?.trim()) throw new ApiError("productName required", 400)

      const data = await geminiJSON(req, buildFullPrompt(input)) as LandingOutput
      return NextResponse.json({ ok: true, output: data })
    }

    if (action === "regenerate-section") {
      const { allowed: aiOk } = aiLimiter.check(`landing-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const input = body.input as LandingInput
      const section = body.section as string
      const currentContent = body.currentContent as string

      if (!input?.productName?.trim()) throw new ApiError("input required", 400)
      if (!section?.trim()) throw new ApiError("section required", 400)

      const data = await geminiJSON(req, buildSectionPrompt(input, section, currentContent))
      return NextResponse.json({ ok: true, section, data })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
