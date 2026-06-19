"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Dumbbell, Plus, Trash2, Sparkles, ChevronRight, X,
  Trophy, TrendingUp, Calendar, Loader2, ExternalLink,
  BarChart3, Clock, Flame,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  Exercise, WorkoutSession, SessionExercise, WorkoutSet,
  PersonalRecord, WorkoutProgram, Goal, Equipment, Experience, MuscleGroup,
} from "./types"
import { PRESET_EXERCISES } from "./exercises"
import { MUSCLE_GROUP_COLORS } from "./types"
import { ConnectButton } from "@/components/shared/connect-button"

const STORAGE_KEY = "workout-log-v1"
const PROGRAM_KEY = "workout-programs-v1"
const PR_KEY = "workout-prs-v1"

function loadSessions(): WorkoutSession[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveSessions(s: WorkoutSession[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }
function loadPrograms(): WorkoutProgram[] {
  try { return JSON.parse(localStorage.getItem(PROGRAM_KEY) ?? "[]") } catch { return [] }
}
function savePrograms(p: WorkoutProgram[]) { localStorage.setItem(PROGRAM_KEY, JSON.stringify(p)) }
function loadPRs(): PersonalRecord[] {
  try { return JSON.parse(localStorage.getItem(PR_KEY) ?? "[]") } catch { return [] }
}
function savePRs(p: PersonalRecord[]) { localStorage.setItem(PR_KEY, JSON.stringify(p)) }

// Brzycki formula for 1RM estimate
function estimate1RM(weight: number, reps: number) {
  if (reps === 1) return weight
  return Math.round(weight * (36 / (37 - reps)))
}

function weeklyVolume(sessions: WorkoutSession[]) {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)
  return sessions
    .filter((s) => new Date(s.date) >= weekAgo)
    .reduce((acc, s) => acc + s.exercises.reduce((a, e) =>
      a + e.sets.reduce((b, set) =>
        b + ((set.weight ?? 0) * (set.reps ?? 0)), 0), 0), 0)
}

type View = "log" | "sessions" | "programs" | "progress" | "add-session" | "session-detail" | "program-detail"

export function WorkoutLogContent() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [programs, setPrograms] = useState<WorkoutProgram[]>([])
  const [prs, setPRs] = useState<PersonalRecord[]>([])
  const [customExercises, setCustomExercises] = useState<Exercise[]>([])
  const [view, setView] = useState<View>("sessions")
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  // Add session form
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10))
  const [sessionName, setSessionName] = useState("")
  const [sessionDuration, setSessionDuration] = useState("")
  const [sessionNotes, setSessionNotes] = useState("")
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([])
  const [exerciseSearch, setExerciseSearch] = useState("")

  // AI program generation
  const [genGoal, setGenGoal] = useState<Goal>("muscle")
  const [genDays, setGenDays] = useState("4")
  const [genEquipment, setGenEquipment] = useState<Equipment>("gym")
  const [genExperience, setGenExperience] = useState<Experience>("intermediate")
  const [genLoading, setGenLoading] = useState(false)

  // Strava
  const [stravaToken, setStravaToken] = useState("")
  const [stravaLoading, setStravaLoading] = useState(false)
  const [showStravaForm, setShowStravaForm] = useState(false)

  // Custom exercise
  const [customName, setCustomName] = useState("")
  const [showAddExercise, setShowAddExercise] = useState(false)

  useEffect(() => {
    setSessions(loadSessions()); setPrograms(loadPrograms()); setPRs(loadPRs())
    try { setCustomExercises(JSON.parse(localStorage.getItem("workout-custom-ex-v1") ?? "[]")) } catch { /* empty */ }
  }, [])
  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { savePrograms(programs) }, [programs])
  useEffect(() => { savePRs(prs) }, [prs])
  useEffect(() => { localStorage.setItem("workout-custom-ex-v1", JSON.stringify(customExercises)) }, [customExercises])

  const allExercises = useMemo(() => [...PRESET_EXERCISES, ...customExercises], [customExercises])

  const filteredExercises = useMemo(() => {
    if (!exerciseSearch.trim()) return allExercises.slice(0, 20)
    const q = exerciseSearch.toLowerCase()
    return allExercises.filter((e) =>
      e.name.toLowerCase().includes(q) || e.muscleGroups.some((m) => m.toLowerCase().includes(q))
    ).slice(0, 15)
  }, [allExercises, exerciseSearch])

  const selectedSession = useMemo(() => sessions.find((s) => s.id === selectedSessionId) ?? null, [sessions, selectedSessionId])
  const selectedProgram = useMemo(() => programs.find((p) => p.id === selectedProgramId) ?? null, [programs, selectedProgramId])

  const volumeStats = useMemo(() => ({
    weekly: weeklyVolume(sessions),
    total: sessions.reduce((acc, s) => acc + s.exercises.reduce((a, e) =>
      a + e.sets.reduce((b, set) => b + ((set.weight ?? 0) * (set.reps ?? 0)), 0), 0), 0),
    totalSessions: sessions.length,
  }), [sessions])

  function addExerciseToSession(exercise: Exercise) {
    const exists = sessionExercises.find((se) => se.exerciseId === exercise.id)
    if (exists) { toast.info("Already added"); return }
    setSessionExercises((prev) => [...prev, {
      exerciseId: exercise.id,
      sets: [{ id: crypto.randomUUID(), exerciseId: exercise.id, weight: undefined, reps: undefined }],
    }])
    setExerciseSearch("")
  }

  function addSet(exerciseId: string) {
    setSessionExercises((prev) => prev.map((se) =>
      se.exerciseId === exerciseId
        ? { ...se, sets: [...se.sets, { id: crypto.randomUUID(), exerciseId, weight: undefined, reps: undefined }] }
        : se
    ))
  }

  function updateSet(exerciseId: string, setId: string, field: keyof WorkoutSet, value: string) {
    setSessionExercises((prev) => prev.map((se) =>
      se.exerciseId === exerciseId
        ? {
            ...se,
            sets: se.sets.map((s) =>
              s.id === setId
                ? { ...s, [field]: field === "notes" ? value : parseFloat(value) || undefined }
                : s
            ),
          }
        : se
    ))
  }

  function removeExercise(exerciseId: string) {
    setSessionExercises((prev) => prev.filter((se) => se.exerciseId !== exerciseId))
  }

  function detectPRs(session: WorkoutSession): string[] {
    const newPRIds: string[] = []
    const updatedPRs = [...prs]

    for (const se of session.exercises) {
      const ex = allExercises.find((e) => e.id === se.exerciseId)
      if (!ex || ex.muscleGroups.includes("Cardio")) continue

      for (const set of se.sets) {
        if (!set.weight || !set.reps) continue
        const est1RM = estimate1RM(set.weight, set.reps)
        const existing = updatedPRs.find((pr) => pr.exerciseId === se.exerciseId)
        if (!existing) {
          updatedPRs.push({
            exerciseId: se.exerciseId,
            weight1RM: est1RM,
            maxReps: set.reps,
            maxWeight: set.weight,
            date: session.date,
          })
          newPRIds.push(se.exerciseId)
        } else if (est1RM > existing.weight1RM) {
          existing.weight1RM = est1RM
          existing.maxWeight = Math.max(existing.maxWeight, set.weight)
          existing.maxReps = Math.max(existing.maxReps, set.reps)
          existing.date = session.date
          newPRIds.push(se.exerciseId)
        }
      }
    }

    setPRs(updatedPRs)
    return newPRIds
  }

  function saveSession() {
    if (sessionExercises.length === 0) { toast.error("Add at least one exercise"); return }
    const now = new Date().toISOString()
    const session: WorkoutSession = {
      id: crypto.randomUUID(),
      date: sessionDate,
      name: sessionName.trim() || undefined,
      exercises: sessionExercises,
      durationMinutes: sessionDuration ? parseInt(sessionDuration) : undefined,
      notes: sessionNotes.trim() || undefined,
      createdAt: now,
    }
    const prIds = detectPRs(session)
    if (prIds.length > 0) {
      session.prsAchieved = prIds
      toast.success(`New PR${prIds.length > 1 ? "s" : ""}! ${prIds.map((id) => allExercises.find((e) => e.id === id)?.name).join(", ")}`)
    }
    setSessions((prev) => [session, ...prev])
    setSessionExercises([]); setSessionName(""); setSessionDuration(""); setSessionNotes("")
    setSessionDate(new Date().toISOString().slice(0, 10))
    toast.success("Workout logged!")
    setView("sessions")
  }

  async function generateProgram() {
    setGenLoading(true)
    try {
      const res = await fetch("/api/workout-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-program",
          goal: genGoal, daysPerWeek: parseInt(genDays),
          equipment: genEquipment, experience: genExperience,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setPrograms((prev) => [data.program, ...prev])
      toast.success(`Program "${data.program.name}" created!`)
      setSelectedProgramId(data.program.id)
      setView("program-detail")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setGenLoading(false)
  }

  async function importStrava() {
    const token = stravaToken.trim() || localStorage.getItem("workout-strava-token") || ""
    if (!token) { toast.error("Connect Strava first"); return }
    setStravaLoading(true)
    try {
      const res = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=50", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error("Strava API error — check your token")
      const activities = await res.json() as { id: number; name: string; type: string; start_date: string; distance: number; moving_time: number }[]
      const cardioTypes = ["Run", "Ride", "Walk", "Swim", "Hike", "Rowing"]
      const filtered = activities.filter((a) => cardioTypes.includes(a.type))
      const now = new Date().toISOString()
      const newSessions: WorkoutSession[] = filtered.map((a) => ({
        id: crypto.randomUUID(),
        date: a.start_date.slice(0, 10),
        name: a.name,
        exercises: [{
          exerciseId: a.type === "Run" ? "treadmill-run" : a.type === "Ride" ? "cycling" : "treadmill-run",
          sets: [{
            id: crypto.randomUUID(),
            exerciseId: a.type === "Run" ? "treadmill-run" : "cycling",
            duration: a.moving_time,
            distance: a.distance / 1000,
          }],
        }],
        durationMinutes: Math.round(a.moving_time / 60),
        notes: `Imported from Strava: ${a.type}`,
        createdAt: now,
      }))
      setSessions((prev) => [...newSessions, ...prev])
      toast.success(`Imported ${newSessions.length} activities from Strava`)
      setShowStravaForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Strava import failed")
    }
    setStravaLoading(false)
  }

  function addCustomExercise() {
    if (!customName.trim()) { toast.error("Name required"); return }
    const ex: Exercise = {
      id: `custom-${crypto.randomUUID()}`,
      name: customName.trim(),
      muscleGroups: ["Full Body"],
      isCustom: true,
    }
    setCustomExercises((prev) => [...prev, ex])
    setCustomName(""); setShowAddExercise(false)
    toast.success("Custom exercise added")
  }

  // Progress chart data for an exercise
  function getProgressData(exerciseId: string) {
    return sessions
      .flatMap((s) => {
        const ex = s.exercises.find((e) => e.exerciseId === exerciseId)
        if (!ex) return []
        const maxWeight = Math.max(...ex.sets.map((set) => set.weight ?? 0))
        return [{ date: s.date, weight: maxWeight }]
      })
      .filter((d) => d.weight > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-20)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Workout Log"
        icon={Dumbbell}
        color="text-orange-500"
        badge="Personal"
        actions={
          <div className="flex gap-2">
            {view !== "sessions" && view !== "log" && view !== "programs" && view !== "progress" ? (
              <Button variant="outline" size="sm" onClick={() => setView("sessions")}>← Back</Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setView("add-session")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Log Workout
            </Button>
          </div>
        }
      />

      {/* Nav tabs */}
      <div className="border-b bg-background/95 sticky top-14 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {(["sessions", "programs", "progress"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setView(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${
                view === tab
                  ? "border-orange-500 text-orange-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "sessions" ? "Workouts" : tab === "programs" ? "Programs" : "Progress"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── Add Session ── */}
        {view === "add-session" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Log Workout</h1>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Date</label>
                    <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Duration (min)</label>
                    <Input type="number" placeholder="60" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Workout Name (optional)</label>
                  <Input placeholder="Push Day, Leg Day..." value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* Exercise picker */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Add Exercises</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Search exercises (e.g. Bench, Legs)..."
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                />
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {filteredExercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => addExerciseToSession(ex)}
                      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 text-left text-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                      <span className="truncate">{ex.name}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {showAddExercise ? (
                    <>
                      <Input
                        placeholder="Custom exercise name..."
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={addCustomExercise}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddExercise(false)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setShowAddExercise(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Custom Exercise
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sets per exercise */}
            {sessionExercises.map((se) => {
              const ex = allExercises.find((e) => e.id === se.exerciseId)
              const isCardio = ex?.muscleGroups.includes("Cardio")
              return (
                <Card key={se.exerciseId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{ex?.name ?? se.exerciseId}</CardTitle>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {ex?.muscleGroups.map((mg) => (
                            <span key={mg} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${MUSCLE_GROUP_COLORS[mg as MuscleGroup]}`}>
                              {mg}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => removeExercise(se.exerciseId)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {se.sets.map((set, i) => (
                      <div key={set.id} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                        {isCardio ? (
                          <>
                            <Input
                              type="number"
                              placeholder="Duration (s)"
                              className="flex-1"
                              value={set.duration ?? ""}
                              onChange={(e) => updateSet(se.exerciseId, set.id, "duration", e.target.value)}
                            />
                            <Input
                              type="number"
                              placeholder="Dist (km)"
                              className="flex-1"
                              value={set.distance ?? ""}
                              onChange={(e) => updateSet(se.exerciseId, set.id, "distance", e.target.value)}
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              placeholder="kg"
                              className="flex-1"
                              value={set.weight ?? ""}
                              onChange={(e) => updateSet(se.exerciseId, set.id, "weight", e.target.value)}
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                            <Input
                              type="number"
                              placeholder="reps"
                              className="flex-1"
                              value={set.reps ?? ""}
                              onChange={(e) => updateSet(se.exerciseId, set.id, "reps", e.target.value)}
                            />
                          </>
                        )}
                      </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => addSet(se.exerciseId)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Set
                    </Button>
                  </CardContent>
                </Card>
              )
            })}

            <div>
              <label className="text-xs font-medium mb-1 block">Notes</label>
              <Textarea
                placeholder="How did the workout go?"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={saveSession}
              disabled={sessionExercises.length === 0}
            >
              <Dumbbell className="w-4 h-4 mr-2" /> Save Workout
            </Button>

            {/* Strava Import */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Connect Strava</p>
                  <Button size="sm" variant="outline" onClick={() => setShowStravaForm((v) => !v)}>
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Import Activities
                  </Button>
                </div>
                {showStravaForm && (
                  <div className="space-y-3">
                    <ConnectButton
                      provider="strava"
                      returnTo="/tools/workout-log"
                      storageKey="workout-strava-token"
                      onConnected={(token) => setStravaToken(token)}
                      onDisconnected={() => setStravaToken("")}
                      description="Allows read access to your Strava activities (runs, rides, swims, etc.)."
                    />
                    <Button size="sm" onClick={importStrava} disabled={stravaLoading}>
                      {stravaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Import from Strava
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Sessions ── */}
        {view === "sessions" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Workout Log</h1>
              <p className="text-muted-foreground text-sm">{sessions.length} sessions tracked</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "Weekly Volume", value: `${Math.round(volumeStats.weekly).toLocaleString()} kg`, icon: TrendingUp, color: "text-orange-500" },
                { label: "Total Sessions", value: String(volumeStats.totalSessions), icon: Calendar, color: "text-blue-500" },
                { label: "PRs Set", value: String(prs.length), icon: Trophy, color: "text-amber-500" },
              ].map((s) => (
                <Card key={s.label} size="sm">
                  <CardContent className="py-3 flex items-center gap-3">
                    <s.icon className={`w-4 h-4 ${s.color} shrink-0`} />
                    <div>
                      <p className="text-lg font-bold leading-none">{s.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sessions.length === 0 ? (
              <Card className="max-w-md mx-auto mt-12">
                <CardContent className="py-16 text-center">
                  <Dumbbell className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No workouts yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">Start tracking your training sessions.</p>
                  <Button onClick={() => setView("add-session")}>
                    <Plus className="w-4 h-4 mr-1" /> Log First Workout
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const muscleGroupsHit = new Set(
                    session.exercises.flatMap((se) => {
                      const ex = allExercises.find((e) => e.id === se.exerciseId)
                      return ex?.muscleGroups ?? []
                    })
                  )
                  const totalVol = session.exercises.reduce((acc, e) =>
                    acc + e.sets.reduce((b, s) => b + ((s.weight ?? 0) * (s.reps ?? 0)), 0), 0)
                  return (
                    <Card
                      key={session.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedSessionId(session.id); setView("session-detail") }}
                    >
                      <CardContent className="py-4 flex items-center gap-4">
                        <div className="shrink-0 text-center w-12">
                          <p className="text-xs font-medium text-orange-500">{new Date(session.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</p>
                          <p className="text-xl font-bold leading-none">{new Date(session.date + "T00:00:00").getDate()}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{session.name ?? `${session.exercises.length} exercises`}</p>
                            {session.prsAchieved && session.prsAchieved.length > 0 && (
                              <Badge className="text-[10px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                <Trophy className="w-2.5 h-2.5 mr-0.5" /> PR
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {Array.from(muscleGroupsHit).slice(0, 4).map((mg) => (
                              <span key={mg} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${MUSCLE_GROUP_COLORS[mg as MuscleGroup]}`}>
                                {mg}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {totalVol > 0 && <p className="text-sm font-semibold">{Math.round(totalVol).toLocaleString()} kg</p>}
                          {session.durationMinutes && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" /> {session.durationMinutes}m
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Session Detail ── */}
        {view === "session-detail" && selectedSession && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedSession.name ?? "Workout"}</h1>
                <p className="text-muted-foreground text-sm">{new Date(selectedSession.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setSessions((prev) => prev.filter((s) => s.id !== selectedSession.id))
                  setView("sessions"); toast.success("Session deleted")
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            {selectedSession.prsAchieved && selectedSession.prsAchieved.length > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Trophy className="w-4 h-4 text-amber-500" />
                <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                  New PR! {selectedSession.prsAchieved.map((id) => allExercises.find((e) => e.id === id)?.name).join(", ")}
                </p>
              </div>
            )}

            {selectedSession.exercises.map((se) => {
              const ex = allExercises.find((e) => e.id === se.exerciseId)
              const isCardio = ex?.muscleGroups.includes("Cardio")
              const pr = prs.find((p) => p.exerciseId === se.exerciseId)
              return (
                <Card key={se.exerciseId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{ex?.name ?? se.exerciseId}</CardTitle>
                      {pr && (
                        <span className="text-xs text-amber-500">
                          1RM est: {pr.weight1RM} kg
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {se.sets.map((set, i) => (
                        <div key={set.id} className="flex gap-4 text-sm py-0.5">
                          <span className="text-muted-foreground w-12">Set {i + 1}</span>
                          {isCardio ? (
                            <>
                              {set.duration && <span>{Math.round(set.duration / 60)} min</span>}
                              {set.distance && <span>{set.distance.toFixed(1)} km</span>}
                            </>
                          ) : (
                            <>
                              {set.weight && <span>{set.weight} kg</span>}
                              {set.reps && <span>× {set.reps} reps</span>}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            {selectedSession.notes && (
              <Card><CardContent className="py-3 text-sm text-muted-foreground">{selectedSession.notes}</CardContent></Card>
            )}
          </div>
        )}

        {/* ── Programs ── */}
        {view === "programs" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Workout Programs</h1>

            {/* AI Generator */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-orange-500" /> AI Program Generator</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Goal</label>
                    <select value={genGoal} onChange={(e) => setGenGoal(e.target.value as Goal)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="strength">Strength</option>
                      <option value="muscle">Muscle</option>
                      <option value="endurance">Endurance</option>
                      <option value="fat-loss">Fat Loss</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Days/week</label>
                    <Input type="number" min="3" max="6" value={genDays} onChange={(e) => setGenDays(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Equipment</label>
                    <select value={genEquipment} onChange={(e) => setGenEquipment(e.target.value as Equipment)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="gym">Full Gym</option>
                      <option value="home">Home (Dumbbells)</option>
                      <option value="minimal">Minimal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Experience</label>
                    <select value={genExperience} onChange={(e) => setGenExperience(e.target.value as Experience)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>
                <Button onClick={generateProgram} disabled={genLoading}>
                  {genLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  Generate Program
                </Button>
              </CardContent>
            </Card>

            {programs.length > 0 && (
              <div className="space-y-3">
                {programs.map((p) => (
                  <Card
                    key={p.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setSelectedProgramId(p.id); setView("program-detail") }}
                  >
                    <CardContent className="py-4 flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.isAiGenerated && <Badge variant="secondary" className="text-[10px]"><Sparkles className="w-2.5 h-2.5 mr-0.5" /> AI</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {p.goal} · {p.daysPerWeek} days/week · {p.days.length} training days
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Program Detail ── */}
        {view === "program-detail" && selectedProgram && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedProgram.name}</h1>
                <p className="text-muted-foreground text-sm capitalize">{selectedProgram.goal} · {selectedProgram.daysPerWeek} days/week</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => {
                setPrograms((prev) => prev.filter((p) => p.id !== selectedProgram.id))
                setView("programs"); toast.success("Program deleted")
              }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {selectedProgram.days.map((day, i) => (
              <Card key={i}>
                <CardHeader><CardTitle className="text-sm">{day.name}</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {day.exercises.map((ex, j) => (
                      <div key={j} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <span>{allExercises.find((e) => e.id === ex.exerciseId)?.name ?? ex.exerciseId}</span>
                        <span className="text-muted-foreground">{ex.targetSets} × {ex.targetReps} · {ex.restSeconds}s rest</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Progress ── */}
        {view === "progress" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Progress</h1>

            {/* PRs */}
            {prs.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /> Personal Records</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {prs.sort((a, b) => b.weight1RM - a.weight1RM).map((pr) => {
                      const ex = allExercises.find((e) => e.id === pr.exerciseId)
                      return (
                        <div key={pr.exerciseId} className="flex items-center justify-between py-1.5 text-sm border-b last:border-0">
                          <span>{ex?.name ?? pr.exerciseId}</span>
                          <div className="text-right">
                            <span className="font-semibold">{pr.maxWeight} kg × {pr.maxReps}</span>
                            <span className="text-xs text-muted-foreground ml-2">1RM ~{pr.weight1RM} kg</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress charts */}
            {prs.slice(0, 5).map((pr) => {
              const ex = allExercises.find((e) => e.id === pr.exerciseId)
              const data = getProgressData(pr.exerciseId)
              if (data.length < 2) return null
              const maxW = Math.max(...data.map((d) => d.weight))
              return (
                <Card key={pr.exerciseId}>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-orange-500" /> {ex?.name ?? pr.exerciseId} — Weight Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-1 h-24">
                      {data.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group">
                          <div
                            className="w-full bg-orange-500/70 rounded-t hover:bg-orange-500 transition-colors"
                            style={{ height: `${(d.weight / maxW) * 88}px` }}
                          />
                          {i === 0 || i === data.length - 1 ? (
                            <span className="text-[9px] text-muted-foreground hidden group-first:block group-last:block">
                              {d.date.slice(5)}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{data[0]?.weight} kg</span>
                      <span className="text-orange-500 font-medium">Now: {data[data.length-1]?.weight} kg</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {/* Volume chart */}
            {sessions.length > 0 && (() => {
              const last8 = sessions.slice(0, 8).reverse()
              const maxVol = Math.max(...last8.map((s) =>
                s.exercises.reduce((acc, e) => acc + e.sets.reduce((b, st) => b + ((st.weight ?? 0) * (st.reps ?? 0)), 0), 0)
              ))
              return (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-orange-500" /> Volume per Session (last 8)</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2 h-24">
                      {last8.map((s, i) => {
                        const vol = s.exercises.reduce((acc, e) =>
                          acc + e.sets.reduce((b, st) => b + ((st.weight ?? 0) * (st.reps ?? 0)), 0), 0)
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className="w-full bg-blue-500/70 rounded-t hover:bg-blue-500 transition-colors"
                              style={{ height: maxVol > 0 ? `${(vol / maxVol) * 88}px` : "4px" }}
                            />
                            <span className="text-[9px] text-muted-foreground">{s.date.slice(5)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )
            })()}

            {sessions.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Log workouts to see progress charts.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
