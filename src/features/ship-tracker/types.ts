export interface DailyEntry {
  date: string // YYYY-MM-DD
  note: string
  completed: boolean
  mood: 1 | 2 | 3 | 4 | 5
}

export interface Challenge {
  id: string
  name: string
  description: string
  deadline: string // YYYY-MM-DD
  dailyCommitment: string
  publicGoal: string
  startDate: string // YYYY-MM-DD
  entries: DailyEntry[]
  archived: boolean
}

export interface ShipTrackerData {
  challenges: Challenge[]
  activeChallengeId: string | null
}

export const MOOD_EMOJIS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "😩",
  2: "😕",
  3: "😐",
  4: "😊",
  5: "🔥",
}

export const MOOD_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Rough",
  2: "Meh",
  3: "Okay",
  4: "Good",
  5: "Crushed it",
}
