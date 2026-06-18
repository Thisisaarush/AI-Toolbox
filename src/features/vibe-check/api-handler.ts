import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateVibePoster } from "@/lib/ai"
import { db } from "@/lib/db"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const { allowed } = limiter.check(`vibe-check:${ip}`)
    if (!allowed) throw new ApiError("Too many requests. Try again later.", 429)

    const { description, playlistUrl } = await req.json()
    if (!description || typeof description !== "string") {
      throw new ApiError("Description is required", 400)
    }

    const posterUrl = await generateVibePoster(description)

    try {
      const prisma = db()
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } })
        if (user) {
          await prisma.vibeCheck.create({
            data: {
              userId: user.id,
              description,
              playlistUrl: playlistUrl ?? null,
              posterUrl,
            },
          })
        }
      }
    } catch {
      // DB not available — skip saving, still return the poster
    }

    if (!posterUrl) {
      return NextResponse.json(
        { posterUrl: null, warning: "Image generation unavailable. Set OPENAI_API_KEY (DALL-E) or upgrade your Gemini plan for Imagen." },
      )
    }

    return NextResponse.json({ posterUrl })
  } catch (err) {
    return handleApiError(err)
  }
}
