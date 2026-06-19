import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"

const limiter   = rateLimit({ max: 30, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 10, windowMs: 60000 })

async function fetchWithTimeout(url: string, ms = 8000): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; ReadingListBot/1.0)" } })
    clearTimeout(id)
    return res
  } catch (e) {
    clearTimeout(id)
    throw e
  }
}

function extractMeta(html: string): { title?: string; description?: string; ogImage?: string; wordCount?: number } {
  const getTag = (pattern: RegExp) => pattern.exec(html)?.[1]?.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim()

  const title = getTag(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    ?? getTag(/<title[^>]*>([^<]+)<\/title>/i)
    ?? getTag(/<meta[^>]+name=["']title["'][^>]+content=["']([^"']+)["']/i)

  const description = getTag(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    ?? getTag(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)

  const ogImage = getTag(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? getTag(/<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i)

  // rough word count from stripped text
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  const wordCount = stripped.split(" ").filter(Boolean).length

  return { title, description, ogImage, wordCount }
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`reading-list:${uid}`)
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

    if (action === "fetch-meta") {
      const { allowed } = limiter.check(`reading-list:${uid}`)
      if (!allowed) throw new ApiError("Too many requests", 429)
      const { url } = body
      if (!url) throw new ApiError("url required", 400)

      try {
        const resp = await fetchWithTimeout(url)
        if (!resp.ok) throw new ApiError(`Failed to fetch URL: ${resp.status}`, 502)
        const html = await resp.text()
        const meta = extractMeta(html)
        return NextResponse.json({ ok: true, data: meta })
      } catch (e) {
        if (e instanceof ApiError) throw e
        return NextResponse.json({ ok: true, data: { title: undefined, description: undefined } })
      }
    }

    if (action === "summarize") {
      const { allowed } = aiLimiter.check(`reading-list-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { url } = body
      if (!url) throw new ApiError("url required", 400)

      // Fetch article content
      let articleText = ""
      try {
        const resp = await fetchWithTimeout(url, 10000)
        const html = await resp.text()
        // Strip HTML tags, collapse whitespace
        articleText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 8000)
      } catch {
        throw new ApiError("Failed to fetch article content", 502)
      }

      if (!articleText || articleText.length < 100) {
        throw new ApiError("Article content too short to summarize", 400)
      }

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `Summarize this article in 3-5 clear, informative sentences. Focus on the main points and key takeaways. Do not start with "This article" or similar phrases.

Article content:
${articleText}

Provide just the summary, no extra commentary.`

      const result = await model.generateContent(prompt)
      const summary = result.response.text().trim()
      return NextResponse.json({ ok: true, data: { summary } })
    }

    if (action === "suggest-tags") {
      const { allowed } = aiLimiter.check(`reading-list-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { title, description } = body
      if (!title) throw new ApiError("title required", 400)

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `Given this article title and description, suggest 3-5 relevant tags (single words or short phrases).

Title: ${title}
Description: ${description ?? ""}

Return only a JSON array of strings: ["tag1", "tag2", "tag3"]`
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json\n?/g,"").replace(/```\n?/g,"").trim()
      const tags = JSON.parse(text)
      return NextResponse.json({ ok: true, data: { tags } })
    }

    if (action === "readwise-import") {
      const { allowed } = limiter.check(`reading-list:${uid}`)
      if (!allowed) throw new ApiError("Too many requests", 429)
      const { token } = body
      if (!token) throw new ApiError("token required", 400)

      const resp = await fetch("https://readwise.io/api/v2/highlights/?page_size=100", {
        headers: { "Authorization": `Token ${token}` },
      })
      if (!resp.ok) throw new ApiError(`Readwise API error: ${resp.status}`, 502)
      const data = await resp.json()
      return NextResponse.json({ ok: true, data: data.results ?? [] })
    }

    const { allowed } = limiter.check(`reading-list:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}
