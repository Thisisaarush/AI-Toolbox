import { ApiError } from "@/lib/api-error"

export function getGeminiKey(req: Request): string {
  const userKey = req.headers.get("X-API-Key")?.trim()
  if (userKey) return userKey

  throw new ApiError(
    "No Gemini API key configured. Add your API key in Settings → AI Provider.",
    402,
    "api_key_required",
  )
}
