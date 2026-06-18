import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { categorizeRecipe } from "@/lib/ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"

const limiter = rateLimit({ max: 20, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) throw new ApiError("Unauthorized", 401)

    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const { allowed } = limiter.check(`savor:${ip}`)
    if (!allowed) throw new ApiError("Too many requests. Try again later.", 429)

    const { name, ingredients } = await req.json()
    if (!name || typeof name !== "string") throw new ApiError("Recipe name is required", 400)

    const result = await categorizeRecipe(name, Array.isArray(ingredients) ? ingredients : [])

    return NextResponse.json(result)
  } catch (err) {
    return handleApiError(err)
  }
}
