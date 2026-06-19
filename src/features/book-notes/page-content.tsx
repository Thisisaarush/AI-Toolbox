"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  BookOpen, Plus, Trash2, Download, Sparkles, Search,
  ChevronRight, Star, BookMarked, X, Loader2, Copy,
  RotateCcw, Check, ExternalLink, Clock, TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  Book, BookHighlight, Flashcard, ReadingStatus, OpenLibraryResult, ReadingStats,
} from "./types"
import { TokenConnect } from "@/components/shared/connect-button"

const STORAGE_KEY = "book-notes-v1"
const FLASHCARD_KEY = "book-notes-flashcards-v1"

function loadBooks(): Book[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveBooks(b: Book[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)) }
function loadFlashcards(): Flashcard[] {
  try { return JSON.parse(localStorage.getItem(FLASHCARD_KEY) ?? "[]") } catch { return [] }
}
function saveFlashcards(f: Flashcard[]) { localStorage.setItem(FLASHCARD_KEY, JSON.stringify(f)) }

const STATUS_META: Record<ReadingStatus, { label: string; color: string; bg: string }> = {
  "not-started": { label: "Not Started", color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" },
  "reading":     { label: "Reading",     color: "text-blue-600",  bg: "bg-blue-100 dark:bg-blue-900/30" },
  "finished":    { label: "Finished",    color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
  "abandoned":   { label: "Abandoned",   color: "text-red-600",   bg: "bg-red-100 dark:bg-red-900/30" },
}

function coverUrl(coverId: number) {
  return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}

function computeStats(books: Book[], flashcards: Flashcard[]): ReadingStats {
  const thisYear = new Date().getFullYear()
  const finished = books.filter((b) => b.status === "finished")
  const booksThisYear = finished.filter((b) => b.finishDate && new Date(b.finishDate).getFullYear() === thisYear).length

  const daysArr = finished
    .filter((b) => b.startDate && b.finishDate)
    .map((b) => {
      const diff = new Date(b.finishDate!).getTime() - new Date(b.startDate!).getTime()
      return Math.max(1, Math.ceil(diff / 86400000))
    })
  const avgDaysToFinish = daysArr.length > 0 ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : 0

  const genreBreakdown: Record<string, number> = {}
  books.forEach((b) => {
    if (b.genre) genreBreakdown[b.genre] = (genreBreakdown[b.genre] ?? 0) + 1
  })

  // Reading streak: consecutive days with at least one highlight logged
  const allDates = new Set(
    books.flatMap((b) => b.highlights.map((h) => h.createdAt.slice(0, 10)))
  )
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (allDates.has(key)) streak++
    else if (i > 0) break
  }

  const totalHighlights = books.reduce((acc, b) => acc + b.highlights.length, 0)
  return { booksThisYear, avgDaysToFinish, genreBreakdown, readingStreak: streak, totalHighlights }
}

// SM-2 lite
function sm2(card: Flashcard, rating: number): Flashcard {
  const minEF = 1.3
  const newEF = Math.max(minEF, card.easeFactor + 0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  let interval: number
  let repetitions = card.repetitions
  if (rating < 3) {
    interval = 1
    repetitions = 0
  } else {
    repetitions++
    if (repetitions === 1) interval = 1
    else if (repetitions === 2) interval = 6
    else interval = Math.round(card.interval * newEF)
  }
  const due = new Date()
  due.setDate(due.getDate() + interval)
  return { ...card, interval, easeFactor: newEF, repetitions, dueDate: due.toISOString() }
}

type View = "library" | "add-book" | "book-detail" | "review"

export function BookNotesContent() {
  const [books, setBooks] = useState<Book[]>([])
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [view, setView] = useState<View>("library")
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // Add book form
  const [addTitle, setAddTitle] = useState("")
  const [addAuthor, setAddAuthor] = useState("")
  const [addYear, setAddYear] = useState("")
  const [addGenre, setAddGenre] = useState("")
  const [addStatus, setAddStatus] = useState<ReadingStatus>("not-started")
  const [addCoverUrl, setAddCoverUrl] = useState("")
  const [olResults, setOlResults] = useState<OpenLibraryResult[]>([])
  const [olSearching, setOlSearching] = useState(false)

  // Highlights
  const [hlText, setHlText] = useState("")
  const [hlPage, setHlPage] = useState("")
  const [hlNote, setHlNote] = useState("")

  // Readwise
  const [rwToken, setRwToken] = useState("")
  const [rwBookId, setRwBookId] = useState("")
  const [rwLoading, setRwLoading] = useState(false)
  const [showRwForm, setShowRwForm] = useState(false)

  // AI
  const [aiLoading, setAiLoading] = useState(false)

  // Review mode
  const [reviewCards, setReviewCards] = useState<Flashcard[]>([])
  const [reviewIdx, setReviewIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    setBooks(loadBooks()); setFlashcards(loadFlashcards())
    const stored = localStorage.getItem("readwise-token")
    if (stored) setRwToken(stored)
  }, [])
  useEffect(() => { saveBooks(books) }, [books])
  useEffect(() => { saveFlashcards(flashcards) }, [flashcards])

  const selectedBook = useMemo(() => books.find((b) => b.id === selectedBookId) ?? null, [books, selectedBookId])
  const stats = useMemo(() => computeStats(books, flashcards), [books, flashcards])

  const filtered = useMemo(() => {
    if (!search.trim()) return books
    const q = search.toLowerCase()
    return books.filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q))
  }, [books, search])

  // Open Library search
  const searchOL = useCallback(async (q: string) => {
    if (!q.trim()) { setOlResults([]); return }
    setOlSearching(true)
    try {
      const res = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(q)}&limit=8`)
      const data = await res.json() as { docs: OpenLibraryResult[] }
      setOlResults(data.docs ?? [])
    } catch {
      toast.error("Open Library search failed")
    }
    setOlSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { if (addTitle.length > 2) searchOL(addTitle) }, 500)
    return () => clearTimeout(t)
  }, [addTitle, searchOL])

  function pickOLResult(r: OpenLibraryResult) {
    setAddTitle(r.title)
    setAddAuthor((r.author_name ?? []).join(", "))
    setAddYear(r.first_publish_year ? String(r.first_publish_year) : "")
    if (r.cover_i) setAddCoverUrl(coverUrl(r.cover_i))
    setOlResults([])
  }

  function addBook() {
    if (!addTitle.trim()) { toast.error("Title is required"); return }
    const now = new Date().toISOString()
    const book: Book = {
      id: crypto.randomUUID(),
      title: addTitle.trim(),
      author: addAuthor.trim(),
      year: addYear ? parseInt(addYear) : undefined,
      genre: addGenre.trim() || undefined,
      coverUrl: addCoverUrl.trim() || undefined,
      status: addStatus,
      highlights: [],
      createdAt: now,
      updatedAt: now,
    }
    setBooks((prev) => [book, ...prev])
    setAddTitle(""); setAddAuthor(""); setAddYear(""); setAddGenre("")
    setAddCoverUrl(""); setAddStatus("not-started"); setOlResults([])
    toast.success(`"${book.title}" added`)
    setSelectedBookId(book.id)
    setView("book-detail")
  }

  function deleteBook(id: string) {
    setBooks((prev) => prev.filter((b) => b.id !== id))
    setFlashcards((prev) => prev.filter((f) => f.bookId !== id))
    if (selectedBookId === id) { setSelectedBookId(null); setView("library") }
    toast.success("Book removed")
  }

  function updateBookStatus(id: string, status: ReadingStatus) {
    const now = new Date().toISOString()
    setBooks((prev) => prev.map((b) => {
      if (b.id !== id) return b
      const patch: Partial<Book> = { status, updatedAt: now }
      if (status === "reading" && !b.startDate) patch.startDate = now.slice(0, 10)
      if (status === "finished" && !b.finishDate) patch.finishDate = now.slice(0, 10)
      return { ...b, ...patch }
    }))
  }

  function addHighlight() {
    if (!selectedBookId || !hlText.trim()) { toast.error("Highlight text required"); return }
    const hl: BookHighlight = {
      id: crypto.randomUUID(),
      text: hlText.trim(),
      page: hlPage ? parseInt(hlPage) : undefined,
      note: hlNote.trim() || undefined,
      source: "manual",
      createdAt: new Date().toISOString(),
    }
    setBooks((prev) => prev.map((b) =>
      b.id === selectedBookId
        ? { ...b, highlights: [hl, ...b.highlights], updatedAt: new Date().toISOString() }
        : b
    ))
    setHlText(""); setHlPage(""); setHlNote("")
    toast.success("Highlight saved")
  }

  function deleteHighlight(bookId: string, hlId: string) {
    setBooks((prev) => prev.map((b) =>
      b.id === bookId
        ? { ...b, highlights: b.highlights.filter((h) => h.id !== hlId), updatedAt: new Date().toISOString() }
        : b
    ))
  }

  async function fetchReadwise() {
    if (!rwToken || !rwBookId || !selectedBookId) { toast.error("Enter token and book ID"); return }
    setRwLoading(true)
    try {
      const res = await fetch(`https://readwise.io/api/v2/highlights/?book_id=${rwBookId}`, {
        headers: { Authorization: `Token ${rwToken}` },
      })
      if (!res.ok) throw new Error("Readwise API error")
      const data = await res.json() as { results: { text: string; note?: string; location?: number }[] }
      const now = new Date().toISOString()
      const newHls: BookHighlight[] = data.results.map((r) => ({
        id: crypto.randomUUID(),
        text: r.text,
        note: r.note || undefined,
        page: r.location,
        source: "readwise" as const,
        createdAt: now,
      }))
      setBooks((prev) => prev.map((b) =>
        b.id === selectedBookId
          ? { ...b, highlights: [...newHls, ...b.highlights], updatedAt: now }
          : b
      ))
      toast.success(`Imported ${newHls.length} highlights from Readwise`)
      setShowRwForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Readwise import failed")
    }
    setRwLoading(false)
  }

  async function generateSummary() {
    if (!selectedBook || selectedBook.highlights.length === 0) {
      toast.error("Add highlights first"); return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/book-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-summary",
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.author,
          highlights: selectedBook.highlights,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setBooks((prev) => prev.map((b) =>
        b.id === selectedBook.id ? { ...b, aiSummary: data.summary } : b
      ))
      toast.success("AI summary generated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed")
    }
    setAiLoading(false)
  }

  async function generateFlashcards() {
    if (!selectedBook || selectedBook.highlights.length === 0) {
      toast.error("Add highlights first"); return
    }
    setAiLoading(true)
    try {
      const res = await fetch("/api/book-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-flashcards",
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          bookAuthor: selectedBook.author,
          highlights: selectedBook.highlights,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const newCards: Flashcard[] = data.flashcards
      setFlashcards((prev) => {
        const withoutOld = prev.filter((f) => f.bookId !== selectedBook.id)
        return [...newCards, ...withoutOld]
      })
      toast.success(`Generated ${newCards.length} flashcards`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed")
    }
    setAiLoading(false)
  }

  function startReview(bookId: string) {
    const due = flashcards.filter(
      (f) => f.bookId === bookId && new Date(f.dueDate) <= new Date()
    )
    if (due.length === 0) { toast.info("No cards due for review!"); return }
    setReviewCards(due)
    setReviewIdx(0)
    setShowAnswer(false)
    setView("review")
  }

  function rateCard(rating: number) {
    const card = reviewCards[reviewIdx]
    if (!card) return
    const updated = sm2(card, rating)
    setFlashcards((prev) => prev.map((f) => f.id === card.id ? updated : f))
    if (reviewIdx + 1 >= reviewCards.length) {
      toast.success("Review session complete!")
      setView("book-detail")
    } else {
      setReviewIdx((i) => i + 1)
      setShowAnswer(false)
    }
  }

  function exportMarkdown() {
    const lines: string[] = []
    for (const book of books) {
      lines.push(`# ${book.title} — ${book.author}`)
      lines.push(`**Status:** ${STATUS_META[book.status].label}`)
      if (book.startDate) lines.push(`**Started:** ${book.startDate}`)
      if (book.finishDate) lines.push(`**Finished:** ${book.finishDate}`)
      if (book.notes) lines.push(`\n**Notes:** ${book.notes}`)
      if (book.highlights.length > 0) {
        lines.push(`\n## Highlights`)
        book.highlights.forEach((h) => {
          lines.push(`\n> ${h.text}${h.page ? ` *(p.${h.page})*` : ""}`)
          if (h.note) lines.push(`— ${h.note}`)
        })
      }
      if (book.aiSummary) {
        lines.push(`\n## AI Summary`)
        lines.push(`### Key Themes`)
        book.aiSummary.keyThemes.forEach((t) => lines.push(`- ${t}`))
        lines.push(`### Main Arguments`)
        book.aiSummary.mainArguments.forEach((a) => lines.push(`- ${a}`))
        lines.push(`### Action Items`)
        book.aiSummary.actionItems.forEach((a) => lines.push(`- ${a}`))
      }
      lines.push("\n---\n")
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `book-notes-${new Date().toISOString().slice(0,10)}.md`; a.click()
    URL.revokeObjectURL(a.href); toast.success("Exported as Markdown")
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ books, flashcards }, null, 2)], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `book-notes-${new Date().toISOString().slice(0,10)}.json`; a.click()
    URL.revokeObjectURL(a.href); toast.success("Exported as JSON")
  }

  const bookFlashcards = useMemo(() =>
    selectedBookId ? flashcards.filter((f) => f.bookId === selectedBookId) : [],
    [flashcards, selectedBookId]
  )
  const dueDueCount = bookFlashcards.filter((f) => new Date(f.dueDate) <= new Date()).length

  // ── Review view ──────────────────────────────────────────────────────────
  if (view === "review") {
    const card = reviewCards[reviewIdx]
    return (
      <div className="min-h-screen flex flex-col">
        <ToolHeader
          title="Book Notes"
          icon={BookOpen}
          color="text-violet-500"
          badge="Education"
          actions={
            <Button variant="outline" size="sm" onClick={() => setView("book-detail")}>
              ← Exit Review
            </Button>
          }
        />
        <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
          <div className="text-center mb-8">
            <p className="text-sm text-muted-foreground">Card {reviewIdx + 1} of {reviewCards.length}</p>
            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
              <div className="bg-violet-500 h-1.5 rounded-full transition-all" style={{ width: `${((reviewIdx) / reviewCards.length) * 100}%` }} />
            </div>
          </div>
          {card && (
            <Card className="min-h-64">
              <CardContent className="py-8 space-y-6 text-center">
                <p className="text-lg font-medium">{card.question}</p>
                {!showAnswer ? (
                  <Button onClick={() => setShowAnswer(true)}>Show Answer</Button>
                ) : (
                  <>
                    <div className="p-4 rounded-lg bg-muted/50 text-left">
                      <p className="text-sm">{card.answer}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-3">How well did you know this?</p>
                      <div className="flex gap-2 justify-center flex-wrap">
                        {[
                          { r: 1, label: "Blackout", color: "bg-red-500 hover:bg-red-600" },
                          { r: 2, label: "Wrong", color: "bg-orange-500 hover:bg-orange-600" },
                          { r: 3, label: "Hard", color: "bg-yellow-500 hover:bg-yellow-600" },
                          { r: 4, label: "Good", color: "bg-blue-500 hover:bg-blue-600" },
                          { r: 5, label: "Easy", color: "bg-green-500 hover:bg-green-600" },
                        ].map(({ r, label, color }) => (
                          <button
                            key={r}
                            onClick={() => rateCard(r)}
                            className={`px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${color}`}
                          >
                            {r} — {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Book Notes"
        icon={BookOpen}
        color="text-violet-500"
        badge="Education"
        actions={
          <div className="flex gap-2">
            {view === "book-detail" ? (
              <Button variant="outline" size="sm" onClick={() => { setView("library"); setSelectedBookId(null) }}>
                ← Library
              </Button>
            ) : view === "add-book" ? (
              <Button variant="outline" size="sm" onClick={() => setView("library")}>← Back</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setView("add-book")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Book
                </Button>
                {books.length > 0 && (
                  <>
                    <Button variant="ghost" size="sm" onClick={exportMarkdown}>
                      <Download className="w-3.5 h-3.5 mr-1" /> MD
                    </Button>
                    <Button variant="ghost" size="sm" onClick={exportJson}>
                      <Download className="w-3.5 h-3.5 mr-1" /> JSON
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        }
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">

        {/* ── Add book ── */}
        {view === "add-book" && (
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Add Book</h1>
              <p className="text-muted-foreground text-sm">Search by title or fill in manually.</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="relative">
                  <label className="text-xs font-medium mb-1 block">Title *</label>
                  <Input
                    placeholder="Search by title..."
                    value={addTitle}
                    onChange={(e) => setAddTitle(e.target.value)}
                  />
                  {olSearching && (
                    <div className="absolute right-3 top-8 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                  )}
                  {olResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-background border rounded-lg shadow-lg overflow-hidden">
                      {olResults.slice(0, 6).map((r, i) => (
                        <button
                          key={i}
                          onClick={() => pickOLResult(r)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors text-sm border-b last:border-0"
                        >
                          {r.cover_i && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverUrl(r.cover_i)} alt="" className="w-8 h-12 object-cover rounded shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{r.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {(r.author_name ?? []).slice(0, 2).join(", ")}
                              {r.first_publish_year ? ` · ${r.first_publish_year}` : ""}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Author</label>
                  <Input placeholder="Author name" value={addAuthor} onChange={(e) => setAddAuthor(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Year</label>
                    <Input type="number" placeholder="2024" value={addYear} onChange={(e) => setAddYear(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Genre</label>
                    <Input placeholder="Non-fiction" value={addGenre} onChange={(e) => setAddGenre(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Status</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value as ReadingStatus)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {(Object.entries(STATUS_META) as [ReadingStatus, typeof STATUS_META[ReadingStatus]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                {addCoverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={addCoverUrl} alt="Cover" className="w-16 h-24 object-cover rounded shadow" />
                )}
                <Button className="w-full" onClick={addBook}>
                  <BookOpen className="w-4 h-4 mr-2" /> Add to Library
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Library ── */}
        {view === "library" && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Book Library</h1>
                <p className="text-muted-foreground text-sm mt-0.5">{books.length} books tracked</p>
              </div>
            </div>

            {/* Stats bar */}
            {books.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Read this year", value: String(stats.booksThisYear), icon: BookMarked, color: "text-violet-500" },
                  { label: "Avg days/book", value: stats.avgDaysToFinish > 0 ? String(stats.avgDaysToFinish) : "—", icon: Clock, color: "text-blue-500" },
                  { label: "Reading streak", value: `${stats.readingStreak}d`, icon: TrendingUp, color: "text-green-500" },
                  { label: "Total highlights", value: String(stats.totalHighlights), icon: Star, color: "text-amber-500" },
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
            )}

            {/* Search */}
            {books.length > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search books..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {books.length === 0 ? (
              <Card className="max-w-md mx-auto mt-16">
                <CardContent className="py-16 text-center">
                  <BookOpen className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No books yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Add your first book to start tracking highlights, notes, and summaries.
                  </p>
                  <Button onClick={() => setView("add-book")}>
                    <Plus className="w-4 h-4 mr-1" /> Add Your First Book
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((book) => {
                  const sm = STATUS_META[book.status]
                  const bookFc = flashcards.filter((f) => f.bookId === book.id)
                  const due = bookFc.filter((f) => new Date(f.dueDate) <= new Date()).length
                  return (
                    <Card
                      key={book.id}
                      className="cursor-pointer hover:shadow-md transition-shadow group"
                      onClick={() => { setSelectedBookId(book.id); setView("book-detail") }}
                    >
                      <CardContent className="p-4 flex gap-3">
                        {book.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={book.coverUrl} alt="Cover" className="w-12 h-16 object-cover rounded shadow shrink-0" />
                        ) : (
                          <div className="w-12 h-16 rounded bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
                            <BookOpen className="w-5 h-5 text-violet-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm leading-snug line-clamp-2">{book.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                              {sm.label}
                            </span>
                            {book.highlights.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">{book.highlights.length} highlights</span>
                            )}
                            {due > 0 && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">{due} cards due</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Genre breakdown */}
            {Object.keys(stats.genreBreakdown).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Genre Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(stats.genreBreakdown).sort(([,a],[,b]) => b - a).map(([genre, count]) => (
                      <div key={genre} className="flex items-center gap-3">
                        <span className="text-xs w-28 truncate">{genre}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full" style={{ width: `${(count / books.length) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Book Detail ── */}
        {view === "book-detail" && selectedBook && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: book info */}
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex gap-4">
                    {selectedBook.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selectedBook.coverUrl} alt="Cover" className="w-20 h-28 object-cover rounded shadow" />
                    ) : (
                      <div className="w-20 h-28 rounded bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-violet-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 className="font-bold text-base leading-snug">{selectedBook.title}</h2>
                      <p className="text-sm text-muted-foreground">{selectedBook.author}</p>
                      {selectedBook.year && <p className="text-xs text-muted-foreground">{selectedBook.year}</p>}
                      {selectedBook.genre && (
                        <Badge variant="secondary" className="text-[10px] mt-1">{selectedBook.genre}</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block">Reading Status</label>
                    <select
                      value={selectedBook.status}
                      onChange={(e) => updateBookStatus(selectedBook.id, e.target.value as ReadingStatus)}
                      className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {(Object.entries(STATUS_META) as [ReadingStatus, typeof STATUS_META[ReadingStatus]][]).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>

                  {selectedBook.startDate && (
                    <p className="text-xs text-muted-foreground">
                      Started: {new Date(selectedBook.startDate).toLocaleDateString()}
                      {selectedBook.finishDate && ` · Finished: ${new Date(selectedBook.finishDate).toLocaleDateString()}`}
                    </p>
                  )}

                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => deleteBook(selectedBook.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove Book
                  </Button>
                </CardContent>
              </Card>

              {/* Flashcards card */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Flashcards</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{bookFlashcards.length} cards</span>
                    {dueDueCount > 0 && <span className="text-amber-500 font-medium">{dueDueCount} due</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={generateFlashcards}
                      disabled={aiLoading || selectedBook.highlights.length === 0}
                    >
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      Generate
                    </Button>
                    {bookFlashcards.length > 0 && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => startReview(selectedBook.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Review {dueDueCount > 0 ? `(${dueDueCount})` : ""}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: highlights + AI summary */}
            <div className="lg:col-span-2 space-y-4">
              {/* Add highlight */}
              <Card>
                <CardHeader><CardTitle className="text-sm">Add Highlight</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    placeholder="Paste the highlight text..."
                    value={hlText}
                    onChange={(e) => setHlText(e.target.value)}
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="number"
                      placeholder="Page number (optional)"
                      value={hlPage}
                      onChange={(e) => setHlPage(e.target.value)}
                    />
                    <Input
                      placeholder="Your note (optional)"
                      value={hlNote}
                      onChange={(e) => setHlNote(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={addHighlight} disabled={!hlText.trim()}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Save Highlight
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowRwForm((v) => !v)}>
                      <ExternalLink className="w-3.5 h-3.5 mr-1" /> Connect Readwise
                    </Button>
                  </div>
                  {showRwForm && (
                    <div className="p-3 border rounded-lg space-y-3 bg-muted/30">
                      <TokenConnect
                        serviceName="Readwise"
                        storageKey="readwise-token"
                        placeholder="Paste Readwise access token"
                        helpUrl="https://readwise.io/access_token"
                        helpText="Get your Readwise access token"
                        onConnected={(token) => setRwToken(token)}
                        onDisconnected={() => setRwToken("")}
                        description="Import your book highlights from Readwise automatically."
                      />
                      <Input placeholder="Readwise Book ID" value={rwBookId} onChange={(e) => setRwBookId(e.target.value)} />
                      <Button size="sm" onClick={fetchReadwise} disabled={rwLoading}>
                        {rwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                        Import Highlights
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">AI Book Summary</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={generateSummary}
                      disabled={aiLoading || selectedBook.highlights.length === 0}
                    >
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      {selectedBook.aiSummary ? "Regenerate" : "Generate"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {selectedBook.aiSummary ? (
                    <div className="space-y-4">
                      {[
                        { title: "Key Themes", items: selectedBook.aiSummary.keyThemes },
                        { title: "Main Arguments", items: selectedBook.aiSummary.mainArguments },
                        { title: "Action Items", items: selectedBook.aiSummary.actionItems },
                        { title: "Top Quotes", items: selectedBook.aiSummary.topQuotes },
                      ].map(({ title, items }) => (
                        <div key={title}>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
                          <ul className="space-y-1">
                            {items.map((item, i) => (
                              <li key={i} className="flex gap-2 text-sm">
                                <span className="text-violet-500 mt-0.5 shrink-0">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground">
                        Generated {new Date(selectedBook.aiSummary.generatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {selectedBook.highlights.length === 0
                        ? "Add highlights first, then generate an AI summary."
                        : `${selectedBook.highlights.length} highlights ready. Click Generate to analyze.`}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Highlights list */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Highlights ({selectedBook.highlights.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedBook.highlights.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No highlights yet.</p>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedBook.highlights.map((hl) => (
                        <div key={hl.id} className="p-3 rounded-lg border bg-muted/20 group">
                          <div className="flex gap-2 justify-between">
                            <p className="text-sm italic flex-1">&ldquo;{hl.text}&rdquo;</p>
                            <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { navigator.clipboard.writeText(hl.text); toast.success("Copied") }}
                                className="p-1 hover:text-foreground text-muted-foreground"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteHighlight(selectedBook.id, hl.id)}
                                className="p-1 hover:text-destructive text-muted-foreground"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                            {hl.page && <span>p.{hl.page}</span>}
                            {hl.source === "readwise" && <Badge variant="secondary" className="text-[9px] py-0">Readwise</Badge>}
                            <span>{new Date(hl.createdAt).toLocaleDateString()}</span>
                          </div>
                          {hl.note && <p className="text-xs text-muted-foreground mt-1 border-l-2 border-violet-500/30 pl-2">{hl.note}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
