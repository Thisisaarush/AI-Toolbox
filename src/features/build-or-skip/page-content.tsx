"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Hammer, Loader2, History, ThumbsUp, ThumbsDown, AlertTriangle,
  TrendingUp, RefreshCw, Quote, ChevronRight, Lightbulb,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { type BuildOrSkipInput, type BuildOrSkipResult, type BuildOrSkipRecord, type Verdict, LOADING_MESSAGES } from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "build-or-skip-v1"

function load(): BuildOrSkipRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: BuildOrSkipRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }
function uid(): string { return Math.random().toString(36).slice(2, 10) }

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const colors: Record<Verdict, string> = {
    BUILD: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    SKIP: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    PIVOT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  }
  const icons: Record<Verdict, React.ReactNode> = {
    BUILD: <ThumbsUp className="w-4 h-4" />,
    SKIP: <ThumbsDown className="w-4 h-4" />,
    PIVOT: <RefreshCw className="w-4 h-4" />,
  }
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold ${colors[verdict]}`}>
      {icons[verdict]} {verdict}
    </span>
  )
}

function initInput(): BuildOrSkipInput {
  return { idea: "", timeAvailable: "", skills: "", goal: "" }
}

export function BuildOrSkipContent() {
  const [records, setRecords] = useState<BuildOrSkipRecord[]>([])
  const [input, setInput] = useState<BuildOrSkipInput>(initInput())
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState("")
  const [result, setResult] = useState<BuildOrSkipResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { setRecords(load()) }, [])

  async function judge() {
    if (!input.idea.trim()) { toast.error("Describe your idea first"); return }
    setLoading(true)
    setResult(null)
    const msg = LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]!
    setLoadingMsg(msg)
    const interval = setInterval(() => {
      setLoadingMsg(LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)]!)
    }, 2000)
    try {
      const res = await aiFetch("/api/build-or-skip", { action: "judge", ...input })
      const data = await res.json()
      if (data.ok) {
        setResult(data.result)
        const record: BuildOrSkipRecord = { id: uid(), input: { ...input }, result: data.result, createdAt: new Date().toISOString() }
        const next = [record, ...records].slice(0, 20)
        setRecords(next)
        save(next)
      } else toast.error(data.error || "Failed to judge")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to judge")
    } finally { clearInterval(interval); setLoading(false) }
  }

  function loadRecord(record: BuildOrSkipRecord) {
    setInput(record.input)
    setResult(record.result)
    setShowHistory(false)
  }

  return (
    <>
      <ToolHeader title="Build or Skip" icon={Hammer} color="text-rose-500" badge="Research" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">

        {/* Input form */}
        <div className="space-y-4">
          <Textarea
            placeholder="Describe your idea in detail..."
            value={input.idea}
            onChange={(e) => setInput({ ...input, idea: e.target.value })}
            rows={4}
            className="leading-relaxed"
          />
          <div className="grid grid-cols-3 gap-4">
            <Input placeholder="Time available (e.g. evenings/weekends)" value={input.timeAvailable} onChange={(e) => setInput({ ...input, timeAvailable: e.target.value })} />
            <Input placeholder="Your skills (e.g. React, Python)" value={input.skills} onChange={(e) => setInput({ ...input, skills: e.target.value })} />
            <Input placeholder="What you want (e.g. $5k/mo, learn)" value={input.goal} onChange={(e) => setInput({ ...input, goal: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <Button onClick={judge} disabled={loading || !input.idea.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
              Judge My Idea
            </Button>
            <Button variant="outline" onClick={() => { setInput(initInput()); setResult(null) }}>
              Clear
            </Button>
            {records.length > 0 && (
              <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>
                <History className="w-4 h-4" /> History ({records.length})
              </Button>
            )}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <Card>
            <CardContent className="py-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground italic">{loadingMsg}</p>
            </CardContent>
          </Card>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-5">
            {/* Verdict */}
            <Card className={`border-t-4 ${result.verdict === "BUILD" ? "border-t-green-500" : result.verdict === "SKIP" ? "border-t-red-500" : "border-t-amber-500"}`}>
              <CardContent className="py-6 text-center">
                <VerdictBadge verdict={result.verdict} />
                <h2 className="text-3xl font-bold mt-3">{result.headline}</h2>
                <div className="flex items-center justify-center gap-3 mt-3 text-sm text-muted-foreground italic">
                  <Quote className="w-4 h-4" />
                  &ldquo;{result.snarkyQuote}&rdquo;
                </div>
                <div className="mt-4">
                  <span className="text-xs text-muted-foreground">Confidence: </span>
                  <span className="text-xl font-bold">{result.confidence}%</span>
                  <div className="max-w-xs mx-auto h-2 bg-muted rounded-full mt-1">
                    <div
                      className={`h-full rounded-full ${result.confidence >= 70 ? "bg-green-500" : result.confidence >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${result.confidence}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* For / Against */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-green-600 flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> For</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.for.map((f, i) => <li key={i} className="text-xs">✓ {f}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-red-600 flex items-center gap-2"><ThumbsDown className="w-4 h-4" /> Against</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.against.map((a, i) => <li key={i} className="text-xs">✗ {a}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Risks */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Risks</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.risks.map((r, i) => <li key={i} className="text-xs">⚠ {r}</li>)}
                </ul>
              </CardContent>
            </Card>

            {/* Prediction */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Prediction</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{result.prediction}</p>
              </CardContent>
            </Card>

            {/* Pivot */}
            {result.pivotSuggestion && (
              <Card className="border-t-2 border-t-amber-500">
                <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Pivot Suggestion</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm">{result.pivotSuggestion}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* History */}
        {showHistory && records.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Past Judgments</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {records.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRecord(r)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.input.idea}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <VerdictBadge verdict={r.result.verdict} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
        {/* Tip banner */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Remember:</strong> Past judgments are saved in your history. Be honest about your skills and time available for the most accurate verdict.
          </p>
        </div>
      </div>
    </>
  )
}
