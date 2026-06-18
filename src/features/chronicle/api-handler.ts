import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateJournalNarrative } from "@/lib/ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const { allowed } = limiter.check(`chronicle:${userId}`)
    if (!allowed) throw new ApiError("Too many requests. Try again later.", 429)

    const { entries } = await req.json()
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new ApiError("At least one journal entry is required", 400)
    }

    const narrative = await generateJournalNarrative(entries)
    if (!narrative) throw new ApiError("Narrative generation unavailable", 503)

    return NextResponse.json({ narrative })
  } catch (err) {
    return handleApiError(err)
  }
}
