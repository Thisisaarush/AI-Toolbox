"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  GitBranch, Sparkles, Copy, Check, Loader2, Plus, Trash2,
  Download, Eye, EyeOff, History, ChevronDown, ChevronUp, Search,
  BarChart2, Mail, Globe, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Release, type ChangelogEntry, type ChangeType, type ToneId, type OutputFormat,
  CHANGE_TYPE_META, generateMarkdown, generateHTML, generateGitHubRelease, generateEmailHtml,
  bumpVersion, computeReleaseStats,
} from "./types"

const STORAGE_KEY = "changelog-ai-v1"

function load(): Release[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: Release[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }

type View = "input" | "editor" | "history"

const TONE_OPTIONS: { id: ToneId; label: string; desc: string }[] = [
  { id: "friendly",     label: "Friendly",      desc: "Warm and approachable" },
  { id: "professional", label: "Professional",   desc: "Formal and precise" },
  { id: "technical",    label: "Technical",      desc: "For developer audiences" },
]

const FORMAT_TABS: { id: OutputFormat; label: string; icon: string; color: string }[] = [
  { id: "markdown", label: "Markdown",       icon: "#",    color: "text-slate-600 dark:text-slate-400" },
  { id: "html",     label: "HTML",           icon: "</>",  color: "text-orange-600 dark:text-orange-400" },
  { id: "github",   label: "GitHub Release", icon: "G",    color: "text-gray-700 dark:text-gray-300" },
  { id: "tweet",    label: "Tweet Thread",   icon: "𝕏",   color: "text-sky-500" },
  { id: "email",    label: "Email Preview",  icon: "✉",    color: "text-cyan-600 dark:text-cyan-400" },
]

// ── Semver bump helper UI ─────────────────────────────────────────────────────

function SemverBumper({ version, onChange }: { version: string; onChange: (v: string) => void }) {
  const bumps: Array<{ type: "major" | "minor" | "patch"; label: string }> = [
    { type: "major", label: "MAJOR +1.0.0" },
    { type: "minor", label: "MINOR +0.1.0" },
    { type: "patch", label: "PATCH +0.0.1" },
  ]
  return (
    <div className="flex flex-wrap gap-1">
      {bumps.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onChange(bumpVersion(version, type))}
          className="px-2 py-1 text-[10px] font-mono font-semibold border rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Grouped preview panel ─────────────────────────────────────────────────────

function GroupedPreview({ entries }: { entries: ChangelogEntry[] }) {
  const order: ChangeType[] = ["breaking", "feature", "improvement", "fix", "deprecation"]
  const byType = useMemo(() => {
    const map = new Map<ChangeType, ChangelogEntry[]>()
    for (const e of entries) {
      if (!map.has(e.type)) map.set(e.type, [])
      map.get(e.type)!.push(e)
    }
    return map
  }, [entries])

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic p-3">No entries yet — generate or add some above.</p>
  }

  return (
    <div className="space-y-2">
      {order.map((type) => {
        const items = byType.get(type)
        if (!items || items.length === 0) return null
        const meta = CHANGE_TYPE_META[type]
        return (
          <div key={type} className={`rounded-lg p-2.5 border ${meta.bg}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{meta.emoji}</span>
              <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
              <span className={`ml-auto text-xs font-mono font-bold ${meta.color}`}>{items.length}</span>
            </div>
            {items.map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground pl-5 truncate">
                {e.title || <span className="italic">Untitled</span>}
              </p>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ── Release stats panel ───────────────────────────────────────────────────────

function ReleaseStatsPanel({ entries }: { entries: ChangelogEntry[] }) {
  const stats = useMemo(() => computeReleaseStats(entries), [entries])
  if (entries.length === 0) return null

  const sizeLabelColor = stats.sizeLabel === "Breaking release"
    ? "text-red-600 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
    : stats.sizeLabel === "Feature release"
      ? "text-green-600 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
      : "text-blue-600 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"

  return (
    <Card className="border-cyan-200 dark:border-cyan-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-cyan-500" /> Release Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-center">
            <p className="text-3xl font-black text-cyan-500">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total entries</p>
          </div>
          <div className={`ml-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${sizeLabelColor}`}>
            {stats.sizeLabel}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(stats.byType) as [ChangeType, number][]).map(([type, count]) => {
            const meta = CHANGE_TYPE_META[type]
            return (
              <span key={type} className={`text-xs px-2 py-0.5 rounded-full ${meta.bg} ${meta.color} font-medium`}>
                {meta.emoji} {count} {type}
              </span>
            )
          })}
        </div>
        {stats.biggestType && (
          <p className="text-xs text-muted-foreground">
            Biggest change type: <span className="font-semibold text-foreground">{CHANGE_TYPE_META[stats.biggestType].label}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Append mode modal ─────────────────────────────────────────────────────────

function AppendModal({
  current,
  onClose,
}: {
  current: string
  onClose: () => void
}) {
  const [existing, setExisting] = useState("")
  const [result, setResult] = useState("")
  const [copied, setCopied] = useState(false)

  function handleMerge() {
    const merged = existing.trim()
      ? `${current}\n\n---\n\n${existing.trim()}`
      : current
    setResult(merged)
  }

  function handleDownload() {
    const content = result || current
    const blob = new Blob([content], { type: "text/markdown" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "CHANGELOG.md"
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("CHANGELOG.md downloaded")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold">Export CHANGELOG.md</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => { setResult(current); handleDownload() }}
              className="border rounded-lg p-4 text-left hover:bg-muted/50 transition-colors"
            >
              <Download className="w-4 h-4 mb-2 text-cyan-500" />
              <p className="font-medium text-sm">Download current release</p>
              <p className="text-xs text-muted-foreground mt-0.5">Just this release as CHANGELOG.md</p>
            </button>
            <button
              onClick={() => setResult("")}
              className="border rounded-lg p-4 text-left hover:bg-muted/50 transition-colors border-cyan-200 dark:border-cyan-800"
            >
              <Plus className="w-4 h-4 mb-2 text-cyan-500" />
              <p className="font-medium text-sm">Append to existing</p>
              <p className="text-xs text-muted-foreground mt-0.5">Prepend to your existing CHANGELOG.md</p>
            </button>
          </div>

          <div>
            <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Paste your existing CHANGELOG.md (optional)</label>
            <Textarea
              placeholder="## v1.2.0 — 2024-01-01&#10;&#10;### Bug Fixes&#10;- ..."
              value={existing}
              onChange={(e) => setExisting(e.target.value)}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          <Button className="w-full" onClick={handleMerge}>
            <Eye className="w-3.5 h-3.5 mr-1" /> Preview merged CHANGELOG.md
          </Button>

          {result && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Preview</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copy
                </button>
              </div>
              <pre className="bg-muted/30 border rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                {result}
              </pre>
              <Button className="w-full" onClick={handleDownload}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download CHANGELOG.md
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Public page preview modal ─────────────────────────────────────────────────

function PublicPageModal({
  releases,
  onClose,
}: {
  releases: Release[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState(releases[0]?.id ?? "")
  const activeRelease = releases.find((r) => r.id === selected) ?? releases[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-card rounded-xl shadow-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/40 rounded-t-xl">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 bg-background border rounded-md px-3 py-0.5 text-xs text-muted-foreground font-mono">
            yourapp.com/changelog
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar — version timeline */}
          <div className="w-52 shrink-0 border-r overflow-y-auto p-4 space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Versions</p>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
              {releases.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className="relative flex flex-col mb-4 text-left w-full group"
                >
                  <div className={`absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full border-2 border-background ${selected === r.id ? "bg-cyan-500" : "bg-muted-foreground/40 group-hover:bg-cyan-400"} transition-colors`} />
                  <span className={`font-mono font-bold text-sm ${selected === r.id ? "text-cyan-500" : "text-foreground"}`}>{r.version}</span>
                  <span className="text-[10px] text-muted-foreground">{r.releaseDate}</span>
                  <span className="text-[10px] text-muted-foreground">{r.entries.length} changes</span>
                </button>
              ))}
            </div>
          </div>
          {/* Main content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeRelease && (
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                  <span>Changelog</span>
                  <span>/</span>
                  <span className="text-foreground font-medium">{activeRelease.version}</span>
                </div>
                <h1 className="text-3xl font-black font-mono mb-1">{activeRelease.version}</h1>
                <p className="text-sm text-muted-foreground mb-6">{activeRelease.releaseDate} · {activeRelease.entries.length} changes</p>
                {(["breaking", "feature", "improvement", "fix", "deprecation"] as ChangeType[]).map((type) => {
                  const items = activeRelease.entries.filter((e) => e.type === type)
                  if (items.length === 0) return null
                  const meta = CHANGE_TYPE_META[type]
                  return (
                    <div key={type} className="mb-6">
                      <h2 className={`text-base font-semibold mb-3 flex items-center gap-2 ${meta.color}`}>
                        <span>{meta.emoji}</span> {meta.label}
                      </h2>
                      <ul className="space-y-3">
                        {items.map((e) => (
                          <li key={e.id} className="border-l-2 pl-4 py-1" style={{ borderColor: "currentColor" }}>
                            <p className="font-medium text-sm">{e.title}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">{e.description}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground text-center rounded-b-xl">
          This is a preview. Public changelog hosting is coming soon.
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ChangelogAIContent() {
  const [releases, setReleases] = useState<Release[]>([])
  const [view, setView] = useState<View>("input")
  const [loading, setLoading] = useState(false)
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown")
  const [copiedKey, setCopiedKey] = useState("")
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [showAppendModal, setShowAppendModal] = useState(false)
  const [showPublicPageModal, setShowPublicPageModal] = useState(false)

  // Input form
  const [rawInput, setRawInput] = useState("")
  const [version, setVersion] = useState("")
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [tone, setTone] = useState<ToneId>("friendly")
  const [useEmojis, setUseEmojis] = useState(false)

  // Editor state
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [showPreview, setShowPreview] = useState(true)
  const [showGroupedPreview, setShowGroupedPreview] = useState(true)

  // History
  const [historySearch, setHistorySearch] = useState("")
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set())

  useEffect(() => { setReleases(load()) }, [])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function handleGenerate() {
    if (!rawInput.trim()) { toast.error("Paste your git log or changes first"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/changelog-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", rawInput, tone, useEmojis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setEntries(data.entries)
      setView("editor")
      toast.success(`${data.entries.length} changelog entries generated`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setLoading(false)
  }

  function saveRelease() {
    if (!version.trim()) { toast.error("Version required"); return }
    if (entries.length === 0) { toast.error("Add at least one entry"); return }
    const now = new Date().toISOString()
    const release: Release = {
      id: currentRelease?.id ?? crypto.randomUUID(),
      version,
      releaseDate,
      entries: [...entries],
      tone,
      useEmojis,
      createdAt: currentRelease?.createdAt ?? now,
    }
    setReleases((prev) => {
      const filtered = prev.filter((r) => r.id !== release.id)
      const next = [release, ...filtered]
      save(next)
      return next
    })
    setCurrentRelease(release)
    toast.success("Release saved!")
  }

  const updateEntry = useCallback((id: string, field: keyof ChangelogEntry, value: string) => {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  function addEntry() {
    setEntries((prev) => [...prev, {
      id: crypto.randomUUID(),
      type: "improvement" as ChangeType,
      title: "",
      description: "",
    }])
  }

  function toggleExpand(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleReleaseExpand(id: string) {
    setExpandedReleases((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // Infer "current version" from latest saved release for semver bumper
  const latestVersion = releases[0]?.version ?? ""

  const releaseForExport: Release = useMemo(() => ({
    id: currentRelease?.id ?? "preview",
    version: version || "v1.0.0",
    releaseDate,
    entries,
    tone,
    useEmojis,
    createdAt: new Date().toISOString(),
  }), [currentRelease, version, releaseDate, entries, tone, useEmojis])

  const outputText = useMemo(() => {
    if (outputFormat === "markdown") return generateMarkdown(releaseForExport)
    if (outputFormat === "html") return generateHTML(releaseForExport)
    if (outputFormat === "github") return generateGitHubRelease(releaseForExport)
    if (outputFormat === "email") return generateEmailHtml(releaseForExport)
    if (outputFormat === "tweet") {
      const features = entries.filter((e) => e.type === "feature").slice(0, 3)
      const fixes = entries.filter((e) => e.type === "fix").slice(0, 2)
      const total = features.length + fixes.length + 2
      const tweets = [
        `[1/${total}] ${useEmojis ? "🚀 " : ""}${version || "New release"} is live! Here's what's new:`,
        ...features.map((e, i) => `[${i + 2}/${total}] ${useEmojis ? "✨ " : ""}${e.title}: ${e.description.slice(0, 200)}`),
        ...fixes.map((e, i) => `[${features.length + i + 2}/${total}] ${useEmojis ? "🐛 " : ""}Fixed: ${e.title}`),
        `[${total}/${total}] Full changelog: [link] — update now and let us know what you think!`,
      ]
      return tweets.join("\n\n")
    }
    return ""
  }, [outputFormat, releaseForExport, entries, version, useEmojis])

  const filteredReleases = useMemo(() => {
    if (!historySearch.trim()) return releases
    return releases.filter((r) => r.version.toLowerCase().includes(historySearch.toLowerCase()))
  }, [releases, historySearch])

  // Current release markdown for export modal
  const currentMarkdown = useMemo(() => generateMarkdown(releaseForExport), [releaseForExport])

  return (
    <div className="min-h-screen flex flex-col">
      {showAppendModal && (
        <AppendModal current={currentMarkdown} onClose={() => setShowAppendModal(false)} />
      )}
      {showPublicPageModal && releases.length > 0 && (
        <PublicPageModal releases={releases} onClose={() => setShowPublicPageModal(false)} />
      )}

      <ToolHeader
        title="Changelog AI"
        icon={GitBranch}
        color="text-cyan-500"
        badge="Dev Tools"
        actions={
          <div className="flex gap-2">
            {view !== "input" && (
              <Button variant="outline" size="sm" onClick={() => { setView("input"); setCurrentRelease(null) }}>
                ← New Release
              </Button>
            )}
            {releases.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "input" : "history")}>
                  <History className="w-3.5 h-3.5 mr-1" /> History
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowPublicPageModal(true)}>
                  <Globe className="w-3.5 h-3.5 mr-1" /> Preview Page
                </Button>
              </>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── INPUT ──────────────────────────────────────────────────────────── */}
        {view === "input" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Changelog AI</h1>
              <p className="text-muted-foreground">Paste your git log → get a beautiful, user-facing changelog.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              {/* Left: paste area */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2 block">
                        Git log, PR descriptions, or manual changes
                      </label>
                      <Textarea
                        placeholder={`abc1234 feat: add dark mode toggle
def5678 fix: resolve crash on mobile Safari
ghi9012 chore: upgrade React to 19
jkl3456 feat: add CSV export for reports
mno7890 fix: typo in onboarding copy
pqr1234 perf: 40% faster load times via lazy loading`}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </div>
                    {/* Git log helper */}
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">Get your git log</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono bg-background border rounded px-2 py-1 flex-1">git log --oneline v1.0..HEAD</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText("git log --oneline v1.0..HEAD"); toast.success("Copied!") }}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <Button className="w-full h-10" onClick={handleGenerate} disabled={loading}>
                      {loading
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transforming...</>
                        : <><Sparkles className="w-4 h-4 mr-2" /> Generate Changelog</>
                      }
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Right: settings + how it works guide */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Release Info</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Version</label>
                      <Input
                        placeholder="v2.3.0"
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        className="font-mono"
                      />
                      {latestVersion && (
                        <div className="mt-2">
                          <p className="text-[10px] text-muted-foreground mb-1">Bump from <span className="font-mono">{latestVersion}</span></p>
                          <SemverBumper version={latestVersion} onChange={setVersion} />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Release date</label>
                      <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Options</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-2 block">Tone</label>
                      <div className="flex flex-col gap-1">
                        {TONE_OPTIONS.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setTone(t.id)}
                            className={`px-3 py-2 rounded text-sm border text-left transition-colors ${tone === t.id ? "bg-cyan-500 text-white border-cyan-500" : "border-border hover:bg-muted"}`}
                          >
                            <span className="font-medium">{t.label}</span>
                            <span className={`block text-xs mt-0.5 ${tone === t.id ? "text-cyan-100" : "text-muted-foreground"}`}>{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useEmojis}
                        onChange={(e) => setUseEmojis(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm">Add emojis to headings</span>
                    </label>
                  </CardContent>
                </Card>

                {/* How it works */}
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2"><CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">How it works</CardTitle></CardHeader>
                  <CardContent className="space-y-2.5">
                    {[
                      { step: "1", text: "Paste raw git commits or PR descriptions" },
                      { step: "2", text: "AI categorizes and rewrites for your users" },
                      { step: "3", text: "Edit entries in the visual editor" },
                      { step: "4", text: "Export in Markdown, HTML, GitHub, Tweet, or Email" },
                    ].map(({ step, text }) => (
                      <div key={step} className="flex gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                        <p className="text-xs text-muted-foreground">{text}</p>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t space-y-1">
                      <p className="text-[10px] font-medium text-muted-foreground">Example input → output</p>
                      <code className="block text-[10px] font-mono bg-background border rounded p-2 text-muted-foreground">feat: add dark mode toggle</code>
                      <p className="text-[10px] text-muted-foreground pl-1">→</p>
                      <p className="text-[10px] font-medium pl-1">Dark mode support — your eyes will thank you</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR ─────────────────────────────────────────────────────────── */}
        {view === "editor" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
              <div>
                <h1 className="text-2xl font-bold">Review & Edit</h1>
                <p className="text-muted-foreground text-sm">{entries.length} entries. Edit, add, remove, then save.</p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Version</label>
                  <Input
                    placeholder="v2.3.0"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-32 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Date</label>
                  <Input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="w-36" />
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {showPreview ? "Hide" : "Show"} preview
                </Button>
                <Button size="sm" onClick={saveRelease}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Save Release
                </Button>
              </div>
            </div>

            {/* Semver bumper in editor too */}
            {latestVersion && version === "" && (
              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <p className="text-xs text-muted-foreground shrink-0">Bump from <span className="font-mono">{latestVersion}</span>:</p>
                <SemverBumper version={latestVersion} onChange={setVersion} />
              </div>
            )}

            {/* Release stats */}
            <ReleaseStatsPanel entries={entries} />

            <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
              {/* Entries editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Entries</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowGroupedPreview(!showGroupedPreview)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      {showGroupedPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      Group view
                    </button>
                    <Button variant="outline" size="sm" onClick={addEntry}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                  </div>
                </div>

                {/* Grouped preview panel */}
                {showGroupedPreview && (
                  <Card className="bg-muted/20">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground">Grouped Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <GroupedPreview entries={entries} />
                    </CardContent>
                  </Card>
                )}

                {entries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={entry.type}
                          onChange={(e) => updateEntry(entry.id, "type", e.target.value)}
                          className="h-9 rounded border border-input bg-background px-2 text-xs font-medium"
                        >
                          {(Object.entries(CHANGE_TYPE_META) as [ChangeType, typeof CHANGE_TYPE_META[ChangeType]][]).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                          ))}
                        </select>
                        <div className="flex gap-1">
                          <button onClick={() => toggleExpand(entry.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {expandedEntries.has(entry.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => removeEntry(entry.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <Input
                        placeholder="Entry title"
                        value={entry.title}
                        onChange={(e) => updateEntry(entry.id, "title", e.target.value)}
                        className="text-sm"
                      />
                      <Textarea
                        placeholder="User-facing description"
                        value={entry.description}
                        onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      {expandedEntries.has(entry.id) && (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Technical details (optional)"
                            value={entry.technicalDetails ?? ""}
                            onChange={(e) => updateEntry(entry.id, "technicalDetails", e.target.value)}
                            rows={2}
                            className="text-sm text-muted-foreground"
                          />
                          {entry.rawCommit && (
                            <div className="bg-muted/30 rounded p-2 border">
                              <p className="text-[10px] text-muted-foreground mb-0.5 font-medium">Original commit</p>
                              <code className="text-[10px] font-mono text-muted-foreground">{entry.rawCommit}</code>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                <Button className="w-full" onClick={saveRelease}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Save Release
                </Button>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="space-y-3">
                  <div className="flex gap-0.5 border-b overflow-x-auto">
                    {FORMAT_TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setOutputFormat(t.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${outputFormat === t.id ? `border-cyan-500 ${t.color}` : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        <span className="font-mono">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {outputFormat === "email" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-cyan-500" />
                          <span className="text-xs text-muted-foreground">Email HTML preview</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => copyText(outputText, "output")}>
                          {copiedKey === "output" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          Copy HTML
                        </Button>
                      </div>
                      <div
                        className="border rounded-xl overflow-hidden max-h-[600px] overflow-y-auto"
                        dangerouslySetInnerHTML={{ __html: outputText }}
                      />
                    </div>
                  ) : (
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 z-10"
                        onClick={() => copyText(outputText, "output")}
                      >
                        {copiedKey === "output" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        Copy
                      </Button>
                      <pre className="bg-muted/30 rounded-xl border p-4 pt-10 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[600px]">
                        {outputText}
                      </pre>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAppendModal(true)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Export CHANGELOG.md
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ────────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Changelog History</h1>
              <div className="flex gap-2">
                {releases.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowPublicPageModal(true)}>
                      <Globe className="w-3.5 h-3.5 mr-1" /> Preview Page
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowAppendModal(true)}>
                      <Download className="w-3.5 h-3.5 mr-1" /> Export CHANGELOG.md
                    </Button>
                  </>
                )}
              </div>
            </div>

            {releases.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search releases by version..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {filteredReleases.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                {releases.length === 0 ? "No releases saved yet" : "No releases match your search"}
              </CardContent></Card>
            ) : (
              <div className="relative pl-4">
                {/* Timeline line */}
                <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {filteredReleases.map((r) => {
                    const stats = computeReleaseStats(r.entries)
                    return (
                      <div key={r.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[19px] top-5 w-3 h-3 rounded-full bg-cyan-500 border-2 border-background" />
                        <Card>
                          <CardContent className="py-4">
                            <div className="flex items-start justify-between gap-3">
                              <button
                                className="flex-1 text-left"
                                onClick={() => { setEntries(r.entries); setVersion(r.version); setReleaseDate(r.releaseDate); setTone(r.tone); setUseEmojis(r.useEmojis); setCurrentRelease(r); setView("editor") }}
                              >
                                <div className="flex items-baseline gap-3 flex-wrap">
                                  <p className="font-black font-mono text-xl tracking-tight text-cyan-500">{r.version}</p>
                                  <span className="text-sm text-muted-foreground">{r.releaseDate}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    stats.sizeLabel === "Breaking release" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
                                    stats.sizeLabel === "Feature release" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                                    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                  }`}>
                                    {stats.sizeLabel}
                                  </span>
                                  {(Object.entries(stats.byType) as [ChangeType, number][]).map(([type, count]) => {
                                    const meta = CHANGE_TYPE_META[type]
                                    return (
                                      <span key={type} className={`text-xs px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                                        {meta.emoji} {count}
                                      </span>
                                    )
                                  })}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{r.entries.length} entries · {r.tone} tone</p>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => toggleReleaseExpand(r.id)}
                                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {expandedReleases.has(r.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => {
                                    setReleases((prev) => { const next = prev.filter((rel) => rel.id !== r.id); save(next); return next })
                                    toast.success("Deleted")
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {expandedReleases.has(r.id) && (
                              <div className="mt-3 pt-3 border-t">
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-3 rounded border max-h-48 overflow-auto">
                                  {generateMarkdown(r)}
                                </pre>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
