"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Briefcase, Plus, Trash2, Sparkles, Star, ChevronRight,
  GitBranch, Loader2, AlertTriangle, Copy, X, Check,
  TrendingUp, ExternalLink, Bell, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  Application, ApplicationStatus, Interview, InterviewType,
  ResumeVersion, GitHubRepo, WorkMode,
} from "./types"
import { STATUS_META } from "./types"

const STORAGE_KEY = "job-tracker-v1"

interface JobTrackerState {
  applications: Application[]
  resumeVersions: ResumeVersion[]
  githubRepos: GitHubRepo[]
  githubUsername?: string
}

function loadState(): JobTrackerState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ??
      { applications: [], resumeVersions: [], githubRepos: [] }
  } catch { return { applications: [], resumeVersions: [], githubRepos: [] } }
}
function saveState(s: JobTrackerState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

function daysSinceUpdate(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

type View = "pipeline" | "add-app" | "app-detail" | "resumes" | "stats" | "cover-letter"

export function JobTrackerContent() {
  const [state, setState] = useState<JobTrackerState>({ applications: [], resumeVersions: [], githubRepos: [] })
  const [view, setView] = useState<View>("pipeline")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Add app form
  const [addCompany, setAddCompany] = useState("")
  const [addRole, setAddRole] = useState("")
  const [addSalaryMin, setAddSalaryMin] = useState("")
  const [addSalaryMax, setAddSalaryMax] = useState("")
  const [addLocation, setAddLocation] = useState("")
  const [addWorkMode, setAddWorkMode] = useState<WorkMode>("remote")
  const [addJobUrl, setAddJobUrl] = useState("")
  const [addAppliedDate, setAddAppliedDate] = useState(new Date().toISOString().slice(0, 10))
  const [addStatus, setAddStatus] = useState<ApplicationStatus>("applied")
  const [addRecruiterName, setAddRecruiterName] = useState("")
  const [addRecruiterEmail, setAddRecruiterEmail] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [addRating, setAddRating] = useState(3)

  // Cover letter
  const [clLoading, setClLoading] = useState(false)
  const [coverLetter, setCoverLetter] = useState("")
  const [clAppId, setClAppId] = useState<string | null>(null)

  // GitHub import
  const [ghUsername, setGhUsername] = useState("")
  const [ghLoading, setGhLoading] = useState(false)
  const [showGhForm, setShowGhForm] = useState(false)

  // Resume
  const [resumeLabel, setResumeLabel] = useState("")
  const [resumeContent, setResumeContent] = useState("")

  // Interviews
  const [addInterview, setAddInterview] = useState(false)
  const [ivDate, setIvDate] = useState("")
  const [ivType, setIvType] = useState<InterviewType>("phone")
  const [ivInterviewer, setIvInterviewer] = useState("")
  const [ivPrep, setIvPrep] = useState("")

  useEffect(() => { setState(loadState()) }, [])
  useEffect(() => { saveState(state) }, [state])

  const selectedApp = useMemo(() =>
    state.applications.find((a) => a.id === selectedId) ?? null,
    [state.applications, selectedId]
  )

  // Follow-up reminders
  const followUpReminders = useMemo(() =>
    state.applications.filter((a) => {
      if (a.status !== "applied" && a.status !== "phone-screen") return false
      if (a.snoozedUntil && new Date(a.snoozedUntil) > new Date()) return false
      return daysSinceUpdate(a.updatedAt) >= 7
    }),
    [state.applications]
  )

  function addApplication() {
    if (!addCompany.trim() || !addRole.trim()) { toast.error("Company and role required"); return }
    const now = new Date().toISOString()
    const app: Application = {
      id: crypto.randomUUID(),
      company: addCompany.trim(),
      role: addRole.trim(),
      salaryMin: addSalaryMin ? parseInt(addSalaryMin) : undefined,
      salaryMax: addSalaryMax ? parseInt(addSalaryMax) : undefined,
      location: addLocation.trim() || undefined,
      workMode: addWorkMode,
      jobUrl: addJobUrl.trim() || undefined,
      appliedDate: addAppliedDate || undefined,
      status: addStatus,
      recruiterName: addRecruiterName.trim() || undefined,
      recruiterEmail: addRecruiterEmail.trim() || undefined,
      notes: addNotes.trim() || undefined,
      rating: addRating,
      interviews: [],
      createdAt: now,
      updatedAt: now,
    }
    setState((prev) => ({ ...prev, applications: [app, ...prev.applications] }))
    setAddCompany(""); setAddRole(""); setAddSalaryMin(""); setAddSalaryMax("")
    setAddLocation(""); setAddJobUrl(""); setAddNotes(""); setAddRecruiterName("")
    setAddRecruiterEmail(""); setAddRating(3); setAddWorkMode("remote")
    setAddAppliedDate(new Date().toISOString().slice(0, 10))
    toast.success(`${app.company} added`)
    setSelectedId(app.id)
    setView("app-detail")
  }

  function updateStatus(id: string, status: ApplicationStatus) {
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === id ? { ...a, status, updatedAt: new Date().toISOString() } : a
      ),
    }))
  }

  function deleteApp(id: string) {
    setState((prev) => ({ ...prev, applications: prev.applications.filter((a) => a.id !== id) }))
    if (selectedId === id) { setSelectedId(null); setView("pipeline") }
    toast.success("Application removed")
  }

  function addInterviewToApp() {
    if (!selectedId || !ivDate) { toast.error("Date required"); return }
    const interview: Interview = {
      id: crypto.randomUUID(),
      date: ivDate,
      type: ivType,
      interviewerName: ivInterviewer.trim() || undefined,
      prepNotes: ivPrep.trim() || undefined,
      completed: false,
    }
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === selectedId
          ? { ...a, interviews: [...a.interviews, interview], updatedAt: new Date().toISOString() }
          : a
      ),
    }))
    setIvDate(""); setIvType("phone"); setIvInterviewer(""); setIvPrep("")
    setAddInterview(false); toast.success("Interview added")
  }

  function snoozeFollowUp(id: string) {
    const snoozeUntil = new Date()
    snoozeUntil.setDate(snoozeUntil.getDate() + 3)
    setState((prev) => ({
      ...prev,
      applications: prev.applications.map((a) =>
        a.id === id ? { ...a, snoozedUntil: snoozeUntil.toISOString().slice(0, 10) } : a
      ),
    }))
    toast.success("Snoozed 3 days")
  }

  async function generateCoverLetter(app: Application) {
    setClLoading(true); setClAppId(app.id)
    try {
      const resume = state.resumeVersions.find((r) => r.id === app.resumeVersionId)
      const ghItems = state.githubRepos
        .filter((r) => (app.portfolioItems ?? []).includes(r.name))
        .map((r) => `${r.name}: ${r.description ?? ""}`)

      const res = await fetch("/api/job-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-cover-letter",
          company: app.company,
          role: app.role,
          notes: app.notes,
          resumeText: resume?.content,
          portfolioItems: ghItems,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setCoverLetter(data.coverLetter)
      setView("cover-letter")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setClLoading(false)
  }

  async function importGithub() {
    if (!ghUsername.trim()) { toast.error("Enter GitHub username"); return }
    setGhLoading(true)
    try {
      const res = await fetch("/api/job-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "github-repos", username: ghUsername }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setState((prev) => ({
        ...prev,
        githubRepos: data.repos,
        githubUsername: ghUsername,
      }))
      toast.success(`Imported ${data.repos.length} repos from GitHub`)
      setShowGhForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    }
    setGhLoading(false)
  }

  function addResume() {
    if (!resumeLabel.trim() || !resumeContent.trim()) { toast.error("Label and content required"); return }
    const rv: ResumeVersion = {
      id: crypto.randomUUID(),
      label: resumeLabel.trim(),
      content: resumeContent.trim(),
      createdAt: new Date().toISOString(),
    }
    setState((prev) => ({ ...prev, resumeVersions: [...prev.resumeVersions, rv] }))
    setResumeLabel(""); setResumeContent("")
    toast.success("Resume version saved")
  }

  const stats = useMemo(() => {
    const apps = state.applications
    const responded = apps.filter((a) => a.status !== "applied" && a.status !== "wishlist").length
    const interviews = apps.filter((a) => ["phone-screen", "technical", "final-round"].includes(a.status)).length
    const offers = apps.filter((a) => a.status === "offer" || a.status === "accepted").length
    const responseRate = apps.length > 0 ? (responded / apps.filter((a) => a.status !== "wishlist").length) * 100 : 0
    const offerRate = interviews > 0 ? (offers / interviews) * 100 : 0

    const byStatus: Partial<Record<ApplicationStatus, number>> = {}
    apps.forEach((a) => { byStatus[a.status] = (byStatus[a.status] ?? 0) + 1 })

    const offerSalaries = apps
      .filter((a) => (a.status === "offer" || a.status === "accepted") && a.salaryMin)
      .map((a) => ({ company: a.company, role: a.role, min: a.salaryMin!, max: a.salaryMax }))

    return { total: apps.length, responseRate, offerRate, byStatus, offerSalaries }
  }, [state.applications])

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Job Tracker"
        icon={Briefcase}
        color="text-blue-500"
        badge="Career"
        actions={
          <div className="flex gap-2">
            {view !== "pipeline" && view !== "stats" && view !== "resumes" ? (
              <Button variant="outline" size="sm" onClick={() => setView("pipeline")}>← Back</Button>
            ) : null}
            <Button size="sm" onClick={() => setView("add-app")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Application
            </Button>
          </div>
        }
      />

      {/* Nav */}
      <div className="border-b bg-background/95 sticky top-14 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {(["pipeline", "resumes", "stats"] as const).map((tab) => (
            <button key={tab} onClick={() => setView(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${
                view === tab
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "pipeline" ? "Applications" : tab === "resumes" ? "Resumes" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── Add Application ── */}
        {view === "add-app" && (
          <div className="max-w-lg mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Add Application</h1>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Company *</label>
                    <Input placeholder="Google" value={addCompany} onChange={(e) => setAddCompany(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Role *</label>
                    <Input placeholder="Senior Engineer" value={addRole} onChange={(e) => setAddRole(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Salary Min ($)</label>
                    <Input type="number" placeholder="100000" value={addSalaryMin} onChange={(e) => setAddSalaryMin(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Salary Max ($)</label>
                    <Input type="number" placeholder="150000" value={addSalaryMax} onChange={(e) => setAddSalaryMax(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Location</label>
                    <Input placeholder="San Francisco, CA" value={addLocation} onChange={(e) => setAddLocation(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Work Mode</label>
                    <select value={addWorkMode} onChange={(e) => setAddWorkMode(e.target.value as WorkMode)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">Onsite</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Job URL</label>
                  <Input placeholder="https://..." value={addJobUrl} onChange={(e) => setAddJobUrl(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Status</label>
                    <select value={addStatus} onChange={(e) => setAddStatus(e.target.value as ApplicationStatus)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Applied Date</label>
                    <Input type="date" value={addAppliedDate} onChange={(e) => setAddAppliedDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Recruiter Name</label>
                    <Input placeholder="Jane Doe" value={addRecruiterName} onChange={(e) => setAddRecruiterName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Recruiter Email</label>
                    <Input placeholder="jane@company.com" value={addRecruiterEmail} onChange={(e) => setAddRecruiterEmail(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea rows={2} placeholder="Job description, requirements..." value={addNotes} onChange={(e) => setAddNotes(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">How much do you want this? {addRating}/5</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((r) => (
                      <button key={r} onClick={() => setAddRating(r)}>
                        <Star className={`w-5 h-5 ${r <= addRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={addApplication}>
                  <Briefcase className="w-4 h-4 mr-2" /> Save Application
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Pipeline ── */}
        {view === "pipeline" && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Job Pipeline</h1>
                <p className="text-muted-foreground text-sm">{state.applications.length} applications</p>
              </div>
            </div>

            {/* Follow-up reminders */}
            {followUpReminders.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Follow-up reminders</p>
                  </div>
                  <div className="space-y-2">
                    {followUpReminders.map((app) => (
                      <div key={app.id} className="flex items-center justify-between text-sm">
                        <span>{app.company} — {app.role} ({daysSinceUpdate(app.updatedAt)}d ago)</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedId(app.id); setView("app-detail") }}>View</Button>
                          <Button size="sm" variant="ghost" onClick={() => snoozeFollowUp(app.id)}>Snooze 3d</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {state.applications.length === 0 ? (
              <Card className="max-w-md mx-auto mt-12">
                <CardContent className="py-16 text-center">
                  <Briefcase className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No applications yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">Start tracking your job search.</p>
                  <Button onClick={() => setView("add-app")}>
                    <Plus className="w-4 h-4 mr-1" /> Add Application
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][])
                  .filter(([status]) => state.applications.some((a) => a.status === status))
                  .map(([status, meta]) => {
                    const appsInStatus = state.applications.filter((a) => a.status === status)
                    return (
                      <div key={status}>
                        <div className="flex items-center gap-2 mb-3">
                          <h2 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h2>
                          <span className="text-xs text-muted-foreground">({appsInStatus.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {appsInStatus.map((app) => (
                            <Card
                              key={app.id}
                              className="cursor-pointer hover:shadow-md transition-shadow group"
                              onClick={() => { setSelectedId(app.id); setView("app-detail") }}
                            >
                              <CardContent className="p-4 space-y-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{app.company}</p>
                                    <p className="text-xs text-muted-foreground">{app.role}</p>
                                  </div>
                                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {app.workMode && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{app.workMode}</span>
                                  )}
                                  {app.salaryMin && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                      ${(app.salaryMin / 1000).toFixed(0)}k{app.salaryMax ? `–${(app.salaryMax / 1000).toFixed(0)}k` : "+"}
                                    </span>
                                  )}
                                  <div className="flex ml-auto">
                                    {[1,2,3,4,5].map((r) => (
                                      <Star key={r} className={`w-3 h-3 ${r <= app.rating ? "fill-amber-400 text-amber-400" : "text-muted/30"}`} />
                                    ))}
                                  </div>
                                </div>
                                {app.interviews.length > 0 && (
                                  <p className="text-xs text-muted-foreground">{app.interviews.length} interview{app.interviews.length !== 1 ? "s" : ""} scheduled</p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── App Detail ── */}
        {view === "app-detail" && selectedApp && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">{selectedApp.company}</h1>
                <p className="text-muted-foreground">{selectedApp.role}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => generateCoverLetter(selectedApp)}
                  disabled={clLoading && clAppId === selectedApp.id}
                >
                  {clLoading && clAppId === selectedApp.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Cover Letter</>
                  }
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteApp(selectedApp.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-muted-foreground w-24 shrink-0">Status</label>
                  <select
                    value={selectedApp.status}
                    onChange={(e) => updateStatus(selectedApp.id, e.target.value as ApplicationStatus)}
                    className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                {[
                  { label: "Salary", value: selectedApp.salaryMin ? `$${selectedApp.salaryMin.toLocaleString()}${selectedApp.salaryMax ? ` – $${selectedApp.salaryMax.toLocaleString()}` : "+"}` : null },
                  { label: "Location", value: selectedApp.location },
                  { label: "Work Mode", value: selectedApp.workMode },
                  { label: "Applied", value: selectedApp.appliedDate && new Date(selectedApp.appliedDate).toLocaleDateString() },
                  { label: "Recruiter", value: selectedApp.recruiterName ? `${selectedApp.recruiterName}${selectedApp.recruiterEmail ? ` · ${selectedApp.recruiterEmail}` : ""}` : null },
                ].filter((f) => f.value).map((f) => (
                  <div key={f.label} className="flex gap-3 text-sm">
                    <span className="text-muted-foreground w-24 shrink-0">{f.label}</span>
                    <span>{f.value}</span>
                  </div>
                ))}
                {selectedApp.jobUrl && (
                  <a href={selectedApp.jobUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
                    <ExternalLink className="w-3.5 h-3.5" /> View Job Posting
                  </a>
                )}
                {selectedApp.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes / Job Description</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedApp.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Interviews */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Interviews ({selectedApp.interviews.length})</CardTitle>
                  <Button size="sm" variant="ghost" onClick={() => setAddInterview((v) => !v)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {addInterview && (
                  <div className="p-3 border rounded-lg space-y-2 bg-muted/30">
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="datetime-local" value={ivDate} onChange={(e) => setIvDate(e.target.value)} />
                      <select value={ivType} onChange={(e) => setIvType(e.target.value as InterviewType)}
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm">
                        <option value="phone">Phone</option>
                        <option value="video">Video</option>
                        <option value="technical">Technical</option>
                        <option value="onsite">Onsite</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <Input placeholder="Interviewer name" value={ivInterviewer} onChange={(e) => setIvInterviewer(e.target.value)} />
                    <Textarea placeholder="Prep notes..." rows={2} value={ivPrep} onChange={(e) => setIvPrep(e.target.value)} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addInterviewToApp}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAddInterview(false)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                )}
                {selectedApp.interviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No interviews yet.</p>
                ) : (
                  selectedApp.interviews.map((iv) => (
                    <div key={iv.id} className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          iv.type === "technical" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                          iv.type === "onsite" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}>{iv.type}</span>
                        <p className="text-sm">{new Date(iv.date).toLocaleString()}</p>
                        {iv.interviewerName && <p className="text-xs text-muted-foreground">with {iv.interviewerName}</p>}
                      </div>
                      {iv.prepNotes && <p className="text-xs text-muted-foreground mt-1">{iv.prepNotes}</p>}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Company Research Notes */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Company Research</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Culture notes, tech stack, benefits, Levels.fyi data..."
                  rows={3}
                  value={selectedApp.companyNotes ?? ""}
                  onChange={(e) => setState((prev) => ({
                    ...prev,
                    applications: prev.applications.map((a) =>
                      a.id === selectedApp.id ? { ...a, companyNotes: e.target.value } : a
                    ),
                  }))}
                />
              </CardContent>
            </Card>

            {/* Portfolio items */}
            {state.githubRepos.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm flex items-center gap-2"><GitBranch className="w-4 h-4" /> Portfolio Items</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {state.githubRepos.map((repo) => {
                      const isSelected = (selectedApp.portfolioItems ?? []).includes(repo.name)
                      return (
                        <button
                          key={repo.id}
                          onClick={() => setState((prev) => ({
                            ...prev,
                            applications: prev.applications.map((a) => {
                              if (a.id !== selectedApp.id) return a
                              const items = a.portfolioItems ?? []
                              return {
                                ...a,
                                portfolioItems: isSelected
                                  ? items.filter((n) => n !== repo.name)
                                  : [...items, repo.name],
                              }
                            }),
                          }))}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                            isSelected
                              ? "border-blue-500 bg-blue-500/10 text-blue-600"
                              : "border-border text-muted-foreground hover:border-foreground"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {repo.name}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* GitHub Import (in detail view too) */}
            {state.githubRepos.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                    <p className="text-sm font-medium">Import GitHub Portfolio</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setShowGhForm((v) => !v)}>Import</Button>
                  </div>
                  {showGhForm && (
                    <div className="flex gap-2 mt-2">
                      <Input placeholder="GitHub username" value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} className="flex-1" />
                      <Button size="sm" onClick={importGithub} disabled={ghLoading}>
                        {ghLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Import"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Cover Letter ── */}
        {view === "cover-letter" && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Cover Letter</h1>
              <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(coverLetter); toast.success("Copied") }}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy
              </Button>
            </div>
            <Card>
              <CardContent className="pt-5">
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  rows={20}
                  className="font-serif text-sm leading-relaxed"
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Resumes ── */}
        {view === "resumes" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Resume Versions</h1>

            {/* GitHub import */}
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <GitBranch className="w-4 h-4" />
                      {state.githubUsername ? `GitHub: @${state.githubUsername}` : "GitHub Portfolio"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {state.githubRepos.length} repos imported
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowGhForm((v) => !v)}>
                    {state.githubRepos.length > 0 ? "Refresh" : "Import"}
                  </Button>
                </div>
                {showGhForm && (
                  <div className="flex gap-2">
                    <Input placeholder="GitHub username" value={ghUsername} onChange={(e) => setGhUsername(e.target.value)} className="flex-1" />
                    <Button size="sm" onClick={importGithub} disabled={ghLoading}>
                      {ghLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Import"}
                    </Button>
                  </div>
                )}
                {state.githubRepos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    {state.githubRepos.map((repo) => (
                      <div key={repo.id} className="p-2 rounded border text-sm flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{repo.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{repo.description}</p>
                          {repo.language && <Badge variant="secondary" className="text-[10px] mt-1">{repo.language}</Badge>}
                        </div>
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add resume */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" /> Add Resume Version</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Label (e.g. 'Backend v2', 'Full-Stack')" value={resumeLabel} onChange={(e) => setResumeLabel(e.target.value)} />
                <Textarea
                  placeholder="Paste your resume content here..."
                  rows={6}
                  value={resumeContent}
                  onChange={(e) => setResumeContent(e.target.value)}
                />
                <Button size="sm" onClick={addResume}>Save Resume Version</Button>
              </CardContent>
            </Card>

            {state.resumeVersions.length > 0 && (
              <div className="space-y-2">
                {state.resumeVersions.map((rv) => (
                  <Card key={rv.id}>
                    <CardContent className="py-3 flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{rv.label}</p>
                        <p className="text-xs text-muted-foreground">{new Date(rv.createdAt).toLocaleDateString()} · {rv.content.length} chars</p>
                      </div>
                      <button onClick={() => setState((prev) => ({ ...prev, resumeVersions: prev.resumeVersions.filter((r) => r.id !== rv.id) }))}>
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        {view === "stats" && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Job Search Analytics</h1>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Apps", value: String(stats.total), icon: Briefcase, color: "text-blue-500" },
                { label: "Response Rate", value: `${stats.responseRate.toFixed(0)}%`, icon: TrendingUp, color: "text-green-500" },
                { label: "Offer Rate", value: `${stats.offerRate.toFixed(0)}%`, icon: Check, color: "text-emerald-500" },
                { label: "Offers", value: String(state.applications.filter((a) => a.status === "offer" || a.status === "accepted").length), icon: Star, color: "text-amber-500" },
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

            {/* By status breakdown */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Applications by Stage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(Object.entries(STATUS_META) as [ApplicationStatus, typeof STATUS_META[ApplicationStatus]][])
                    .filter(([s]) => stats.byStatus[s])
                    .map(([s, meta]) => {
                      const count = stats.byStatus[s] ?? 0
                      const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                      return (
                        <div key={s} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-24 shrink-0 ${meta.color}`}>{meta.label}</span>
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Salary comparison */}
            {stats.offerSalaries.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Offer Salary Comparison</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.offerSalaries.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <span>{s.company} — {s.role}</span>
                        <span className="font-semibold text-emerald-500">
                          ${s.min.toLocaleString()}{s.max ? ` – $${s.max.toLocaleString()}` : "+"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {state.applications.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Add applications to see analytics.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
