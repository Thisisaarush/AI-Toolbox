"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Timer, Brain, Moon, Sun, Droplets, Coffee, Dumbbell,
  TrendingUp, Activity, Play, Pause, RotateCcw,
  Plus, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type DailyLog, type DevHealthData,
  type EnergyLevel, type MoodLevel,
  ENERGY_LABELS, MOOD_LABELS,
  POMODORO_WORK_MINUTES, POMODORO_BREAK_MINUTES, POMODORO_LONG_BREAK_MINUTES,
} from "./types"

const STORAGE_KEY = "dev-health-v1"

function load(): DevHealthData {
  if (typeof window === "undefined") return { logs: [], streak: 0, lastLogDate: "" }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"logs":[],"streak":0,"lastLogDate":""}') } catch { return { logs: [], streak: 0, lastLogDate: "" } }
}
function save(d: DevHealthData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) }
function uid(): string { return Math.random().toString(36).slice(2, 10) }
function today(): string { return new Date().toISOString().split("T")[0]! }

function newLog(): DailyLog {
  return { date: today(), sleep: 7, energy: 3, mood: 3, water: 4, caffeine: 1, exercised: false, pomodorosCompleted: 0, notes: "" }
}

export function DevHealthContent() {
  const [data, setData] = useState<DevHealthData>({ logs: [], streak: 0, lastLogDate: "" })
  const [pomodoroMinutes, setPomodoroMinutes] = useState(POMODORO_WORK_MINUTES)
  const [pomodoroSeconds, setPomodoroSeconds] = useState(0)
  const [pomodoroRunning, setPomodoroRunning] = useState(false)
  const [pomodoroMode, setPomodoroMode] = useState<"work" | "break" | "long-break">("work")
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [activeTab, setActiveTab] = useState<"pomodoro" | "log" | "stats">("pomodoro")

  useEffect(() => {
    const d = load()
    setData(d)
    setPomodoroMinutes(POMODORO_WORK_MINUTES)
    setPomodoroSeconds(0)
  }, [])

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  // ── Pomodoro ────────────────────────────────────────────────────────────────
  function startTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPomodoroRunning(true)
    intervalRef.current = setInterval(() => {
      setPomodoroSeconds((s) => {
        if (s > 0) return s - 1
        return 59
      })
      setPomodoroMinutes((m) => {
        if (pomodoroSeconds === 0) {
          if (m === 0) return 0
          return m - 1
        }
        return m
      })
    }, 1000)
  }

  function pauseTimer() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPomodoroRunning(false)
  }

  function resetTimer() {
    pauseTimer()
    setPomodoroMinutes(POMODORO_WORK_MINUTES)
    setPomodoroSeconds(0)
    setPomodoroMode("work")
  }

  useEffect(() => {
    if (pomodoroMinutes === 0 && pomodoroSeconds === 0 && pomodoroRunning) {
      pauseTimer()
      if (pomodoroMode === "work") {
        setPomodoroCount((c) => c + 1)
        const isLong = pomodoroCount > 0 && (pomodoroCount + 1) % 4 === 0
        if (isLong) {
          setPomodoroMinutes(POMODORO_LONG_BREAK_MINUTES)
          setPomodoroMode("long-break")
          toast.success("Long break! You earned it.")
        } else {
          setPomodoroMinutes(POMODORO_BREAK_MINUTES)
          setPomodoroMode("break")
          toast.success("Break time!")
        }
      } else {
        setPomodoroMinutes(POMODORO_WORK_MINUTES)
        setPomodoroMode("work")
        toast.info("Focus time!")
      }
      setPomodoroSeconds(0)
    }
  }, [pomodoroMinutes, pomodoroSeconds, pomodoroRunning, pomodoroMode, pomodoroCount])

  const totalSeconds = pomodoroMode === "work" ? POMODORO_WORK_MINUTES * 60 : pomodoroMode === "long-break" ? POMODORO_LONG_BREAK_MINUTES * 60 : POMODORO_BREAK_MINUTES * 60
  const elapsed = totalSeconds - (pomodoroMinutes * 60 + pomodoroSeconds)
  const pct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  // ── Daily Log ──────────────────────────────────────────────────────────────
  const todayLog = data.logs.find((l) => l.date === today())
  const activeLog = todayLog ?? newLog()

  function saveLog(log: DailyLog) {
    setData((prev) => {
      const existing = prev.logs.findIndex((l) => l.date === log.date)
      const logs = existing >= 0 ? prev.logs.map((l, i) => i === existing ? log : l) : [...prev.logs, log]
      const todayIdx = logs.findIndex((l) => l.date === today())
      let streak = 0
      if (todayIdx >= 0) {
        streak = 1
        for (let i = todayIdx - 1; i >= 0; i--) {
          const curr = new Date(logs[i]!.date)
          const prev = new Date(logs[i + 1]!.date)
          const diff = (prev.getTime() - curr.getTime()) / 86400000
          if (diff === 1) streak++
          else break
        }
      }
      const next: DevHealthData = { logs, streak, lastLogDate: streak > 0 ? today() : prev.lastLogDate }
      save(next)
      return next
    })
    toast.success("Log saved")
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const recentLogs = data.logs.slice(-30)
  const avgSleep = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.sleep, 0) / recentLogs.length * 10) / 10 : 0
  const avgEnergy = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.energy, 0) / recentLogs.length * 10) / 10 : 0
  const avgMood = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.mood, 0) / recentLogs.length * 10) / 10 : 0
  const avgWater = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.water, 0) / recentLogs.length * 10) / 10 : 0
  const avgCaffeine = recentLogs.length > 0 ? Math.round(recentLogs.reduce((s, l) => s + l.caffeine, 0) / recentLogs.length * 10) / 10 : 0
  const totalPomodoros = data.logs.reduce((s, l) => s + l.pomodorosCompleted, 0)

  // Heatmap data
  const heatmapDays = 35
  const heatmapData = Array.from({ length: heatmapDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (heatmapDays - 1 - i))
    const dateStr = d.toISOString().split("T")[0]!
    const log = data.logs.find((l) => l.date === dateStr)
    return { date: dateStr, logged: !!log }
  })

  function heatColor(logged: boolean): string {
    return logged ? "bg-green-500" : "bg-muted"
  }

  return (
    <>
      <ToolHeader title="Dev Health" icon={Brain} color="text-indigo-400" badge="Personal" />
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Tab bar */}
        <div className="flex gap-1.5 border-b border-border mb-8">
          {(["pomodoro", "log", "stats"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-all capitalize ${
                activeTab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "log" ? "Daily Log" : t === "pomodoro" ? "Pomodoro" : "Stats"}
            </button>
          ))}
        </div>

        {/* ── Pomodoro ──────────────────────────────────────────────────────── */}
        {activeTab === "pomodoro" && (
          <div className="max-w-sm mx-auto text-center space-y-8">
            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
                <circle
                  cx="50" cy="50" r={radius} fill="none" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className={pomodoroMode === "work" ? "stroke-indigo-500" : "stroke-emerald-500"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold tabular-nums">
                  {String(pomodoroMinutes).padStart(2, "0")}:{String(pomodoroSeconds).padStart(2, "0")}
                </span>
                <span className="text-xs text-muted-foreground mt-1 capitalize">{pomodoroMode.replace("-", " ")}</span>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              {pomodoroRunning ? (
                <Button onClick={pauseTimer}><Pause className="w-4 h-4" /> Pause</Button>
              ) : (
                <Button onClick={startTimer} disabled={pomodoroMinutes === 0 && pomodoroSeconds === 0}><Play className="w-4 h-4" /> Start</Button>
              )}
              <Button variant="outline" onClick={resetTimer}><RotateCcw className="w-4 h-4" /> Reset</Button>
            </div>

            <p className="text-sm text-muted-foreground">Pomodoros completed today: {todayLog?.pomodorosCompleted ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total all time: {totalPomodoros}</p>
          </div>
        )}

        {/* ── Daily Log ─────────────────────────────────────────────────────── */}
        {activeTab === "log" && (
          <div className="max-w-lg mx-auto space-y-5">
            <Card>
              <CardHeader><CardTitle>Log for {activeLog.date}</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                {/* Sleep */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Moon className="w-4 h-4" /> Sleep (hours)</label>
                  <input type="number" min={0} max={16} step={0.5} value={activeLog.sleep} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) saveLog({ ...activeLog, sleep: v }) }} className="flex h-9 w-full min-w-0 rounded-xl border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40" />
                </div>

                {/* Energy */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Sun className="w-4 h-4" /> Energy</label>
                  <div className="flex gap-1.5">
                    {([1, 2, 3, 4, 5] as EnergyLevel[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => saveLog({ ...activeLog, energy: v })}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          activeLog.energy === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        {ENERGY_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mood */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Activity className="w-4 h-4" /> Mood</label>
                  <div className="flex gap-1.5">
                    {([1, 2, 3, 4, 5] as MoodLevel[]).map((v) => (
                      <button
                        key={v}
                        onClick={() => saveLog({ ...activeLog, mood: v })}
                        className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${
                          activeLog.mood === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        {MOOD_LABELS[v]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Water */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Droplets className="w-4 h-4" /> Water (glasses)</label>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => { if ((activeLog.water ?? 0) > 0) saveLog({ ...activeLog, water: activeLog.water - 1 }) }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-bold w-8 text-center">{activeLog.water}</span>
                    <Button variant="ghost" size="icon" onClick={() => saveLog({ ...activeLog, water: activeLog.water + 1 })}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Caffeine */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Coffee className="w-4 h-4" /> Caffeine (cups)</label>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => { if ((activeLog.caffeine ?? 0) > 0) saveLog({ ...activeLog, caffeine: activeLog.caffeine - 1 }) }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <span className="text-lg font-bold w-8 text-center">{activeLog.caffeine}</span>
                    <Button variant="ghost" size="icon" onClick={() => saveLog({ ...activeLog, caffeine: activeLog.caffeine + 1 })}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Exercise */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Dumbbell className="w-4 h-4" /> Exercise</label>
                  <button
                    onClick={() => saveLog({ ...activeLog, exercised: !activeLog.exercised })}
                    className={`px-4 py-2 text-xs font-medium rounded-xl border transition-all ${
                      activeLog.exercised ? "bg-green-500 text-white border-green-500" : "border-border text-muted-foreground hover:border-foreground/30"
                    }`}
                  >
                    {activeLog.exercised ? "✅ Done!" : "Mark as done"}
                  </button>
                </div>

                {/* Pomodoros */}
                <div>
                  <label className="text-xs font-medium flex items-center gap-2 mb-1"><Timer className="w-4 h-4" /> Pomodoros Completed</label>
                  <input type="number" min={0} value={activeLog.pomodorosCompleted} onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) saveLog({ ...activeLog, pomodorosCompleted: v }) }} className="flex h-9 w-full min-w-0 rounded-xl border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40" />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea
                    placeholder="How was your day?"
                    value={activeLog.notes}
                    onChange={(e) => { const val = e.target.value; setData((prev) => { const log = { ...activeLog, notes: val }; const existing = prev.logs.findIndex((l) => l.date === log.date); const logs = existing >= 0 ? prev.logs.map((l, i) => i === existing ? log : l) : [...prev.logs, log]; save({ ...prev, logs }); return { ...prev, logs } }) }}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        {activeTab === "stats" && (
          <div className="space-y-8">
            {/* Streak */}
            <div className="text-center">
              <span className="text-5xl font-bold">{data.streak}</span>
              <span className="text-lg text-muted-foreground ml-2">day streak</span>
            </div>

            {/* Averages */}
            <div className="grid grid-cols-4 gap-4">
              <Card><CardContent className="py-4 text-center">
                <Moon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{avgSleep}h</p>
                <p className="text-xs text-muted-foreground">Avg Sleep</p>
              </CardContent></Card>
              <Card><CardContent className="py-4 text-center">
                <Sun className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{avgEnergy}</p>
                <p className="text-xs text-muted-foreground">Avg Energy</p>
              </CardContent></Card>
              <Card><CardContent className="py-4 text-center">
                <Activity className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{avgMood}</p>
                <p className="text-xs text-muted-foreground">Avg Mood</p>
              </CardContent></Card>
              <Card><CardContent className="py-4 text-center">
                <Droplets className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{avgWater}</p>
                <p className="text-xs text-muted-foreground">Avg Water</p>
              </CardContent></Card>
            </div>

            {/* Exercise rate */}
            <Card>
              <CardHeader><CardTitle>Exercise</CardTitle></CardHeader>
              <CardContent>
                {recentLogs.length > 0
                  ? <p className="text-sm">{recentLogs.filter((l) => l.exercised).length}/{recentLogs.length} days exercised (last 30)</p>
                  : <p className="text-sm text-muted-foreground">No data yet</p>}
              </CardContent>
            </Card>

            {/* Heatmap */}
            <Card>
              <CardHeader><CardTitle>Last 35 Days</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1.5">
                  {heatmapData.map((d) => (
                    <div
                      key={d.date}
                      title={d.date}
                      className={`w-5 h-5 rounded ${heatColor(d.logged)}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>Less</span>
                  <div className="w-4 h-4 rounded bg-muted" />
                  <div className="w-4 h-4 rounded bg-green-500" />
                  <span>More</span>
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            {recentLogs.length > 2 && (
              <Card>
                <CardHeader><CardTitle>Tips</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-sm">
                  {avgSleep < 7 && <p>• Try to get more sleep (aim for 7-8h)</p>}
                  {avgWater < 5 && <p>• Increase water intake (aim for 8 glasses)</p>}
                  {recentLogs.filter((l) => l.exercised).length < 5 && <p>• Aim to exercise more (3+ times/week)</p>}
                  {avgCaffeine > 2 && <p>• Consider reducing caffeine (limit to 2 cups)</p>}
                  {(avgSleep >= 7 && avgWater >= 5 && recentLogs.filter((l) => l.exercised).length >= 5) && <p>• Great job maintaining healthy habits!</p>}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
