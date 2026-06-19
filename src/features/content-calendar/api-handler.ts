import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"

const limiter   = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 5,  windowMs: 60000 })

async function geminiText(req: Request, prompt: string): Promise<string> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function geminiJSON(req: Request, prompt: string): Promise<unknown> {
  const text = await geminiText(req, prompt)
  return JSON.parse(text.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim())
}

// ── Ghost JWT (HS256 via Web Crypto) ─────────────────────────────────────────
async function signGhostJwt(adminKey: string): Promise<string> {
  const [id, secret] = adminKey.split(":")
  if (!id || !secret) throw new ApiError("Invalid Ghost admin key format (expected id:secret)", 400)

  const header = { alg: "HS256", typ: "JWT", kid: id }
  const payload = {
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    aud: "/admin/",
  }

  const enc = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
  const unsigned = `${enc(header)}.${enc(payload)}`

  const secretBytes = new Uint8Array(secret.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")

  return `${unsigned}.${sigB64}`
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`content-calendar:${uid}`)
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

    if (action === "content-ideas") {
      const { allowed } = aiLimiter.check(`content-calendar-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { niche, audience, platform } = body
      if (!niche) throw new ApiError("niche required", 400)
      const prompt = `You are a content strategist. Generate 10 content ideas for a creator in the "${niche}" niche targeting "${audience || "general audience"}" on "${platform || "general"}".

Return JSON array:
[
  {
    "hook": "The attention-grabbing opening line",
    "title": "Content title",
    "format": "thread|post|video|article|carousel",
    "bestTime": "Best time to post (e.g. Tuesday 9am)",
    "whyItWorks": "Short reason"
  }
]

Make ideas specific, engaging, and actionable. JSON only.`
      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    if (action === "repurpose") {
      const { allowed } = aiLimiter.check(`content-calendar-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { content } = body
      if (!content) throw new ApiError("content required", 400)
      const prompt = `You are a content repurposing expert. Given this long-form content, generate repurposed versions.

Content:
${content.slice(0, 3000)}

Return JSON:
{
  "tweetThreads": [
    { "title": "Thread title", "tweets": ["tweet 1", "tweet 2", "tweet 3"] }
  ],
  "linkedInPost": "Full LinkedIn post text (max 1300 chars)",
  "instagramCaptions": ["Caption 1", "Caption 2", "Caption 3"],
  "newsletterSummary": "Newsletter summary (2-3 paragraphs)"
}

Keep tweet threads at 3-7 tweets, each under 280 chars. JSON only.`
      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    if (action === "ghost-publish") {
      const { allowed } = limiter.check(`content-calendar:${uid}`)
      if (!allowed) throw new ApiError("Too many requests", 429)
      const { apiUrl, adminKey, title, html } = body
      if (!apiUrl || !adminKey || !title) throw new ApiError("apiUrl, adminKey, and title required", 400)

      const token = await signGhostJwt(adminKey)
      const base = apiUrl.replace(/\/$/, "")

      const resp = await fetch(`${base}/ghost/api/admin/posts/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Ghost ${token}`,
        },
        body: JSON.stringify({
          posts: [{
            title,
            html: html || `<p>${title}</p>`,
            status: "draft",
          }],
        }),
      })

      if (!resp.ok) {
        const errText = await resp.text()
        throw new ApiError(`Ghost API error: ${errText.slice(0, 200)}`, 502)
      }

      const ghostData = await resp.json()
      const post = ghostData.posts?.[0]
      return NextResponse.json({ ok: true, postId: post?.id, url: post?.url })
    }

    const { allowed } = limiter.check(`content-calendar:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}
