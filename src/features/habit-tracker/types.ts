export type HabitColor =
  | "teal" | "violet" | "rose" | "amber" | "sky" | "lime" | "orange" | "pink"

export type HabitFrequency =
  | { type: "daily" }
  | { type: "specific_days"; days: number[] } // 0=Sun … 6=Sat
  | { type: "times_per_week"; times: number }

export type HabitTarget =
  | { type: "boolean" }
  | { type: "number"; unit: string; goal: number }

export interface Habit {
  id: string
  name: string
  description: string
  color: HabitColor
  emoji: string
  frequency: HabitFrequency
  target: HabitTarget
  reminderTime?: string // "HH:MM"
  stackId?: string      // belongs to a habit stack
  stackOrder?: number
  archived: boolean
  createdAt: string
}

export interface HabitStack {
  id: string
  name: string
  order: number
}

export interface DailyLog {
  habitId: string
  date: string      // "YYYY-MM-DD"
  completed: boolean
  value?: number    // for numeric targets
}

export interface HabitStore {
  habits: Habit[]
  stacks: HabitStack[]
  logs: DailyLog[]
}

// ── Derived helpers ──────────────────────────────────────────────────────────

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns all YYYY-MM-DD strings for the last N days (oldest first) */
export function lastNDays(n: number): string[] {
  const result: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    result.push(dateStr(d))
  }
  return result
}

/** Is this habit scheduled for a given date (ISO string)? */
export function isDueOn(habit: Habit, date: string): boolean {
  const d = new Date(date + "T12:00:00")
  const dow = d.getDay()
  const f = habit.frequency
  if (f.type === "daily") return true
  if (f.type === "specific_days") return f.days.includes(dow)
  // times_per_week — treat every day as potentially due (user decides)
  return true
}

/** Completion rate for a habit on a given date */
export function completionRateForDate(habit: Habit, date: string, logs: DailyLog[]): number {
  const log = logs.find((l) => l.habitId === habit.id && l.date === date)
  if (!log) return 0
  if (!log.completed) return 0
  if (habit.target.type === "number") {
    return Math.min(1, (log.value ?? 0) / habit.target.goal)
  }
  return 1
}

/** Current streak for a habit (days from today backwards while completed) */
export function currentStreak(habit: Habit, logs: DailyLog[]): number {
  let streak = 0
  let d = new Date()
  // If today has no log yet, start checking from yesterday
  const todayLog = logs.find((l) => l.habitId === habit.id && l.date === todayStr())
  if (!todayLog?.completed) d.setDate(d.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    const ds = dateStr(d)
    if (!isDueOn(habit, ds)) { d.setDate(d.getDate() - 1); continue }
    const log = logs.find((l) => l.habitId === habit.id && l.date === ds)
    if (log?.completed) {
      streak++
      d.setDate(d.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}

/** Longest streak ever */
export function longestStreak(habit: Habit, logs: DailyLog[]): number {
  const habitLogs = logs.filter((l) => l.habitId === habit.id && l.completed)
  if (habitLogs.length === 0) return 0
  const dates = habitLogs.map((l) => l.date).sort()
  let max = 1, cur = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T12:00:00")
    const curr = new Date(dates[i] + "T12:00:00")
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) { cur++; max = Math.max(max, cur) } else cur = 1
  }
  return max
}

export const COLOR_MAP: Record<HabitColor, { bg: string; text: string; ring: string; heatmap: string[] }> = {
  teal:   { bg: "bg-teal-500/20",   text: "text-teal-400",   ring: "ring-teal-500",   heatmap: ["bg-teal-950","bg-teal-800","bg-teal-600","bg-teal-400","bg-teal-300"] },
  violet: { bg: "bg-violet-500/20", text: "text-violet-400", ring: "ring-violet-500", heatmap: ["bg-violet-950","bg-violet-800","bg-violet-600","bg-violet-400","bg-violet-300"] },
  rose:   { bg: "bg-rose-500/20",   text: "text-rose-400",   ring: "ring-rose-500",   heatmap: ["bg-rose-950","bg-rose-800","bg-rose-600","bg-rose-400","bg-rose-300"] },
  amber:  { bg: "bg-amber-500/20",  text: "text-amber-400",  ring: "ring-amber-500",  heatmap: ["bg-amber-950","bg-amber-800","bg-amber-600","bg-amber-400","bg-amber-300"] },
  sky:    { bg: "bg-sky-500/20",    text: "text-sky-400",    ring: "ring-sky-500",    heatmap: ["bg-sky-950","bg-sky-800","bg-sky-600","bg-sky-400","bg-sky-300"] },
  lime:   { bg: "bg-lime-500/20",   text: "text-lime-400",   ring: "ring-lime-500",   heatmap: ["bg-lime-950","bg-lime-800","bg-lime-600","bg-lime-400","bg-lime-300"] },
  orange: { bg: "bg-orange-500/20", text: "text-orange-400", ring: "ring-orange-500", heatmap: ["bg-orange-950","bg-orange-800","bg-orange-600","bg-orange-400","bg-orange-300"] },
  pink:   { bg: "bg-pink-500/20",   text: "text-pink-400",   ring: "ring-pink-500",   heatmap: ["bg-pink-950","bg-pink-800","bg-pink-600","bg-pink-400","bg-pink-300"] },
}

export const PRESET_COLORS: HabitColor[] = ["teal","violet","rose","amber","sky","lime","orange","pink"]
