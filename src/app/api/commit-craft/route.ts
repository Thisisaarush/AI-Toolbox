import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateCommitMessage } from "@/lib/ai"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { diff } = await req.json()
  if (!diff || typeof diff !== "string") {
    return NextResponse.json({ error: "Diff is required" }, { status: 400 })
  }

  const result = await generateCommitMessage(diff)

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

  return NextResponse.json(result)
}
