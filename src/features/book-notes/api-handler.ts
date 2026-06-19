import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import type { AISummary, Flashcard } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`book-notes:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action, bookTitle, bookAuthor, highlights } = body

    if (!action) throw new ApiError("action required", 400)
    if (!Array.isArray(highlights) || highlights.length === 0) {
      throw new ApiError("highlights array required", 400)
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

    const highlightsText = highlights
      .map((h: { text: string; page?: number; note?: string }, i: number) =>
        `${i + 1}. "${h.text}"${h.page ? ` (p.${h.page})` : ""}${h.note ? ` — Note: ${h.note}` : ""}`
      )
      .join("\n")

    if (action === "generate-summary") {
      const prompt = `You are a book analysis assistant. Analyze the following highlights from "${bookTitle}" by ${bookAuthor ?? "Unknown"}.

Highlights:
${highlightsText}

Return a JSON object with exactly this structure:
{
  "keyThemes": ["theme 1", "theme 2", "theme 3"],
  "mainArguments": ["argument 1", "argument 2", "argument 3"],
  "actionItems": ["action 1", "action 2", "action 3"],
  "topQuotes": ["exact quote 1", "exact quote 2", "exact quote 3"]
}

Be concise. keyThemes and mainArguments should be 1-2 sentences each. actionItems should be specific and actionable. topQuotes should be exact quotes from the highlights. Return only valid JSON.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new ApiError("AI returned invalid response", 500)
      const parsed = JSON.parse(jsonMatch[0]) as Omit<AISummary, "generatedAt">
      const summary: AISummary = { ...parsed, generatedAt: new Date().toISOString() }
      return NextResponse.json({ summary })
    }

    if (action === "generate-flashcards") {
      const { bookId } = body
      if (!bookId) throw new ApiError("bookId required", 400)

      const prompt = `You are a learning assistant. Create flashcard Q&A pairs from these highlights from "${bookTitle}" by ${bookAuthor ?? "Unknown"}.

Highlights:
${highlightsText}

Generate up to ${Math.min(highlights.length * 2, 20)} flashcards. Return a JSON array:
[
  { "question": "What is...", "answer": "..." },
  ...
]

Make questions specific and testable. Answers should be concise (1-3 sentences). Return only valid JSON array.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new ApiError("AI returned invalid response", 500)
      const pairs = JSON.parse(jsonMatch[0]) as { question: string; answer: string }[]
      const now = new Date().toISOString()
      const flashcards: Flashcard[] = pairs.map((p) => ({
        id: crypto.randomUUID(),
        bookId,
        question: p.question,
        answer: p.answer,
        dueDate: now,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        createdAt: now,
      }))
      return NextResponse.json({ flashcards })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
