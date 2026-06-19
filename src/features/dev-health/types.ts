export type EnergyLevel = 1 | 2 | 3 | 4 | 5
export type MoodLevel = 1 | 2 | 3 | 4 | 5

export interface DailyLog {
  date: string // ISO date string YYYY-MM-DD
  sleep: number // hours
  energy: EnergyLevel
  mood: MoodLevel
  water: number // glasses
  caffeine: number // cups
  exercised: boolean
  pomodorosCompleted: number
  notes: string
}

export interface DevHealthData {
  logs: DailyLog[]
  streak: number
  lastLogDate: string
}

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  1: "Exhausted",
  2: "Tired",
  3: "Okay",
  4: "Good",
  5: "Energized",
}

export const MOOD_LABELS: Record<MoodLevel, string> = {
  1: "Terrible",
  2: "Low",
  3: "Neutral",
  4: "Good",
  5: "Great",
}

export const POMODORO_WORK_MINUTES = 25
export const POMODORO_BREAK_MINUTES = 5
export const POMODORO_LONG_BREAK_MINUTES = 15
