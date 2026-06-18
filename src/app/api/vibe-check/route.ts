import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { generateVibePoster } from "@/lib/ai"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { description, playlistUrl } = await req.json()
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Description is required" }, { status: 400 })
  }

  const posterUrl = await generateVibePoster(description)

  const prisma = db()
  if (prisma) {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } })
    if (user) {
      await prisma.vibeCheck.create({
        data: {
          userId: user.id,
          description,
          playlistUrl,
          posterUrl,
        },
      })
    }
  }

  return NextResponse.json({ posterUrl })
}
