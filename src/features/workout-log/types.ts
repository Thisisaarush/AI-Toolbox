export type MuscleGroup =
  | "Chest" | "Back" | "Shoulders" | "Arms" | "Legs" | "Core" | "Cardio" | "Full Body"

export type Equipment = "home" | "gym" | "minimal"
export type Goal = "strength" | "muscle" | "endurance" | "fat-loss"
export type Experience = "beginner" | "intermediate" | "advanced"

export interface Exercise {
  id: string
  name: string
  muscleGroups: MuscleGroup[]
  isCustom?: boolean
}

export interface WorkoutSet {
  id: string
  exerciseId: string
  weight?: number       // kg
  reps?: number
  duration?: number     // seconds (for cardio)
  distance?: number     // km
  notes?: string
}

export interface SessionExercise {
  exerciseId: string
  sets: WorkoutSet[]
}

export interface WorkoutSession {
  id: string
  date: string          // ISO date
  name?: string
  programId?: string
  programDay?: string
  exercises: SessionExercise[]
  durationMinutes?: number
  notes?: string
  prsAchieved?: string[]   // exercise IDs with PR
  createdAt: string
}

export interface PersonalRecord {
  exerciseId: string
  weight1RM: number     // estimated 1-rep max
  maxReps: number
  maxWeight: number
  date: string
}

export interface ProgramDay {
  name: string          // e.g. "Push Day"
  exercises: {
    exerciseId: string
    targetSets: number
    targetReps: string  // "3-5" or "8-12"
    restSeconds: number
  }[]
}

export interface WorkoutProgram {
  id: string
  name: string
  goal: Goal
  daysPerWeek: number
  days: ProgramDay[]
  isAiGenerated?: boolean
  createdAt: string
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
}

export const MUSCLE_GROUP_COLORS: Record<MuscleGroup, string> = {
  Chest:     "bg-red-100    text-red-700    dark:bg-red-900/30    dark:text-red-300",
  Back:      "bg-blue-100   text-blue-700   dark:bg-blue-900/30   dark:text-blue-300",
  Shoulders: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  Arms:      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Legs:      "bg-green-100  text-green-700  dark:bg-green-900/30  dark:text-green-300",
  Core:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  Cardio:    "bg-cyan-100   text-cyan-700   dark:bg-cyan-900/30   dark:text-cyan-300",
  "Full Body": "bg-pink-100 text-pink-700   dark:bg-pink-900/30   dark:text-pink-300",
}
