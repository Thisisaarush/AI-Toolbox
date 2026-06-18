import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { transcribeAudio } from "@/lib/ai"
import { handleApiError, ApiError } from "@/lib/api-error"

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const { audio } = await req.json()
    if (!audio) throw new ApiError("Audio data is required", 400)

    const text = await transcribeAudio(audio as string)
    if (!text) throw new ApiError("Transcription unavailable. Configure an AI provider.", 503)

    return NextResponse.json({ text })
  } catch (err) {
    return handleApiError(err)
  }
}
