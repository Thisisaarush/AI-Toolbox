import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserId } from "@/lib/auth"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserId(req)
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const prisma = db()
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const form = await prisma.publishedForm.findUnique({ where: { formId: id } })
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })
    if (form.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const responses = await prisma.formResponse.findMany({
      where: { formId: id },
      orderBy: { submittedAt: "desc" },
    })

    return NextResponse.json({ responses })
  } catch (err) {
    console.error("Get responses error:", err)
    return NextResponse.json({ error: "Failed to get responses" }, { status: 500 })
  }
}
