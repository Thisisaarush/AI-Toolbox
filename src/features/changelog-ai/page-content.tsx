"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  GitBranch, Sparkles, Copy, Check, Loader2, Plus, Trash2,
  Download, Eye, EyeOff, History, ChevronDown, ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Release, type ChangelogEntry, type ChangeType, type ToneId, type OutputFormat,
  CHANGE_TYPE_META, generateMarkdown, generateHTML, generateGitHubRelease,
} from "./types"

const STORAGE_KEY = "changelog-ai-v1"

function load(): Release[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: Release[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }

type View = "input" | "editor" | "history"

const TONE_OPTIONS: { id: ToneId; label: string }[] = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "technical", label: "Technical" },
]

const FORMAT_TABS: { id: OutputFormat; label: string }[] = [
  { id: "markdown", label: "Markdown" },
  { id: "html", label: "HTML" },
  { id: "github", label: "GitHub Release" },
  { id: "tweet", label: "Tweet Thread" },
  { id: "email", label: "Email" },
]

export function ChangelogAIContent() {
  const [releases, setReleases] = useState<Release[]>([])
  const [view, setView] = useState<View>("input")
  const [loading, setLoading] = useState(false)
  const [currentRelease, setCurrentRelease] = useState<Release | null>(null)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown")
  const [copiedKey, setCopiedKey] = useState("")
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())

  // Input form
  const [rawInput, setRawInput] = useState("")
  const [version, setVersion] = useState("")
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [tone, setTone] = useState<ToneId>("friendly")
  const [useEmojis, setUseEmojis] = useState(false)

  // Editor state
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [showPreview, setShowPreview] = useState(true)

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
      id: crypto.randomUUID(),
      version,
      releaseDate,
      entries: [...entries],
      tone,
      useEmojis,
      createdAt: now,
    }
    setReleases((prev) => {
      const next = [release, ...prev]
      save(next)
      return next
    })
    setCurrentRelease(release)
    toast.success("Release saved!")
  }

  function updateEntry(id: string, field: keyof ChangelogEntry, value: string) {
    setEntries((prev) => prev.map((e) => e.id === id ? { ...e, [field]: value } : e))
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function addEntry() {
    const newEntry: ChangelogEntry = {
      id: crypto.randomUUID(),
      type: "improvement",
      title: "",
      description: "",
    }
    setEntries((prev) => [...prev, newEntry])
  }

  function toggleExpand(id: string) {
    setExpandedEntries((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
    if (outputFormat === "tweet") {
      const features = entries.filter((e) => e.type === "feature").slice(0, 3)
      const fixes = entries.filter((e) => e.type === "fix").slice(0, 2)
      const tweets = [
        `[1/${features.length + fixes.length + 2}] ${useEmojis ? "🚀 " : ""}${version || "New release"} is live! Here's what's new:`,
        ...features.map((e, i) => `[${i + 2}/X] ${useEmojis ? "✨ " : ""}${e.title}: ${e.description.slice(0, 200)}`),
        ...fixes.map((e, i) => `[${features.length + i + 2}/X] ${useEmojis ? "🐛 " : ""}Fixed: ${e.title}`),
        `[Final/X] Full changelog: [link] — update now and let us know what you think!`,
      ]
      return tweets.join("\n\n")
    }
    if (outputFormat === "email") {
      const features = entries.filter((e) => e.type === "feature")
      const fixes = entries.filter((e) => e.type === "fix")
      return `Subject: What's new in ${version || "our latest release"}

Hi there,

We just shipped ${version || "a new release"} and wanted to share what's changed.

${features.length > 0 ? `**New Features**\n${features.map((e) => `• ${e.title}: ${e.description}`).join("\n")}\n` : ""}
${fixes.length > 0 ? `**Bug Fixes**\n${fixes.map((e) => `• ${e.title}`).join("\n")}\n` : ""}

Thanks for being with us,
The Team`
    }
    return ""
  }, [outputFormat, releaseForExport, entries, version, useEmojis])

  function exportChangelog() {
    const allReleases = releases.map((r) => generateMarkdown(r)).join("\n\n---\n\n")
    const blob = new Blob([allReleases], { type: "text/markdown" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "CHANGELOG.md"
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("CHANGELOG.md downloaded")
  }

  const widgetSnippet = `<script src="https://yourapp.com/changelog-widget.js" data-changelog-id="YOUR_ID"></script>`

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Changelog AI"
        icon={GitBranch}
        color="text-cyan-500"
        badge="Dev Tools"
        actions={
          <div className="flex gap-2">
            {view !== "input" && <Button variant="outline" size="sm" onClick={() => { setView("input"); setCurrentRelease(null) }}>← New Release</Button>}
            {releases.length > 0 && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "input" : "history")}>
                  <History className="w-3.5 h-3.5 mr-1" /> History
                </Button>
                <Button variant="ghost" size="sm" onClick={exportChangelog}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export MD
                </Button>
              </>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── INPUT ─────────────────────────────────────────────────────────── */}
        {view === "input" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Changelog AI</h1>
              <p className="text-muted-foreground">Paste your git log → get a beautiful, user-facing changelog.</p>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardContent className="pt-5 space-y-4">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block">Git log, PR descriptions, or manual changes *</label>
                      <Textarea
                        placeholder={`abc1234 feat: add dark mode toggle
def5678 fix: resolve crash on mobile Safari
ghi9012 chore: upgrade React to 19
jkl3456 feat: add CSV export for reports
mno7890 fix: typo in onboarding copy
pqr1234 improvement: 40% faster load times via lazy loading`}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        rows={12}
                        className="font-mono text-sm"
                      />
                    </div>
                    <Button className="w-full" onClick={handleGenerate} disabled={loading}>
                      {loading
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Transforming...</>
                        : <><Sparkles className="w-4 h-4 mr-2" /> Generate Changelog</>
                      }
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Release Info</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Version</label>
                      <Input placeholder="v2.3.0" value={version} onChange={(e) => setVersion(e.target.value)} />
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
                            className={`px-3 py-1.5 rounded text-sm border text-left transition-colors ${tone === t.id ? "bg-cyan-500 text-white border-cyan-500" : "border-border hover:bg-muted"}`}
                          >
                            {t.label}
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
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR ───────────────────────────────────────────────────────── */}
        {view === "editor" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Review & Edit</h1>
                <p className="text-muted-foreground text-sm">{entries.length} entries generated. Edit and save.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                  {showPreview ? "Hide" : "Show"} preview
                </Button>
                <Button size="sm" onClick={saveRelease}>
                  <Check className="w-3.5 h-3.5 mr-1" /> Save Release
                </Button>
              </div>
            </div>

            <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
              {/* Entries editor */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Entries</p>
                  <Button variant="outline" size="sm" onClick={addEntry}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                </div>
                {entries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <select
                          value={entry.type}
                          onChange={(e) => updateEntry(entry.id, "type", e.target.value)}
                          className="h-7 rounded border border-input bg-background px-2 text-xs"
                        >
                          {(Object.entries(CHANGE_TYPE_META) as [ChangeType, typeof CHANGE_TYPE_META[ChangeType]][]).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
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
                        <Textarea
                          placeholder="Technical details (optional, shown in collapsible)"
                          value={entry.technicalDetails ?? ""}
                          onChange={(e) => updateEntry(entry.id, "technicalDetails", e.target.value)}
                          rows={2}
                          className="text-sm text-muted-foreground"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="space-y-3">
                  <div className="flex gap-1 border-b">
                    {FORMAT_TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setOutputFormat(t.id)}
                        className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors ${outputFormat === t.id ? "border-cyan-500 text-cyan-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
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

                  {/* Widget snippet */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Embeddable widget snippet</p>
                    <div className="group relative">
                      <code className="text-xs bg-muted/50 p-3 rounded border block font-mono">{widgetSnippet}</code>
                      <button onClick={() => copyText(widgetSnippet, "widget")} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedKey === "widget" ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Changelog History</h1>
              {releases.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportChangelog}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Export CHANGELOG.md
                </Button>
              )}
            </div>

            {/* Full changelog preview */}
            {releases.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Full Changelog Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/30 p-4 rounded border max-h-64 overflow-auto">
                    {releases.map((r) => generateMarkdown(r)).join("\n\n---\n\n")}
                  </pre>
                </CardContent>
              </Card>
            )}

            {releases.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No releases saved yet</CardContent></Card>
            ) : (
              releases.map((r) => (
                <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setEntries(r.entries); setVersion(r.version); setReleaseDate(r.releaseDate); setTone(r.tone); setUseEmojis(r.useEmojis); setCurrentRelease(r); setView("editor") }}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{r.version}</p>
                        <Badge variant="secondary">{r.releaseDate}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{r.entries.length} entries · {r.tone} tone</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {(["feature", "fix", "improvement"] as ChangeType[]).map((type) => {
                          const count = r.entries.filter((e) => e.type === type).length
                          if (count === 0) return null
                          const meta = CHANGE_TYPE_META[type]
                          return (
                            <span key={type} className={`text-xs px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                              {count} {type}
                            </span>
                          )
                        })}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setReleases((prev) => { const next = prev.filter((rel) => rel.id !== r.id); save(next); return next })
                          toast.success("Deleted")
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
