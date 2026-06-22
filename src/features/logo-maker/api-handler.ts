import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { geminiJSON } from "@/lib/gemini"
import { ICON_LIST } from "./types"

const limiter = rateLimit({ max: 30, windowMs: 60000 })
const aiLimiter = rateLimit({ max: 15, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip

    const { allowed } = limiter.check(`logo-maker:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json() as { action: string; [key: string]: unknown }
    const { action } = body

    if (action === "suggest-icons") {
      const { allowed: aiOk } = aiLimiter.check(`logo-maker-ai:${uid}`)
      if (!aiOk) throw new ApiError("AI rate limit exceeded", 429)

      const description = body.description as string
      if (!description?.trim()) throw new ApiError("description required", 400)

      const prompt = `You are a logo design expert. Given this app/company description, suggest the 5 most fitting icon names from the list below.

App description: "${description}"

Available icons: ${ICON_LIST.join(", ")}

Return ONLY valid JSON array of exactly 5 icon names from the list above:
["IconName1", "IconName2", "IconName3", "IconName4", "IconName5"]

Rules:
- Only use names exactly as they appear in the available icons list
- Choose icons that visually represent the app's core purpose or value
- Prioritize recognizable, professional-looking icons
- JSON array only, no markdown`

      const icons = await geminiJSON(req, prompt)
      return NextResponse.json({ ok: true, icons })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
