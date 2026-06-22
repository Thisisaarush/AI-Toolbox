import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"
import type { IdeaAnalysis } from "./types"

const aiLimiter = rateLimit({ max: 5, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = aiLimiter.check(`idea-sniper:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Rate limit: 5 analyses per minute", 429)

    const body = await req.json()
    const { action, idea } = body

    // ── search-real ───────────────────────────────────────────────────────────
    if (action === "search-real") {
      const { query } = body
      if (!query?.trim()) throw new ApiError("query required", 400)

      const encoded = encodeURIComponent(query as string)

      const [commentsRes, storiesRes] = await Promise.all([
        fetch(
          `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=comment&hitsPerPage=10`,
          { headers: { Accept: "application/json" } }
        ),
        fetch(
          `https://hn.algolia.com/api/v1/search?query=${encoded}&tags=story&hitsPerPage=5`,
          { headers: { Accept: "application/json" } }
        ),
      ])

      if (!commentsRes.ok || !storiesRes.ok) {
        throw new ApiError("HN Algolia API error", 502)
      }

      type HNCommentHit = {
        objectID: string
        comment_text?: string
        author?: string
        story_url?: string
        points?: number
        created_at?: string
      }
      type HNStoryHit = {
        objectID: string
        title?: string
        url?: string
        story_url?: string
        points?: number
        num_comments?: number
      }
      type HNResponse<T> = { hits: T[] }

      const commentsData: HNResponse<HNCommentHit> = await commentsRes.json()
      const storiesData: HNResponse<HNStoryHit> = await storiesRes.json()

      const hnComments = commentsData.hits
        .filter((h) => h.comment_text)
        .map((h) => ({
          text: (h.comment_text ?? "").replace(/<[^>]*>/g, "").slice(0, 500),
          author: h.author ?? "unknown",
          url: `https://news.ycombinator.com/item?id=${h.objectID}`,
          points: h.points ?? 0,
          createdAt: h.created_at ?? "",
        }))

      const hnStories = storiesData.hits.map((h) => ({
        title: h.title ?? "",
        url: h.url ?? h.story_url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points ?? 0,
        numComments: h.num_comments ?? 0,
      }))

      return NextResponse.json({ ok: true, hnComments, hnStories })
    }

    if (action !== "analyze") throw new ApiError(`Unknown action: ${action}`, 400)
    if (!idea?.trim()) throw new ApiError("idea required", 400)

    const key = getGeminiKey(req)

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `You are a startup market research analyst with deep knowledge of online communities, Reddit, Hacker News, and indie maker spaces.

Analyze this startup idea and return a comprehensive market research report:

IDEA: "${idea}"

Return a single JSON object with EXACTLY this structure:
{
  "idea": "string (the idea as stated)",
  "painScore": number (1-10, how acute and real the pain is),
  "painScoreReasoning": "string (2-3 sentences explaining the score)",
  "searchQueries": [
    "string (5-8 search queries someone would use to find this pain on Reddit/HN, e.g. 'site:reddit.com I wish there was a way to manage')"
  ],
  "communitySignals": [
    {
      "platform": "Reddit/r/entrepreneur or HN or Twitter",
      "simulatedQuote": "string (AI-synthesized example of what someone would post about this pain - make it realistic, 1-3 sentences)",
      "sentiment": "frustrated | desperate | curious"
    }
  ],
  "personas": [
    {
      "jobTitle": "string",
      "context": "string (specific situation where they have this pain)",
      "frequency": "daily | weekly | monthly",
      "workaround": "string (what they currently do)",
      "willingToPay": "string (realistic price range and reasoning)"
    }
  ],
  "competitors": [
    {
      "name": "string",
      "description": "string (one sentence)",
      "pros": ["string"],
      "cons": ["string"],
      "pricing": "string"
    }
  ],
  "competitionStrength": "weak | moderate | strong | very-strong (assess the overall competitive landscape density)",
  "verdict": "go | no-go | pivot",
  "verdictReasoning": "string (3-5 sentences with specific reasoning)",
  "whereTofindCustomers": [
    {
      "type": "subreddit | slack | discord | forum | community",
      "name": "string",
      "link": "string (URL or handle)"
    }
  ],
  "exactLanguage": [
    "string (exact phrase people use when describing this pain, useful for landing page copy)"
  ],
  "outreachMessage": "string (copy-paste Reddit/community DM to find potential users, 100-150 words)",
  "tamEstimate": {
    "addressableUniverse": "string (e.g. '~2.5M developers in the US who regularly write backend APIs')",
    "avgWillingnessToPay": number (monthly USD average across personas, e.g. 25),
    "annualTam": "string (pre-formatted, e.g. '$750M' — calculated as universe count * avgWTP * 12, show your work in reasoning)",
    "reasoning": "string (2-3 sentences explaining the TAM calculation assumptions)"
  },
  "pivotSuggestions": [
    {
      "angle": "string (the pivot idea in one sentence)",
      "reasoning": "string (why this pivot addresses the core weakness)",
      "targetAudience": "string (who this pivot targets)"
    }
  ],
  "relatedIdeas": [
    "string (5 adjacent idea angles — not the same idea, but related problems or variations the user could analyze next)"
  ]
}

Rules:
- communitySignals must have 4-6 items clearly labeled as AI-SYNTHESIZED
- personas must have 3-4 items
- competitors must have 3-5 known tools (include well-known ones even if imperfect alternatives)
- exactLanguage must have 6-8 phrases
- whereTofindCustomers must have 5-8 communities
- pivotSuggestions must have exactly 3 items (always include regardless of verdict — they're always useful)
- relatedIdeas must have exactly 5 items
- tamEstimate.annualTam = addressable universe number * avgWillingnessToPay * 12, formatted as currency string
- Be brutally honest about go/no-go - don't sugarcoat
- competitionStrength: "weak" means few/poor alternatives, "very-strong" means highly saturated market
- Only return valid JSON, no markdown`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const analysis: IdeaAnalysis = JSON.parse(text)
      return NextResponse.json({ ok: true, analysis })
    } catch {
      const fallback: IdeaAnalysis = {
        idea,
        painScore: 5,
        painScoreReasoning: "Unable to analyze at this time. Please try again.",
        searchQueries: [`site:reddit.com "${idea}"`, `"I wish there was" ${idea}`],
        communitySignals: [{ platform: "Reddit (AI-synthesized)", simulatedQuote: `"I've been struggling with exactly this problem for months. Can't believe there's no good solution."`, sentiment: "frustrated" }],
        personas: [{ jobTitle: "Developer", context: "Regular workflow", frequency: "weekly", workaround: "Manual process", willingToPay: "$10-50/mo" }],
        competitors: [{ name: "Generic Competitor", description: "Partial solution", pros: ["Established"], cons: ["Missing key features"], pricing: "Unknown" }],
        competitionStrength: "moderate",
        verdict: "go",
        verdictReasoning: "Could not complete full analysis. Try again with more specific idea description.",
        whereTofindCustomers: [{ type: "subreddit", name: "r/entrepreneur", link: "https://reddit.com/r/entrepreneur" }],
        exactLanguage: ["I can't find a good way to...", "Why is there no tool for..."],
        outreachMessage: `Hi! I'm building a solution for [problem]. Would love to chat for 10 minutes about your experience with [pain point]. No pitch, just research. DM me if interested!`,
        tamEstimate: {
          addressableUniverse: "~1M potential users",
          avgWillingnessToPay: 20,
          annualTam: "$240M",
          reasoning: "Rough estimate based on typical market size for this problem space. Re-run for more accurate analysis.",
        },
        pivotSuggestions: [
          { angle: "Narrow to a specific vertical", reasoning: "A focused niche has less competition and clearer buyers", targetAudience: "Enterprise teams in one industry" },
          { angle: "Solve an adjacent problem with less competition", reasoning: "Related pain point with fewer existing solutions", targetAudience: "Same audience, different workflow" },
          { angle: "Build a workflow integration instead", reasoning: "Embedding into existing tools reduces friction to adoption", targetAudience: "Users of popular platforms in this space" },
        ],
        relatedIdeas: [
          "Automated testing tool for this domain",
          "Analytics dashboard for this use case",
          "AI-assisted version of a manual workflow in this space",
          "Collaboration tool for teams dealing with this pain",
          "API or SDK that solves the underlying technical problem",
        ],
      }
      return NextResponse.json({ ok: true, analysis: fallback })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
