import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"

const limiter = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 5, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const body = await req.json()
    const { action } = body

    if (action === "fetch-og") {
      const { allowed } = limiter.check(`og-craft:${uid}:${ip}`)
      if (!allowed) throw new ApiError("Too many requests", 429)
      const { url } = body
      if (!url) throw new ApiError("url required", 400)

      let targetUrl = url
      if (!targetUrl.startsWith("http")) targetUrl = "https://" + targetUrl

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)
        const response = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OGCrawler/1.0)",
            "Accept": "text/html",
          },
        })
        clearTimeout(timeout)
        const html = await response.text()

        function extractMeta(property: string): string {
          const patterns = [
            new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
            new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, "i"),
          ]
          for (const re of patterns) {
            const m = html.match(re)
            if (m?.[1]) return m[1].trim()
          }
          return ""
        }

        function extractTitle(): string {
          const og = extractMeta("og:title")
          if (og) return og
          const m = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          return m?.[1]?.trim() ?? ""
        }

        const faviconMatch = html.match(/href=["']([^"']*(?:favicon|icon)[^"']*\.(ico|png|svg))["']/i)
        const faviconPath = faviconMatch?.[1] ?? "/favicon.ico"
        const base = new URL(targetUrl)
        const favicon = faviconPath.startsWith("http") ? faviconPath : `${base.origin}${faviconPath.startsWith("/") ? "" : "/"}${faviconPath}`

        const ogData = {
          url: targetUrl,
          title: extractTitle(),
          description: extractMeta("og:description") || extractMeta("description"),
          image: extractMeta("og:image"),
          siteName: extractMeta("og:site_name") || base.hostname,
          twitterCard: extractMeta("twitter:card"),
          twitterTitle: extractMeta("twitter:title"),
          twitterDescription: extractMeta("twitter:description"),
          twitterImage: extractMeta("twitter:image"),
          favicon,
          ogType: extractMeta("og:type"),
          ogUrl: extractMeta("og:url"),
          fetchedAt: new Date().toISOString(),
        }

        return NextResponse.json({ ok: true, ogData })
      } catch (fetchErr: unknown) {
        const msg = fetchErr instanceof Error ? fetchErr.message : "Fetch failed"
        throw new ApiError(`Could not fetch URL: ${msg}`, 422)
      }
    }

    if (action === "generate-copy") {
      const { allowed } = aiLimiter.check(`og-craft-ai:${uid}:${ip}`)
      if (!allowed) throw new ApiError("AI rate limit exceeded (5/min)", 429)
      const { description } = body
      if (!description) throw new ApiError("description required", 400)
      const key = getGeminiKey(req)

      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const prompt = `You are an SEO and social media expert. Given this product/page description, generate the perfect OG meta copy.

Description: "${description}"

Return JSON:
{
  "ogTitle": "string (max 60 chars, compelling, clear)",
  "ogDescription": "string (max 160 chars, includes value prop + hook)",
  "twitterTitle": "string (max 70 chars)",
  "twitterDescription": "string (max 200 chars)"
}

Only return JSON, no markdown.`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        const data = JSON.parse(text)
        return NextResponse.json({ ok: true, data })
      } catch {
        return NextResponse.json({
          ok: true,
          data: {
            ogTitle: "Your Amazing Product",
            ogDescription: "The tool that helps you get more done. Try it free today.",
            twitterTitle: "Your Amazing Product",
            twitterDescription: "The tool that helps you get more done.",
          },
        })
      }
    }

    if (action === "bulk-generate") {
      const { allowed } = aiLimiter.check(`og-craft-bulk:${uid}:${ip}`)
      if (!allowed) throw new ApiError("AI rate limit exceeded (5/min)", 429)
      const { paths, baseUrl } = body as { paths: string[]; baseUrl: string }
      if (!paths || !Array.isArray(paths) || paths.length === 0) throw new ApiError("paths required", 400)
      if (paths.length > 20) throw new ApiError("Max 20 paths at once", 400)
      if (!baseUrl) throw new ApiError("baseUrl required", 400)

      const key = getGeminiKey(req)

      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

      const prompt = `You are an SEO expert. Generate OG title and description for each page path below.
Base URL: ${baseUrl}
Paths:
${paths.map((p, i) => `${i + 1}. ${p}`).join("\n")}

For each path, infer the page purpose from the URL pattern and generate:
- title: max 60 chars, compelling, specific to that page
- description: max 155 chars, includes value prop

Return JSON array (same order as input):
[
  { "path": "/blog/post-1", "title": "...", "description": "..." },
  ...
]

Only return valid JSON array, no markdown.`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
        const items = JSON.parse(text)
        return NextResponse.json({ ok: true, items })
      } catch {
        // Fallback: generate basic titles from paths
        const items = paths.map((p) => {
          const parts = p.split("/").filter(Boolean)
          const last = parts[parts.length - 1] ?? p
          const title = last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
          return { path: p, title: title.slice(0, 60), description: `Learn more about ${title} on ${baseUrl}`.slice(0, 155) }
        })
        return NextResponse.json({ ok: true, items })
      }
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
