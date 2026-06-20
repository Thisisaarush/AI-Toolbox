"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  CheckCircle2, Plus, Trash2, Flame, Calendar, BarChart3, Target,
  TrendingUp, Check, X, Edit3, Eye, EyeOff, ChevronLeft, ChevronRight,
} from "lucide-react"

type Habit = {
  id: string
  name: string
  color: string
  target: number
  logs: Record<string, boolean>
  createdAt: string
}

const STORAGE_KEY = "visualize-habit-v1"
const HABIT_COLORS = ["red", "blue", "green", "purple", "orange", "teal", "pink", "yellow"] as const

type ColorDef = { hex: string; bg: string; grid: string[]; ring: string; text: string }
const COLOR_MAP: Record<string, ColorDef> = {
  red:    { hex: "#ef4444", bg: "bg-red-500/20",   grid: ["bg-red-950","bg-red-800","bg-red-600","bg-red-400","bg-red-300"], ring: "ring-red-500",   text: "text-red-400" },
  blue:   { hex: "#3b82f6", bg: "bg-blue-500/20",  grid: ["bg-blue-950","bg-blue-800","bg-blue-600","bg-blue-400","bg-blue-300"], ring: "ring-blue-500",  text: "text-blue-400" },
  green:  { hex: "#22c55e", bg: "bg-green-500/20", grid: ["bg-green-950","bg-green-800","bg-green-600","bg-green-400","bg-green-300"], ring: "ring-green-500", text: "text-green-400" },
  purple: { hex: "#a855f7", bg: "bg-purple-500/20",grid: ["bg-purple-950","bg-purple-800","bg-purple-600","bg-purple-400","bg-purple-300"], ring: "ring-purple-500",text: "text-purple-400" },
  orange: { hex: "#f97316", bg: "bg-orange-500/20",grid: ["bg-orange-950","bg-orange-800","bg-orange-600","bg-orange-400","bg-orange-300"], ring: "ring-orange-500",text: "text-orange-400" },
  teal:   { hex: "#14b8a6", bg: "bg-teal-500/20",  grid: ["bg-teal-950","bg-teal-800","bg-teal-600","bg-teal-400","bg-teal-300"], ring: "ring-teal-500",  text: "text-teal-400" },
  pink:   { hex: "#ec4899", bg: "bg-pink-500/20",  grid: ["bg-pink-950","bg-pink-800","bg-pink-600","bg-pink-400","bg-pink-300"], ring: "ring-pink-500",  text: "text-pink-400" },
  yellow: { hex: "#eab308", bg: "bg-yellow-500/20",grid: ["bg-yellow-950","bg-yellow-800","bg-yellow-600","bg-yellow-400","bg-yellow-300"], ring: "ring-yellow-500",text: "text-yellow-400" },
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function todayStr(): string {
  return dateStr(new Date())
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = []
  const lastDay = new Date(year, month + 1, 0)
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d))
  return days
}

function getWeekDays(): Date[] {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - now.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getGridDays(year: number, month: number): (Date | null)[] {
  const days = getDaysInMonth(year, month)
  const pad = new Date(year, month, 1).getDay()
  return [...Array(pad).fill(null), ...days]
}

function loadStore(): Habit[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") }
  catch { return [] }
}

function currentStreak(habit: Habit): number {
  let streak = 0
  const today = todayStr()
  const d = new Date()
  if (!habit.logs[today]) d.setDate(d.getDate() - 1)
  for (let i = 0; i < 365; i++) {
    if (habit.logs[dateStr(d)]) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

function longestStreak(habit: Habit): number {
  const dates = Object.entries(habit.logs).filter(([, v]) => v).map(([k]) => k).sort()
  if (dates.length === 0) return 0
  let max = 1, cur = 1
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / 86400000
    if (diff === 1) { cur++; max = Math.max(max, cur) } else cur = 1
  }
  return max
}

function computeStats(habit: Habit, days: number) {
  let total = 0, done = 0
  const d = new Date()
  for (let i = 0; i < days; i++) {
    total++
    if (habit.logs[dateStr(d)]) done++
    d.setDate(d.getDate() - 1)
  }
  return { total, done, rate: total > 0 ? done / total : 0 }
}

function bucketStyle(c: ColorDef, rate: number): string {
  if (rate === 0) return c.grid[0]!
  if (rate < 0.25) return c.grid[1]!
  if (rate < 0.5) return c.grid[2]!
  if (rate < 0.75) return c.grid[3]!
  return c.grid[4]!
}

type Tab = "calendar" | "habits" | "weekly" | "stats"

export function VisualizeHabitContent() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [tab, setTab] = useState<Tab>("calendar")
  const [showForm, setShowForm] = useState(false)
  const [selDay, setSelDay] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState<string>("teal")
  const [newTarget, setNewTarget] = useState(5)

  useEffect(() => { setHabits(loadStore()) }, [])

  function sync(h: Habit[]) { setHabits(h); localStorage.setItem(STORAGE_KEY, JSON.stringify(h)) }

  function addHabit() {
    if (!newName.trim()) { toast.error("Name is required"); return }
    sync([...habits, {
      id: crypto.randomUUID(),
      name: newName.trim(),
      color: newColor,
      target: newTarget,
      logs: {},
      createdAt: new Date().toISOString(),
    }])
    setNewName(""); setShowForm(false)
    toast.success("Habit created")
  }

  function deleteHabit(id: string) {
    sync(habits.filter(h => h.id !== id))
    toast.success("Habit deleted")
  }

  function toggleLog(habitId: string, date: string) {
    sync(habits.map(h => {
      if (h.id !== habitId) return h
      const logs = { ...h.logs }
      if (logs[date]) delete logs[date]
      else logs[date] = true
      return { ...h, logs }
    }))
  }

  function dayDoneCount(date: string) {
    return habits.filter(h => h.logs[date]).length
  }

  const visibleHabits = habits

  const gridDays = useMemo(() => getGridDays(calYear, calMonth), [calYear, calMonth])
  const weekDays = useMemo(() => getWeekDays(), [])
  const selDate = selDay ?? todayStr()

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Visualize Habit"
        icon={CheckCircle2}
        color="text-teal-500"
        badge="Visual"
        actions={
          tab === "habits" && (
            <Button size="sm" onClick={() => setShowForm(v => !v)}>
              <Plus className="w-4 h-4 mr-1" /> {showForm ? "Cancel" : "New Habit"}
            </Button>
          )
        }
      />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-fit">
          {(["calendar","habits","weekly","stats"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium transition-colors capitalize ${
                tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "calendar" && <Calendar className="w-4 h-4" />}
              {t === "habits" && <CheckCircle2 className="w-4 h-4" />}
              {t === "weekly" && <BarChart3 className="w-4 h-4" />}
              {t === "stats" && <TrendingUp className="w-4 h-4" />}
              {t}
            </button>
          ))}
        </div>

        {/* ── CALENDAR ── */}
        {tab === "calendar" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{MONTHS[calMonth]} {calYear}</h2>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) }
                  else setCalMonth(m => m - 1)
                }}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  const n = new Date(); setCalMonth(n.getMonth()); setCalYear(n.getFullYear())
                }}>
                  Today
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) }
                  else setCalMonth(m => m + 1)
                }}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DOW.map(d => (
                <span key={d} className="text-xs text-muted-foreground font-medium text-center py-1">{d}</span>
              ))}
              {gridDays.map((day, i) => {
                if (!day) return <div key={`p-${i}`} />
                const key = dateStr(day)
                const isToday = key === todayStr()
                const done = dayDoneCount(key)
                const total = habits.length
                const rate = total > 0 ? done / total : 0
                return (
                  <button
                    key={key}
                    onClick={() => setSelDay(key === selDay ? null : key)}
                    className={`aspect-square rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5
                      ${total === 0 ? "bg-muted/20" : bucketStyle(COLOR_MAP.teal!, rate)}
                      ${isToday ? "ring-2 ring-primary" : ""}
                      hover:ring-1 hover:ring-foreground/30`}
                    title={`${day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} - ${done}/${total}`}
                  >
                    <span className={`${rate > 0.4 ? "text-white" : "text-muted-foreground"}`}>{day.getDate()}</span>
                    {total > 0 && habits.length <= 5 && (
                      <span className="flex gap-0.5">
                        {habits.map(h => (
                          <span
                            key={h.id}
                            className={`w-1 h-1 rounded-full ${h.logs[key] ? COLOR_MAP[h.color]!.grid[4]! : "bg-muted-foreground/20"}`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {selDay && (
              <div className="p-5 rounded-xl border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">
                    {new Date(selDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelDay(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {habits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Create habits to start tracking</p>
                ) : (
                  <div className="space-y-2">
                    {habits.map(h => {
                      const c = COLOR_MAP[h.color]!
                      const done = !!h.logs[selDay]
                      return (
                        <button
                          key={h.id}
                          onClick={() => toggleLog(h.id, selDay)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                            done ? `${c.bg} border-transparent` : "border-border hover:bg-muted/30"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                            done ? "bg-primary border-primary" : "border-muted-foreground/30"
                          }`}>
                            {done && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className={`text-sm font-medium flex-1 ${done ? "line-through opacity-60" : ""}`}>{h.name}</span>
                          <Badge variant="secondary" className={`text-[10px] ${c.text}`}>{h.target}/wk</Badge>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              {["bg-muted/20","bg-teal-950","bg-teal-800","bg-teal-600","bg-teal-400","bg-teal-300"].map(cls => (
                <div key={cls} className={`w-3 h-3 rounded-sm ${cls}`} />
              ))}
              <span>More</span>
            </div>
          </div>
        )}

        {/* ── HABITS ── */}
        {tab === "habits" && (
          <div className="space-y-5">
            {showForm && (
              <div className="p-5 rounded-xl border bg-card space-y-4">
                <h3 className="font-semibold text-sm">New Habit</h3>
                <div>
                  <label className="text-xs font-medium block mb-1">Name</label>
                  <input
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                    placeholder="Read 30 minutes, Exercise, Meditate..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addHabit()}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-2">Color</label>
                  <div className="flex gap-3 flex-wrap">
                    {HABIT_COLORS.map(col => (
                      <button
                        key={col}
                        onClick={() => setNewColor(col)}
                        className={`w-7 h-7 rounded-full ${COLOR_MAP[col]!.bg} border-2 transition-all ${
                          newColor === col ? `border-white ring-2 ${COLOR_MAP[col]!.ring}` : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Target (times per week)</label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    className="w-20 h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                    value={newTarget}
                    onChange={e => setNewTarget(Number(e.target.value))}
                  />
                </div>
                <div className="flex gap-3">
                  <Button size="sm" onClick={addHabit}>Create Habit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {habits.length === 0 && !showForm ? (
              <div className="py-12 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground">No habits yet</p>
                <p className="text-sm mt-1">Create your first habit to start tracking</p>
                <Button className="mt-4" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-1" /> New Habit
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {habits.map(h => {
                  const c = COLOR_MAP[h.color]!
                  const streak = currentStreak(h)
                  const longest = longestStreak(h)
                  const totalLogs = Object.values(h.logs).filter(Boolean).length
                  return (
                    <div key={h.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/20 transition-colors">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${c.bg} ring-1 ${c.ring}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{h.name}</p>
                        <p className="text-xs text-muted-foreground">{h.target}× / week · {totalLogs} total</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {streak > 0 && (
                          <div className="flex items-center gap-1">
                            <Flame className="w-4 h-4 text-orange-400" />
                            <span className="text-xs font-bold text-orange-400">{streak}</span>
                          </div>
                        )}
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Best</p>
                          <p className="text-sm font-bold">{longest}</p>
                        </div>
                        <Button variant="ghost" size="icon-sm" onClick={() => deleteHabit(h.id)}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── WEEKLY ── */}
        {tab === "weekly" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">This Week</h2>
              <p className="text-sm text-muted-foreground">
                {weekDays[0]!.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — {weekDays[6]!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            {habits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No habits yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-muted-foreground font-medium pb-3 pr-4">Habit</th>
                      {weekDays.map((d, i) => {
                        const isToday = dateStr(d) === todayStr()
                        return (
                          <th key={i} className={`text-center pb-3 px-2 ${isToday ? "text-foreground" : "text-muted-foreground"}`}>
                            <span className="text-xs font-medium">{DOW[i]}</span>
                            <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</div>
                          </th>
                        )
                      })}
                      <th className="text-center pb-3 pl-3 text-xs text-muted-foreground font-medium">Done</th>
                    </tr>
                  </thead>
                  <tbody>
                    {habits.map(h => {
                      const c = COLOR_MAP[h.color]!
                      const weekDates = weekDays.map(d => dateStr(d))
                      const doneThisWeek = weekDates.filter(d => h.logs[d]).length
                      const targetMetThisWeek = doneThisWeek >= h.target
                      return (
                        <tr key={h.id} className="border-t border-border">
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${c.bg} ring-1 ${c.ring}`} />
                              <span className="font-medium text-sm">{h.name}</span>
                            </div>
                          </td>
                          {weekDates.map((d, i) => {
                            const done = !!h.logs[d]
                            const isToday = d === todayStr()
                            return (
                              <td key={i} className="text-center py-2 px-1">
                                <button
                                  onClick={() => toggleLog(h.id, d)}
                                  className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-all ${
                                    done
                                      ? `${c.bg} border-transparent`
                                      : `border-muted-foreground/20 hover:border-muted-foreground/40 ${isToday ? "border-primary/40" : ""}`
                                  }`}
                                >
                                  {done && <Check className={`w-4 h-4 ${c.text}`} />}
                                </button>
                              </td>
                            )
                          })}
                          <td className="text-center pl-3">
                            <span className={`text-sm font-bold ${targetMetThisWeek ? "text-green-400" : "text-muted-foreground"}`}>
                              {doneThisWeek}/{h.target}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── STATS ── */}
        {tab === "stats" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Statistics</h2>
            {habits.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>No habits to analyze</p>
              </div>
            ) : (
              habits.map(h => {
                const c = COLOR_MAP[h.color]!
                const s30 = computeStats(h, 30)
                const s7 = computeStats(h, 7)
                const avgWeek = s7.done
                const streak = currentStreak(h)
                const longest = longestStreak(h)
                const totalDone = Object.values(h.logs).filter(Boolean).length

                const days = Array.from({ length: 14 }, (_, i) => {
                  const d = new Date()
                  d.setDate(d.getDate() - (13 - i))
                  return { date: dateStr(d), done: !!h.logs[dateStr(d)] }
                })

                return (
                  <div key={h.id} className="p-5 rounded-xl border bg-card space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${c.bg} ring-1 ${c.ring}`} />
                      <h3 className="font-semibold text-sm">{h.name}</h3>
                      <Badge variant="secondary" className={`text-[10px] ${c.text}`}>{h.target}/wk</Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold">{totalDone}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold">{Math.round(s30.rate * 100)}%</p>
                        <p className="text-xs text-muted-foreground">30-day rate</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <p className="text-2xl font-bold">{avgWeek.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Avg/week</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-center gap-1">
                          <Flame className="w-4 h-4 text-orange-400" />
                          <p className="text-2xl font-bold">{streak}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Streak (best: {longest})</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Last 14 days</p>
                      <div className="flex gap-1 items-end h-16">
                        {days.map(d => {
                          const maxBar = Math.max(...days.map(x => x.done ? 1 : 0), 1)
                          const hPx = d.done ? 100 : 8
                          return (
                            <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className={`w-full rounded-sm transition-all ${d.done ? c.grid[4]! : "bg-muted/20"}`}
                                style={{ height: `${hPx}%` }}
                              />
                              <span className="text-[8px] text-muted-foreground">
                                {new Date(d.date + "T12:00:00").getDate()}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* Summary row */}
            {habits.length > 0 && (
              <div className="p-5 rounded-xl border bg-card">
                <h3 className="font-semibold text-sm mb-3">Overall</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">
                      {habits.reduce((s, h) => s + Object.values(h.logs).filter(Boolean).length, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total completions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {habits.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Active habits</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.round(habits.reduce((s, h) => s + computeStats(h, 7).done, 0) / Math.max(habits.length, 1) * 10) / 10}
                    </p>
                    <p className="text-xs text-muted-foreground">Avg completions/week</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
