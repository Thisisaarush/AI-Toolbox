"use client"

import { useState, useEffect, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Dices, HelpCircle, ListChecks, Plus, Trash2, RefreshCw, Sparkles,
  ThumbsUp, ThumbsDown, Send, RotateCcw, Play, History, X, CircleDot,
} from "lucide-react"

const EIGHT_BALL_ANSWERS = [
  "It is certain.", "It is decidedly so.", "Without a doubt.", "Yes — definitely.",
  "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.",
  "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.",
  "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.",
  "Don't bet on it.", "My reply is no.", "My sources say no.", "Outlook not so good.",
  "Very doubtful.",
]

const BALL_STORAGE_KEY = "decision-game-ball-v1"
const PROS_CONS_STORAGE_KEY = "decision-game-pros-cons-v1"

const SEGMENT_COLORS = [
  "#f87171", "#60a5fa", "#34d399", "#fbbf24",
  "#a78bfa", "#f472b6", "#22d3ee", "#fb923c",
  "#2dd4bf", "#818cf8", "#a3e635", "#fb7185",
]

type EightBallRecord = { id: string; question: string; answer: string; createdAt: string }
type ProsConsRecord = { id: string; topic: string; pros: string[]; cons: string[]; createdAt: string }
type Tab = "8ball" | "wheel" | "proscons"

function uid(): string { return Math.random().toString(36).slice(2, 10) }

function loadBall(): EightBallRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(BALL_STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveBall(r: EightBallRecord[]) { localStorage.setItem(BALL_STORAGE_KEY, JSON.stringify(r)) }

function loadPC(): ProsConsRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(PROS_CONS_STORAGE_KEY) ?? "[]") } catch { return [] }
}
function savePC(r: ProsConsRecord[]) { localStorage.setItem(PROS_CONS_STORAGE_KEY, JSON.stringify(r)) }

// ── 8-Ball ──────────────────────────────────────────────────────────────────
function EightBallTab() {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [history, setHistory] = useState<EightBallRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { setHistory(loadBall()) }, [])

  function shake() {
    if (!question.trim()) { toast.error("Ask a question first"); return }
    setShaking(true)
    setAnswer(null)
    const ans = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)]!
    setTimeout(() => {
      setAnswer(ans)
      setShaking(false)
      const record: EightBallRecord = { id: uid(), question: question.trim(), answer: ans, createdAt: new Date().toISOString() }
      const next = [record, ...history].slice(0, 50)
      setHistory(next)
      saveBall(next)
    }, 900)
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Ask the Magic 8-Ball anything..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && shake()}
          className="flex-1 h-10 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button onClick={shake} disabled={shaking || !question.trim()}>
          {shaking ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Ask
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setShowHistory((v) => !v)} disabled={history.length === 0} title="History">
          <History className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex flex-col items-center py-6">
        <div
          className={`relative w-48 h-48 rounded-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 dark:from-gray-800 dark:via-gray-700 dark:to-gray-600 shadow-2xl flex items-center justify-center ${shaking ? "animate-[shake_0.9s_ease-in-out]" : ""}`}
        >
          <div className="w-20 h-16 overflow-hidden">
            <div className="w-0 h-0 border-l-[40px] border-r-[40px] border-b-[64px] border-l-transparent border-r-transparent border-b-white/10" />
          </div>
          {answer && !shaking && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
              <p className="text-xs font-semibold text-white leading-relaxed drop-shadow-md">{answer}</p>
            </div>
          )}
          {!answer && !shaking && <span className="absolute bottom-6 text-xl opacity-50">🎱</span>}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {shaking ? "Shaking..." : answer ? "The 8-Ball has spoken" : "Type a question and press Ask"}
        </p>
      </div>

      {showHistory && history.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {history.map((r) => (
              <div key={r.id} className="p-3 rounded-xl border border-border bg-card text-sm">
                <p className="font-medium">Q: {r.question}</p>
                <p className="text-muted-foreground mt-0.5">A: {r.answer}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(r.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => { setHistory([]); saveBall([]); toast.success("History cleared") }}>
            <Trash2 className="w-3 h-3 mr-1" /> Clear history
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Wheel of Fortune ────────────────────────────────────────────────────────
function WheelTab() {
  const [options, setOptions] = useState<string[]>([""])
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const transitionRef = useRef<HTMLDivElement>(null)

  function addOption() {
    if (options.length >= 12) { toast.error("Max 12 options"); return }
    setOptions((prev) => [...prev, ""])
  }
  function removeOption(idx: number) {
    if (options.length <= 2) { toast.error("Need at least 2 options"); return }
    setOptions((prev) => prev.filter((_, i) => i !== idx))
  }
  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)))
  }

  function spin() {
    const valid = options.filter((o) => o.trim().length > 0)
    if (valid.length < 2) { toast.error("Enter at least 2 options"); return }
    setSpinning(true)
    setResult(null)
    const segAngle = 360 / valid.length
    const fullSpins = (5 + Math.floor(Math.random() * 5)) * 360
    const offset = Math.random() * 360
    const totalRotation = rotation + fullSpins + offset
    setRotation(totalRotation)
    const normalized = totalRotation % 360
    const winnerIdx = Math.floor(normalized / segAngle) % valid.length
    const actualIdx = (valid.length - 1 - winnerIdx + valid.length) % valid.length
    setTimeout(() => {
      setSpinning(false)
      setResult(valid[actualIdx] ?? valid[0] ?? "")
    }, 4200)
  }

  const validOptions = options.filter((o) => o.trim().length > 0)
  const segAngle = validOptions.length > 0 ? 360 / validOptions.length : 0
  const gradientStops = validOptions
    .map((_, i) => {
      const s = (i / validOptions.length) * 100
      const e = ((i + 1) / validOptions.length) * 100
      return `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${s}% ${e}%`
    })
    .join(", ")

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Options ({options.length}/12)</label>
          <Button variant="ghost" size="sm" onClick={addOption} disabled={options.length >= 12}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                className="flex-1 h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button variant="ghost" size="icon" onClick={() => removeOption(i)} disabled={options.length <= 2} className="shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[18px] border-l-transparent border-r-transparent border-t-foreground" />
          </div>
          <div
            ref={transitionRef}
            className="relative w-64 h-64 rounded-full overflow-hidden shadow-xl"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 4.2s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              background: validOptions.length > 0 ? `conic-gradient(${gradientStops})` : undefined,
            }}
          >
            {validOptions.length === 0 && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground bg-muted/30">
                Add options to spin
              </div>
            )}
            {validOptions.map((opt, i) => {
              const midAngle = segAngle * i + segAngle / 2
              const rad = ((midAngle - 90) * Math.PI) / 180
              const labelR = 38
              return (
                <span
                  key={i}
                  className="absolute text-xs font-bold text-white drop-shadow-lg pointer-events-none leading-tight text-center"
                  style={{
                    left: `${50 + labelR * Math.cos(rad)}%`,
                    top: `${50 + labelR * Math.sin(rad)}%`,
                    transform: "translate(-50%, -50%)",
                    width: segAngle < 40 ? `${segAngle * 0.6}px` : "64px",
                  }}
                >
                  {opt.length > 14 ? opt.slice(0, 14) + "…" : opt}
                </span>
              )
            })}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-background border-2 border-border shadow-md flex items-center justify-center">
                <CircleDot className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
        <Button onClick={spin} disabled={spinning || validOptions.length < 2} size="lg" className="px-8">
          {spinning ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
          {spinning ? "Spinning..." : "Spin the Wheel"}
        </Button>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setResult(null)}>
          <div
            className="bg-background rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center space-y-4 animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8 text-green-600 dark:text-green-300" />
            </div>
            <h3 className="text-lg font-bold">The wheel landed on&hellip;</h3>
            <p className="text-3xl font-extrabold text-primary">{result}</p>
            <Button className="w-full" onClick={() => setResult(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Pros & Cons ─────────────────────────────────────────────────────────────
function ProsConsTab() {
  const [topic, setTopic] = useState("")
  const [pros, setPros] = useState<string[]>([])
  const [cons, setCons] = useState<string[]>([])
  const [newPro, setNewPro] = useState("")
  const [newCon, setNewCon] = useState("")
  const [saved, setSaved] = useState<ProsConsRecord[]>([])
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => { setSaved(loadPC()) }, [])

  function addPro() {
    if (!newPro.trim()) return
    setPros((prev) => [...prev, newPro.trim()])
    setNewPro("")
  }
  function addCon() {
    if (!newCon.trim()) return
    setCons((prev) => [...prev, newCon.trim()])
    setNewCon("")
  }
  function removePro(i: number) { setPros((prev) => prev.filter((_, idx) => idx !== i)) }
  function removeCon(i: number) { setCons((prev) => prev.filter((_, idx) => idx !== i)) }

  function saveDecision() {
    if (!topic.trim()) { toast.error("Enter a decision topic"); return }
    if (pros.length === 0 && cons.length === 0) { toast.error("Add at least one pro or con"); return }
    const record: ProsConsRecord = { id: uid(), topic: topic.trim(), pros: [...pros], cons: [...cons], createdAt: new Date().toISOString() }
    const next = [record, ...saved].slice(0, 20)
    setSaved(next)
    savePC(next)
    toast.success("Decision saved")
  }

  function loadRecord(r: ProsConsRecord) {
    setTopic(r.topic)
    setPros(r.pros)
    setCons(r.cons)
    setShowSaved(false)
  }

  function reset() {
    setTopic("")
    setPros([])
    setCons([])
    setNewPro("")
    setNewCon("")
  }

  const score = pros.length - cons.length

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-medium block mb-1.5">Decision Topic</label>
        <input
          type="text"
          placeholder="e.g. Should I take that job?"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="w-full h-10 rounded-xl border border-input bg-background px-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ThumbsUp className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">Pros</h3>
            <Badge variant="secondary" className="ml-auto">{pros.length}</Badge>
          </div>
          <div className="space-y-2">
            {pros.map((pro, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-xl border border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/30"
              >
                <span className="flex-1 text-sm">{pro}</span>
                <button onClick={() => removePro(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a pro..."
              value={newPro}
              onChange={(e) => setNewPro(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPro()}
              className="flex-1 h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button variant="outline" size="sm" onClick={addPro} disabled={!newPro.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ThumbsDown className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400">Cons</h3>
            <Badge variant="secondary" className="ml-auto">{cons.length}</Badge>
          </div>
          <div className="space-y-2">
            {cons.map((con, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30"
              >
                <span className="flex-1 text-sm">{con}</span>
                <button onClick={() => removeCon(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a con..."
              value={newCon}
              onChange={(e) => setNewCon(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCon()}
              className="flex-1 h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button variant="outline" size="sm" onClick={addCon} disabled={!newCon.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {(pros.length > 0 || cons.length > 0) && (
        <div className="p-4 rounded-xl border bg-card text-center space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Score</p>
          <p className={`text-4xl font-extrabold ${score > 0 ? "text-green-500" : score < 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {score > 0 ? "+" : ""}{score}
          </p>
          <p className="text-xs text-muted-foreground">
            {pros.length} pro{pros.length !== 1 ? "s" : ""} &middot; {cons.length} con{cons.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={saveDecision} disabled={!topic.trim() || (pros.length === 0 && cons.length === 0)}>
          <Send className="w-4 h-4 mr-1" /> Save Decision
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
        {saved.length > 0 && (
          <Button variant="ghost" onClick={() => setShowSaved((v) => !v)}>
            <History className="w-4 h-4 mr-1" /> Saved ({saved.length})
          </Button>
        )}
      </div>

      {showSaved && saved.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Decisions</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {saved.map((r) => (
              <button
                key={r.id}
                onClick={() => loadRecord(r)}
                className="w-full text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors"
              >
                <p className="text-sm font-medium">{r.topic}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.pros.length} pro{r.pros.length !== 1 ? "s" : ""} &middot; {r.cons.length} con{r.cons.length !== 1 ? "s" : ""}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(r.createdAt).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export function DecisionGameContent() {
  const [tab, setTab] = useState<Tab>("8ball")

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "8ball", label: "8-Ball", icon: <HelpCircle className="w-4 h-4" /> },
    { key: "wheel", label: "Wheel", icon: <Dices className="w-4 h-4" /> },
    { key: "proscons", label: "Pros & Cons", icon: <ListChecks className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="Decision Game" icon={HelpCircle} color="text-indigo-500" badge="Fun" />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-6 w-full space-y-8">
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                tab === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === "8ball" && <EightBallTab />}
        {tab === "wheel" && <WheelTab />}
        {tab === "proscons" && <ProsConsTab />}
      </main>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-18deg); }
          30% { transform: rotate(18deg); }
          45% { transform: rotate(-14deg); }
          60% { transform: rotate(14deg); }
          75% { transform: rotate(-8deg); }
          90% { transform: rotate(8deg); }
        }
      `}</style>
    </div>
  )
}
