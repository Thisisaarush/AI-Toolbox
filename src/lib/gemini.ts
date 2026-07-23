import "server-only"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getGeminiKey } from "@/lib/ai-key"
import { ApiError } from "@/lib/api-error"

export async function geminiJSON<T = unknown>(req: Request, prompt: string): Promise<T> {
  const key = getGeminiKey(req)
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  let text: string
  try {
    const result = await model.generateContent(prompt)
    text = result.response.text()
  } catch (err) {
    console.error("[gemini] provider call failed:", err)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("429") || message.toLowerCase().includes("rate limit") || message.toLowerCase().includes("quota")) {
      throw new ApiError("The AI provider is rate-limiting your key right now. Try again in a moment.", 429, "ai_rate_limited")
    }
    if (message.includes("401") || message.includes("403") || message.toLowerCase().includes("api key")) {
      throw new ApiError("Your AI API key was rejected. Check it in Settings → AI Provider.", 401, "ai_key_invalid")
    }
    throw new ApiError("The AI provider is unavailable right now. Please try again.", 502, "ai_provider_unavailable")
  }

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    console.error("[gemini] failed to parse model output as JSON:", err, "raw:", cleaned.slice(0, 500))
    throw new ApiError("The AI returned an unexpected response. Please try again.", 502, "ai_bad_response")
  }
}
