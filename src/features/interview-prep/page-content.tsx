"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  MessageSquare, Plus, Sparkles, Loader2, Check, X, ChevronRight,
  BookOpen, BarChart3, Zap, Building2, Clock, Star, ExternalLink,
  ChevronLeft, RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  Question, QuestionCategory, Difficulty,
  InterviewStore, PracticeSession, AiFeedback,
  FlashcardState, MockInterviewSession, CompanyResearch, STARAnswer,
} from "./types"
import {
  CATEGORY_LABELS, CATEGORY_COLORS, DIFFICULTY_COLORS, RESOURCES,
} from "./types"
import { PRELOADED_QUESTIONS } from "./questions"

const STORAGE_KEY = "interview-prep-v1"

function loadStore(): InterviewStore {
  if (typeof window === "undefined") return { sessions:[], flashcards:[], mocks:[], companyResearch:[], customQuestions:[] }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { sessions:[], flashcards:[], mocks:[], companyResearch:[], customQuestions:[] } }
  catch { return { sessions:[], flashcards:[], mocks:[], companyResearch:[], customQuestions:[] } }
}
function saveStore(s: InterviewStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type Tab = "bank" | "practice" | "mock" | "flashcards" | "company" | "progress" | "resources"

// SM-2 lite next review
function nextReviewDate(confidence: 1 | 2 | 3, prevCount: number): string {
  const days = confidence === 1 ? 1 : confidence === 2 ? 3 : Math.min(7 * (prevCount + 1), 30)
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

function isFlashcardDue(fc: FlashcardState): boolean {
  return new Date(fc.nextReview) <= new Date()
}

// ── Flashcard component (flip animation) ─────────────────────────────────────
function FlashCard({ question, onRate }: { question: Question; onRate: (c: 1 | 2 | 3) => void }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div className="perspective-1000 w-full max-w-xl mx-auto">
      <div
        onClick={() => setFlipped(!flipped)}
        className="relative cursor-pointer"
        style={{ transformStyle: "preserve-3d", transition: "transform 0.5s", transform: flipped ? "rotateY(180deg)" : "none", minHeight: "200px" }}
      >
        {/* Front */}
        <div className="absolute inset-0 rounded-2xl border bg-card p-6 flex flex-col items-center justify-center text-center backface-hidden">
          <Badge variant="secondary" className={`text-xs mb-3 ${CATEGORY_COLORS[question.category]}`}>{CATEGORY_LABELS[question.category]}</Badge>
          <p className="text-lg font-semibold">{question.question}</p>
          <p className="text-xs text-muted-foreground mt-4">Click to reveal answer approach</p>
        </div>
        {/* Back */}
        <div className="absolute inset-0 rounded-2xl border bg-card p-6 flex flex-col items-center justify-center text-center" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}>
          <p className="text-sm text-muted-foreground mb-4">{question.tips || "No tips available for this question. Practice answering it out loud!"}</p>
          {flipped && (
            <div className="flex gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => onRate(1)} className="text-red-400 border-red-400/30">Hard</Button>
              <Button size="sm" variant="outline" onClick={() => onRate(2)} className="text-amber-400 border-amber-400/30">OK</Button>
              <Button size="sm" variant="outline" onClick={() => onRate(3)} className="text-green-400 border-green-400/30">Easy</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── STAR Helper ──────────────────────────────────────────────────────────────
function StarHelper({ value, onChange }: { value: STARAnswer; onChange: (v: STARAnswer) => void }) {
  return (
    <div className="space-y-3">
      {(["situation","task","action","result"] as const).map((key) => (
        <div key={key}>
          <label className="text-xs font-semibold block mb-1 uppercase tracking-wider text-amber-400">{key}</label>
          <Textarea
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            rows={2}
            placeholder={key === "situation" ? "Set the scene..." : key === "task" ? "Your responsibility..." : key === "action" ? "What you specifically did..." : "The outcome and what you learned..."}
          />
        </div>
      ))}
    </div>
  )
}

const allQuestions = PRELOADED_QUESTIONS

export function InterviewPrepContent() {
  const [store, setStore] = useState<InterviewStore>({ sessions:[], flashcards:[], mocks:[], companyResearch:[], customQuestions:[] })
  const [tab, setTab] = useState<Tab>("bank")

  // Bank
  const [bankCategory, setBankCategory] = useState<QuestionCategory | "all">("all")
  const [bankDifficulty, setBankDifficulty] = useState<Difficulty | "all">("all")
  const [bankSearch, setBankSearch] = useState("")

  // Practice
  const [practiceQuestion, setPracticeQuestion] = useState<Question | null>(null)
  const [practiceAnswer, setPracticeAnswer] = useState("")
  const [practiceStar, setPracticeStar] = useState<STARAnswer>({ situation:"", task:"", action:"", result:"" })
  const [useStar, setUseStar] = useState(false)
  const [practiceLoading, setPracticeLoading] = useState(false)
  const [practiceFeedback, setPracticeFeedback] = useState<AiFeedback | null>(null)

  // Mock
  const [mockCategories, setMockCategories] = useState<QuestionCategory[]>(["behavioral"])
  const [mockDifficulty, setMockDifficulty] = useState<Difficulty>("medium")
  const [mockTimeLimit, setMockTimeLimit] = useState(5)
  const [currentMock, setCurrentMock] = useState<MockInterviewSession | null>(null)
  const [mockQuestionIdx, setMockQuestionIdx] = useState(0)
  const [mockAnswers, setMockAnswers] = useState<Record<string, string>>({})
  const [mockTimeLeft, setMockTimeLeft] = useState(0)
  const [mockLoading, setMockLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Flashcards
  const [flashIdx, setFlashIdx] = useState(0)
  const [fcCategory, setFcCategory] = useState<QuestionCategory | "all">("all")

  // Company research
  const [companyName, setCompanyName] = useState("")
  const [companyLoading, setCompanyLoading] = useState(false)
  const [selectedResearch, setSelectedResearch] = useState<CompanyResearch | null>(null)

  // Custom question form
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customQ, setCustomQ] = useState("")
  const [customCat, setCustomCat] = useState<QuestionCategory>("custom")
  const [customDiff, setCustomDiff] = useState<Difficulty>("medium")

  useEffect(() => { setStore(loadStore()) }, [])

  function update(fn: (s: InterviewStore) => InterviewStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  // ── Questions (preloaded + custom) ─────────────────────────────────────────
  const allQs = useMemo(() => [...allQuestions, ...store.customQuestions], [store.customQuestions])

  const filteredQs = useMemo(() => {
    let result = allQs
    if (bankCategory !== "all") result = result.filter((q) => q.category === bankCategory)
    if (bankDifficulty !== "all") result = result.filter((q) => q.difficulty === bankDifficulty)
    if (bankSearch) {
      const s = bankSearch.toLowerCase()
      result = result.filter((q) => q.question.toLowerCase().includes(s))
    }
    return result
  }, [allQs, bankCategory, bankDifficulty, bankSearch])

  // ── Practice ───────────────────────────────────────────────────────────────
  function startPractice(q: Question) {
    setPracticeQuestion(q)
    setPracticeAnswer("")
    setPracticeStar({ situation:"", task:"", action:"", result:"" })
    setPracticeFeedback(null)
    setUseStar(q.starTemplate ?? false)
    setTab("practice")
  }

  async function submitAnswer() {
    if (!practiceQuestion) return
    const answer = useStar
      ? `Situation: ${practiceStar.situation}\n\nTask: ${practiceStar.task}\n\nAction: ${practiceStar.action}\n\nResult: ${practiceStar.result}`
      : practiceAnswer
    if (!answer.trim() || answer.length < 20) { toast.error("Please write a more complete answer"); return }
    setPracticeLoading(true)
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "evaluate", question: practiceQuestion.question, answer, category: practiceQuestion.category }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const feedback = data.data as AiFeedback
      setPracticeFeedback(feedback)
      const session: PracticeSession = {
        id: crypto.randomUUID(), questionId: practiceQuestion.id, answer,
        feedback, starAnswer: useStar ? practiceStar : undefined, timestamp: new Date().toISOString(),
      }
      update((s) => ({ ...s, sessions: [...s.sessions, session] }))
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setPracticeLoading(false)
  }

  // ── Mock Interview ─────────────────────────────────────────────────────────
  function startMock() {
    const pool = allQs.filter((q) => mockCategories.includes(q.category) && q.difficulty === mockDifficulty)
    if (pool.length < 5) { toast.error("Not enough questions for selected filters. Try different categories/difficulty."); return }
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 5)
    const mock: MockInterviewSession = {
      id: crypto.randomUUID(), categories: mockCategories, difficulty: mockDifficulty,
      timePerQuestion: mockTimeLimit, questions: shuffled.map((q) => q.id),
      answers: {}, startedAt: new Date().toISOString(),
    }
    setCurrentMock(mock)
    setMockQuestionIdx(0)
    setMockAnswers({})
    setMockTimeLeft(mockTimeLimit * 60)
    startTimer(mockTimeLimit * 60)
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setMockTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setMockTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  function nextMockQuestion() {
    if (!currentMock) return
    if (mockQuestionIdx < currentMock.questions.length - 1) {
      setMockQuestionIdx((i) => i + 1)
      startTimer(mockTimeLimit * 60)
    } else {
      submitMock()
    }
  }

  async function submitMock() {
    if (!currentMock || timerRef.current) clearInterval(timerRef.current!)
    setMockLoading(true)
    const qas = currentMock!.questions.map((qid) => ({
      question: allQs.find((q) => q.id === qid)?.question ?? qid,
      answer: mockAnswers[qid] ?? "(no answer)",
    }))
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mock-evaluate", questionsAndAnswers: qas }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const result = data.data as { perQuestion: AiFeedback[]; overallScore: number; improvementPlan: string }
      const perQFeedback: Record<string, AiFeedback> = {}
      currentMock!.questions.forEach((qid, i) => { perQFeedback[qid] = result.perQuestion[i] as AiFeedback })
      const completed: MockInterviewSession = {
        ...currentMock!,
        answers: mockAnswers,
        feedback: perQFeedback,
        overallScore: result.overallScore,
        improvementPlan: result.improvementPlan,
        completedAt: new Date().toISOString(),
      }
      update((s) => ({ ...s, mocks: [...s.mocks, completed] }))
      setCurrentMock(completed)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setMockLoading(false)
  }

  // ── Flashcards ─────────────────────────────────────────────────────────────
  const dueFlashcards = useMemo(() => {
    const pool = fcCategory === "all" ? allQs : allQs.filter((q) => q.category === fcCategory)
    // Get due flashcards, or if none all questions
    const dueIds = store.flashcards.filter(isFlashcardDue).map((f) => f.questionId)
    const due = pool.filter((q) => dueIds.includes(q.id))
    if (due.length > 0) return due
    // If no due: show questions never seen
    const seenIds = new Set(store.flashcards.map((f) => f.questionId))
    return pool.filter((q) => !seenIds.has(q.id)).slice(0, 20)
  }, [store.flashcards, allQs, fcCategory])

  function rateFlashcard(q: Question, confidence: 1 | 2 | 3) {
    const existing = store.flashcards.find((f) => f.questionId === q.id)
    const newCount = (existing?.reviewCount ?? 0) + 1
    const fc: FlashcardState = {
      questionId: q.id,
      confidence,
      nextReview: nextReviewDate(confidence, newCount),
      reviewCount: newCount,
    }
    update((s) => ({
      ...s,
      flashcards: existing
        ? s.flashcards.map((f) => f.questionId === q.id ? fc : f)
        : [...s.flashcards, fc],
    }))
    if (flashIdx < dueFlashcards.length - 1) setFlashIdx((i) => i + 1)
    else { toast.success("All flashcards reviewed!"); setFlashIdx(0) }
  }

  // ── Company Research ───────────────────────────────────────────────────────
  async function researchCompany() {
    if (!companyName.trim()) { toast.error("Enter company name"); return }
    setCompanyLoading(true)
    try {
      const res = await fetch("/api/interview-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "company-research", company: companyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const r: CompanyResearch = {
        id: crypto.randomUUID(), company: companyName.trim(),
        ...data.data, createdAt: new Date().toISOString(),
      }
      update((s) => ({ ...s, companyResearch: [r, ...s.companyResearch.filter((x) => x.company.toLowerCase() !== companyName.toLowerCase())] }))
      setSelectedResearch(r)
      setCompanyName("")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setCompanyLoading(false)
  }

  // ── Progress ───────────────────────────────────────────────────────────────
  const progress = useMemo(() => {
    const totalSessions = store.sessions.length
    const categories = Object.keys(CATEGORY_LABELS) as QuestionCategory[]
    const byCategory = Object.fromEntries(
      categories.map((cat) => {
        const sessions = store.sessions.filter((s) => {
          const q = allQs.find((q) => q.id === s.questionId)
          return q?.category === cat
        })
        const avgConfidence = store.flashcards.filter((f) => allQs.find((q) => q.id === f.questionId && q.category === cat)).reduce((sum, f) => sum + f.confidence, 0) /
          Math.max(1, store.flashcards.filter((f) => allQs.find((q) => q.id === f.questionId && q.category === cat)).length)
        return [cat, { practiced: sessions.length, avgConfidence: Math.round(avgConfidence * 10) / 10 }]
      })
    ) as Record<QuestionCategory, { practiced: number; avgConfidence: number }>
    const avgScore = store.sessions.filter((s) => s.feedback?.score != null).reduce((sum, s) => sum + (s.feedback?.score ?? 0), 0) /
      Math.max(1, store.sessions.filter((s) => s.feedback?.score != null).length)
    const readinessScore = Math.min(100, Math.round((totalSessions * 5) + (avgScore * 3) + (store.mocks.length * 10)))
    return { totalSessions, byCategory, readinessScore }
  }, [store.sessions, store.flashcards, store.mocks, allQs])

  const currentMockQ = currentMock ? allQs.find((q) => q.id === currentMock.questions[mockQuestionIdx]) : null
  const isCompleted = currentMock?.completedAt != null
  const timerMins = Math.floor(mockTimeLeft / 60)
  const timerSecs = mockTimeLeft % 60

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Interview Prep"
        icon={MessageSquare}
        color="text-amber-500"
        badge="Career"
        actions={
          tab === "bank" ? (
            <Button size="sm" variant="outline" onClick={() => setShowCustomForm(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
            </Button>
          ) : undefined
        }
      />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg flex-wrap">
          {([
            { key: "bank" as Tab, label: "Question Bank", icon: <BookOpen className="w-3.5 h-3.5" /> },
            { key: "practice" as Tab, label: "Practice", icon: <MessageSquare className="w-3.5 h-3.5" /> },
            { key: "mock" as Tab, label: "Mock Interview", icon: <Clock className="w-3.5 h-3.5" /> },
            { key: "flashcards" as Tab, label: "Flashcards", icon: <Zap className="w-3.5 h-3.5" /> },
            { key: "company" as Tab, label: "Company Prep", icon: <Building2 className="w-3.5 h-3.5" /> },
            { key: "progress" as Tab, label: "Progress", icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { key: "resources" as Tab, label: "Resources", icon: <ExternalLink className="w-3.5 h-3.5" /> },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── QUESTION BANK ── */}
        {tab === "bank" && (
          <div className="space-y-4">
            {showCustomForm && (
              <Card className="border-amber-500/30">
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Question *</label>
                    <Textarea value={customQ} onChange={(e) => setCustomQ(e.target.value)} rows={2} placeholder="Enter your custom question..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Category</label>
                      <select value={customCat} onChange={(e) => setCustomCat(e.target.value as QuestionCategory)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                        {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Difficulty</label>
                      <select value={customDiff} onChange={(e) => setCustomDiff(e.target.value as Difficulty)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                        {(["easy","medium","hard"] as Difficulty[]).map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!customQ.trim()) { toast.error("Question required"); return }
                      const q: Question = { id: `custom-${crypto.randomUUID()}`, category: customCat, difficulty: customDiff, question: customQ.trim(), custom: true }
                      update((s) => ({ ...s, customQuestions: [...s.customQuestions, q] }))
                      setCustomQ(""); setShowCustomForm(false); toast.success("Question added")
                    }}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowCustomForm(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="flex flex-wrap gap-2 items-center">
              <Input placeholder="Search questions..." value={bankSearch} onChange={(e) => setBankSearch(e.target.value)} className="w-48" />
              <select value={bankCategory} onChange={(e) => setBankCategory(e.target.value as QuestionCategory | "all")} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All categories</option>
                {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
              <select value={bankDifficulty} onChange={(e) => setBankDifficulty(e.target.value as Difficulty | "all")} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All difficulties</option>
                {(["easy","medium","hard"] as Difficulty[]).map((d) => <option key={d}>{d}</option>)}
              </select>
              <span className="text-xs text-muted-foreground">{filteredQs.length} questions</span>
            </div>
            <div className="space-y-2">
              {filteredQs.slice(0, 50).map((q) => (
                <div key={q.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 group transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{q.question}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[q.category]}`}>{CATEGORY_LABELS[q.category]}</Badge>
                      <Badge variant="secondary" className={`text-xs ${DIFFICULTY_COLORS[q.difficulty]}`}>{q.difficulty}</Badge>
                      {q.starTemplate && <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400">STAR</Badge>}
                      {q.custom && <Badge variant="secondary" className="text-xs">Custom</Badge>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => startPractice(q)}>
                    Practice <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                  {q.custom && (
                    <Button size="icon-sm" variant="ghost" onClick={() => update((s) => ({ ...s, customQuestions: s.customQuestions.filter((x) => x.id !== q.id) }))} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {filteredQs.length > 50 && <p className="text-xs text-center text-muted-foreground">Showing 50 of {filteredQs.length} — use filters to narrow down</p>}
            </div>
          </div>
        )}

        {/* ── PRACTICE ── */}
        {tab === "practice" && (
          <div className="space-y-4">
            {!practiceQuestion ? (
              <div className="py-16 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No question selected</p>
                <p className="text-sm mt-1">Go to the Question Bank and click Practice on any question</p>
                <Button className="mt-4" size="sm" onClick={() => setTab("bank")}>Browse Questions</Button>
              </div>
            ) : (
              <>
                <Card className="border-amber-500/30">
                  <CardContent className="pt-4">
                    <div className="flex gap-2 mb-3">
                      <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[practiceQuestion.category]}`}>{CATEGORY_LABELS[practiceQuestion.category]}</Badge>
                      <Badge variant="secondary" className={`text-xs ${DIFFICULTY_COLORS[practiceQuestion.difficulty]}`}>{practiceQuestion.difficulty}</Badge>
                    </div>
                    <p className="text-lg font-semibold">{practiceQuestion.question}</p>
                    {practiceQuestion.tips && <p className="text-xs text-muted-foreground mt-2">Tip: {practiceQuestion.tips}</p>}
                  </CardContent>
                </Card>

                {practiceQuestion.starTemplate && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUseStar(!useStar)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${useStar ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "border-border text-muted-foreground"}`}
                    >
                      Use STAR Framework
                    </button>
                  </div>
                )}

                {useStar ? (
                  <StarHelper value={practiceStar} onChange={setPracticeStar} />
                ) : (
                  <div>
                    <label className="text-xs font-medium block mb-1">Your Answer</label>
                    <Textarea value={practiceAnswer} onChange={(e) => setPracticeAnswer(e.target.value)} rows={8} placeholder="Write your answer here..." />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={submitAnswer} disabled={practiceLoading}>
                    {practiceLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Evaluating...</> : <><Sparkles className="w-3.5 h-3.5 mr-1" />Get AI Feedback</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPracticeQuestion(null); setTab("bank") }}>Back to Bank</Button>
                </div>

                {practiceFeedback && (
                  <Card className="border-amber-500/30">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">AI Feedback</CardTitle>
                        <div className="flex items-center gap-1">
                          {Array.from({length:10}).map((_,i) => (
                            <div key={i} className={`w-2 h-4 rounded-sm ${i < (practiceFeedback.score ?? 0) ? "bg-amber-400" : "bg-muted"}`} />
                          ))}
                          <span className="text-sm font-bold ml-1">{practiceFeedback.score}/10</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-green-400 mb-1">Strengths</p>
                        {practiceFeedback.strengths.map((s, i) => (
                          <div key={i} className="flex gap-2 text-sm"><Check className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />{s}</div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-red-400 mb-1">Weaknesses</p>
                        {practiceFeedback.weaknesses.map((w, i) => (
                          <div key={i} className="flex gap-2 text-sm"><X className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />{w}</div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-amber-400 mb-1">Suggestions</p>
                        {practiceFeedback.suggestions.map((s, i) => (
                          <div key={i} className="flex gap-2 text-sm"><Star className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />{s}</div>
                        ))}
                      </div>
                      {practiceFeedback.modelAnswer && (
                        <div>
                          <p className="text-xs font-semibold text-blue-400 mb-1">Model Answer</p>
                          <p className="text-sm border rounded-lg p-3 bg-muted/30 whitespace-pre-line">{practiceFeedback.modelAnswer}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MOCK INTERVIEW ── */}
        {tab === "mock" && (
          <div className="space-y-4">
            {!currentMock ? (
              <Card>
                <CardHeader><CardTitle className="text-sm">Configure Mock Interview</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium block mb-2">Categories</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).filter(c=>c!=="custom").map((cat) => (
                        <button key={cat} onClick={() => setMockCategories((prev) => prev.includes(cat) ? prev.filter(c=>c!==cat) : [...prev, cat])}
                          className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${mockCategories.includes(cat) ? `${CATEGORY_COLORS[cat]} border-transparent` : "border-border text-muted-foreground"}`}>
                          {CATEGORY_LABELS[cat]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Difficulty</label>
                      <select value={mockDifficulty} onChange={(e) => setMockDifficulty(e.target.value as Difficulty)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                        {(["easy","medium","hard"] as Difficulty[]).map((d) => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Time per question (minutes)</label>
                      <Input type="number" min={2} max={10} value={mockTimeLimit} onChange={(e) => setMockTimeLimit(Number(e.target.value))} />
                    </div>
                  </div>
                  <Button size="sm" onClick={startMock}><Clock className="w-3.5 h-3.5 mr-1" /> Start Mock Interview (5 questions)</Button>
                  {store.mocks.length > 0 && (
                    <div className="pt-4 border-t space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Mock Interviews</p>
                      {store.mocks.slice(-5).reverse().map((m) => (
                        <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/30" onClick={() => setCurrentMock(m)}>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{m.categories.map(c=>CATEGORY_LABELS[c]).join(", ")}</p>
                            <p className="text-xs text-muted-foreground">{new Date(m.startedAt).toLocaleDateString()}</p>
                          </div>
                          {m.overallScore != null && <div className="text-lg font-bold text-amber-400">{m.overallScore}/10</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : isCompleted ? (
              // Results view
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Mock Interview Results</h2>
                  <Button size="sm" variant="outline" onClick={() => setCurrentMock(null)}><RefreshCw className="w-3.5 h-3.5 mr-1" /> New Mock</Button>
                </div>
                {currentMock.overallScore != null && (
                  <Card className="border-amber-500/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <div className="text-5xl font-black text-amber-400">{currentMock.overallScore}</div>
                        <div>
                          <p className="text-sm font-medium">Overall Score</p>
                          <div className="flex gap-0.5 mt-1">{Array.from({length:10}).map((_,i) => <div key={i} className={`w-4 h-2 rounded-sm ${i < currentMock.overallScore! ? "bg-amber-400" : "bg-muted"}`} />)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {currentMock.improvementPlan && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Improvement Plan</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground">{currentMock.improvementPlan}</p></CardContent>
                  </Card>
                )}
                {currentMock.questions.map((qid, i) => {
                  const q = allQs.find((x) => x.id === qid)
                  const fb = currentMock.feedback?.[qid]
                  return (
                    <Card key={qid}>
                      <CardContent className="py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium flex-1">Q{i+1}: {q?.question}</p>
                          {fb?.score != null && <span className="text-sm font-bold text-amber-400 shrink-0">{fb.score}/10</span>}
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <p className="text-xs text-muted-foreground">{currentMock.answers[qid] || "(no answer)"}</p>
                        </div>
                        {fb && (
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-green-400 font-medium mb-1">Strengths</p>
                              {fb.strengths.slice(0,2).map((s,j) => <p key={j} className="text-muted-foreground">• {s}</p>)}
                            </div>
                            <div>
                              <p className="text-red-400 font-medium mb-1">To improve</p>
                              {fb.weaknesses.slice(0,2).map((w,j) => <p key={j} className="text-muted-foreground">• {w}</p>)}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            ) : (
              // Active mock
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Question {mockQuestionIdx+1} of {currentMock.questions.length}</span>
                    <Badge variant="secondary" className={`text-xs ${DIFFICULTY_COLORS[currentMock.difficulty]}`}>{currentMock.difficulty}</Badge>
                  </div>
                  <div className={`flex items-center gap-1 font-mono font-bold ${mockTimeLeft < 60 ? "text-red-400" : "text-amber-400"}`}>
                    <Clock className="w-4 h-4" />
                    {timerMins}:{String(timerSecs).padStart(2,"0")}
                  </div>
                </div>
                {/* Progress */}
                <div className="flex gap-1">
                  {currentMock.questions.map((_, i) => (
                    <div key={i} className={`flex-1 h-1 rounded-full ${i < mockQuestionIdx ? "bg-amber-400" : i === mockQuestionIdx ? "bg-amber-400/60" : "bg-muted"}`} />
                  ))}
                </div>
                {currentMockQ && (
                  <Card className="border-amber-500/30">
                    <CardContent className="pt-4">
                      <div className="flex gap-2 mb-2">
                        <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[currentMockQ.category]}`}>{CATEGORY_LABELS[currentMockQ.category]}</Badge>
                      </div>
                      <p className="text-lg font-semibold">{currentMockQ.question}</p>
                    </CardContent>
                  </Card>
                )}
                <Textarea
                  value={mockAnswers[currentMock.questions[mockQuestionIdx] ?? ""] ?? ""}
                  onChange={(e) => {
                    const qid = currentMock.questions[mockQuestionIdx]
                    if (qid) setMockAnswers((prev) => ({ ...prev, [qid]: e.target.value }))
                  }}
                  rows={8}
                  placeholder="Type your answer here..."
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={nextMockQuestion} disabled={mockLoading}>
                    {mockLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Evaluating...</> :
                      mockQuestionIdx < currentMock.questions.length - 1 ? <>Next <ChevronRight className="w-3.5 h-3.5 ml-1" /></> : <><Check className="w-3.5 h-3.5 mr-1" />Submit & Evaluate</>}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if(timerRef.current) clearInterval(timerRef.current); setCurrentMock(null) }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FLASHCARDS ── */}
        {tab === "flashcards" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Flashcard Mode</h2>
                <p className="text-sm text-muted-foreground">{dueFlashcards.length} cards due · SM-2 spaced repetition</p>
              </div>
              <select value={fcCategory} onChange={(e) => { setFcCategory(e.target.value as QuestionCategory | "all"); setFlashIdx(0) }} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All categories</option>
                {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            {dueFlashcards.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No cards due!</p>
                <p className="text-sm">Check back later or switch category</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => setFlashIdx(Math.max(0, flashIdx-1))} disabled={flashIdx === 0}><ChevronLeft className="w-4 h-4" /></Button>
                  <span>{flashIdx+1} / {dueFlashcards.length}</span>
                  <Button variant="ghost" size="icon-sm" onClick={() => setFlashIdx(Math.min(dueFlashcards.length-1, flashIdx+1))} disabled={flashIdx === dueFlashcards.length-1}><ChevronRight className="w-4 h-4" /></Button>
                </div>
                <FlashCard question={dueFlashcards[flashIdx]!} onRate={(c) => rateFlashcard(dueFlashcards[flashIdx]!, c)} />
              </>
            )}
          </div>
        )}

        {/* ── COMPANY PREP ── */}
        {tab === "company" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-amber-400" />Company-Specific Prep</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Google, Meta, Stripe..." value={companyName} onChange={(e) => setCompanyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && researchCompany()} className="flex-1" />
                  <Button size="sm" onClick={researchCompany} disabled={companyLoading}>
                    {companyLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Sparkles className="w-3.5 h-3.5 mr-1" />Research</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Past research */}
            {store.companyResearch.length > 0 && !selectedResearch && (
              <div className="space-y-2">
                {store.companyResearch.map((r) => (
                  <button key={r.id} onClick={() => setSelectedResearch(r)} className="w-full text-left p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{r.company}</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selectedResearch && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">{selectedResearch.company}</h2>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedResearch(null)}>← Back</Button>
                </div>
                {selectedResearch.format && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Interview Format</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground">{selectedResearch.format}</p></CardContent>
                  </Card>
                )}
                {selectedResearch.values && selectedResearch.values.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Company Values</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                      {selectedResearch.values.map((v, i) => <Badge key={i} variant="secondary" className="text-xs bg-amber-500/20 text-amber-400">{v}</Badge>)}
                    </CardContent>
                  </Card>
                )}
                {selectedResearch.commonQuestions && selectedResearch.commonQuestions.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Reported Interview Questions</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {selectedResearch.commonQuestions.map((q, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold text-sm shrink-0">{i+1}.</span>
                          <p className="text-sm">{q}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                {selectedResearch.talkingPoints && selectedResearch.talkingPoints.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Suggested Talking Points</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {selectedResearch.talkingPoints.map((t, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Star className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-sm">{t}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PROGRESS ── */}
        {tab === "progress" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Your Progress</h2>
            <Card className="border-amber-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-5xl font-black text-amber-400">{progress.readinessScore}</p>
                    <p className="text-sm text-muted-foreground">Readiness Score</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all" style={{ width: `${progress.readinessScore}%` }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Just starting</span><span>Interview ready</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{progress.totalSessions}</p><p className="text-xs text-muted-foreground">Practice sessions</p></CardContent></Card>
              <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{store.mocks.length}</p><p className="text-xs text-muted-foreground">Mock interviews</p></CardContent></Card>
              <Card><CardContent className="py-4 text-center"><p className="text-3xl font-bold">{store.flashcards.length}</p><p className="text-xs text-muted-foreground">Cards reviewed</p></CardContent></Card>
            </div>
            <div className="space-y-2">
              {(Object.keys(CATEGORY_LABELS) as QuestionCategory[]).map((cat) => {
                const stat = progress.byCategory[cat]
                return (
                  <div key={cat} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[cat]} w-32 justify-center`}>{CATEGORY_LABELS[cat]}</Badge>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{stat.practiced} sessions</span>
                        <span>avg confidence: {stat.avgConfidence.toFixed(1)}/3</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${(CATEGORY_COLORS[cat] ?? "").split(" ")[0]?.replace("/20", "") ?? ""}`} style={{ width: `${Math.min(100, stat.practiced * 10)}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── RESOURCES ── */}
        {tab === "resources" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Learning Resources</h2>
            {(Object.keys(RESOURCES) as QuestionCategory[]).filter(c => RESOURCES[c].length > 0).map((cat) => (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={`text-xs ${CATEGORY_COLORS[cat]}`}>{CATEGORY_LABELS[cat]}</Badge>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {RESOURCES[cat].map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors group">
                    <div className="flex-1">
                      <p className="text-sm font-medium group-hover:text-amber-400 transition-colors">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </main>
      <style>{`
        .backface-hidden { backface-visibility: hidden; }
        .perspective-1000 { perspective: 1000px; }
      `}</style>
    </div>
  )
}
