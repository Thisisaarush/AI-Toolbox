import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { LaunchInput, LaunchOutput } from "./types"

const aiLimiter = rateLimit({ max: 5, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = aiLimiter.check(`launch-pad:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Rate limit: 5 generations per minute", 429)

    const body = await req.json()
    const { action } = body
    if (action !== "generate") throw new ApiError(`Unknown action: ${action}`, 400)

    const input: LaunchInput = body.input
    if (!input?.productName) throw new ApiError("productName required", 400)

    const key = process.env.GEMINI_API_KEY
    if (!key) throw new ApiError("AI not configured", 503)

    const genAI = new GoogleGenerativeAI(key)
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const toneGuide = {
      professional: "Use polished, business-appropriate language. Avoid hype.",
      casual: "Be friendly, conversational, like talking to a friend. Use 'you' and 'we'.",
      technical: "Lead with technical details. Assume a developer audience. Be precise.",
      excited: "High energy! Use exclamation points (sparingly). Show genuine enthusiasm.",
    }[input.tone] ?? ""

    const prompt = `You are a startup launch copywriter. Generate launch copy for ALL 5 platforms at once.

Product: ${input.productName}
Tagline: ${input.tagline}
What it does: ${input.description}
Who it's for: ${input.targetAudience}
Key features: ${input.keyFeatures.filter(Boolean).join(", ")}
Tech stack: ${input.techStack || "Not specified"}
URL: ${input.launchUrl}
Tone guide: ${toneGuide}

Return a single JSON object with this exact structure:
{
  "productHunt": {
    "name": "product name (exact)",
    "tagline": "max 60 chars, punchy, present tense, no period",
    "description": "max 260 chars, what it does + who for + key benefit",
    "firstComment": "founder's first comment, 200-300 words, genuine, explains the story behind building it, mentions key features naturally, ends with call to action"
  },
  "hackerNews": {
    "title": "Show HN: [Name] – [one-liner description]",
    "body": "150-250 words. Honest, no marketing speak. Why you built it, technical approach briefly, what problems it solves, current state (alpha/beta/launched). End with what feedback you're looking for."
  },
  "tweetThread": [
    "Hook tweet [1/N] - grabs attention, states the problem or opportunity",
    "Tweet 2 [2/N] - expand on the problem",
    "Tweet 3 [3/N] - introduce the solution",
    "Tweet 4 [4/N] - key feature 1 with specific detail",
    "Tweet 5 [5/N] - key feature 2 or social proof",
    "CTA tweet [6/N] - link + call to action"
  ],
  "reddit": {
    "title": "I built [name] - [what it does] (with URL)",
    "body": "200-300 words. Genuine r/SideProject tone. Tell the story: what prompted you to build it, what you learned, what it does. NOT salesy. End with asking for feedback. Include the URL naturally."
  },
  "coldEmail": {
    "subject": "compelling subject line, personalized, max 50 chars",
    "body": "Hi [Name],\\n\\n[3-4 short paragraphs: hook with their specific pain, introduce solution briefly, one concrete result/feature, CTA]\\n\\nBest,\\n[Your name]\\n\\nP.S. [relevant postscript]"
  }
}

IMPORTANT:
- Each tweet must be under 280 characters including the [X/N] label
- Make all copy specific to THIS product, not generic
- Only return valid JSON, no markdown fences`

    try {
      const result = await model.generateContent(prompt)
      const text = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const output: LaunchOutput = JSON.parse(text)
      return NextResponse.json({ ok: true, output })
    } catch {
      // Fallback structure
      const fallback: LaunchOutput = {
        productHunt: {
          name: input.productName,
          tagline: input.tagline.slice(0, 60),
          description: input.description.slice(0, 260),
          firstComment: `Hey Product Hunt! I'm the founder of ${input.productName}. ${input.description} Built this to help ${input.targetAudience}. Would love your feedback!`,
        },
        hackerNews: {
          title: `Show HN: ${input.productName} – ${input.tagline}`,
          body: `${input.description}\n\nBuilt for ${input.targetAudience}.\n\nURL: ${input.launchUrl}\n\nLooking for feedback from the HN community.`,
        },
        tweetThread: [
          `[1/5] ${input.tagline} — introducing ${input.productName}`,
          `[2/5] The problem: ${input.description}`,
          `[3/5] Key features: ${input.keyFeatures.filter(Boolean).join(", ")}`,
          `[4/5] Built for: ${input.targetAudience}`,
          `[5/5] Try it free → ${input.launchUrl}`,
        ],
        reddit: {
          title: `I built ${input.productName} – ${input.tagline}`,
          body: `${input.description}\n\nBuilt for ${input.targetAudience}.\n\n${input.launchUrl}\n\nWould love feedback!`,
        },
        coldEmail: {
          subject: `${input.productName} for ${input.targetAudience}`,
          body: `Hi [Name],\n\n${input.description}\n\nCheck it out at ${input.launchUrl}\n\nBest,\n[Your name]`,
        },
      }
      return NextResponse.json({ ok: true, output: fallback })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
