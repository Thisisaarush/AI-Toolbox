"use client"

import { useState, useEffect, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { useHashNav } from "@/lib/use-hash-nav"
import {
  Target, Sparkles, Copy, Check, Loader2, Trash2,
  TrendingUp, TrendingDown, Minus, Users, Search,
  MessageSquare, AlertTriangle, History, ExternalLink, Download, Pencil,
  RefreshCw, ChevronRight, BarChart2, Waves, ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { IdeaAnalysis, IdeaRecord } from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

type HNComment = { text: string; author: string; url: string; points: number; createdAt: string }
type HNStory = { title: string; url: string; points: number; numComments: number }
type RealSignals = { hnComments: HNComment[]; hnStories: HNStory[] }

const STORAGE_KEY = "idea-sniper-v1"
const CHECKLIST_STORAGE_KEY = "idea-sniper-checklist-v1"

const verdictConfig = {
  go: { icon: TrendingUp, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", label: "GO", border: "border-green-400 dark:border-green-600", textBig: "text-green-500" },
  "no-go": { icon: TrendingDown, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", label: "NO-GO", border: "border-red-400 dark:border-red-600", textBig: "text-red-500" },
  pivot: { icon: Minus, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", label: "PIVOT", border: "border-amber-400 dark:border-amber-600", textBig: "text-amber-500" },
}

const competitionConfig = {
  "weak": { label: "Weak", color: "text-green-600", bg: "bg-green-100 dark:bg-green-900", width: "25%", badge: "Blue Ocean" },
  "moderate": { label: "Moderate", color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900", width: "50%", badge: null },
  "strong": { label: "Strong", color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900", width: "75%", badge: null },
  "very-strong": { label: "Very Strong", color: "text-red-600", bg: "bg-red-100 dark:bg-red-900", width: "100%", badge: "Red Ocean" },
}

function load(): IdeaRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: IdeaRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 20))) }

function loadChecklist(): Record<string, boolean[]> {
  if (typeof window === "undefined") return {}
  try { return JSON.parse(localStorage.getItem(CHECKLIST_STORAGE_KEY) ?? "{}") } catch { return {} }
}
function saveChecklist(c: Record<string, boolean[]>) { localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(c)) }

function buildChecklistSteps(analysis: IdeaAnalysis): string[] {
  const firstCommunity = analysis.whereTofindCustomers[0]
  const firstSubreddit = analysis.whereTofindCustomers.find((c) => c.type === "subreddit")
  const communityName = firstSubreddit?.name ?? firstCommunity?.name ?? "your target community"
  const topQuery = analysis.searchQueries[0] ?? "your top search query"
  const firstPhrase = analysis.exactLanguage[0] ?? "pain phrase"

  return [
    `Post in ${communityName} using the outreach message above`,
    `Search "${topQuery}" on Reddit and reply to 3 posts`,
    `Create a landing page using: "${firstPhrase}"`,
    `Set up a 5-question Typeform survey about the pain`,
    `DM 10 people who complained about this in the past month`,
    `Build a 48-hour MVP or clickable prototype`,
    `Get 3 people to commit $1 to validate willingness to pay`,
  ]
}

function copyToNotion(ideaInput: string, analysis: IdeaAnalysis) {
  const lines: string[] = [
    `# Idea Analysis: ${(ideaInput.split("\n")[0] ?? "").slice(0, 80) || "Idea"}`,
    ``,
    `## Summary`,
    `**Pain Score:** ${analysis.painScore}/10`,
    `**Verdict:** ${analysis.verdict.toUpperCase()}`,
    `**Competition:** ${analysis.competitionStrength}`,
    ``,
    `## Pain Reasoning`,
    analysis.painScoreReasoning,
    ``,
    `## Verdict Reasoning`,
    analysis.verdictReasoning,
    ``,
    `## Market Size (Rough TAM)`,
    `- **Addressable Universe:** ${analysis.tamEstimate.addressableUniverse}`,
    `- **Avg WTP:** $${analysis.tamEstimate.avgWillingnessToPay}/mo`,
    `- **Annual TAM:** ${analysis.tamEstimate.annualTam}`,
    `- *${analysis.tamEstimate.reasoning}*`,
    ``,
    `## Personas`,
    ...analysis.personas.map((p) =>
      `- **${p.jobTitle}** (${p.frequency})\n  - Context: ${p.context}\n  - Workaround: ${p.workaround}\n  - WTP: ${p.willingToPay}`
    ),
    ``,
    `## Competitors`,
    `| Name | Pricing | Pros | Cons |`,
    `|------|---------|------|------|`,
    ...analysis.competitors.map((c) =>
      `| ${c.name} | ${c.pricing} | ${c.pros.join(", ")} | ${c.cons.join(", ")} |`
    ),
    ``,
    `## Search Queries`,
    ...analysis.searchQueries.map((q) => `- \`${q}\``),
    ``,
    `## Where to Find Customers`,
    ...analysis.whereTofindCustomers.map((c) => `- **${c.name}** (${c.type}): ${c.link}`),
    ``,
    `## Exact Language`,
    ...analysis.exactLanguage.map((p) => `- "${p}"`),
    ``,
    `## Outreach Message`,
    analysis.outreachMessage,
    ``,
    `## Pivot Suggestions`,
    ...analysis.pivotSuggestions.map((p) =>
      `- **${p.angle}**\n  - ${p.reasoning}\n  - Target: ${p.targetAudience}`
    ),
    ``,
    `## Related Ideas to Explore`,
    ...analysis.relatedIdeas.map((i) => `- ${i}`),
  ]
  navigator.clipboard.writeText(lines.join("\n"))
  toast.success("Copied as Notion-compatible Markdown!")
}

function exportAnalysisMarkdown(ideaInput: string, analysis: IdeaAnalysis) {
  const title = (ideaInput.split("\n")[0] ?? "").slice(0, 80) || "Idea"
  const lines: string[] = [
    `# Idea Analysis: ${title}`,
    `**Pain Score:** ${analysis.painScore}/10`,
    `**Verdict:** ${analysis.verdict.toUpperCase()}`,
    ``,
    `## Pain Reasoning`,
    analysis.painScoreReasoning,
    ``,
    `## Market Size (Rough TAM)`,
    `- Addressable Universe: ${analysis.tamEstimate.addressableUniverse}`,
    `- Avg WTP: $${analysis.tamEstimate.avgWillingnessToPay}/mo`,
    `- Annual TAM: ${analysis.tamEstimate.annualTam}`,
    ``,
    `## Personas`,
    ...analysis.personas.map((p) =>
      `### ${p.jobTitle}\n${p.context}\n- Frequency: ${p.frequency}\n- Workaround: ${p.workaround}\n- WTP: ${p.willingToPay}`
    ),
    ``,
    `## Competitors`,
    ...analysis.competitors.map((c) =>
      `### ${c.name} (${c.pricing})\n${c.description}\nPros: ${c.pros.join(", ")}\nCons: ${c.cons.join(", ")}`
    ),
    ``,
    `## Search Queries`,
    ...analysis.searchQueries.map((q) => `- ${q}`),
    ``,
    `## Where to Find Customers`,
    ...analysis.whereTofindCustomers.map((c) => `- **${c.name}** (${c.type}): ${c.link}`),
    ``,
    `## Exact Language`,
    ...analysis.exactLanguage.map((p) => `- "${p}"`),
    ``,
    `## Outreach Message`,
    analysis.outreachMessage,
    ``,
    `## Pivot Suggestions`,
    ...analysis.pivotSuggestions.map((p) => `### ${p.angle}\n${p.reasoning}\nTarget: ${p.targetAudience}`),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `idea-analysis-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
  toast.success("Exported as Markdown")
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PainScoreArc({ score }: { score: number }) {
  const pct = score / 10
  const color = score >= 7 ? "#ef4444" : score >= 5 ? "#f59e0b" : "#22c55e"
  // CSS-only semi-circle arc using conic-gradient
  const arcDeg = Math.round(pct * 180)
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        {/* Background track */}
        <div
          className="absolute inset-0 w-32 h-32 rounded-full"
          style={{
            background: `conic-gradient(from 180deg, #e5e7eb 0deg, #e5e7eb 180deg, transparent 180deg)`,
          }}
        />
        {/* Filled arc */}
        <div
          className="absolute inset-0 w-32 h-32 rounded-full transition-all duration-700"
          style={{
            background: `conic-gradient(from 180deg, ${color} 0deg, ${color} ${arcDeg}deg, transparent ${arcDeg}deg)`,
          }}
        />
        {/* Center hole */}
        <div className="absolute inset-[6px] w-[116px] h-[116px] rounded-full bg-card" />
      </div>
      <div className="flex items-end gap-1.5 -mt-8">
        <span className="text-5xl font-black leading-none" style={{ color }}>{score}</span>
        <span className="text-lg text-muted-foreground mb-0.5">/10</span>
      </div>
    </div>
  )
}

function VerdictHero({ analysis }: { analysis: IdeaAnalysis }) {
  const vc = verdictConfig[analysis.verdict]
  const VerdictIcon = vc.icon

  return (
    <div className="space-y-5">
      {/* Verdict — most prominent element */}
      <div className={`rounded-2xl border-2 ${vc.border} ${vc.bg} p-6 text-center`}>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Verdict</p>
        <div className="flex items-center justify-center gap-4 mb-4">
          <VerdictIcon className={`w-10 h-11 ${vc.color}`} />
          <span className={`text-6xl font-black tracking-tight ${vc.textBig}`}>{vc.label}</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">{analysis.verdictReasoning}</p>
      </div>

      {/* Pain score */}
      <Card>
        <CardContent className="pt-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5 text-center">Pain Score</p>
          <PainScoreArc score={analysis.painScore} />
          <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm mx-auto">{analysis.painScoreReasoning}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function CompetitionMeter({ strength }: { strength: IdeaAnalysis["competitionStrength"] }) {
  const cfg = competitionConfig[strength]
  const levels = ["weak", "moderate", "strong", "very-strong"] as const
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label} Competition</span>
        {cfg.badge && (
          <Badge className={`text-xs ${cfg.badge === "Blue Ocean" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
            {cfg.badge === "Blue Ocean" ? <Waves className="w-4 h-4 mr-1" /> : null}
            {cfg.badge}
          </Badge>
        )}
      </div>
      <div className="flex gap-1.5">
        {levels.map((level) => {
          const levelIdx = levels.indexOf(level)
          const activeIdx = levels.indexOf(strength)
          const isActive = levelIdx <= activeIdx
          const levelCfg = competitionConfig[level]
          return (
            <div
              key={level}
              className={`flex-1 h-2 rounded-full transition-all ${isActive ? levelCfg.bg : "bg-muted"}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Low</span>
        <span>High</span>
      </div>
    </div>
  )
}

function TamCard({ tam }: { tam: IdeaAnalysis["tamEstimate"] }) {
  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-4">
            <BarChart2 className="w-4 h-4 text-blue-500" /> Market Size
          </CardTitle>
          <Badge variant="secondary" className="text-xs">Rough TAM · AI-estimated</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-muted/40 rounded-xl p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Addressable Universe</p>
            <p className="text-sm font-semibold">{tam.addressableUniverse}</p>
          </div>
          <div className="bg-muted/40 rounded-xl p-4 text-center">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Avg WTP / mo</p>
            <p className="text-2xl font-black text-blue-500">${tam.avgWillingnessToPay}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-4 text-center border border-blue-200 dark:border-blue-800">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Annual TAM</p>
            <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{tam.annualTam}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-3">{tam.reasoning}</p>
        <p className="text-xs text-muted-foreground">⚠ TAM figures are AI-estimated from training data patterns. Always validate with primary research.</p>
      </CardContent>
    </Card>
  )
}

function PivotSuggestionsCard({ pivots }: { pivots: IdeaAnalysis["pivotSuggestions"] }) {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-4">
          <RefreshCw className="w-4 h-4 text-amber-500" /> Pivot Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pivots.map((p, i) => (
          <div key={i} className="border rounded-xl p-5 space-y-1.5">
            <div className="flex items-start gap-4">
              <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded mt-0.5 shrink-0">#{i + 1}</span>
              <p className="text-sm font-semibold">{p.angle}</p>
            </div>
            <p className="text-xs text-muted-foreground pl-6">{p.reasoning}</p>
            <p className="text-xs text-muted-foreground pl-6"><span className="font-medium">Target:</span> {p.targetAudience}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ValidationChecklist({
  recordId,
  analysis,
}: {
  recordId: string
  analysis: IdeaAnalysis
}) {
  const steps = buildChecklistSteps(analysis)
  const [checks, setChecks] = useState<boolean[]>(() => {
    const all = loadChecklist()
    return all[recordId] ?? Array(steps.length).fill(false)
  })

  const toggle = useCallback((idx: number) => {
    setChecks((prev) => {
      const next = [...prev]
      next[idx] = !next[idx]
      const all = loadChecklist()
      all[recordId] = next
      saveChecklist(all)
      return next
    })
  }, [recordId])

  const completed = checks.filter(Boolean).length
  const pct = Math.round((completed / steps.length) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-4">
            <Check className="w-4 h-4 text-rose-500" /> Validation Checklist
          </CardTitle>
          <span className="text-xs font-semibold text-muted-foreground">{completed}/{steps.length} done</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-2">
          <div
            className="h-1.5 rounded-full bg-rose-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="w-full flex items-start gap-4 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
          >
            <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checks[i] ? "bg-rose-500 border-rose-500" : "border-muted-foreground/40"}`}>
              {checks[i] && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={`text-sm ${checks[i] ? "line-through text-muted-foreground" : ""}`}>
              <span className="font-medium text-rose-500 mr-1.5">Step {i + 1}.</span>{step}
            </span>
          </button>
        ))}
        {completed === steps.length && (
          <div className="mt-2 p-4 bg-green-50 dark:bg-green-950 rounded-xl border border-green-200 dark:border-green-800 text-center text-sm text-green-700 dark:text-green-300 font-medium">
            All steps complete — time to decide!
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RelatedIdeas({ ideas, onAnalyze }: { ideas: string[]; onAnalyze: (idea: string) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-4">
          <Search className="w-4 h-4 text-rose-500" /> Related Ideas to Explore
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {ideas.map((idea, i) => (
            <button
              key={i}
              onClick={() => onAnalyze(idea)}
              className="w-full flex items-center gap-4 p-4 rounded-xl border hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left group"
            >
              <span className="text-sm flex-1">{idea}</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreHistoryChart({ records }: { records: IdeaRecord[] }) {
  if (records.length < 2) return null
  const max = 10
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Pain Score Trend</p>
      <div className="flex items-end gap-2 h-12">
        {records.slice().reverse().map((r, i) => {
          const h = (r.analysis.painScore / max) * 100
          const color = r.analysis.painScore >= 7 ? "bg-red-400" : r.analysis.painScore >= 5 ? "bg-amber-400" : "bg-green-400"
          return (
            <div key={r.id} className="flex flex-col items-center gap-1.5 flex-1">
              <div className="w-full flex flex-col justify-end h-11">
                <div
                  className={`rounded-t w-full ${color} transition-all`}
                  style={{ height: `${h}%`, minHeight: "4px" }}
                  title={`#${i + 1}: ${r.analysis.painScore}/10`}
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">{r.analysis.painScore}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">Newest on right · {records.length} ideas analyzed</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IdeaSniperContent() {
  const [records, setRecords] = useState<IdeaRecord[]>([])
  const [ideaInput, setIdeaInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<IdeaAnalysis | null>(null)
  const [currentRecordId, setCurrentRecordId] = useState<string>("")
  const [view, setView] = useState<"input" | "result" | "history">("input")
  const [copiedKey, setCopiedKey] = useState("")

  const [editingIdea, setEditingIdea] = useState(false)
  const [editDraft, setEditDraft] = useState("")

  const [realSignals, setRealSignals] = useState<RealSignals | null>(null)
  const [realSignalsLoading, setRealSignalsLoading] = useState(false)

  useEffect(() => {
    setRecords(load())
  }, [])

  useHashNav(view, setView, ["input", "result", "history"] as const)

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function searchRealSignals(query: string) {
    setRealSignalsLoading(true)
    try {
      const res = await fetch("/api/idea-sniper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search-real", query }),
      })
      const data = await res.json()
      if (res.ok) setRealSignals({ hnComments: data.hnComments ?? [], hnStories: data.hnStories ?? [] })
    } catch {
      // non-fatal — real signals are supplementary
    }
    setRealSignalsLoading(false)
  }

  async function handleAnalyze(overrideIdea?: string) {
    const idea = overrideIdea ?? ideaInput
    if (!idea.trim()) { toast.error("Describe your idea first"); return }
    if (overrideIdea) { setIdeaInput(overrideIdea) }
    setLoading(true)
    setView("input")
    setRealSignals(null)
    try {
      const [res] = await Promise.all([
        aiFetch("/api/idea-sniper", { action: "analyze", idea }),
        searchRealSignals(idea.split("\n")[0]?.slice(0, 120) ?? idea.slice(0, 120)),
      ])
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Analysis failed")
      setAnalysis(data.analysis)
      const id = crypto.randomUUID()
      setCurrentRecordId(id)
      const record: IdeaRecord = {
        id,
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
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setLoading(false)
        return
      }
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
          <div className="flex gap-4">
            {view !== "input" && <Button variant="outline" size="sm" onClick={() => setView("input")}>← New Idea</Button>}
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "input" : "history")}>
                <History className="w-4 h-4 mr-1" /> History
              </Button>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-5 py-6 w-full">

        {/* ── INPUT ──────────────────────────────────────────────────────────── */}
        {view === "input" && (
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-bold mb-1">Idea Sniper</h1>
              <p className="text-muted-foreground">Enter your idea → get real pain analysis, market signals, competitor landscape, and TAM estimate.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 block">Describe your idea</label>
                  <Textarea
                    placeholder="e.g. A tool that automatically generates test cases for backend APIs by analyzing your OpenAPI spec and running against your staging environment. Aimed at solo developers and small teams who hate writing tests."
                    value={ideaInput}
                    onChange={(e) => setIdeaInput(e.target.value)}
                    rows={8}
                    className="text-base resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-2">Include: what problem it solves, who has the pain, and your approach</p>
                </div>
                <Button className="w-full h-11 text-base" onClick={() => handleAnalyze()} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing market...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Snipe This Idea</>
                  }
                </Button>
              </CardContent>
            </Card>

            {loading && (
              <div className="space-y-5">
                <Skeleton className="h-40 rounded-2xl" />
                <Skeleton className="h-32 rounded-xl" />
                <div className="grid sm:grid-cols-2 gap-5">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
                <Skeleton className="h-32 rounded-xl" />
              </div>
            )}

            {records.length > 0 && !loading && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-4">Recent analyses</p>
                <div className="space-y-3">
                  {records.slice(0, 3).map((r) => {
                    const vc = verdictConfig[r.analysis.verdict]
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setAnalysis(r.analysis); setIdeaInput(r.input); setCurrentRecordId(r.id); setView("result") }}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${vc.bg} ${vc.color}`}>{vc.label}</span>
                        <span className="text-sm flex-1 truncate">{r.input}</span>
                        <span className={`text-xs font-semibold ${r.analysis.painScore >= 7 ? "text-red-500" : r.analysis.painScore >= 5 ? "text-amber-500" : "text-green-500"}`}>
                          {r.analysis.painScore}/10
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ─────────────────────────────────────────────────────────── */}
        {view === "result" && analysis && (
          <div className="space-y-8">
            {/* Verdict hero — largest, most prominent */}
            <VerdictHero analysis={analysis} />

            {/* Edit idea inline */}
            <div>
              {!editingIdea ? (
                <button
                  onClick={() => { setEditDraft(ideaInput); setEditingIdea(true) }}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Edit idea & re-analyze
                </button>
              ) : (
                <Card className="border-rose-200 dark:border-rose-800">
                  <CardContent className="pt-4 space-y-4">
                    <p className="text-xs font-medium">Edit your idea</p>
                    <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={5} />
                    <div className="flex gap-4">
                      <Button
                        size="sm"
                        onClick={() => { setIdeaInput(editDraft); setEditingIdea(false); handleAnalyze(editDraft) }}
                        disabled={loading}
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                        Re-analyze
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingIdea(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* TAM Estimator */}
            <TamCard tam={analysis.tamEstimate} />

            {/* Search queries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-4"><Search className="w-4 h-4 text-rose-500" /> Search Queries to Run Yourself</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysis.searchQueries.map((q, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <code className="text-xs bg-muted/50 px-4 py-2.5 rounded border flex-1 font-mono">{q}</code>
                      <button onClick={() => copyText(q, `sq-${i}`)} className="shrink-0">
                        {copiedKey === `sq-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community signals — AI-synthesized */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-4">
                  <MessageSquare className="w-4 h-4 text-rose-500" /> Community Signals
                  <Badge variant="secondary" className="text-xs">AI-synthesized</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">These are AI-generated examples of what people would say, based on training data patterns. Always verify with real community search.</p>
                {analysis.communitySignals.map((signal, i) => {
                  const sentimentColor = { frustrated: "text-amber-500", desperate: "text-red-500", curious: "text-blue-500" }[signal.sentiment]
                  return (
                    <div key={i} className="bg-muted/30 rounded-xl p-5 border">
                      <div className="flex items-center gap-4 mb-3">
                        <span className="text-xs text-muted-foreground">{signal.platform}</span>
                        <Badge variant="secondary" className={`text-xs ${sentimentColor}`}>{signal.sentiment}</Badge>
                      </div>
                      <p className="text-sm italic">&ldquo;{signal.simulatedQuote}&rdquo;</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Real Community Signals — HN Algolia */}
            <Card className="border-orange-200 dark:border-orange-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="text-sm flex items-center gap-4">
                    <Search className="w-4 h-4 text-orange-500" /> Real Community Signals
                    <Badge className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">Live Data</Badge>
                  </CardTitle>
                  <a
                    href={`https://hn.algolia.com/?query=${encodeURIComponent((ideaInput.split("\n")[0] ?? "").slice(0, 80))}&type=comment`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1.5"
                  >
                    Search for more <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {realSignalsLoading && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching Hacker News...
                  </div>
                )}

                {!realSignalsLoading && !realSignals && (
                  <p className="text-xs text-muted-foreground italic">No real signals fetched yet.</p>
                )}

                {realSignals && (
                  <>
                    {/* HN Stories */}
                    {realSignals.hnStories.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">HN Posts</p>
                        <div className="space-y-3">
                          {realSignals.hnStories.map((story, i) => (
                            <a
                              key={i}
                              href={story.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-4 p-4 border rounded-xl hover:bg-muted/50 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium line-clamp-3 group-hover:text-orange-600 transition-colors">{story.title}</p>
                                <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                  <span>{story.points} pts</span>
                                  <span>{story.numComments} comments</span>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* HN Comments */}
                    {realSignals.hnComments.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">HN Comments</p>
                        <div className="space-y-3">
                          {realSignals.hnComments.slice(0, 5).map((comment, i) => (
                            <div key={i} className="bg-muted/30 rounded-xl p-4 border space-y-1.5">
                              <p className="text-sm">
                                {comment.text.length > 200
                                  ? comment.text.slice(0, 200) + "…"
                                  : comment.text}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">{comment.author}</span>
                                <a
                                  href={comment.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1.5"
                                >
                                  View <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {realSignals.hnComments.length === 0 && realSignals.hnStories.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No HN results found for this query.</p>
                    )}

                    <p className="text-xs text-muted-foreground pt-1 border-t">
                      Source: Hacker News Algolia API · Real data
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Personas — profile cards */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-4"><Users className="w-4 h-4 text-rose-500" /> Who Has This Pain</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysis.personas.map((p, i) => {
                  const initial = p.jobTitle.charAt(0).toUpperCase()
                  const colors = ["bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300", "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300", "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"]
                  return (
                    <div key={i} className="border rounded-xl p-5">
                      <div className="flex items-start gap-4 mb-4">
                        <div className={`w-9 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[i % colors.length]}`}>
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-4 flex-wrap">
                            <span className="font-semibold text-sm">{p.jobTitle}</span>
                            <Badge variant="secondary" className="text-xs">{p.frequency}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.context}</p>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 text-xs">
                        <div className="bg-muted/30 p-2.5 rounded-xl">
                          <span className="font-medium block mb-0.5 text-muted-foreground">Current Workaround</span>{p.workaround}
                        </div>
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-2.5 rounded-xl">
                          <span className="font-medium block mb-0.5 text-green-700 dark:text-green-300">Willing to Pay</span>{p.willingToPay}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            {/* Competitors — table layout */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-4"><AlertTriangle className="w-4 h-4 text-rose-500" /> Competitor Landscape</CardTitle>
                </div>
                <div className="mt-4">
                  <CompetitionMeter strength={analysis.competitionStrength} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2.5 pr-3 font-medium text-muted-foreground w-1/4">Name</th>
                        <th className="text-left py-2.5 pr-3 font-medium text-muted-foreground w-1/6">Pricing</th>
                        <th className="text-left py-2.5 pr-3 font-medium text-green-600 w-1/3">Pros</th>
                        <th className="text-left py-2.5 font-medium text-red-600 w-1/3">Cons / Gaps</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.competitors.map((c, i) => (
                        <tr key={i} className="border-b last:border-0 align-top">
                          <td className="py-4 pr-3">
                            <span className="font-semibold text-foreground">{c.name}</span>
                            <span className="block text-muted-foreground mt-0.5 leading-snug">{c.description}</span>
                          </td>
                          <td className="py-4 pr-3 text-muted-foreground">{c.pricing}</td>
                          <td className="py-4 pr-3">
                            <ul className="space-y-0.5">
                              {c.pros.map((p, j) => <li key={j} className="text-muted-foreground">+ {p}</li>)}
                            </ul>
                          </td>
                          <td className="py-4">
                            <ul className="space-y-0.5">
                              {c.cons.map((con, j) => <li key={j} className="text-muted-foreground">− {con}</li>)}
                            </ul>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Pivot Suggestions */}
            <PivotSuggestionsCard pivots={analysis.pivotSuggestions} />

            {/* Where to find customers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-4"><Users className="w-4 h-4 text-rose-500" /> Where to Find Your Customers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  {analysis.whereTofindCustomers.map((c, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 border rounded-xl">
                      <Badge variant="secondary" className="text-xs shrink-0">{c.type}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <a
                          href={c.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-rose-500 hover:text-rose-600 truncate mt-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-4 h-4 shrink-0" />
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
                <CardTitle className="text-sm flex items-center gap-4"><MessageSquare className="w-4 h-4 text-rose-500" /> Exact Language People Use</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-4">Use these phrases on your landing page, ads, and outreach.</p>
                <div className="flex flex-wrap gap-4">
                  {analysis.exactLanguage.map((phrase, i) => (
                    <button
                      key={i}
                      onClick={() => copyText(phrase, `lang-${i}`)}
                      className="group flex items-center gap-2 px-4 py-2 bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full text-xs border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors"
                    >
                      <span>&ldquo;{phrase}&rdquo;</span>
                      {copiedKey === `lang-${i}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4 opacity-0 group-hover:opacity-100" />}
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
                    {copiedKey === "outreach" ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-xl p-5 border whitespace-pre-wrap text-sm">
                  {analysis.outreachMessage}
                </div>
              </CardContent>
            </Card>

            {/* Validation checklist */}
            <ValidationChecklist recordId={currentRecordId} analysis={analysis} />

            {/* Related ideas */}
            <RelatedIdeas ideas={analysis.relatedIdeas} onAnalyze={handleAnalyze} />

            {/* Action buttons */}
            <div className="flex flex-wrap gap-4 pb-4">
              <Button variant="outline" onClick={() => setView("input")}>Analyze New Idea</Button>
              <Button variant="outline" onClick={() => exportAnalysisMarkdown(ideaInput, analysis)}>
                <Download className="w-4 h-4 mr-1" /> Export MD
              </Button>
              <Button variant="outline" onClick={() => copyToNotion(ideaInput, analysis)}>
                <Copy className="w-4 h-4 mr-1" /> Copy to Notion
              </Button>
              <Button variant="outline" onClick={() => handleAnalyze()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                Re-run
              </Button>
            </div>
          </div>
        )}

        {/* ── HISTORY ────────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">Idea History</h1>
            </div>

            {records.length >= 2 && (
              <Card>
                <CardContent className="pt-5">
                  <ScoreHistoryChart records={records} />
                </CardContent>
              </Card>
            )}

            {records.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No analyses yet</CardContent></Card>
            ) : (
              records.map((r) => {
                const vc = verdictConfig[r.analysis.verdict]
                return (
                  <Card
                    key={r.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setAnalysis(r.analysis); setIdeaInput(r.input); setCurrentRecordId(r.id); setView("result") }}
                  >
                    <CardContent className="py-4 flex items-start justify-between gap-5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-3">{r.input}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                        {"tamEstimate" in r.analysis && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-medium">TAM: {r.analysis.tamEstimate.annualTam}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`text-xs font-bold px-3 py-0.5 rounded ${vc.bg} ${vc.color}`}>{vc.label}</span>
                        <span className={`text-sm font-bold ${r.analysis.painScore >= 7 ? "text-red-500" : r.analysis.painScore >= 5 ? "text-amber-500" : "text-green-500"}`}>
                          {r.analysis.painScore}/10
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecords((prev) => { const next = prev.filter((rec) => rec.id !== r.id); save(next); return next })
                            toast.success("Deleted")
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
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
