import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { geminiJSON } from "@/lib/gemini"

const limiter   = rateLimit({ max: 20, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 5,  windowMs: 60000 })

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`interview-prep:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const body = await req.json()
    const { action } = body

    if (action === "evaluate") {
      const { allowed } = aiLimiter.check(`interview-prep-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { question, answer, category } = body
      if (!question || !answer) throw new ApiError("question and answer required", 400)
      const prompt = `You are an expert interview coach. Evaluate this interview answer.

Question: "${question}"
Category: ${category ?? "general"}
Answer: "${answer}"

Return JSON:
{
  "strengths": ["strength 1", "strength 2"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "modelAnswer": "An ideal answer in 150-200 words",
  "score": 7
}

Score out of 10. Strengths/weaknesses/suggestions should be specific and actionable. JSON only.`
      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    if (action === "company-research") {
      const { allowed } = aiLimiter.check(`interview-prep-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { company } = body
      if (!company) throw new ApiError("company required", 400)
      const prompt = `You are an interview research expert. Research the interview process for "${company}".

Return JSON:
{
  "format": "Description of typical interview format at this company (e.g., 'Phone screen → 2 technical rounds → system design → bar raiser → team fit')",
  "values": ["value 1", "value 2", "value 3", "value 4", "value 5"],
  "commonQuestions": [
    "Reported interview question 1",
    "Reported interview question 2",
    "Reported interview question 3",
    "Reported interview question 4",
    "Reported interview question 5"
  ],
  "talkingPoints": [
    "Key talking point 1 (e.g., mention their recent product launch)",
    "Key talking point 2",
    "Key talking point 3"
  ]
}

Base on publicly known information about ${company}'s interview process. JSON only.`
      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    if (action === "mock-evaluate") {
      const { allowed } = aiLimiter.check(`interview-prep-ai:${uid}`)
      if (!allowed) throw new ApiError("AI rate limit", 429)
      const { questionsAndAnswers } = body
      if (!Array.isArray(questionsAndAnswers) || questionsAndAnswers.length === 0) {
        throw new ApiError("questionsAndAnswers required", 400)
      }

      const prompt = `You are a senior engineering interviewer. Evaluate these interview answers holistically.

${questionsAndAnswers.map((qa: {question: string; answer: string}, i: number) => `Q${i+1}: ${qa.question}\nA${i+1}: ${qa.answer}`).join("\n\n")}

Return JSON:
{
  "perQuestion": [
    { "score": 7, "strengths": ["..."], "weaknesses": ["..."] }
  ],
  "overallScore": 7,
  "improvementPlan": "A 3-4 sentence actionable improvement plan based on all answers"
}

overallScore out of 10. JSON only.`
      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    const { allowed } = limiter.check(`interview-prep:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)
    return NextResponse.json({ ok: true })
  } catch (err) { return handleApiError(err) }
}
