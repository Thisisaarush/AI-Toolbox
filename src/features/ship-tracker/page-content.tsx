"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Rocket, Plus, Trash2, Calendar, Target, BarChart3,
  Flame, CheckCircle2, XCircle, TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { type Challenge, type DailyEntry, MOOD_EMOJIS, MOOD_LABELS } from "./types"

const STORAGE_KEY = "ship-tracker-v1"

interface ShipTrackerData {
  challenges: Challenge[]
  activeChallengeId: string | null
}

function load(): ShipTrackerData {
  if (typeof window === "undefined") return { challenges: [], activeChallengeId: null }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"challenges":[],"activeChallengeId":null}') } catch { return { challenges: [], activeChallengeId: null } }
}
function save(d: ShipTrackerData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) }
function today(): string { return new Date().toISOString().split("T")[0]! }
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
function fmtDate(d: Date): string { return d.toISOString().split("T")[0]! }

export function ShipTrackerContent() {
  const [data, setData] = useState<ShipTrackerData>({ challenges: [], activeChallengeId: null })
  const [view, setView] = useState<"list" | "challenge" | "new">("list")

  // New challenge form
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newDeadline, setNewDeadline] = useState("")
  const [newCommitment, setNewCommitment] = useState("")
  const [newGoal, setNewGoal] = useState("")

  useEffect(() => { setData(load()) }, [])

  const activeChallenge = data.challenges.find((c) => c.id === data.activeChallengeId) ?? null

  function createChallenge() {
    if (!newName.trim() || !newDeadline.trim()) { toast.error("Name and deadline required"); return }
    const challenge: Challenge = {
      id: uid(), name: newName.trim(), description: newDesc.trim(),
      deadline: newDeadline, dailyCommitment: newCommitment.trim(),
      publicGoal: newGoal.trim(), startDate: today(), entries: [], archived: false,
    }
    const next: ShipTrackerData = { challenges: [challenge, ...data.challenges], activeChallengeId: challenge.id }
    setData(next)
    save(next)
    setNewName(""); setNewDesc(""); setNewDeadline(""); setNewCommitment(""); setNewGoal("")
    setView("challenge")
    toast.success("Challenge created!")
  }

  function selectChallenge(id: string) {
    const next = { ...data, activeChallengeId: id }
    setData(next)
    save(next)
    setView("challenge")
  }

  function archiveChallenge(id: string) {
    setData((prev) => {
      const challenges = prev.challenges.map((c) => c.id === id ? { ...c, archived: true } : c)
      const activeChallengeId = prev.activeChallengeId === id ? null : prev.activeChallengeId
      const next = { challenges, activeChallengeId }
      save(next)
      return next
    })
    setView("list")
  }

  function logDay(entry: DailyEntry) {
    if (!activeChallenge) return
    setData((prev) => {
      const challenges = prev.challenges.map((c) => {
        if (c.id !== activeChallenge.id) return c
        const existing = c.entries.findIndex((e) => e.date === entry.date)
        const entries = existing >= 0 ? c.entries.map((e, i) => i === existing ? entry : e) : [...c.entries, entry]
        return { ...c, entries }
      })
      const next = { ...prev, challenges }
      save(next)
      return next
    })
    toast.success("Logged!")
  }

  function deleteEntry(date: string) {
    if (!activeChallenge) return
    setData((prev) => {
      const challenges = prev.challenges.map((c) => {
        if (c.id !== activeChallenge.id) return c
        return { ...c, entries: c.entries.filter((e) => e.date !== date) }
      })
      const next = { ...prev, challenges }
      save(next)
      return next
    })
  }

  function progress(challenge: Challenge): { completed: number; total: number; pct: number; streak: number } {
    const start = new Date(challenge.startDate)
    const end = new Date(challenge.deadline)
    const now = new Date()
    const total = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
    const elapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000))
    const sorted = [...challenge.entries].sort((a, b) => b.date.localeCompare(a.date))
    let streak = 0
    for (const e of sorted) {
      if (e.completed) streak++
      else if (!e.completed && streak > 0) break
      else break
    }
    const completed = challenge.entries.filter((e) => e.completed).length
    return { completed, total, pct: Math.min(100, Math.round((completed / total) * 100)), streak }
  }

  // ── List View ──────────────────────────────────────────────────────────────
  if (view === "list") {
    const active = data.challenges.find((c) => c.id === data.activeChallengeId && !c.archived)
    return (
      <>
        <ToolHeader title="Ship Tracker" icon={Rocket} color="text-amber-500" badge="Personal" />
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <Button onClick={() => setView("new")}><Plus className="w-4 h-4" /> New Challenge</Button>

          {active && (
            <Card className="border-t-2 border-t-indigo-500 cursor-pointer hover:shadow-md transition-all" onClick={() => setView("challenge")}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold">{active.name}</h3>
                  <Badge variant="secondary" className="text-xs">{progress(active).completed}/{progress(active).total} days</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{active.description}</p>
                <div className="mt-2 h-2 bg-muted rounded-full">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${progress(active).pct}%` }} />
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" /> {progress(active).streak} day streak</span>
                  <span>{active.dailyCommitment}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {(data.challenges.length === 0 || !active) && (
            <div className="text-center py-16">
              <Rocket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm">No active challenges. Start shipping!</p>
            </div>
          )}

          {/* Archived */}
          {data.challenges.filter((c) => c.archived).length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Archived</h3>
              <div className="space-y-2">
                {data.challenges.filter((c) => c.archived).map((c) => (
                  <Card key={c.id} size="sm" className="opacity-60">
                    <CardContent className="py-2 flex items-center justify-between">
                      <span className="text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{progress(c).completed}/{progress(c).total}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // ── New Challenge Form ───────────────────────────────────────────────────────
  if (view === "new") {
    return (
      <>
        <ToolHeader title="New Challenge" icon={Rocket} color="text-amber-500" badge="Personal" actions={<Button variant="ghost" size="sm" onClick={() => setView("list")}>Back</Button>} />
        <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
          <Input placeholder="Challenge name (e.g. Ship 30 in 30)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Textarea placeholder="Description or goal" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
          <Input type="date" placeholder="Deadline" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
          <Input placeholder="Daily commitment (e.g. Write 500 words)" value={newCommitment} onChange={(e) => setNewCommitment(e.target.value)} />
          <Input placeholder="Public goal (e.g. Ship an MVP)" value={newGoal} onChange={(e) => setNewGoal(e.target.value)} />
          <Button onClick={createChallenge} className="w-full"><Rocket className="w-4 h-4" /> Start Shipping</Button>
        </div>
      </>
    )
  }

  // ── Challenge Detail View ────────────────────────────────────────────────────
  if (!activeChallenge) {
    setView("list")
    return null
  }

  const p = progress(activeChallenge)
  const todayEntry = activeChallenge.entries.find((e) => e.date === today())
  const sortedEntries = [...activeChallenge.entries].sort((a, b) => b.date.localeCompare(a.date))

  // Heatmap
  const heatmapDays = 30
  const heatmapData = Array.from({ length: heatmapDays }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (heatmapDays - 1 - i))
    const dateStr = fmtDate(d)
    const entry = activeChallenge.entries.find((e) => e.date === dateStr)
    return { date: dateStr, completed: entry?.completed ?? false, logged: !!entry }
  })

  const shameMode = p.streak <= 1 && activeChallenge.entries.length >= 2

  return (
    <>
      <ToolHeader title={activeChallenge.name} icon={Rocket} color="text-amber-500" badge="Personal" actions={
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>All</Button>
          <Button variant="ghost" size="sm" onClick={() => archiveChallenge(activeChallenge.id)}>Archive</Button>
        </div>
      } />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-muted-foreground">{activeChallenge.dailyCommitment}</p>
                <p className="text-xs text-muted-foreground">Target: {activeChallenge.publicGoal}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold">{p.pct}%</span>
                <p className="text-xs text-muted-foreground">{p.completed}/{p.total} days</p>
              </div>
            </div>
            <div className="h-3 bg-muted rounded-full">
              <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${p.pct}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="py-3 text-center">
            <Flame className={`w-5 h-5 mx-auto mb-1 ${p.streak >= 3 ? "text-orange-500" : "text-muted-foreground"}`} />
            <p className="text-lg font-bold">{p.streak}</p>
            <p className="text-[10px] text-muted-foreground">Day streak</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg font-bold">{p.completed}</p>
            <p className="text-[10px] text-muted-foreground">Done</p>
          </CardContent></Card>
          <Card><CardContent className="py-3 text-center">
            <Target className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-lg font-bold">{p.total - p.completed}</p>
            <p className="text-[10px] text-muted-foreground">Remaining</p>
          </CardContent></Card>
        </div>

        {/* Shame card */}
        {shameMode && (
          <Card className="border-t-2 border-t-red-500 bg-red-50 dark:bg-red-950">
            <CardContent className="py-4 text-center">
              <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <h3 className="text-lg font-bold text-red-600">Accountability Check!</h3>
              <p className="text-sm text-red-500">You missed 2+ days. Get back to shipping!</p>
            </CardContent>
          </Card>
        )}

        {/* Today's log */}
        <Card>
          <CardHeader><CardTitle>{todayEntry ? "Today's Entry" : "Log Today"}</CardTitle></CardHeader>
          <CardContent>
            {todayEntry ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {todayEntry.completed ? <span className="text-green-500">✓ Completed</span> : <span className="text-amber-500">○ In progress</span>}
                  </span>
                  <div className="flex items-center gap-1">
                    <span title={MOOD_LABELS[todayEntry.mood]}>{MOOD_EMOJIS[todayEntry.mood]}</span>
                    <Button variant="ghost" size="icon-xs" onClick={() => deleteEntry(today())}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{todayEntry.note}</p>
                <Button variant="ghost" size="xs" onClick={() => logDay({ ...todayEntry, completed: !todayEntry.completed })}>
                  {todayEntry.completed ? "Mark incomplete" : "Mark complete"}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button onClick={() => logDay({ date: today(), note: "", completed: true, mood: 3 })}>
                    <CheckCircle2 className="w-4 h-4" /> Done
                  </Button>
                  <Button variant="outline" onClick={() => logDay({ date: today(), note: "", completed: false, mood: 3 })}>
                    <XCircle className="w-4 h-4" /> Skip
                  </Button>
                </div>
                <Input
                  placeholder="Optional note..."
                  value=""
                  onChange={() => {}}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      logDay({ date: today(), note: (e.target as HTMLInputElement).value, completed: true, mood: 3 })
                    }
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mood/note quick log */}
        <div className="flex gap-1">
          {([1, 2, 3, 4, 5] as const).map((mood) => (
            <button
              key={mood}
              onClick={() => logDay({ date: today(), note: todayEntry?.note ?? "", completed: todayEntry?.completed ?? false, mood })}
              title={MOOD_LABELS[mood]}
              className={`text-lg w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                todayEntry?.mood === mood ? "bg-foreground/10 ring-2 ring-foreground/30" : "hover:bg-muted"
              }`}
            >
              {MOOD_EMOJIS[mood]}
            </button>
          ))}
        </div>

        {/* Heatmap */}
        <Card>
          <CardHeader><CardTitle>Last 30 Days</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {heatmapData.map((d) => (
                <div
                  key={d.date}
                  title={d.date}
                  className={`w-5 h-5 rounded ${d.completed ? "bg-green-500" : d.logged ? "bg-amber-300" : "bg-muted"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              <span>Missed</span>
              <div className="w-3 h-3 rounded bg-muted" />
              <div className="w-3 h-3 rounded bg-amber-300" />
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Done</span>
            </div>
          </CardContent>
        </Card>

        {/* Entry history */}
        {sortedEntries.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Log</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {sortedEntries.slice(0, 14).map((e) => (
                <div key={e.date} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className={e.completed ? "text-green-500" : "text-amber-500"}>
                      {e.completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{e.date}</span>
                    <span className="text-xs">{e.note}</span>
                  </div>
                  <span title={MOOD_LABELS[e.mood]}>{MOOD_EMOJIS[e.mood]}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
