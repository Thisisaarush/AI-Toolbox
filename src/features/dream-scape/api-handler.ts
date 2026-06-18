import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { analyzeDream, generateDreamImage } from "@/lib/ai"
import { db } from "@/lib/db"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const { allowed } = limiter.check(`dream-scape:${userId}`)
    if (!allowed) throw new ApiError("Too many requests. Try again later.", 429)

    const { content } = await req.json()
    if (!content || typeof content !== "string") {
      throw new ApiError("Dream content is required", 400)
    }

    const [analysis, imageUrl] = await Promise.all([
      analyzeDream(content),
      generateDreamImage(content),
    ])

    try {
      const prisma = db()
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } })
        if (user) {
          await prisma.dream.create({
            data: {
              userId: user.id,
              content,
              analysis,
              imageUrl,
            },
          })
        }
      }
    } catch {
      // DB not available — skip saving
    }

    logger.info("dream-scape: analyzed", { userId })

    return NextResponse.json({ analysis, imageUrl })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    try {
      const prisma = db()
      if (!prisma) {
        return NextResponse.json({ dreams: [] })
      }

      const user = await prisma.user.findUnique({ where: { clerkId: userId } })
      if (!user) {
        return NextResponse.json({ dreams: [] })
      }

      const dreams = await prisma.dream.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      })

      return NextResponse.json({ dreams })
    } catch {
      return NextResponse.json({ dreams: [] })
    }
  } catch (err) {
    return handleApiError(err)
  }
}
