import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import type { GitHubRepo } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`job-tracker:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "generate-cover-letter") {
      const { jobDescription, company, role, resumeText, portfolioItems, notes } = body
      if (!company || !role) throw new ApiError("company and role required", 400)

      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

      const prompt = `You are an expert cover letter writer. Write a compelling, personalized cover letter for the following job application.

Company: ${company}
Role: ${role}
${jobDescription ? `Job Description:\n${jobDescription}` : ""}
${resumeText ? `\nCandidate's Resume/Background:\n${resumeText}` : ""}
${portfolioItems?.length ? `\nPortfolio / GitHub Projects:\n${portfolioItems.join(", ")}` : ""}
${notes ? `\nAdditional Notes:\n${notes}` : ""}

Write a professional cover letter that:
1. Opens with a compelling hook
2. Highlights relevant experience matching the role
3. Shows genuine enthusiasm for the company
4. Includes specific examples where possible
5. Has a strong call to action close
6. Is 3-4 paragraphs, ~300-400 words

Write only the cover letter body (no "Dear Hiring Manager" prefix needed — start with the opening paragraph).`

      const result = await model.generateContent(prompt)
      const coverLetter = result.response.text()
      return NextResponse.json({ coverLetter })
    }

    if (action === "github-repos") {
      const { username } = body
      if (!username) throw new ApiError("username required", 400)

      const res = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=10`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      )
      if (!res.ok) throw new ApiError("GitHub user not found or API error", 404)
      const repos = await res.json() as GitHubRepo[]
      return NextResponse.json({ repos })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
