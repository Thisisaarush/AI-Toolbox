import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateCommitMessage } from "@/lib/ai"
import { db } from "@/lib/db"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"

const limiter = rateLimit({ max: 30, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const { allowed, remaining } = limiter.check(`commit-craft:${ip}`)
    if (!allowed) throw new ApiError("Too many requests. Try again later.", 429)

    const { diff } = await req.json()
    if (!diff || typeof diff !== "string") {
      throw new ApiError("Diff is required", 400)
    }

    const result = await generateCommitMessage(diff)

    try {
      const prisma = db()
      if (prisma) {
        const user = await prisma.user.findUnique({ where: { clerkId: userId } })
        if (user) {
          await prisma.commitMessage.create({
            data: {
              userId: user.id,
              diff,
              message: result.message,
              type: result.type,
              scope: result.scope,
            },
          })
        }
      }
    } catch {
      // DB not available — skip saving
    }

    logger.info("commit-craft: generated", { userId, type: result.type })

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    })
  } catch (err) {
    return handleApiError(err)
  }
}
