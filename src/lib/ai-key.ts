import { ApiError } from "@/lib/api-error"

/**
 * Returns the Gemini API key to use for a request.
 *
 * Priority:
 *   1. X-API-Key header — user's own key (BYOK)
 *   2. GEMINI_API_KEY env var — server-side key (for dev / admin use)
 *
 * Throws ApiError 402 if neither is available, so the client knows to
 * prompt the user to add their key in Settings.
 */
export function getGeminiKey(req: Request): string {
  const userKey = req.headers.get("X-API-Key")?.trim()
  if (userKey) return userKey

  const serverKey = process.env.GEMINI_API_KEY?.trim()
  if (serverKey) return serverKey

  throw new ApiError(
    "No Gemini API key configured. Add your API key in Settings → AI Provider.",
    402,
    "api_key_required",
  )
}
