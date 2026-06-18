import "server-only"
import { GoogleGenerativeAI } from "@google/generative-ai"

let _gemini: GoogleGenerativeAI | null = null

function initGemini() {
  if (_gemini) return _gemini
  const key = process.env.GEMINI_API_KEY
  if (!key) return null
  _gemini = new GoogleGenerativeAI(key)
  return _gemini
}

function getModel(model = "gemini-2.5-flash") {
  const genAI = initGemini()
  if (!genAI) return null
  return genAI.getGenerativeModel({ model })
}

// --- Text completions ---

async function chatCompletion(system: string, user: string, opts?: { json?: boolean; temperature?: number }): Promise<string> {
  const model = getModel()
  if (!model) return ""

  try {
    const prompt = opts?.json
      ? `${system}\n\n${user}\n\nRespond with valid JSON only.`
      : `${system}\n\n${user}`

    const result = await model.generateContent(prompt)
    return result.response.text()
  } catch {
    return ""
  }
}

// --- Image generation (not available on Gemini free tier) ---

async function generateImage(_prompt: string): Promise<string | null> {
  return null
}

// --- Audio transcription (not available on Gemini) ---

async function transcribeAudio(_audioBase64: string): Promise<string> {
  return ""
}

// --- Tool-specific functions ---

export async function analyzeDream(dreamContent: string): Promise<string> {
  return chatCompletion(
    "You are a dream analyst. Analyze the dream for themes, symbols, emotions, and possible meanings. Be insightful but grounded. Keep analysis to 2-3 paragraphs.",
    dreamContent,
  )
}

export async function generateDreamImage(_dreamContent: string): Promise<string | null> {
  return null
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

export async function generateVibePoster(_description: string): Promise<string | null> {
  return null
}

export async function generatePrDescription(diff: string): Promise<{ title: string; description: string }> {
  const system = `Generate a GitHub PR description from the git diff.

Return JSON with:
{
  "title": "A concise PR title (max 72 chars)",
  "description": "A well-structured PR description with ## Summary, ## Changes, ## Why, ## Testing sections"
}`

  const text = await chatCompletion(system, diff, { json: true, temperature: 0.3 })

  try {
    const result = JSON.parse(text)
    return {
      title: result.title ?? "Update codebase",
      description: result.description ?? "See diff for details.",
    }
  } catch {
    return { title: "Update codebase", description: "See diff for details." }
  }
}

export async function generateJournalNarrative(entries: { date: string; content: string }[]): Promise<string> {
  if (entries.length === 0) return "No entries yet."

  const system = "You are a personal historian. Given a list of journal entries, write a cohesive narrative summary. Connect themes, highlight emotional arcs, and tell the story of this period. 2-3 paragraphs."

  const user = entries.map(e => `[${e.date}]: ${e.content}`).join("\n\n")

  const text = await chatCompletion(system, user, { temperature: 0.8 })
  return text || "Could not generate narrative."
}

export async function categorizeRecipe(name: string, ingredients: string[]): Promise<{ category: string; cuisine: string; tags: string[] }> {
  const system = `Given a recipe name and ingredients, categorize it.

Return JSON:
{
  "category": "Dessert | Main Course | Appetizer | Breakfast | Salad | Soup | Drink | Snack",
  "cuisine": "Italian | Mexican | Indian | Chinese | Japanese | American | French | Mediterranean | Thai | Other",
  "tags": ["tag1", "tag2", "tag3"]
}`

  const text = await chatCompletion(system, `Recipe: ${name}\nIngredients: ${ingredients.join(", ")}`, { json: true })

  try {
    const result = JSON.parse(text)
    return {
      category: result.category ?? "Main Course",
      cuisine: result.cuisine ?? "Other",
      tags: Array.isArray(result.tags) ? result.tags.slice(0, 5) : [],
    }
  } catch {
    return { category: "Main Course", cuisine: "Other", tags: [] }
  }
}

export { transcribeAudio }
