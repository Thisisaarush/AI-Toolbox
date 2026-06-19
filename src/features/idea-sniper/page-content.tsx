"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Target, Sparkles, Copy, Check, Loader2, Trash2,
  TrendingUp, TrendingDown, Minus, Users, Search,
  MessageSquare, AlertTriangle, History, ExternalLink, Download, Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { IdeaAnalysis, IdeaRecord } from "./types"

const STORAGE_KEY = "idea-sniper-v1"

// Module-level constant — no recreation on every render
const verdictConfig = {
  go: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", label: "GO", border: "border-green-300 dark:border-green-700" },
  "no-go": { icon: TrendingDown, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", label: "NO-GO", border: "border-red-300 dark:border-red-700" },
  pivot: { icon: Minus, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", label: "PIVOT", border: "border-amber-300 dark:border-amber-700" },
}

function load(): IdeaRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: IdeaRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 20))) }

function exportAnalysisMarkdown(ideaInput: string, analysis: IdeaAnalysis) {
  const title = (ideaInput.split("\n")[0] ?? "").slice(0, 80) || "Idea"
  const lines: string[] = [
    `# Idea Analysis: ${title}`,
    `**Pain Score:** ${analysis.painScore}/10`,
    `**Verdict:** ${analysis.verdict.toUpperCase()}`,
    "",
    "## Pain Reasoning",
    analysis.painScoreReasoning,
    "",
    "## Personas",
    ...analysis.personas.map((p) =>
      `### ${p.jobTitle}\n${p.context}\n- **Frequency:** ${p.frequency}\n- **Workaround:** ${p.workaround}\n- **WTP:** ${p.willingToPay}`
    ),
    "",
    "## Competitors",
    ...analysis.competitors.map((c) =>
      `### ${c.name} (${c.pricing})\n${c.description}\n**Pros:** ${c.pros.join(", ")}\n**Cons:** ${c.cons.join(", ")}`
    ),
    "",
    "## Search Queries",
    ...analysis.searchQueries.map((q) => `- ${q}`),
    "",
    "## Where to Find Customers",
    ...analysis.whereTofindCustomers.map((c) => `- **${c.name}** (${c.type}): ${c.link}`),
    "",
    "## Exact Language",
    ...analysis.exactLanguage.map((p) => `- "${p}"`),
    "",
    "## Outreach Message",
    analysis.outreachMessage,
  ]
  const md = lines.join("\n")
  const blob = new Blob([md], { type: "text/markdown" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `idea-analysis-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
  toast.success("Exported as Markdown")
}

// Named sub-component for the verdict hero card
function VerdictHero({ analysis }: { analysis: IdeaAnalysis }) {
  const vc = verdictConfig[analysis.verdict]
  const VerdictIcon = vc.icon
  const scoreColor = analysis.painScore >= 7 ? "text-red-500" : analysis.painScore >= 5 ? "text-amber-500" : "text-green-500"
  const barColor = analysis.painScore >= 7 ? "bg-red-500" : analysis.painScore >= 5 ? "bg-amber-500" : "bg-green-500"

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Pain score card */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Pain Score</p>
          <div className="flex items-end gap-2 mb-3">
            <span className={`text-5xl font-black ${scoreColor}`}>{analysis.painScore}</span>
            <span className="text-xl text-muted-foreground mb-1">/10</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full ${barColor}`}
              style={{ width: `${analysis.painScore * 10}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{analysis.painScoreReasoning}</p>
        </CardContent>
      </Card>

      {/* Verdict card */}
      <Card className={`border-2 ${vc.border}`}>
        <CardContent className="pt-5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Verdict</p>
          <div className={`flex items-center gap-3 p-3 rounded-xl ${vc.bg} mb-3`}>
            <VerdictIcon className={`w-7 h-7 ${vc.color} shrink-0`} />
            <span className={`text-3xl font-black ${vc.color}`}>{vc.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">{analysis.verdictReasoning}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function IdeaSniperContent() {
  const [records, setRecords] = useState<IdeaRecord[]>([])
  const [ideaInput, setIdeaInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null)
  const [view, setView] = useState<"input" | "result" | "history">("input")
  const [copiedKey, setCopiedKey] = useState("")

  // Edit-and-rerun state
  const [editingIdea, setEditingIdea] = useState(false)
  const [editDraft, setEditDraft] = useState("")

  useEffect(() => { setRecords(load()) }, [])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function handleAnalyze(overrideIdea?: string) {
    const idea = overrideIdea ?? ideaInput
    if (!idea.trim()) { toast.error("Describe your idea first"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/idea-sniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", idea }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Analysis failed")
      setAnalysis(data.analysis)
      const record: IdeaRecord = {
        id: crypto.randomUUID(),
        input: idea,
        analysis: data.analysis,
        createdAt: new Date().toISOString(),
      }
      setRecords((prev) => {
        const next = [record, ...prev]
        save(next)
        return next
      })
      setView("result")
      setEditingIdea(false)
      toast.success("Analysis complete!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Analysis failed")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Idea Sniper"
        icon={Target}
        color="text-rose-500"
        badge="Research"
        actions={
          <div className="flex gap-2">
            {view !== "input" && <Button variant="outline" size="sm" onClick={() => setView("input")}>← New Idea</Button>}
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "input" : "history")}>
                <History className="w-3.5 h-3.5 mr-1" /> History
              </Button>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">

        {/* ── INPUT ─────────────────────────────────────────────────────────── */}
        {view === "input" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Idea Sniper</h1>
              <p className="text-muted-foreground">Enter your idea → get real pain analysis, market signals, and competitor landscape.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Describe your idea</label>
                  <Textarea
                    placeholder="e.g. A tool that automatically generates test cases for backend APIs by analyzing your OpenAPI spec and running against your staging environment. Aimed at solo developers and small teams who hate writing tests."
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">Include: what problem it solves, who has the pain, and your approach</p>
                </div>
                <Button className="w-full" onClick={() => handleAnalyze()} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing market...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Snipe This Idea</>
                  }
                </Button>
              </CardContent>
            </Card>

            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-xl" />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
                <Skeleton className="h-32 rounded-xl" />
              </div>
            )}

            {/* Quick history preview */}
            {records.length > 0 && !loading && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Recent analyses</p>
                <div className="space-y-2">
                  {records.slice(0, 3).map((r) => {
                    const vc = verdictConfig[r.analysis.verdict]
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setAnalysis(r.analysis); setIdeaInput(r.input); setView("result") }}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${vc.bg} ${vc.color}`}>{vc.label}</span>
                        <span className="text-sm flex-1 truncate">{r.input}</span>
                        <span className={`text-xs font-semibold ${r.analysis.painScore >= 7 ? "text-red-500" : r.analysis.painScore >= 5 ? "text-amber-500" : "text-green-500"}`}>
                          {r.analysis.painScore}/10
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ───────────────────────────────────────────────────────── */}
        {view === "result" && analysis && (
          <div className="space-y-6">
            {/* Verdict hero — split cards */}
            <VerdictHero analysis={analysis} />

            {/* Edit idea inline */}
            <div>
              {!editingIdea ? (
                <button
                  onClick={() => { setEditDraft(ideaInput); setEditingIdea(true) }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit idea
                </button>
              ) : (
                <Card className="border-rose-200 dark:border-rose-800">
                  <CardContent className="pt-4 space-y-3">
                    <p className="text-xs font-medium">Edit your idea</p>
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={5}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setIdeaInput(editDraft)
                          setEditingIdea(false)
                          handleAnalyze(editDraft)
                        }}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                        Re-analyze
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingIdea(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Search queries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-rose-500" /> Search Queries to Run Yourself</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.searchQueries.map((q, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <code className="text-xs bg-muted/50 px-3 py-2 rounded border flex-1 font-mono">{q}</code>
                      <button onClick={() => copyText(q, `sq-${i}`)} className="shrink-0">
                        {copiedKey === `sq-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community signals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-rose-500" /> Community Signals
                  <Badge variant="secondary" className="text-[10px]">AI-synthesized</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">These are AI-generated examples of what people would say, based on training data patterns. Always verify with real community search.</p>
                {analysis.communitySignals.map((signal, i) => {
                  const sentimentColor = { frustrated: "text-amber-500", desperate: "text-red-500", curious: "text-blue-500" }[signal.sentiment]
                  return (
                    <div key={i} className="bg-muted/30 rounded-lg p-4 border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground">{signal.platform}</span>
                        <Badge variant="secondary" className={`text-[10px] ${sentimentColor}`}>{signal.sentiment}</Badge>
                      </div>
                      <p className="text-sm italic">&ldquo;{signal.simulatedQuote}&rdquo;</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Personas */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-rose-500" /> Who Has This Pain</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.personas.map((p, i) => (
                  <div key={i} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{p.jobTitle}</span>
                      <Badge variant="secondary">{p.frequency}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.context}</p>
                    <div className="grid sm:grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted/30 p-2 rounded">
                        <span className="font-medium">Workaround: </span>{p.workaround}
                      </div>
                      <div className="bg-green-50 dark:bg-green-950 p-2 rounded">
                        <span className="font-medium text-green-700 dark:text-green-300">WTP: </span>{p.willingToPay}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Competitors */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-500" /> Competitor Landscape</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.competitors.map((c, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.pricing}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{c.description}</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-green-600 mb-1">Pros</p>
                        <ul className="space-y-0.5">{c.pros.map((p, j) => <li key={j} className="text-xs text-muted-foreground">+ {p}</li>)}</ul>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-red-600 mb-1">Cons / Gaps</p>
                        <ul className="space-y-0.5">{c.cons.map((con, j) => <li key={j} className="text-xs text-muted-foreground">− {con}</li>)}</ul>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Where to find customers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-rose-500" /> Where to Find Your Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {analysis.whereTofindCustomers.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Badge variant="secondary" className="text-[10px] shrink-0">{c.type}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600 truncate mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{c.link}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Exact language */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4 text-rose-500" /> Exact Language People Use</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Use these phrases on your landing page, ads, and outreach.</p>
                <div className="flex flex-wrap gap-2">
                  {analysis.exactLanguage.map((phrase, i) => (
                    <button
                      key={i}
                      onClick={() => copyText(phrase, `lang-${i}`)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full text-xs border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                    >
                      <span>&ldquo;{phrase}&rdquo;</span>
                      {copiedKey === `lang-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Outreach message */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Copy-Paste Outreach Message</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyText(analysis.outreachMessage, "outreach")}>
                    {copiedKey === "outreach" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-lg p-4 border whitespace-pre-wrap text-sm">
                  {analysis.outreachMessage}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setView("input")}>Analyze New Idea</Button>
              <Button variant="outline" onClick={() => exportAnalysisMarkdown(ideaInput, analysis)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Export
              </Button>
              <Button variant="outline" onClick={() => handleAnalyze()} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                Re-run Analysis
              </Button>
            </div>
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Idea History</h1>
            {records.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No analyses yet</CardContent></Card>
            ) : (
              records.map((r) => {
                const vc = verdictConfig[r.analysis.verdict]
                return (
                  <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setAnalysis(r.analysis); setIdeaInput(r.input); setView("result") }}>
                    <CardContent className="py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2">{r.input}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${vc.bg} ${vc.color}`}>{vc.label}</span>
                        <span className={`text-sm font-bold ${r.analysis.painScore >= 7 ? "text-red-500" : r.analysis.painScore >= 5 ? "text-amber-500" : "text-green-500"}`}>
                          {r.analysis.painScore}/10
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecords((prev) => { const next = prev.filter((rec) => rec.id !== r.id); save(next); return next })
                            toast.success("Deleted")
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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
