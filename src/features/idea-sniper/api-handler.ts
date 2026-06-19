import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { IdeaAnalysis } from "./types"

const aiLimiter = rateLimit({ max: 5, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = aiLimiter.check(`idea-sniper:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Rate limit: 5 analyses per minute", 429)

    const body = await req.json()
    const { action, idea } = body
    if (action !== "analyze") throw new ApiError(`Unknown action: ${action}`, 400)
    if (!idea?.trim()) throw new ApiError("idea required", 400)

    const key = process.env.GEMINI_API_KEY
    if (!key) throw new ApiError("AI not configured", 503)

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
  "outreachMessage": "string (copy-paste Reddit/community DM to find potential users, 100-150 words)"
}

Rules:
- communitySignals must have 4-6 items clearly labeled as AI-SYNTHESIZED
- personas must have 3-4 items
- competitors must have 3-5 known tools (include well-known ones even if imperfect alternatives)
- exactLanguage must have 6-8 phrases
- whereTofindCustomers must have 5-8 communities
- Be brutally honest about go/no-go - don't sugarcoat
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
        verdict: "go",
        verdictReasoning: "Could not complete full analysis. Try again with more specific idea description.",
        whereTofindCustomers: [{ type: "subreddit", name: "r/entrepreneur", link: "https://reddit.com/r/entrepreneur" }],
        exactLanguage: ["I can't find a good way to...", "Why is there no tool for..."],
        outreachMessage: `Hi! I'm building a solution for [problem]. Would love to chat for 10 minutes about your experience with [pain point]. No pitch, just research. DM me if interested!`,
      }
      return NextResponse.json({ ok: true, analysis: fallback })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
