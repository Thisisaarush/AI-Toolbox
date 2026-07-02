import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const prisma = db()
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const form = await prisma.publishedForm.findUnique({ where: { formId: id } })
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

    return NextResponse.json({ form: form.formData, title: form.title })
  } catch (err) {
    console.error("Get form error:", err)
    return NextResponse.json({ error: "Failed to get form" }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const prisma = db()
    if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })

    const form = await prisma.publishedForm.findUnique({ where: { formId: id } })
    if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

    const { answers, timeSpent } = await req.json()
    if (!answers) return NextResponse.json({ error: "answers required" }, { status: 400 })

    const response = await prisma.formResponse.create({
      data: { formId: id, answers, timeSpent: timeSpent ?? 0 },
    })

    return NextResponse.json({ submitted: true, responseId: response.id })
  } catch (err) {
    console.error("Submit error:", err)
    return NextResponse.json({ error: "Failed to submit response" }, { status: 500 })
  }
}
