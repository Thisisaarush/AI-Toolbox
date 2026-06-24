"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { useHashNav } from "@/lib/use-hash-nav"
import {
  Rocket, Sparkles, Copy, Check, Loader2, Plus, Trash2, X,
  RefreshCw, Clock, CheckSquare, ChevronDown, ChevronUp,
  History, BarChart2, Globe, Megaphone, ChevronRight,
  Download, Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type LaunchInput, type LaunchOutput, type LaunchRecord, type ToneId,
  type CompetitorResearch, type PlatformPerformance, type LaunchPlatformId,
  type WaitlistFormData, type EmailSubjectLine,
  TONES, LAUNCH_CHECKLIST, BEST_TIMES, LAUNCH_PLATFORM_OPTIONS, PRE_LAUNCH_TIMELINE,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "launch-pad-v1"

function load(): LaunchRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: LaunchRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }

type MainTab = "form" | "output" | "history" | "waitlist" | "research"
type OutputTab = "ph" | "hn" | "tweet" | "reddit" | "email" | "linkedin"

const OUTPUT_TABS: { id: OutputTab; label: string; color: string }[] = [
  { id: "ph", label: "Product Hunt", color: "text-orange-500" },
  { id: "hn", label: "Hacker News", color: "text-amber-600" },
  { id: "tweet", label: "Tweet Thread", color: "text-sky-500" },
  { id: "reddit", label: "Reddit", color: "text-red-500" },
  { id: "email", label: "Cold Email", color: "text-violet-500" },
  { id: "linkedin", label: "LinkedIn", color: "text-blue-600" },
]

// Platform char limits for progress bar
const PLATFORM_LIMITS: Partial<Record<OutputTab, number>> = {
  ph: 260, hn: 1500, tweet: 280, reddit: 2000, email: 2000, linkedin: 1300,
}

function defaultForm(): LaunchInput {
  return {
    productName: "",
    tagline: "",
    description: "",
    targetAudience: "",
    keyFeatures: ["", "", ""],
    techStack: "",
    launchUrl: "",
    tone: "casual",
  }
}

function defaultWaitlist(): WaitlistFormData {
  return {
    productName: "",
    headline: "Be the first to know",
    description: "We're building something amazing. Join the waitlist for early access.",
    ctaText: "Join Waitlist",
    formspreeEndpoint: "https://formspree.io/f/YOUR_FORM_ID",
    accentColor: "#f97316",
  }
}

function generateWaitlistHtml(data: WaitlistFormData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.productName} – Waitlist</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f0f;
      color: #fff;
      padding: 2rem;
    }
    .container {
      max-width: 520px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      color: ${data.accentColor};
      margin-bottom: 2rem;
      letter-spacing: -0.02em;
    }
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }
    p {
      color: rgba(255,255,255,0.65);
      font-size: 1.05rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    form {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    input[type="email"] {
      flex: 1;
      min-width: 200px;
      padding: 0.75rem 1rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.08);
      color: #fff;
      font-size: 1rem;
      outline: none;
    }
    input[type="email"]::placeholder { color: rgba(255,255,255,0.35); }
    input[type="email"]:focus { border-color: ${data.accentColor}; }
    button[type="submit"] {
      padding: 0.75rem 1.5rem;
      border-radius: 10px;
      background: ${data.accentColor};
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    button[type="submit"]:hover { opacity: 0.85; }
    .footnote {
      margin-top: 1.5rem;
      font-size: 0.8rem;
      color: rgba(255,255,255,0.35);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${data.productName}</div>
    <h1>${data.headline}</h1>
    <p>${data.description}</p>
    <form action="${data.formspreeEndpoint}" method="POST">
      <input type="email" name="email" placeholder="you@example.com" required />
      <button type="submit">${data.ctaText}</button>
    </form>
    <p class="footnote">No spam. Unsubscribe anytime.</p>
  </div>
</body>
</html>`
}

function generateThankYouHtml(data: WaitlistFormData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.productName} – You're in!</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0f0f0f;
      color: #fff;
      padding: 2rem;
      text-align: center;
    }
    .container { max-width: 480px; }
    .icon { font-size: 4rem; margin-bottom: 1.5rem; }
    h1 { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.03em; margin-bottom: 1rem; }
    p { color: rgba(255,255,255,0.6); font-size: 1.05rem; line-height: 1.6; }
    a {
      display: inline-block;
      margin-top: 2rem;
      color: ${data.accentColor};
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🎉</div>
    <h1>You're on the list!</h1>
    <p>Thanks for joining the ${data.productName} waitlist. We'll reach out when early access opens.</p>
    <a href="/">← Back to homepage</a>
  </div>
</body>
</html>`
}

function downloadHtml(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function LaunchPadContent() {
  const [records, setRecords] = useState<LaunchRecord[]>([])
  const [view, setView] = useState<MainTab>("form")
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState<OutputTab | null>(null)
  const [currentOutput, setCurrentOutput] = useState<LaunchOutput | null>(null)
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null)
  const [outputTab, setOutputTab] = useState<OutputTab>("ph")
  const [copiedKey, setCopiedKey] = useState("")
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [showChecklist, setShowChecklist] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [expandedPerf, setExpandedPerf] = useState<string | null>(null)
  const [perfDraft, setPerfDraft] = useState<Partial<PlatformPerformance>>({})

  // Form
  const [form, setForm] = useState<LaunchInput>(defaultForm)

  // Competitor research
  const [researchProductName, setResearchProductName] = useState("")
  const [researchCategory, setResearchCategory] = useState("")
  const [researchLoading, setResearchLoading] = useState(false)
  const [research, setResearch] = useState<CompetitorResearch | null>(null)

  // Waitlist builder
  const [waitlist, setWaitlist] = useState<WaitlistFormData>(defaultWaitlist)
  const [waitlistGenerated, setWaitlistGenerated] = useState(false)

  // Email subject lines
  const [altSubjectLines, setAltSubjectLines] = useState<EmailSubjectLine[]>([])
  const [subjectLoading, setSubjectLoading] = useState(false)
  const [activeSubject, setActiveSubject] = useState<string | null>(null)

  useEffect(() => {
    setRecords(load())
  }, [])

  useHashNav(view, setView, ["form", "output", "history", "waitlist", "research"] as const)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function handleGenerate() {
    if (!form.productName.trim()) { toast.error("Product name required"); return }
    if (!form.description.trim()) { toast.error("Description required"); return }
    setLoading(true)
    try {
      const res = await aiFetch("/api/launch-pad", { action: "generate", input: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setCurrentOutput(data.output)
      setActiveSubject(data.output.coldEmail?.subject ?? null)
      const record: LaunchRecord = {
        id: crypto.randomUUID(),
        input: { ...form },
        output: data.output,
        notes: "",
        createdAt: new Date().toISOString(),
      }
      setCurrentRecordId(record.id)
      setRecords((prev) => {
        const next = [record, ...prev]
        save(next)
        return next
      })
      setView("output")
      toast.success("All 6 formats generated!")
    } catch (err: unknown) {
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setLoading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setLoading(false)
  }

  function updateFeature(idx: number, value: string) {
    setForm((f) => ({ ...f, keyFeatures: f.keyFeatures.map((k, i) => i === idx ? value : k) }))
  }
  function addFeature() {
    if (form.keyFeatures.length >= 6) return
    setForm((f) => ({ ...f, keyFeatures: [...f.keyFeatures, ""] }))
  }
  function removeFeature(idx: number) {
    setForm((f) => ({ ...f, keyFeatures: f.keyFeatures.filter((_, i) => i !== idx) }))
  }

  function loadRecord(record: LaunchRecord) {
    setCurrentOutput(record.output)
    setCurrentRecordId(record.id)
    setForm(record.input)
    setActiveSubject(record.output.coldEmail?.subject ?? null)
    setView("output")
  }

  async function regeneratePlatform(platform: OutputTab) {
    if (!currentOutput) return
    setRegenLoading(platform)
    try {
      const res = await aiFetch("/api/launch-pad", { action: "regenerate-platform", input: form, platform })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Regeneration failed")
      if (data.partial && Object.keys(data.partial).length > 0) {
        setCurrentOutput((prev) => prev ? { ...prev, ...data.partial } : prev)
        toast.success("Regenerated!")
      }
    } catch (err: unknown) {
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setRegenLoading(null)
        return
      }
      toast.error(err instanceof Error ? err.message : "Regeneration failed")
    }
    setRegenLoading(null)
  }

  function updateRecordNotes(id: string, notes: string) {
    setRecords((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, notes } : r)
      save(next)
      return next
    })
  }

  async function handleCompetitorResearch() {
    if (!researchProductName.trim()) { toast.error("Product name required"); return }
    if (!researchCategory.trim()) { toast.error("Category required"); return }
    setResearchLoading(true)
    try {
      const res = await aiFetch("/api/launch-pad", { action: "competitor-research", productName: researchProductName, category: researchCategory })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Research failed")
      setResearch(data.data)
      // Persist to most recent record if one exists
      if (records.length > 0) {
        setRecords((prev) => {
          const next = prev.map((r, i) => i === 0 ? { ...r, competitorResearch: data.data } : r)
          save(next)
          return next
        })
      }
      toast.success("Competitor research complete")
    } catch (err: unknown) {
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setResearchLoading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Research failed")
    }
    setResearchLoading(false)
  }

  async function handleGenerateSubjectLines() {
    setSubjectLoading(true)
    try {
      const res = await aiFetch("/api/launch-pad", {
        action: "generate-subject-lines",
        productName: form.productName,
        targetAudience: form.targetAudience,
        currentSubject: currentOutput?.coldEmail?.subject ?? "",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setAltSubjectLines(data.items)
      toast.success("Subject lines generated")
    } catch (err: unknown) {
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setSubjectLoading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Failed")
    }
    setSubjectLoading(false)
  }

  function addPerformanceEntry() {
    if (!currentRecordId) { toast.error("No active launch record"); return }
    if (!perfDraft.platform) { toast.error("Select a platform"); return }
    const entry: PlatformPerformance = {
      platform: perfDraft.platform as LaunchPlatformId,
      platformLabel: LAUNCH_PLATFORM_OPTIONS.find((p) => p.id === perfDraft.platform)?.label ?? perfDraft.platform,
      upvotes: perfDraft.upvotes ?? 0,
      comments: perfDraft.comments ?? 0,
      signups: perfDraft.signups ?? 0,
      notes: perfDraft.notes ?? "",
      loggedAt: new Date().toISOString(),
    }
    setRecords((prev) => {
      const next = prev.map((r) =>
        r.id === currentRecordId
          ? { ...r, performanceData: [...(r.performanceData ?? []), entry] }
          : r,
      )
      save(next)
      return next
    })
    setPerfDraft({})
    toast.success("Performance logged")
  }

  function getBufferFormat(tweets: string[]): string {
    return tweets.join("\n---\n")
  }

  // Checklist progress
  const checkedCount = Object.values(checkedItems).filter(Boolean).length

  // Current record performance
  const currentRecord = records.find((r) => r.id === currentRecordId)
  const perfData = currentRecord?.performanceData ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Launch Pad"
        icon={Rocket}
        color="text-orange-500"
        badge="Marketing"
        actions={
          <div className="flex gap-4 flex-wrap">
            {view !== "form" && <Button variant="outline" size="sm" onClick={() => { setForm(defaultForm()); setView("form") }}>← New Launch</Button>}
            <Button variant="ghost" size="sm" onClick={() => setView("waitlist")} className={view === "waitlist" ? "bg-muted" : ""}>
              <Megaphone className="w-4 h-4 mr-1" /> Waitlist
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setView("research")} className={view === "research" ? "bg-muted" : ""}>
              <Search className="w-4 h-4 mr-1" /> Research
            </Button>
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "form" : "history")} className={view === "history" ? "bg-muted" : ""}>
                <History className="w-4 h-4 mr-1" /> History
              </Button>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-5 py-6 w-full">

        {/* ── FORM ─────────────────────────────────────────────────────────── */}
        {view === "form" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Launch Pad</h1>
              <p className="text-muted-foreground">Describe your product once — get 6 platform-ready launch posts.</p>
            </div>

            {/* Product basics */}
            <section className="space-y-5">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Product</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-medium mb-1 block">Product name *</label>
                  <Input placeholder="DevDash" value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Tagline * <span className="text-muted-foreground">({form.tagline.length}/60)</span></label>
                  <Input
                    placeholder="The developer dashboard you've been waiting for"
                    value={form.tagline}
                    onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                    maxLength={80}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">What it does (2-3 sentences) *</label>
                <Textarea
                  placeholder="DevDash aggregates your GitHub activity, deployment status, and team metrics in one place..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Who it's for *</label>
                <Input
                  placeholder="Full-stack developers who manage multiple projects"
                  value={form.targetAudience}
                  onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                />
              </div>
            </section>

            {/* Features */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Key Features</h2>
                <Button variant="ghost" size="sm" onClick={addFeature} disabled={form.keyFeatures.length >= 6}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {form.keyFeatures.map((f, i) => (
                  <div key={i} className="flex gap-4">
                    <Input
                      placeholder={`Feature ${i + 1}`}
                      value={f}
                      onChange={(e) => updateFeature(i, e.target.value)}
                    />
                    {form.keyFeatures.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeFeature(i)}>
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Tech + URL */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Details</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-medium mb-1 block">Tech stack (optional)</label>
                  <Input placeholder="Next.js, Postgres, Vercel" value={form.techStack} onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Launch URL</label>
                  <Input placeholder="https://yourproduct.com" value={form.launchUrl} onChange={(e) => setForm((f) => ({ ...f, launchUrl: e.target.value }))} />
                </div>
              </div>
            </section>

            {/* Tone */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tone</h2>
              <div className="flex flex-wrap gap-4">
                {(Object.entries(TONES) as [ToneId, typeof TONES[ToneId]][]).map(([id, t]) => (
                  <button
                    key={id}
                    onClick={() => setForm((f) => ({ ...f, tone: id }))}
                    className={`px-4 py-2 rounded-xl border text-sm transition-colors ${form.tone === id ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted"}`}
                  >
                    <span className="font-medium">{t.label}</span>
                    <span className="text-xs opacity-70 ml-1 hidden sm:inline">— {t.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Launch date + Schedule */}
            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Launch Schedule</h2>
              <div className="flex items-center gap-5">
                <div className="flex-1">
                  <label className="text-xs font-medium mb-1 block">Target launch date (optional)</label>
                  <input
                    type="date"
                    value={form.launchDate ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, launchDate: e.target.value || undefined }))}
                    className="h-9 text-sm rounded-md border border-input bg-background px-4 w-full"
                  />
                </div>
                {form.launchDate && (
                  <div className="text-center shrink-0">
                    <p className="text-2xl font-bold text-orange-500">{Math.max(0, daysUntil(form.launchDate))}</p>
                    <p className="text-xs text-muted-foreground">days away</p>
                  </div>
                )}
              </div>

              {form.launchDate && (
                <div>
                  <button
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                    onClick={() => setShowSchedule(!showSchedule)}
                  >
                    {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    Pre-launch timeline
                  </button>
                  {showSchedule && (
                    <div className="mt-4 space-y-3 pl-2 border-l-2 border-orange-200 dark:border-orange-900">
                      {PRE_LAUNCH_TIMELINE.map((item) => {
                        const d = daysUntil(form.launchDate!)
                        const daysFromNow = d + item.dayOffset
                        const isPast = daysFromNow < 0
                        const isToday = daysFromNow === 0
                        return (
                          <div key={item.dayOffset} className={`pl-3 ${isPast ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-semibold ${isToday ? "text-orange-500" : "text-foreground"}`}>
                              {item.label} {isToday && "← Today"}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            <Button className="w-full" onClick={handleGenerate} disabled={loading}>
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating all 6 formats...</>
                : <><Sparkles className="w-4 h-4 mr-2" /> Generate All Launch Copy</>
              }
            </Button>

            {/* Checklist */}
            <section>
              <button
                className="w-full text-left flex items-center justify-between py-2.5"
                onClick={() => setShowChecklist(!showChecklist)}
              >
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-4">
                  <CheckSquare className="w-4 h-4 text-orange-500" />
                  Before You Launch
                  <span className="normal-case font-normal text-xs">({checkedCount}/{LAUNCH_CHECKLIST.length})</span>
                </span>
                {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showChecklist && (
                <div className="mt-2 space-y-3">
                  {LAUNCH_CHECKLIST.map((item, i) => (
                    <label key={i} className="flex items-center gap-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[i]}
                        onChange={(e) => setCheckedItems((c) => ({ ...c, [i]: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      <span className={`text-sm ${checkedItems[i] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            {/* Best times */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-4">
                <Clock className="w-4 h-4 text-orange-500" /> Best Times to Launch
              </h2>
              {Object.entries(BEST_TIMES).map(([platform, time]) => (
                <div key={platform} className="flex items-start gap-4 text-sm">
                  <span className="font-medium w-32 shrink-0">{platform}</span>
                  <span className="text-muted-foreground">{time}</span>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* ── OUTPUT ───────────────────────────────────────────────────────── */}
        {view === "output" && currentOutput && (
          <div className="space-y-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <h1 className="text-2xl font-bold">Launch Copy Ready</h1>
                <p className="text-muted-foreground text-sm">6 platform-optimized formats generated.</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {/* Checklist progress badge */}
                <span className="text-xs text-muted-foreground px-3 py-1.5 rounded-xl bg-muted border">
                  <CheckSquare className="inline w-4 h-4 mr-1" />
                  {checkedCount}/{LAUNCH_CHECKLIST.length} checked
                </span>
                <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  Regenerate
                </Button>
              </div>
            </div>

            {/* Tone selector */}
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm text-muted-foreground">Tone:</span>
              {(Object.entries(TONES) as [ToneId, typeof TONES[ToneId]][]).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => setForm((f) => ({ ...f, tone: id }))}
                  className={`px-3 py-1.5 rounded text-xs border transition-colors ${form.tone === id ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted"}`}
                >
                  {t.label}
                </button>
              ))}
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Apply tone
              </Button>
            </div>

            {/* Bold pill tab bar */}
            <div className="flex gap-2 p-1 bg-muted/60 rounded-xl overflow-x-auto">
              {OUTPUT_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOutputTab(t.id)}
                  className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${outputTab === t.id ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className={outputTab === t.id ? t.color : ""}>{t.label}</span>
                </button>
              ))}
            </div>

            {/* Per-tab header with char count progress */}
            <div className="flex items-center justify-between gap-5">
              <CharCountBar outputTab={outputTab} currentOutput={currentOutput} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regeneratePlatform(outputTab)}
                disabled={regenLoading === outputTab}
                className="shrink-0"
              >
                {regenLoading === outputTab
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Regenerating...</>
                  : <><RefreshCw className="w-4 h-4 mr-1" /> Redo {OUTPUT_TABS.find((t) => t.id === outputTab)?.label}</>}
              </Button>
            </div>

            {outputTab === "ph" && (
              <OutputSection title="Product Hunt" color="text-orange-500">
                <OutputField label="Name" value={currentOutput.productHunt.name} copyKey="ph-name" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField
                  label={`Tagline (${currentOutput.productHunt.tagline.length}/60)`}
                  value={currentOutput.productHunt.tagline}
                  copyKey="ph-tagline"
                  copiedKey={copiedKey}
                  onCopy={copyText}
                  warning={currentOutput.productHunt.tagline.length > 60}
                />
                <OutputField
                  label={`Description (${currentOutput.productHunt.description.length}/260)`}
                  value={currentOutput.productHunt.description}
                  copyKey="ph-desc"
                  copiedKey={copiedKey}
                  onCopy={copyText}
                  warning={currentOutput.productHunt.description.length > 260}
                />
                <OutputField label="First Comment" value={currentOutput.productHunt.firstComment} copyKey="ph-comment" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "hn" && (
              <OutputSection title="Hacker News" color="text-amber-600">
                <OutputField label="Title" value={currentOutput.hackerNews.title} copyKey="hn-title" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField label="Body" value={currentOutput.hackerNews.body} copyKey="hn-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "tweet" && (
              <OutputSection title="Tweet Thread" color="text-sky-500">
                <div className="space-y-4">
                  {currentOutput.tweetThread.map((tweet, i) => (
                    <div key={i} className="group relative bg-muted/30 rounded-xl p-5 border">
                      <p className="text-sm pr-8">{tweet}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${tweet.length > 280 ? "text-red-500" : "text-muted-foreground"}`}>
                          {tweet.length}/280
                        </span>
                        <button onClick={() => copyText(tweet, `tweet-${i}`)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {copiedKey === `tweet-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-4 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => copyText(currentOutput.tweetThread.join("\n\n"), "tweet-all")}>
                      {copiedKey === "tweet-all" ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copy full thread
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copyText(getBufferFormat(currentOutput.tweetThread), "tweet-buffer")}>
                      {copiedKey === "tweet-buffer" ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                      Copy for Buffer
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-xl p-4 border">
                    <p className="font-medium mb-1">Engagement tips for {TONES[form.tone]?.label} tone:</p>
                    {form.tone === "excited" && <p>• Post on Tuesday–Thursday 9–11 AM. Reply to every reply within 30 min to boost reach. Add a GIF or screenshot to the first tweet.</p>}
                    {form.tone === "casual" && <p>• Personal tweets outperform branded ones. Start thread with a story or relatable pain point. End with a direct question.</p>}
                    {form.tone === "technical" && <p>• Technical threads perform best Thu–Fri. Include code snippets or architecture diagrams. Tag relevant communities (#buildinpublic, #devtools).</p>}
                    {form.tone === "professional" && <p>• Professional threads work well Tue–Wed morning. Cross-post as a LinkedIn article for extended reach. Use numbered structure for readability.</p>}
                  </div>
                </div>
              </OutputSection>
            )}

            {outputTab === "reddit" && (
              <OutputSection title="Reddit" color="text-red-500">
                <OutputField label="Title" value={currentOutput.reddit.title} copyKey="reddit-title" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField label="Body" value={currentOutput.reddit.body} copyKey="reddit-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "email" && (
              <OutputSection title="Cold Email" color="text-violet-500">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Subject line</label>
                    <Button size="sm" variant="ghost" onClick={handleGenerateSubjectLines} disabled={subjectLoading}>
                      {subjectLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                      Generate alternatives
                    </Button>
                  </div>
                  <div className="bg-muted/30 rounded-xl px-4 py-2.5 border text-sm font-medium">
                    {activeSubject ?? currentOutput.coldEmail.subject}
                  </div>
                  {altSubjectLines.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-muted-foreground font-medium">Alternative subject lines:</p>
                      {altSubjectLines.map((sl, i) => {
                        const badge = sl.openRateLabel === "High"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : sl.openRateLabel === "Medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-muted text-muted-foreground"
                        return (
                          <div key={i} className="flex items-start gap-4 p-3 rounded-xl border hover:bg-muted/30 cursor-pointer group" onClick={() => { setActiveSubject(sl.subject); copyText(sl.subject, `sl-${i}`) }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">{sl.subject}</p>
                              <p className="text-xs text-muted-foreground">{sl.reason}</p>
                            </div>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${badge}`}>{sl.openRateLabel}</span>
                            {copiedKey === `sl-${i}` ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <Copy className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <OutputField label="Body" value={currentOutput.coldEmail.body} copyKey="email-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "linkedin" && (
              <OutputSection title="LinkedIn" color="text-blue-600">
                <OutputField label={`Post (${currentOutput.linkedInPost?.body?.length ?? 0} chars)`} value={currentOutput.linkedInPost?.body ?? ""} copyKey="linkedin-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {/* Performance tracker for current record */}
            {currentRecordId && (
              <Card>
                <button className="w-full text-left" onClick={() => setExpandedPerf(expandedPerf === currentRecordId ? null : currentRecordId)}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-4">
                        <BarChart2 className="w-4 h-4 text-orange-500" />
                        Track Performance
                        {perfData.length > 0 && <Badge variant="secondary">{perfData.length} entries</Badge>}
                      </span>
                      {expandedPerf === currentRecordId ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </CardTitle>
                  </CardHeader>
                </button>
                {expandedPerf === currentRecordId && (
                  <CardContent className="pt-0 space-y-5">
                    {perfData.length > 0 && (
                      <div className="space-y-3">
                        {perfData.map((p, i) => (
                          <div key={i} className="flex items-center gap-4 text-sm bg-muted/30 rounded-xl p-4 border">
                            <span className="font-medium w-24 shrink-0">{p.platformLabel}</span>
                            <span className="text-muted-foreground">↑ {p.upvotes}</span>
                            <span className="text-muted-foreground">💬 {p.comments}</span>
                            <span className="text-muted-foreground">✉ {p.signups} signups</span>
                            {p.notes && <span className="text-xs text-muted-foreground truncate">{p.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Platform</label>
                        <select
                          value={perfDraft.platform ?? ""}
                          onChange={(e) => setPerfDraft((d) => ({ ...d, platform: e.target.value as LaunchPlatformId }))}
                          className="w-full h-9 text-xs rounded-md border border-input bg-background px-3"
                        >
                          <option value="">Select platform</option>
                          {LAUNCH_PLATFORM_OPTIONS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Upvotes / Reactions</label>
                        <Input
                          type="number"
                          min={0}
                          value={perfDraft.upvotes ?? ""}
                          onChange={(e) => setPerfDraft((d) => ({ ...d, upvotes: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Comments</label>
                        <Input
                          type="number"
                          min={0}
                          value={perfDraft.comments ?? ""}
                          onChange={(e) => setPerfDraft((d) => ({ ...d, comments: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Signups from this platform</label>
                        <Input
                          type="number"
                          min={0}
                          value={perfDraft.signups ?? ""}
                          onChange={(e) => setPerfDraft((d) => ({ ...d, signups: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs font-medium mb-1 block">Notes</label>
                        <Input
                          value={perfDraft.notes ?? ""}
                          onChange={(e) => setPerfDraft((d) => ({ ...d, notes: e.target.value }))}
                          placeholder="e.g. launched at 8am, got featured in daily digest"
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={addPerformanceEntry}>
                      <Plus className="w-4 h-4 mr-1" /> Log Entry
                    </Button>
                  </CardContent>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── WAITLIST BUILDER ─────────────────────────────────────────────── */}
        {view === "waitlist" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-4">
                <Megaphone className="w-6 h-6 text-orange-500" /> Waitlist Builder
              </h1>
              <p className="text-muted-foreground text-sm">Generate a self-contained HTML waitlist page ready to deploy anywhere.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium mb-1 block">Product name</label>
                <Input value={waitlist.productName} onChange={(e) => setWaitlist((w) => ({ ...w, productName: e.target.value }))} placeholder="DevDash" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Accent color</label>
                <input type="color" value={waitlist.accentColor} onChange={(e) => setWaitlist((w) => ({ ...w, accentColor: e.target.value }))} className="w-full h-9 rounded-md border border-input cursor-pointer" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block">Headline</label>
                <Input value={waitlist.headline} onChange={(e) => setWaitlist((w) => ({ ...w, headline: e.target.value }))} placeholder="Be the first to know" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block">Description</label>
                <Textarea value={waitlist.description} onChange={(e) => setWaitlist((w) => ({ ...w, description: e.target.value }))} rows={3} />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">CTA button text</label>
                <Input value={waitlist.ctaText} onChange={(e) => setWaitlist((w) => ({ ...w, ctaText: e.target.value }))} placeholder="Join Waitlist" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Formspree endpoint</label>
                <Input value={waitlist.formspreeEndpoint} onChange={(e) => setWaitlist((w) => ({ ...w, formspreeEndpoint: e.target.value }))} placeholder="https://formspree.io/f/YOUR_ID" />
              </div>
            </div>
            <div className="flex gap-4 flex-wrap">
              <Button
                onClick={() => {
                  downloadHtml(generateWaitlistHtml(waitlist), "waitlist.html")
                  setWaitlistGenerated(true)
                  toast.success("waitlist.html downloaded")
                }}
              >
                <Download className="w-4 h-4 mr-2" /> Download waitlist.html
              </Button>
              {waitlistGenerated && (
                <Button
                  variant="outline"
                  onClick={() => {
                    downloadHtml(generateThankYouHtml(waitlist), "thank-you.html")
                    toast.success("thank-you.html downloaded")
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> Download thank-you.html
                </Button>
              )}
            </div>
            <Card className="border-dashed">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground font-medium mb-3">Preview (dark background)</p>
                <div className="rounded-xl overflow-hidden" style={{ background: "#0f0f0f", minHeight: 200 }}>
                  <div className="p-8 text-center text-white space-y-4">
                    <p style={{ color: waitlist.accentColor }} className="text-lg font-bold">{waitlist.productName || "Product"}</p>
                    <p className="text-2xl font-bold">{waitlist.headline || "Headline"}</p>
                    <p className="text-sm opacity-60">{waitlist.description}</p>
                    <div className="flex gap-4 justify-center mt-4 flex-wrap">
                      <div className="bg-white/10 border border-white/20 rounded-xl px-5 py-2.5 text-sm text-white/50">you@example.com</div>
                      <div className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: waitlist.accentColor }}>{waitlist.ctaText || "Join"}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── COMPETITOR RESEARCH ─────────────────────────────────────────── */}
        {view === "research" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-4">
                <Search className="w-6 h-6 text-orange-500" /> Competitor Research
              </h1>
              <p className="text-muted-foreground text-sm">AI-powered market analysis: find your competitors, positioning angles, and unique value proposition.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-medium mb-1 block">Product name</label>
                <Input value={researchProductName} onChange={(e) => setResearchProductName(e.target.value)} placeholder="DevDash" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Category / niche</label>
                <Input value={researchCategory} onChange={(e) => setResearchCategory(e.target.value)} placeholder="developer dashboards, SaaS analytics" />
              </div>
            </div>
            <Button onClick={handleCompetitorResearch} disabled={researchLoading}>
              {researchLoading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Researching...</>
                : <><Sparkles className="w-4 h-4 mr-2" /> Research Competitors</>}
            </Button>

            {research && (
              <div className="space-y-5">
                {/* Suggested UVP */}
                <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/30 dark:bg-orange-950/20">
                  <CardContent className="pt-4">
                    <p className="text-xs font-semibold text-orange-600 mb-1 uppercase tracking-wide">Suggested Unique Value Proposition</p>
                    <p className="text-base font-medium">{research.suggestedUVP}</p>
                    <button onClick={() => copyText(research.suggestedUVP, "uvp")} className="mt-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                      {copiedKey === "uvp" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Copy
                    </button>
                  </CardContent>
                </Card>

                {/* Positioning angles */}
                <div>
                  <p className="text-sm font-medium mb-3">Positioning Angles</p>
                  <div className="space-y-3">
                    {research.positioningAngles.map((angle, i) => (
                      <div key={i} className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30 group">
                        <span className="text-orange-500 font-bold text-sm shrink-0">{i + 1}.</span>
                        <p className="text-sm flex-1">{angle}</p>
                        <button onClick={() => copyText(angle, `angle-${i}`)} className="opacity-0 group-hover:opacity-100 shrink-0">
                          {copiedKey === `angle-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Competitor table */}
                <div>
                  <p className="text-sm font-medium mb-3">5 Competitors</p>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2.5">Name</th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2.5 hidden sm:table-cell">Pricing</th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2.5">Differentiator</th>
                          <th className="text-left text-xs font-medium text-muted-foreground px-5 py-2.5 hidden md:table-cell">Weakness</th>
                        </tr>
                      </thead>
                      <tbody>
                        {research.competitors.map((c, i) => (
                          <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-5 py-4">
                              <p className="font-medium">{c.name}</p>
                              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                                <Globe className="w-2.5 h-2.5" /> {c.url.replace(/^https?:\/\//, "").slice(0, 30)}
                              </a>
                            </td>
                            <td className="px-5 py-4 text-xs text-muted-foreground hidden sm:table-cell">{c.pricingModel}</td>
                            <td className="px-5 py-4 text-xs">{c.keyDifferentiator}</td>
                            <td className="px-5 py-4 text-xs text-muted-foreground hidden md:table-cell">{c.weakness}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold mb-1">Launch History</h1>
              <p className="text-muted-foreground text-sm">{records.length} saved launches</p>
            </div>

            {/* Aggregate stats */}
            {records.some((r) => (r.performanceData?.length ?? 0) > 0) && (
              <Card className="bg-muted/30">
                <CardContent className="pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">All-Time Stats</p>
                  <AggregateStats records={records} />
                </CardContent>
              </Card>
            )}

            {records.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No launches yet</CardContent></Card>
            ) : (
              records.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => loadRecord(r)}
                    >
                      <div>
                        <p className="font-semibold">{r.input.productName}</p>
                        <p className="text-sm text-muted-foreground">{r.input.tagline}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="secondary">{r.input.tone}</Badge>
                        {r.competitorResearch && (
                          <Badge variant="secondary" className="text-orange-600">Research</Badge>
                        )}
                        {(r.performanceData?.length ?? 0) > 0 && (
                          <Badge variant="secondary" className="text-green-600">
                            <BarChart2 className="w-2.5 h-2.5 mr-1" />
                            {r.performanceData!.reduce((s, p) => s + p.upvotes + p.signups, 0)} total
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecords((prev) => {
                              const next = prev.filter((rec) => rec.id !== r.id)
                              save(next)
                              return next
                            })
                            toast.success("Deleted")
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Performance summary */}
                    {(r.performanceData?.length ?? 0) > 0 && (
                      <div className="mt-4 flex gap-5 text-xs text-muted-foreground border-t pt-3">
                        {r.performanceData!.map((p) => (
                          <span key={p.platform}><span className="font-medium">{p.platformLabel}</span>: ↑{p.upvotes} 💬{p.comments} ✉{p.signups}</span>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                      {editingNotes === r.id ? (
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Add notes about this launch..."
                            value={r.notes}
                            onChange={(e) => updateRecordNotes(r.id, e.target.value)}
                            rows={2}
                            className="text-sm"
                            autoFocus
                          />
                          <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>Done</Button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-full"
                          onClick={() => setEditingNotes(r.id)}
                        >
                          {r.notes ? r.notes : "+ Add notes"}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function OutputSection({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={`text-sm font-semibold flex items-center gap-4 ${color}`}>
          <Rocket className="w-4 h-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  )
}

function OutputField({
  label, value, copyKey, copiedKey, onCopy, multiline, warning,
}: {
  label: string; value: string; copyKey: string; copiedKey: string
  onCopy: (v: string, k: string) => void; multiline?: boolean; warning?: boolean
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <label className={`text-xs font-medium ${warning ? "text-amber-600" : "text-muted-foreground"}`}>{label}</label>
        <button onClick={() => onCopy(value, copyKey)} className="shrink-0">
          {copiedKey === copyKey ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
      {multiline ? (
        <div className="bg-muted/30 rounded-xl p-4 border whitespace-pre-wrap text-sm">{value}</div>
      ) : (
        <div className="bg-muted/30 rounded-xl px-4 py-2.5 border text-sm">{value}</div>
      )}
    </div>
  )
}

function CharCountBar({ outputTab, currentOutput }: { outputTab: OutputTab; currentOutput: LaunchOutput }) {
  const limit = PLATFORM_LIMITS[outputTab]
  if (!limit) return null

  let text = ""
  if (outputTab === "ph") text = currentOutput.productHunt.description
  else if (outputTab === "hn") text = currentOutput.hackerNews.body
  else if (outputTab === "tweet") text = currentOutput.tweetThread[0] ?? ""
  else if (outputTab === "reddit") text = currentOutput.reddit.body
  else if (outputTab === "email") text = currentOutput.coldEmail.body
  else if (outputTab === "linkedin") text = currentOutput.linkedInPost?.body ?? ""

  const count = text.length
  const pct = Math.min(100, Math.round((count / limit) * 100))
  const over = count > limit
  return (
    <div className="flex items-center gap-4 flex-1">
      <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs shrink-0 ${over ? "text-red-500" : "text-muted-foreground"}`}>
        {count}{limit ? `/${limit}` : ""} chars
      </span>
    </div>
  )
}

function AggregateStats({ records }: { records: LaunchRecord[] }) {
  const allPerf = records.flatMap((r) => r.performanceData ?? [])
  if (allPerf.length === 0) return null

  // Best platform by total upvotes
  const byPlatform: Record<string, { upvotes: number; signups: number; count: number }> = {}
  for (const p of allPerf) {
    if (!byPlatform[p.platform]) byPlatform[p.platform] = { upvotes: 0, signups: 0, count: 0 }
    byPlatform[p.platform]!.upvotes += p.upvotes
    byPlatform[p.platform]!.signups += p.signups
    byPlatform[p.platform]!.count += 1
  }
  const best = Object.entries(byPlatform).sort((a, b) => b[1].upvotes - a[1].upvotes)[0]
  const totalSignups = allPerf.reduce((s, p) => s + p.signups, 0)
  const totalUpvotes = allPerf.reduce((s, p) => s + p.upvotes, 0)

  return (
    <div className="flex flex-wrap gap-5 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Total upvotes</p>
        <p className="font-bold text-lg">{totalUpvotes}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Total signups</p>
        <p className="font-bold text-lg">{totalSignups}</p>
      </div>
      {best && (
        <div>
          <p className="text-xs text-muted-foreground">Best platform</p>
          <p className="font-bold text-lg">{LAUNCH_PLATFORM_OPTIONS.find((p) => p.id === best[0])?.label ?? best[0]}</p>
        </div>
      )}
    </div>
  )
}
