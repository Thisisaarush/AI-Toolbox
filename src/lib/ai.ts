import OpenAI from "openai"

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const globalForOpenAI = globalThis as unknown as { openai: OpenAI | undefined }
  if (!globalForOpenAI.openai) {
    globalForOpenAI.openai = new OpenAI({ apiKey })
  }
  return globalForOpenAI.openai
}

export async function generateDreamImage(dreamContent: string): Promise<string | null> {
  const openai = getOpenAI()
  if (!openai) return null
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A dreamlike, artistic visualization of this dream scene: ${dreamContent}. Dreamy, surreal style.`,
      n: 1,
      size: "1024x1024",
    })
    return response.data?.[0]?.url ?? null
  } catch {
    return null
  }
}

export async function analyzeDream(dreamContent: string): Promise<string> {
  const openai = getOpenAI()
  if (!openai) return "AI analysis unavailable. Set OPENAI_API_KEY."

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a dream analyst. Analyze the dream for themes, symbols, emotions, and possible meanings. Be insightful but grounded. Keep analysis to 2-3 paragraphs.",
      },
      { role: "user", content: dreamContent },
    ],
    temperature: 0.7,
  })
  return response.choices[0]?.message?.content ?? "Could not analyze dream."
}

export async function generateCommitMessage(diff: string): Promise<{ message: string; type: string; scope?: string }> {
  const openai = getOpenAI()
  if (!openai) return { message: "chore: set OPENAI_API_KEY", type: "chore" }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Generate a conventional commit message from the provided git diff.

Format: <type>(<scope>): <description>

Types: feat, fix, chore, docs, style, refactor, perf, test, ci, build, revert
Scope is optional and should be the area of code changed.

Respond with JSON:
{
  "type": "feat",
  "scope": "api" | null,
  "description": "add user login endpoint",
  "message": "feat(api): add user login endpoint"
}`,
      },
      { role: "user", content: diff },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  })

  const result = JSON.parse(response.choices[0]?.message?.content ?? "{}")
  return {
    message: result.message ?? "chore: update code",
    type: result.type ?? "chore",
    scope: result.scope ?? undefined,
  }
}

export async function generateVibePoster(description: string): Promise<string | null> {
  const openai = getOpenAI()
  if (!openai) return null
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `Create a poster that captures this vibe/aesthetic: ${description}. Modern, artistic poster design with typography elements. Style: high-contrast, minimalist, trendy.`,
      n: 1,
      size: "1024x1024",
    })
    return response.data?.[0]?.url ?? null
  } catch {
    return null
  }
}
