import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserId } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const prisma = db()
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const { formId, title, formData } = await req.json()
    if (!formId || !formData) return NextResponse.json({ error: "formId and formData required" }, { status: 400 })

    const existing = await prisma.publishedForm.findUnique({ where: { formId } })
    if (existing) {
      if (existing.userId !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const updated = await prisma.publishedForm.update({
        where: { formId },
        data: { title: title ?? "Untitled Form", formData, updatedAt: new Date() },
      })
      return NextResponse.json({ published: true, form: updated })
    }

    const published = await prisma.publishedForm.create({
      data: { formId, userId, title: title ?? "Untitled Form", formData },
    })
    return NextResponse.json({ published: true, form: published })
  } catch (err) {
    console.error("Publish error:", err)
    return NextResponse.json({ error: "Failed to publish form" }, { status: 500 })
  }
}
