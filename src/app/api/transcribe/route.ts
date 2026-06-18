import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import OpenAI from "openai"

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { audio } = await req.json()
  if (!audio) {
    return NextResponse.json({ error: "Audio data is required" }, { status: 400 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 })
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const buffer = Buffer.from(audio, "base64")
  const blob = new Blob([buffer], { type: "audio/webm" })
  const file = new File([blob], "recording.webm", { type: "audio/webm" })

  const transcript = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
  })

  return NextResponse.json({ text: transcript.text })
}
