import "server-only"
import OpenAI from "openai"
import { GoogleGenerativeAI } from "@google/generative-ai"

// --- Init providers (lazy) ---
let _openai: OpenAI | null = null
let _gemini: GoogleGenerativeAI | null = null

function initOpenAI() {
  if (_openai) return _openai
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  _openai = new OpenAI({ apiKey: key })
  return _openai
}

function initGemini() {
  if (_gemini) return _gemini
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  _gemini = new GoogleGenerativeAI(key)
  return _gemini
}

// --- Abstraction layer ---

type Provider = "openai" | "gemini"

async function withBestProvider<T>(
  handlers: {
    openai?: () => Promise<T>
    gemini?: () => Promise<T>
  },
  fallback: T,
): Promise<T> {
  if (handlers.openai && process.env.OPENAI_API_KEY) {
    try {
      return await handlers.openai()
    } catch {
      if (!handlers.gemini) return fallback
    }
  }
  if (handlers.gemini && process.env.GEMINI_API_KEY) {
    try {
      return await handlers.gemini()
    } catch {
      return fallback
    }
  }
  return fallback
}

// --- Chat completions (generic) ---

async function chatCompletion(system: string, user: string, opts?: { json?: boolean; temperature?: number }): Promise<string> {
  return withBestProvider(
    {
      openai: async () => {
        const openai = initOpenAI()!
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: opts?.temperature ?? 0.7,
          ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
        })
        return response.choices[0]?.message?.content ?? ""
      },
      gemini: async () => {
        const genAI = initGemini()!
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
        const prompt = `${system}\n\n${user}`
        const result = await model.generateContent(prompt)
        return result.response.text()
      },
    },
    "",
  )
}

// --- Image generation (OpenAI only for now, DALL-E) ---

async function generateImage(prompt: string): Promise<string | null> {
  return withBestProvider(
    {
      openai: async () => {
        const openai = initOpenAI()!
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
        })
        return response.data?.[0]?.url ?? null
      },
    },
    null,
  )
}

// --- Audio transcription (OpenAI Whisper) ---

async function transcribeAudio(audioBase64: string): Promise<string> {
  return withBestProvider(
    {
      openai: async () => {
        const openai = initOpenAI()!
        const buffer = Buffer.from(audioBase64, "base64")
        const blob = new Blob([buffer], { type: "audio/webm" })
        const file = new File([blob], "recording.webm", { type: "audio/webm" })
        const transcript = await openai.audio.transcriptions.create({
          model: "whisper-1",
          file,
        })
        return transcript.text
      },
    },
    "",
  )
}

// --- Tool-specific functions ---

export async function analyzeDream(dreamContent: string): Promise<string> {
  return chatCompletion(
    "You are a dream analyst. Analyze the dream for themes, symbols, emotions, and possible meanings. Be insightful but grounded. Keep analysis to 2-3 paragraphs.",
    dreamContent,
  )
}

export async function generateDreamImage(dreamContent: string): Promise<string | null> {
  return generateImage(
    `A dreamlike, artistic visualization of this dream scene: ${dreamContent}. Dreamy, surreal style.`,
  )
}

export async function generateCommitMessage(diff: string): Promise<{ message: string; type: string; scope?: string }> {
  const system = `Generate a conventional commit message from the provided git diff.

Format: <type>(<scope>): <description>

Types: feat, fix, chore, docs, style, refactor, perf, test, ci, build, revert
Scope is optional and should be the area of code changed.

Respond with JSON:
{
  "type": "feat",
  "scope": "api",
  "description": "add user login endpoint",
  "message": "feat(api): add user login endpoint"
}`

  const text = await chatCompletion(system, diff, { json: true, temperature: 0.3 })

  try {
    const result = JSON.parse(text)
    return {
      message: result.message ?? "chore: update code",
      type: result.type ?? "chore",
      scope: result.scope ?? undefined,
    }
  } catch {
    return { message: "chore: update code", type: "chore" }
  }
}

export async function generateVibePoster(description: string): Promise<string | null> {
  return generateImage(
    `Create a poster that captures this vibe/aesthetic: ${description}. Modern, artistic poster design with typography elements. Style: high-contrast, minimalist, trendy.`,
  )
}

// Re-export for routes that use it directly
export { transcribeAudio, chatCompletion, generateImage }
