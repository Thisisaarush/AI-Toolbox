"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  CheckCircle2, Plus, Flame, Trash2, Archive, RotateCcw,
  X, ChevronDown, ChevronUp, BarChart3, Calendar, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Habit, type HabitStack, type DailyLog, type HabitStore,
  type HabitColor, type HabitFrequency, type HabitTarget,
  todayStr, lastNDays, isDueOn, completionRateForDate,
  currentStreak, longestStreak, COLOR_MAP, PRESET_COLORS,
} from "./types"

const STORAGE_KEY = "habit-tracker-v1"

function loadStore(): HabitStore {
  if (typeof window === "undefined") return { habits: [], stacks: [], logs: [] }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { habits: [], stacks: [], logs: [] } }
  catch { return { habits: [], stacks: [], logs: [] } }
}
function saveStore(s: HabitStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type Tab = "today" | "habits" | "heatmap" | "weekly"

const DOW_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"]
const DOW_FULL   = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]

// ── Heatmap ──────────────────────────────────────────────────────────────────
function HeatmapGrid({ habit, logs }: { habit: Habit; logs: DailyLog[] }) {
  const days = lastNDays(183) // ~6 months
  const c = COLOR_MAP[habit.color]

  function bucket(rate: number) {
    if (rate === 0) return c.heatmap[0]
    if (rate < 0.26) return c.heatmap[1]
    if (rate < 0.51) return c.heatmap[2]
    if (rate < 0.76) return c.heatmap[3]
    return c.heatmap[4]
  }

  // Pad so grid starts on Sunday
  const firstDow = new Date(days[0] + "T12:00:00").getDay()
  const padded: (string | null)[] = [...Array(firstDow).fill(null), ...days]

  return (
    <div>
      <div className="flex gap-0.5 mb-1">
        {DOW_LABELS.map((l) => <span key={l} className="text-[9px] text-muted-foreground w-3 text-center">{l}</span>)}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-0.5">
        {padded.map((d, i) =>
          d === null ? (
            <div key={`pad-${i}`} className="w-3 h-3 rounded-[2px]" />
          ) : (
            <div
              key={d}
              title={`${d}: ${Math.round(completionRateForDate(habit, d, logs) * 100)}%`}
              className={`w-3 h-3 rounded-[2px] ${isDueOn(habit, d) ? bucket(completionRateForDate(habit, d, logs)) : "bg-muted/20"} transition-colors cursor-default`}
            />
          )
        )}
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[9px] text-muted-foreground">Less</span>
        {c.heatmap.map((cls, i) => <div key={i} className={`w-3 h-3 rounded-[2px] ${cls}`} />)}
        <span className="text-[9px] text-muted-foreground">More</span>
      </div>
    </div>
  )
}

// ── Create / Edit form ────────────────────────────────────────────────────────
interface HabitFormProps {
  stacks: HabitStack[]
  initial?: Habit
  onSave: (h: Habit) => void
  onCancel: () => void
}
function HabitForm({ stacks, initial, onSave, onCancel }: HabitFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [desc, setDesc] = useState(initial?.description ?? "")
  const [color, setColor] = useState<HabitColor>(initial?.color ?? "teal")
  const [emoji, setEmoji] = useState(initial?.emoji ?? "⭐")
  const [freqType, setFreqType] = useState<HabitFrequency["type"]>(initial?.frequency.type ?? "daily")
  const [freqDays, setFreqDays] = useState<number[]>(
    initial?.frequency.type === "specific_days" ? initial.frequency.days : [1,2,3,4,5]
  )
  const [freqTimes, setFreqTimes] = useState(
    initial?.frequency.type === "times_per_week" ? initial.frequency.times : 3
  )
  const [targetType, setTargetType] = useState<HabitTarget["type"]>(initial?.target.type ?? "boolean")
  const [targetUnit, setTargetUnit] = useState(
    initial?.target.type === "number" ? initial.target.unit : "glasses"
  )
  const [targetGoal, setTargetGoal] = useState(
    initial?.target.type === "number" ? initial.target.goal : 8
  )
  const [reminder, setReminder] = useState(initial?.reminderTime ?? "")
  const [stackId, setStackId] = useState(initial?.stackId ?? "")

  function buildFreq(): HabitFrequency {
    if (freqType === "daily") return { type: "daily" }
    if (freqType === "specific_days") return { type: "specific_days", days: freqDays }
    return { type: "times_per_week", times: freqTimes }
  }
  function buildTarget(): HabitTarget {
    if (targetType === "boolean") return { type: "boolean" }
    return { type: "number", unit: targetUnit, goal: targetGoal }
  }

  function handleSave() {
    if (!name.trim()) { toast.error("Name required"); return }
    const habit: Habit = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      description: desc.trim(),
      color,
      emoji,
      frequency: buildFreq(),
      target: buildTarget(),
      reminderTime: reminder || undefined,
      stackId: stackId || undefined,
      stackOrder: initial?.stackOrder,
      archived: initial?.archived ?? false,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    }
    onSave(habit)
  }

  const c = COLOR_MAP[color]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{initial ? "Edit Habit" : "New Habit"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Name *</label>
            <Input placeholder="Meditate, Exercise, Read..." value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Emoji</label>
            <Input className="w-16 text-center text-lg" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1">Description</label>
          <Input placeholder="What, why, and how" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        {/* Color */}
        <div>
          <label className="text-xs font-medium block mb-2">Color</label>
          <div className="flex gap-2 flex-wrap">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                onClick={() => setColor(col)}
                className={`w-7 h-7 rounded-full ${COLOR_MAP[col].bg} border-2 transition-all ${color === col ? `border-white ring-2 ${COLOR_MAP[col].ring}` : "border-transparent"}`}
              >
                <span className={`block w-full h-full rounded-full ${COLOR_MAP[col].text} text-center text-xs leading-6`}>{col[0]?.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Frequency */}
        <div>
          <label className="text-xs font-medium block mb-2">Frequency</label>
          <div className="flex gap-2 mb-2">
            {(["daily","specific_days","times_per_week"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFreqType(t)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${freqType === t ? `${c.bg} ${c.text} border-transparent` : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {t === "daily" ? "Daily" : t === "specific_days" ? "Specific days" : "X/week"}
              </button>
            ))}
          </div>
          {freqType === "specific_days" && (
            <div className="flex gap-1">
              {DOW_LABELS.map((l, i) => (
                <button
                  key={i}
                  onClick={() => setFreqDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i])}
                  className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${freqDays.includes(i) ? `${c.bg} ${c.text}` : "bg-muted/50 text-muted-foreground"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {freqType === "times_per_week" && (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} max={7} className="w-20" value={freqTimes} onChange={(e) => setFreqTimes(Number(e.target.value))} />
              <span className="text-sm text-muted-foreground">times per week</span>
            </div>
          )}
        </div>

        {/* Target */}
        <div>
          <label className="text-xs font-medium block mb-2">Target type</label>
          <div className="flex gap-2 mb-2">
            {(["boolean","number"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTargetType(t)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${targetType === t ? `${c.bg} ${c.text} border-transparent` : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {t === "boolean" ? "Yes/No" : "Numeric"}
              </button>
            ))}
          </div>
          {targetType === "number" && (
            <div className="flex items-center gap-2">
              <Input type="number" min={1} className="w-24" value={targetGoal} onChange={(e) => setTargetGoal(Number(e.target.value))} />
              <Input placeholder="glasses, pages, mins…" className="w-36" value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} />
            </div>
          )}
        </div>

        {/* Stack & reminder */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">Stack (optional)</label>
            <select
              value={stackId}
              onChange={(e) => setStackId(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">None</option>
              {stacks.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Reminder time</label>
            <Input type="time" value={reminder} onChange={(e) => setReminder(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleSave}>Save Habit</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function HabitTrackerContent() {
  const [store, setStore] = useState<HabitStore>({ habits: [], stacks: [], logs: [] })
  const [tab, setTab] = useState<Tab>("today")
  const [showForm, setShowForm] = useState(false)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [newStackName, setNewStackName] = useState("")
  const [showHeatmapFor, setShowHeatmapFor] = useState<string | null>(null)

  useEffect(() => { setStore(loadStore()) }, [])

  function update(fn: (s: HabitStore) => HabitStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  const today = todayStr()
  const todayDow = new Date().getDay()

  // Habits due today
  const dueToday = useMemo(
    () => store.habits.filter((h) => !h.archived && isDueOn(h, today)),
    [store.habits, today]
  )

  // Daily banner
  const pendingCount = dueToday.filter((h) => {
    const log = store.logs.find((l) => l.habitId === h.id && l.date === today)
    return !log?.completed
  }).length

  function getLog(habitId: string, date: string) {
    return store.logs.find((l) => l.habitId === habitId && l.date === date)
  }

  function toggleComplete(habit: Habit) {
    const existing = getLog(habit.id, today)
    update((s) => {
      const filtered = s.logs.filter((l) => !(l.habitId === habit.id && l.date === today))
      const newLog: DailyLog = {
        habitId: habit.id,
        date: today,
        completed: !existing?.completed,
        value: existing?.value,
      }
      return { ...s, logs: [...filtered, newLog] }
    })
  }

  function setNumericValue(habit: Habit, value: number) {
    update((s) => {
      const filtered = s.logs.filter((l) => !(l.habitId === habit.id && l.date === today))
      const goal = habit.target.type === "number" ? habit.target.goal : 1
      const newLog: DailyLog = {
        habitId: habit.id,
        date: today,
        completed: value >= goal,
        value,
      }
      return { ...s, logs: [...filtered, newLog] }
    })
  }

  function saveHabit(h: Habit) {
    update((s) => {
      const exists = s.habits.find((x) => x.id === h.id)
      return {
        ...s,
        habits: exists ? s.habits.map((x) => x.id === h.id ? h : x) : [...s.habits, h],
      }
    })
    setShowForm(false)
    setEditingHabit(null)
    toast.success(editingHabit ? "Habit updated" : "Habit created")
  }

  function archiveHabit(id: string) {
    update((s) => ({ ...s, habits: s.habits.map((h) => h.id === id ? { ...h, archived: true } : h) }))
    toast.success("Habit archived")
  }

  function restoreHabit(id: string) {
    update((s) => ({ ...s, habits: s.habits.map((h) => h.id === id ? { ...h, archived: false } : h) }))
    toast.success("Habit restored")
  }

  function deleteHabit(id: string) {
    update((s) => ({
      ...s,
      habits: s.habits.filter((h) => h.id !== id),
      logs: s.logs.filter((l) => l.habitId !== id),
    }))
    toast.success("Habit deleted")
  }

  function addStack() {
    if (!newStackName.trim()) return
    const stack: HabitStack = { id: crypto.randomUUID(), name: newStackName.trim(), order: store.stacks.length }
    update((s) => ({ ...s, stacks: [...s.stacks, stack] }))
    setNewStackName("")
    toast.success("Stack created")
  }

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const days = lastNDays(7)
    return store.habits
      .filter((h) => !h.archived)
      .map((h) => {
        const due = days.filter((d) => isDueOn(h, d))
        const done = due.filter((d) => store.logs.find((l) => l.habitId === h.id && l.date === d && l.completed))
        const byDow: (number | null)[] = Array(7).fill(0).map((_, dow) => {
          const daysWithDow = days.filter((d) => new Date(d + "T12:00:00").getDay() === dow && isDueOn(h, d))
          const doneDow = daysWithDow.filter((d) => store.logs.find((l) => l.habitId === h.id && l.date === d && l.completed))
          return daysWithDow.length > 0 ? doneDow.length / daysWithDow.length : null
        })
        let best = -1
        byDow.forEach((rate, i) => {
          if (rate === null) return
          if (best === -1 || rate > (byDow[best] ?? 0)) best = i
        })
        return {
          habit: h,
          rate: due.length > 0 ? done.length / due.length : 0,
          due: due.length,
          done: done.length,
          bestDow: best >= 0 ? (DOW_FULL[best] ?? null) : null,
          byDow,
        }
      })
  }, [store])

  const stacks = store.stacks
  const activeHabits = store.habits.filter((h) => !h.archived)
  const archivedHabits = store.habits.filter((h) => h.archived)

  // Group by stack for "today" tab
  const stackedGroups = useMemo(() => {
    const unstacked = dueToday.filter((h) => !h.stackId)
    const grouped = stacks.map((st) => ({
      stack: st,
      habits: dueToday.filter((h) => h.stackId === st.id).sort((a, b) => (a.stackOrder ?? 0) - (b.stackOrder ?? 0)),
    })).filter((g) => g.habits.length > 0)
    return { grouped, unstacked }
  }, [dueToday, stacks])

  function HabitCheckRow({ habit }: { habit: Habit }) {
    const log = getLog(habit.id, today)
    const c = COLOR_MAP[habit.color]
    const streak = currentStreak(habit, store.logs)
    const isNum = habit.target.type === "number"
    const goal = isNum && habit.target.type === "number" ? habit.target.goal : 1
    const currentVal = log?.value ?? 0

    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${log?.completed ? `${c.bg} border-transparent` : "border-border bg-card hover:bg-muted/30"}`}>
        <button
          onClick={() => !isNum && toggleComplete(habit)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xl shrink-0 border-2 transition-all ${log?.completed ? `border-transparent ${c.bg}` : "border-muted-foreground/30"}`}
        >
          {log?.completed ? "✅" : habit.emoji}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${log?.completed ? "line-through opacity-60" : ""}`}>{habit.name}</p>
          {habit.description && <p className="text-xs text-muted-foreground truncate">{habit.description}</p>}
        </div>
        {isNum && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setNumericValue(habit, Math.max(0, currentVal - 1))} className="w-6 h-6 rounded border text-xs hover:bg-muted">-</button>
            <span className={`text-sm font-bold w-8 text-center ${c.text}`}>{currentVal}</span>
            <button onClick={() => setNumericValue(habit, currentVal + 1)} className="w-6 h-6 rounded border text-xs hover:bg-muted">+</button>
            <span className="text-xs text-muted-foreground">/{goal}</span>
          </div>
        )}
        {streak > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-bold text-orange-400">{streak}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Habit Tracker"
        icon={CheckCircle2}
        color="text-teal-500"
        badge="Personal"
        actions={
          tab === "habits" && !showForm ? (
            <Button size="sm" onClick={() => { setShowForm(true); setEditingHabit(null) }}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Habit
            </Button>
          ) : undefined
        }
      />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
        {/* Daily banner */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-teal-500/30 bg-teal-500/10">
            <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
            <p className="text-sm">You have <span className="font-bold text-teal-400">{pendingCount}</span> habit{pendingCount !== 1 ? "s" : ""} left to complete today.</p>
          </div>
        )}
        {pendingCount === 0 && dueToday.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
            <span className="text-xl">🎉</span>
            <p className="text-sm font-medium text-green-400">All habits done for today! Keep it up!</p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit flex-wrap">
          {([
            { key: "today" as Tab,   label: "Today",   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            { key: "habits" as Tab,  label: "Habits",  icon: <Layers className="w-3.5 h-3.5" /> },
            { key: "heatmap" as Tab, label: "Heatmap", icon: <Calendar className="w-3.5 h-3.5" /> },
            { key: "weekly" as Tab,  label: "Weekly",  icon: <BarChart3 className="w-3.5 h-3.5" /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── TODAY ── */}
        {tab === "today" && (
          <div className="space-y-6">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold">Today&apos;s Habits</h2>
                <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-teal-400">{dueToday.filter((h) => getLog(h.id, today)?.completed).length}<span className="text-muted-foreground text-lg">/{dueToday.length}</span></p>
                <p className="text-xs text-muted-foreground">completed</p>
              </div>
            </div>

            {dueToday.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No habits scheduled for today</p>
                <p className="text-sm mt-1">Go to the Habits tab to create your first habit</p>
              </div>
            ) : (
              <>
                {/* Stacked groups */}
                {stackedGroups.grouped.map(({ stack, habits }) => (
                  <div key={stack.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stack.name}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {habits.map((h) => <HabitCheckRow key={h.id} habit={h} />)}
                  </div>
                ))}
                {/* Unstacked */}
                {stackedGroups.unstacked.length > 0 && (
                  <div className="space-y-2">
                    {stackedGroups.grouped.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    )}
                    {stackedGroups.unstacked.map((h) => <HabitCheckRow key={h.id} habit={h} />)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HABITS ── */}
        {tab === "habits" && (
          <div className="space-y-4">
            {(showForm || editingHabit) && (
              <HabitForm
                stacks={stacks}
                initial={editingHabit ?? undefined}
                onSave={saveHabit}
                onCancel={() => { setShowForm(false); setEditingHabit(null) }}
              />
            )}

            {activeHabits.length === 0 && !showForm ? (
              <div className="py-12 text-center text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No habits yet</p>
                <p className="text-sm mt-1">Create your first habit to start tracking</p>
                <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Habit
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {activeHabits.map((h) => {
                  const c = COLOR_MAP[h.color]
                  const streak = currentStreak(h, store.logs)
                  const longest = longestStreak(h, store.logs)
                  return (
                    <Card key={h.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg ${c.bg} shrink-0`}>{h.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm">{h.name}</p>
                              <Badge variant="secondary" className={`text-xs ${c.text}`}>
                                {h.frequency.type === "daily" ? "Daily"
                                  : h.frequency.type === "specific_days" ? `${h.frequency.days.length}d/wk`
                                  : `${h.frequency.times}×/wk`}
                              </Badge>
                            </div>
                            {h.description && <p className="text-xs text-muted-foreground">{h.description}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-center">
                            <div>
                              <div className="flex items-center gap-1">
                                <Flame className="w-3.5 h-3.5 text-orange-400" />
                                <span className="text-sm font-bold">{streak}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">streak</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">{longest}</p>
                              <p className="text-[10px] text-muted-foreground">best</p>
                            </div>
                            <Button variant="ghost" size="icon-sm" onClick={() => { setEditingHabit(h); setShowForm(false) }}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => archiveHabit(h.id)}>
                              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Stacks manager */}
            <div className="pt-4 border-t space-y-3">
              <h3 className="text-sm font-semibold">Habit Stacks</h3>
              <div className="flex gap-2">
                <Input placeholder="Morning Routine, Evening Routine..." value={newStackName} onChange={(e) => setNewStackName(e.target.value)} className="flex-1" />
                <Button size="sm" variant="outline" onClick={addStack}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
              </div>
              {stacks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stacks.map((st) => (
                    <Badge key={st.id} variant="secondary" className="gap-1">
                      {st.name}
                      <button onClick={() => update((s) => ({ ...s, stacks: s.stacks.filter((x) => x.id !== st.id) }))} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Archived */}
            {archivedHabits.length > 0 && (
              <div className="pt-4 border-t">
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Archived habits ({archivedHabits.length})
                </button>
                {showArchived && (
                  <div className="mt-3 space-y-2">
                    {archivedHabits.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-dashed opacity-60">
                        <span className="text-xl">{h.emoji}</span>
                        <p className="text-sm flex-1 line-through">{h.name}</p>
                        <Button size="sm" variant="ghost" onClick={() => restoreHabit(h.id)}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteHabit(h.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HEATMAP ── */}
        {tab === "heatmap" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Activity Heatmap</h2>
            <p className="text-muted-foreground text-sm">GitHub-style contribution graph — last 6 months</p>
            {activeHabits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No habits to show</div>
            ) : (
              activeHabits.map((h) => {
                const c = COLOR_MAP[h.color]
                const streak = currentStreak(h, store.logs)
                const longest = longestStreak(h, store.logs)
                const expanded = showHeatmapFor === h.id
                return (
                  <Card key={h.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${c.bg}`}>{h.emoji}</span>
                        <CardTitle className="text-sm flex-1">{h.name}</CardTitle>
                        <div className="flex items-center gap-4 text-center">
                          <div>
                            <div className="flex items-center gap-1">
                              <Flame className="w-3.5 h-3.5 text-orange-400" />
                              <span className={`text-lg font-bold ${c.text}`}>{streak}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">current</p>
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${c.text}`}>{longest}</p>
                            <p className="text-[10px] text-muted-foreground">best ever</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => setShowHeatmapFor(expanded ? null : h.id)}>
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {expanded && (
                      <CardContent className="pt-0 overflow-x-auto">
                        <HeatmapGrid habit={h} logs={store.logs} />
                      </CardContent>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ── WEEKLY ── */}
        {tab === "weekly" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Weekly Summary</h2>
            <p className="text-muted-foreground text-sm">Last 7 days completion rates</p>
            {weeklyStats.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No habits to show</div>
            ) : (
              weeklyStats.map(({ habit, rate, due, done, bestDow, byDow }) => {
                const c = COLOR_MAP[habit.color]
                return (
                  <Card key={habit.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${c.bg}`}>{habit.emoji}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{habit.name}</p>
                          <p className="text-xs text-muted-foreground">{done}/{due} this week</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${c.text}`}>{Math.round(rate * 100)}%</p>
                          {bestDow && <p className="text-xs text-muted-foreground">best: {bestDow}</p>}
                        </div>
                      </div>
                      {/* Rate bar */}
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${c.bg} transition-all`} style={{ width: `${rate * 100}%` }} />
                      </div>
                      {/* Per-day breakdown */}
                      <div className="grid grid-cols-7 gap-1">
                        {DOW_LABELS.map((l, i) => {
                          const r = byDow[i]
                          return (
                            <div key={i} className="text-center">
                              <div className={`w-full h-6 rounded-sm ${(r == null) ? "bg-muted/20" : r >= 1 ? c.bg.replace("/20", "") : r > 0 ? c.bg : "bg-muted/30"}`} />
                              <p className="text-[9px] text-muted-foreground mt-0.5">{l}</p>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        )}
      </main>
    </div>
  )
}
