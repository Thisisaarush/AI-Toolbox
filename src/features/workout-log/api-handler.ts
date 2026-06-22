import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { getGeminiKey } from "@/lib/ai-key"
import type { WorkoutProgram, Goal, Equipment, Experience } from "./types"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`workout-log:${uid}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "generate-program") {
      const {
        goal, daysPerWeek, equipment, experience,
      }: { goal: Goal; daysPerWeek: number; equipment: Equipment; experience: Experience } = body

      if (!goal || !daysPerWeek || !equipment || !experience) {
        throw new ApiError("goal, daysPerWeek, equipment, experience required", 400)
      }

      const key = getGeminiKey(req)
      const genAI = new GoogleGenerativeAI(key)
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })

      const prompt = `You are an expert personal trainer. Create a detailed ${daysPerWeek}-day per week workout program.

Goal: ${goal}
Equipment: ${equipment} (home=bodyweight+dumbbells, gym=full equipment, minimal=resistance bands+bodyweight)
Experience: ${experience}
Days per week: ${daysPerWeek}

Return a JSON object with this structure:
{
  "name": "Program Name",
  "days": [
    {
      "name": "Day 1 - Push",
      "exercises": [
        {
          "exerciseName": "Bench Press",
          "targetSets": 4,
          "targetReps": "6-8",
          "restSeconds": 120
        }
      ]
    }
  ]
}

Include ${daysPerWeek} training days. 4-6 exercises per day. Be specific with reps and rest. Return only valid JSON.`

      const result = await model.generateContent(prompt)
      const text = result.response.text().trim()
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new ApiError("AI returned invalid response", 500)

      const parsed = JSON.parse(jsonMatch[0]) as {
        name: string
        days: { name: string; exercises: { exerciseName: string; targetSets: number; targetReps: string; restSeconds: number }[] }[]
      }

      const program: WorkoutProgram = {
        id: crypto.randomUUID(),
        name: parsed.name,
        goal,
        daysPerWeek,
        isAiGenerated: true,
        days: parsed.days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((e) => ({
            exerciseId: e.exerciseName.toLowerCase().replace(/\s+/g, "-"),
            targetSets: e.targetSets,
            targetReps: e.targetReps,
            restSeconds: e.restSeconds,
          })),
        })),
        createdAt: new Date().toISOString(),
      }

      return NextResponse.json({ program })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
