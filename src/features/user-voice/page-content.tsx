"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Users, Loader2, Copy, Check, History, ChevronRight,
  TrendingUp, AlertTriangle, Lightbulb, Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type UserVoiceInput, type UserVoiceRecord, type UserVoiceResult,
  type ProductStage, type SimulatedPersona,
  STAGE_LABELS,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "user-voice-v1"

function load(): UserVoiceRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: UserVoiceRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 20))) }
function uid(): string { return Math.random().toString(36).slice(2, 10) }

const STAGES: ProductStage[] = ["idea", "mvp", "beta", "launched", "scaling"]

function initInput(): UserVoiceInput {
  return { productName: "", description: "", targetUser: "", stage: "idea", assumption: "" }
}

function PersonaCard({ persona }: { persona: SimulatedPersona }) {
  const reactionColors: Record<string, string> = {
    excited: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    skeptical: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    neutral: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    confused: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    disappointed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  }
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold">{persona.name}, {persona.age}</p>
            <p className="text-xs text-muted-foreground">{persona.role}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="secondary" className="text-xs">{persona.techSavvy}</Badge>
            <span className={`text-xs px-3 py-0.5 rounded-full font-medium ${reactionColors[persona.reaction]}`}>
              {persona.reaction}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-1.5">
          <span className="text-xs text-muted-foreground">Likeliness:</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <div key={n} className={`w-2 h-3 rounded-sm ${n <= persona.likeliness ? "bg-green-500" : "bg-muted"}`} />
            ))}
          </div>
          <span className="text-xs font-bold">{persona.likeliness}/10</span>
        </div>
        <p className="text-xs text-muted-foreground mb-1">&ldquo;{persona.quote}&rdquo;</p>
        <p className="text-xs"><span className="font-medium">First impression:</span> {persona.firstImpression}</p>
        <p className="text-xs mt-1"><span className="font-medium">Top concern:</span> {persona.topConcern}</p>
        {persona.featureRequests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {persona.featureRequests.map((f, i) => <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>)}
          </div>
        )}
        <p className="text-xs mt-1"><span className="font-medium">Willing to pay:</span> {persona.willingToPay}</p>
      </CardContent>
    </Card>
  )
}

export function UserVoiceContent() {
  const [records, setRecords] = useState<UserVoiceRecord[]>([])
  const [input, setInput] = useState<UserVoiceInput>(initInput())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UserVoiceResult | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { setRecords(load()) }, [])

  async function simulate() {
    if (!input.productName.trim()) { toast.error("Product name required"); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await aiFetch("/api/user-voice", { action: "simulate", input })
      const data = await res.json()
      if (data.ok) {
        setResult(data.result)
        const record: UserVoiceRecord = { id: uid(), input: { ...input }, result: data.result, createdAt: new Date().toISOString() }
        const next = [record, ...records].slice(0, 20)
        setRecords(next)
        save(next)
      } else toast.error(data.error || "Simulation failed")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Simulation failed")
    } finally { setLoading(false) }
  }

  function loadRecord(record: UserVoiceRecord) {
    setInput(record.input)
    setResult(record.result)
    setShowHistory(false)
  }

  return (
    <>
      <ToolHeader title="User Voice" icon={Users} color="text-violet-500" badge="Research" />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Input form */}
        <Card>
          <CardContent className="space-y-4 pt-4">
            <Input placeholder="Product name" value={input.productName} onChange={(e) => setInput({ ...input, productName: e.target.value })} />
            <Textarea placeholder="Product description (2-3 sentences)" value={input.description} onChange={(e) => setInput({ ...input, description: e.target.value })} rows={3} className="leading-relaxed" />
            <Input placeholder="Target user (e.g. solo developers, designers)" value={input.targetUser} onChange={(e) => setInput({ ...input, targetUser: e.target.value })} />
            <div className="flex gap-3">
              <select
                value={input.stage}
                onChange={(e) => setInput({ ...input, stage: e.target.value as ProductStage })}
                className="flex-1 h-9 rounded-xl border border-input bg-transparent px-3.5 text-sm"
              >
                {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select>
              <Input
                placeholder="Core assumption to test"
                value={input.assumption}
                onChange={(e) => setInput({ ...input, assumption: e.target.value })}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={simulate} disabled={loading || !input.productName.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Simulate User Reactions
              </Button>
              {records.length > 0 && (
                <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>
                  <History className="w-4 h-4" /> History ({records.length})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <div className="space-y-5">
            {/* Validation score */}
            <Card className={`border-t-4 ${result.validationScore >= 70 ? "border-t-green-500" : result.validationScore >= 40 ? "border-t-amber-500" : "border-t-red-500"}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-4 flex items-center justify-center shrink-0"
                    style={{ borderColor: result.validationScore >= 70 ? "#22c55e" : result.validationScore >= 40 ? "#f59e0b" : "#ef4444" }}
                  >
                    <span className={`text-3xl font-bold ${result.validationScore >= 70 ? "text-green-500" : result.validationScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                      {result.validationScore}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Validation Score</h3>
                    <p className="text-sm text-muted-foreground">{result.validationSummary}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personas */}
            <div>
              <h3 className="text-xl font-bold mb-4">User Personas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.personas.map((p, i) => <PersonaCard key={i} persona={p} />)}
              </div>
            </div>

            {/* Aggregate Insights */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Insights</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs"><span className="font-medium">Avg Likeliness:</span> {result.insights.avgLikeliness}/10</p>
                  <p className="text-xs"><span className="font-medium">Top Concerns:</span></p>
                  <ul className="space-y-0.5">{
                    result.insights.topConcerns.map((c, i) => <li key={i} className="text-xs text-muted-foreground">• {c}</li>)
                  }</ul>
                  <p className="text-xs mt-2"><span className="font-medium">Payment Consensus:</span> {result.insights.paymentConsensus}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Risks &amp; Wins</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs"><span className="font-medium text-red-600">Biggest Risk:</span> {result.insights.biggestRisk}</p>
                  <p className="text-xs"><span className="font-medium text-green-600">Fastest Win:</span> {result.insights.fastestWin}</p>
                  <p className="text-xs mt-1"><span className="font-medium">Top Requests:</span></p>
                  <div className="flex flex-wrap gap-1.5">{
                    result.insights.topRequests.map((r, i) => <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>)
                  }</div>
                </CardContent>
              </Card>
            </div>

            {/* Action Items */}
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Action Items</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {result.actionItems.map((a, i) => <li key={i} className="text-sm flex items-start gap-3"><span className="text-green-500 mt-0.5">▶</span> {a}</li>)}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* History */}
        {showHistory && records.length > 0 && (
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {records.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRecord(r)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.input.productName}</p>
                    <p className="text-xs text-muted-foreground">{r.input.targetUser} · {STAGE_LABELS[r.input.stage]}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold ${r.result.validationScore >= 70 ? "text-green-500" : r.result.validationScore >= 40 ? "text-amber-500" : "text-red-500"}`}>
                      {r.result.validationScore}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
        {/* Tip banner */}
        <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-center gap-3">
          <Target className="w-5 h-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            <strong>Pro tip:</strong> Try different product stages (Idea → MVP → Beta → Launched) and core assumptions to compare how user reactions change as your product evolves.
          </p>
        </div>
      </div>
    </>
  )
}
