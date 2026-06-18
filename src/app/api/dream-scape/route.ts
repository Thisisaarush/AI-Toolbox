import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { analyzeDream, generateDreamImage } from "@/lib/ai"
import { db } from "@/lib/db"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { content } = await req.json()
  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "Dream content is required" }, { status: 400 })
  }

  const [analysis, imageUrl] = await Promise.all([
    analyzeDream(content),
    generateDreamImage(content),
  ])

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

  return NextResponse.json({ analysis, imageUrl })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
}
