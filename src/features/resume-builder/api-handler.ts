import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { Resume } from "./types"

const limiter = rateLimit({ max: 30, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 10, windowMs: 60000 })

async function geminiText(req: Request, prompt: string): Promise<string> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function geminiJSON(req: Request, prompt: string): Promise<unknown> {
  const text = await geminiText(req, prompt)
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  return JSON.parse(cleaned)
}

function resumeToText(resume: Resume): string {
  const lines: string[] = [
    `Name: ${resume.fullName}`,
    `Email: ${resume.email}`,
    `Phone: ${resume.phone}`,
    `Location: ${resume.location}`,
  ]
  if (resume.summary) lines.push(`\nSummary:\n${resume.summary}`)
  if (resume.experience.length) {
    lines.push("\nExperience:")
    for (const exp of resume.experience) {
      lines.push(`  ${exp.role} at ${exp.company} (${exp.startDate} – ${exp.current ? "Present" : exp.endDate})`)
      for (const b of exp.bullets) lines.push(`    • ${b}`)
    }
  }
  if (resume.education.length) {
    lines.push("\nEducation:")
    for (const edu of resume.education) {
      lines.push(`  ${edu.degree} in ${edu.field} — ${edu.institution} (${edu.startDate}–${edu.endDate})`)
      if (edu.gpa) lines.push(`    GPA: ${edu.gpa}`)
    }
  }
  if (resume.skills.length) lines.push(`\nSkills: ${resume.skills.join(", ")}`)
  if (resume.projects.length) {
    lines.push("\nProjects:")
    for (const p of resume.projects) {
      lines.push(`  ${p.name}: ${p.description}`)
      if (p.tech.length) lines.push(`    Tech: ${p.tech.join(", ")}`)
      for (const b of p.bullets) lines.push(`    • ${b}`)
    }
  }
  if (resume.certifications.length) {
    lines.push("\nCertifications:")
    for (const c of resume.certifications) {
      lines.push(`  ${c.name} — ${c.issuer} (${c.date})`)
    }
  }
  return lines.join("\n")
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`resume-builder:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    // ── analyze-ats ─────────────────────────────────────────────────────────
    if (action === "analyze-ats") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const resume = body.resume as Resume
      const jobDescription = (body.jobDescription as string | undefined) ?? ""
      if (!resume) throw new ApiError("resume required", 400)

      const prompt = `You are an expert ATS (Applicant Tracking System) analyst. Analyze this resume and return a detailed ATS score.

Resume:
${resumeToText(resume)}

${jobDescription ? `Job Description:\n${jobDescription}` : "No job description provided — set jobMatch to 0."}

Return ONLY valid JSON matching this exact shape:
{
  "overall": <0-100 integer>,
  "breakdown": {
    "atsReadability": <0-25>,
    "contentQuality": <0-35>,
    "writingQuality": <0-10>,
    "jobMatch": <0-25 — must be 0 if no job description provided>,
    "applicationReady": <0-5>
  },
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "improvements": ["improvement 1", "improvement 2", "improvement 3"],
  "missingKeywords": ["keyword1", "keyword2"],
  "recommendedBulletRewrites": [
    { "original": "original bullet text", "rewritten": "stronger rewritten version" }
  ]
}

Rules:
- overall = sum of all breakdown scores
- atsReadability: formatting, standard section headers, no tables/columns/graphics, readable fonts
- contentQuality: quantified achievements, action verbs, relevant content depth
- writingQuality: grammar, spelling, conciseness, active voice
- jobMatch: keyword overlap with job description (0 if no JD)
- applicationReady: contact info completeness, file-ready status
- Provide 2-4 strengths, 2-4 improvements, up to 5 missing keywords, up to 3 bullet rewrites
- JSON only, no markdown`

      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    // ── tailor-resume ────────────────────────────────────────────────────────
    if (action === "tailor-resume") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const resume = body.resume as Resume
      const jobDescription = body.jobDescription as string
      if (!resume) throw new ApiError("resume required", 400)
      if (!jobDescription?.trim()) throw new ApiError("jobDescription required", 400)

      const expBulletsJson = resume.experience.map((exp) => ({
        itemId: exp.id,
        company: exp.company,
        role: exp.role,
        bullets: exp.bullets.map((b, i) => ({ index: i, text: b })),
      }))

      const prompt = `You are an expert resume writer. Tailor this resume to match the job description.

Resume:
${resumeToText(resume)}

Job Description:
${jobDescription}

Return ONLY valid JSON:
{
  "tailoredBullets": [
    {
      "section": "experience",
      "itemId": "<experience id from input>",
      "bulletIndex": <0-based index>,
      "original": "<original bullet text>",
      "rewritten": "<tailored version with job-relevant keywords>"
    }
  ],
  "suggestedSkills": ["skill1", "skill2"],
  "tailoredSummary": "<rewritten summary targeting this specific job>"
}

Experience entries to consider rewriting:
${JSON.stringify(expBulletsJson, null, 2)}

Rules:
- Only include bullets that meaningfully benefit from rewriting (2-6 bullets total)
- suggestedSkills: keywords from JD missing from current skills list (up to 8)
- tailoredSummary: 3-4 sentences, incorporate key JD keywords naturally
- Keep rewrites truthful — enhance, don't fabricate
- JSON only, no markdown`

      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    // ── generate-cover-letter ────────────────────────────────────────────────
    if (action === "generate-cover-letter") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const resume = body.resume as Resume
      const jobDescription = body.jobDescription as string
      if (!resume) throw new ApiError("resume required", 400)
      if (!jobDescription?.trim()) throw new ApiError("jobDescription required", 400)

      const prompt = `You are an expert cover letter writer. Write a compelling, personalized cover letter.

Candidate's Resume:
${resumeToText(resume)}

Job Description:
${jobDescription}

Write a professional cover letter that:
1. Opens with a compelling hook that references the specific company/role
2. Highlights 2-3 most relevant experiences from the resume that match the job
3. Shows genuine enthusiasm with specific reasons
4. Closes with a confident call to action
5. Is 3-4 paragraphs, 300-400 words total

Start directly with the opening paragraph. Do not include "Dear Hiring Manager" or date headers.
Write only the letter body.`

      const coverLetter = await geminiText(req, prompt)
      return NextResponse.json({ ok: true, coverLetter })
    }

    // ── rewrite-bullet ───────────────────────────────────────────────────────
    if (action === "rewrite-bullet") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const bullet = body.bullet as string
      const roleContext = (body.roleContext as string | undefined) ?? ""
      if (!bullet?.trim()) throw new ApiError("bullet required", 400)

      const prompt = `You are an expert resume writer. Rewrite this resume bullet point in 3 different ways.

Original bullet: "${bullet}"
${roleContext ? `Role context: ${roleContext}` : ""}

Return ONLY valid JSON:
{
  "conservative": "<minimal improvements: fix grammar, strengthen verb, add one metric if possible>",
  "moderate": "<clear improvement: strong action verb, quantified impact, specific result>",
  "aggressive": "<maximum impact: powerful framing, compelling metric, clear business value — still truthful>"
}

Rules:
- All 3 versions must be plausible improvements of the original (don't fabricate specific numbers unless generic like 20%/30%)
- Each version should start with a strong action verb
- conservative: ~same length, just stronger phrasing
- moderate: adds one concrete result or metric
- aggressive: reframes for maximum impact with scope and outcome
- JSON only, no markdown`

      const data = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, data })
    }

    // ── generate-summary ─────────────────────────────────────────────────────
    if (action === "generate-summary") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const resume = body.resume as Resume
      if (!resume) throw new ApiError("resume required", 400)

      const expSummary = resume.experience.slice(0, 3).map(
        (e) => `${e.role} at ${e.company}`
      ).join(", ")

      const prompt = `Write a professional resume summary for this candidate.

Experience: ${expSummary || "Not specified"}
Skills: ${resume.skills.slice(0, 10).join(", ") || "Not specified"}
Name: ${resume.fullName || "the candidate"}

Write a concise 3-sentence professional summary:
- Sentence 1: Years of experience, domain, key expertise
- Sentence 2: Top 2-3 skills or achievements
- Sentence 3: Value proposition / what they bring to a new role

Output ONLY the summary text, no JSON, no labels.`

      const summary = await geminiText(req, prompt)
      return NextResponse.json({ ok: true, summary: summary.trim() })
    }

    // ── parse-resume ─────────────────────────────────────────────────────────
    if (action === "parse-resume") {
      const { allowed: aiOk } = aiLimiter.check(`resume-builder-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const base64 = body.base64 as string | undefined
      if (!base64) throw new ApiError("base64 required", 400)

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      const result = await model.generateContent([
        { text: `Extract all resume information from this PDF and return ONLY valid JSON matching this shape:
{
  "fullName": "",
  "email": "",
  "phone": "",
  "location": "",
  "linkedin": "",
  "github": "",
  "website": "",
  "summary": "",
  "experience": [
    { "company": "", "role": "", "location": "", "startDate": "", "endDate": "", "current": false, "bullets": [""] }
  ],
  "education": [
    { "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" }
  ],
  "skills": [""],
  "projects": [
    { "name": "", "description": "", "bullets": [""], "url": "", "tech": [""] }
  ],
  "certifications": [
    { "name": "", "issuer": "", "date": "" }
  ]
}
Rules:
- Extract ALL information faithfully — do not invent details
- If a field is missing from the PDF, use empty string or empty array as appropriate
- dates: keep original format (e.g. "Jan 2020" or "2020-01")
- skills: list all technical and soft skills mentioned
- bullets: extract each bullet point as a separate string
- JSON only, no markdown, no explanation` },
        { inlineData: { data: base64, mimeType: "application/pdf" } },
      ])
      const text = result.response.text()
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      const data = JSON.parse(cleaned) as Record<string, unknown>

      const resume: Resume = {
        id: "",
        name: `${data.fullName ?? "Uploaded"} Resume`,
        fullName: (data.fullName as string) ?? "",
        email: (data.email as string) ?? "",
        phone: (data.phone as string) ?? "",
        location: (data.location as string) ?? "",
        linkedin: (data.linkedin as string) ?? "",
        github: (data.github as string) ?? "",
        website: (data.website as string) ?? "",
        summary: (data.summary as string) ?? "",
        experience: Array.isArray(data.experience) ? data.experience as Resume["experience"] : [],
        education: Array.isArray(data.education) ? data.education as Resume["education"] : [],
        skills: Array.isArray(data.skills) ? data.skills as string[] : [],
        projects: Array.isArray(data.projects) ? data.projects as Resume["projects"] : [],
        certifications: Array.isArray(data.certifications) ? data.certifications as Resume["certifications"] : [],
        template: "modern",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      return NextResponse.json({ ok: true, resume })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
