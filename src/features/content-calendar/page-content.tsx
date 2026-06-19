"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Calendar, Plus, Sparkles, Loader2, X, Check, Edit3,
  BarChart3, Repeat2, ExternalLink, ChevronLeft, ChevronRight,
  List, Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type ContentPiece, type ContentStore, type ContentPillar, type ContentAnalytics,
  type Platform, type ContentType, type ContentStatus,
  PLATFORMS, PLATFORM_COLORS, STATUS_COLORS, CONTENT_TYPES, PILLAR_COLORS, PILLAR_COLOR_MAP,
} from "./types"

const STORAGE_KEY = "content-calendar-v1"

function loadStore(): ContentStore {
  if (typeof window === "undefined") return { pieces: [], pillars: [] }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { pieces: [], pillars: [] } }
  catch { return { pieces: [], pillars: [] } }
}
function saveStore(s: ContentStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type MainTab = "calendar" | "list" | "ideas" | "repurpose" | "analytics" | "pillars" | "settings"
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]

// Character count helper for threads
function TwitterThreadEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tweets = value.split("\n---\n")
  return (
    <div className="space-y-2">
      {tweets.map((tw, i) => (
        <div key={i} className="relative">
          <Textarea
            value={tw}
            onChange={(e) => {
              const newTweets = tweets.map((t, idx) => idx === i ? e.target.value : t)
              onChange(newTweets.join("\n---\n"))
            }}
            rows={3}
            placeholder={i === 0 ? "Tweet 1 (hook)..." : `Tweet ${i + 1}...`}
            className="pr-12"
          />
          <span className={`absolute bottom-2 right-2 text-xs ${tw.length > 280 ? "text-red-400" : tw.length > 240 ? "text-amber-400" : "text-muted-foreground"}`}>
            {tw.length}/280
          </span>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange(value + "\n---\n")}>
        <Plus className="w-3 h-3 mr-1" /> Add tweet
      </Button>
    </div>
  )
}

export function ContentCalendarContent() {
  const [store, setStore] = useState<ContentStore>({ pieces: [], pillars: [] })
  const [tab, setTab] = useState<MainTab>("calendar")
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // Filters
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all")
  const [filterStatus, setFilterStatus] = useState<ContentStatus | "all">("all")

  // Create/edit form
  const [showForm, setShowForm] = useState(false)
  const [editingPiece, setEditingPiece] = useState<ContentPiece | null>(null)
  const [fpTitle, setFpTitle] = useState("")
  const [fpPlatform, setFpPlatform] = useState<Platform>("Twitter/X")
  const [fpType, setFpType] = useState<ContentType>("thread")
  const [fpStatus, setFpStatus] = useState<ContentStatus>("idea")
  const [fpDate, setFpDate] = useState("")
  const [fpTags, setFpTags] = useState("")
  const [fpPillar, setFpPillar] = useState("")
  const [fpDraft, setFpDraft] = useState("")
  const [fpNotes, setFpNotes] = useState("")

  // Ideas
  const [ideasNiche, setIdeasNiche] = useState("")
  const [ideasAudience, setIdeasAudience] = useState("")
  const [ideasPlatform, setIdeasPlatform] = useState("")
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideas, setIdeas] = useState<{hook:string;title:string;format:string;bestTime:string;whyItWorks:string}[]>([])

  // Repurpose
  const [repurposeContent, setRepurposeContent] = useState("")
  const [repurposeLoading, setRepurposeLoading] = useState(false)
  const [repurposed, setRepurposed] = useState<{tweetThreads:{title:string;tweets:string[]}[];linkedInPost:string;instagramCaptions:string[];newsletterSummary:string} | null>(null)

  // Pillar form
  const [showPillarForm, setShowPillarForm] = useState(false)
  const [pillarName, setPillarName] = useState("")
  const [pillarColor, setPillarColor] = useState("fuchsia")
  const [pillarDesc, setPillarDesc] = useState("")

  // Ghost
  const [ghostUrl, setGhostUrl] = useState("")
  const [ghostKey, setGhostKey] = useState("")
  const [publishingTo, setPublishingTo] = useState<string | null>(null)

  // Analytics form
  const [analyticsFor, setAnalyticsFor] = useState<string | null>(null)
  const [anImpressions, setAnImpressions] = useState("")
  const [anLikes, setAnLikes] = useState("")
  const [anComments, setAnComments] = useState("")
  const [anShares, setAnShares] = useState("")
  const [anClicks, setAnClicks] = useState("")

  useEffect(() => {
    const s = loadStore()
    setStore(s)
    if (s.ghostConfig) { setGhostUrl(s.ghostConfig.apiUrl); setGhostKey(s.ghostConfig.adminKey) }
  }, [])

  function update(fn: (s: ContentStore) => ContentStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  function openForm(piece?: ContentPiece, date?: string) {
    if (piece) {
      setFpTitle(piece.title); setFpPlatform(piece.platform); setFpType(piece.type)
      setFpStatus(piece.status); setFpDate(piece.publishDate ?? "")
      setFpTags(piece.tags.join(", ")); setFpPillar(piece.pillarId ?? "")
      setFpDraft(piece.draft ?? ""); setFpNotes(piece.notes ?? "")
      setEditingPiece(piece)
    } else {
      setFpTitle(""); setFpPlatform("Twitter/X"); setFpType("thread")
      setFpStatus("idea"); setFpDate(date ?? ""); setFpTags(""); setFpPillar("")
      setFpDraft(""); setFpNotes(""); setEditingPiece(null)
    }
    setShowForm(true)
  }

  function savePiece() {
    if (!fpTitle.trim()) { toast.error("Title required"); return }
    const now = new Date().toISOString()
    const piece: ContentPiece = {
      id: editingPiece?.id ?? crypto.randomUUID(),
      title: fpTitle.trim(), platform: fpPlatform, type: fpType, status: fpStatus,
      publishDate: fpDate || undefined, tags: fpTags.split(",").map((t) => t.trim()).filter(Boolean),
      pillarId: fpPillar || undefined, draft: fpDraft || undefined, notes: fpNotes || undefined,
      analytics: editingPiece?.analytics,
      createdAt: editingPiece?.createdAt ?? now, updatedAt: now,
    }
    update((s) => ({
      ...s,
      pieces: editingPiece
        ? s.pieces.map((p) => p.id === editingPiece.id ? piece : p)
        : [...s.pieces, piece],
    }))
    setShowForm(false)
    toast.success(editingPiece ? "Updated" : "Created")
  }

  function deletePiece(id: string) {
    update((s) => ({ ...s, pieces: s.pieces.filter((p) => p.id !== id) }))
    toast.success("Deleted")
  }

  async function generateIdeas() {
    if (!ideasNiche.trim()) { toast.error("Enter a niche/topic"); return }
    setIdeasLoading(true)
    try {
      const res = await fetch("/api/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "content-ideas", niche: ideasNiche, audience: ideasAudience, platform: ideasPlatform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setIdeas(data.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setIdeasLoading(false)
  }

  async function repurpose() {
    if (!repurposeContent.trim()) { toast.error("Paste your content first"); return }
    setRepurposeLoading(true)
    try {
      const res = await fetch("/api/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repurpose", content: repurposeContent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setRepurposed(data.data)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setRepurposeLoading(false)
  }

  async function publishToGhost(piece: ContentPiece) {
    if (!ghostUrl || !ghostKey) { toast.error("Configure Ghost settings first"); setTab("settings"); return }
    setPublishingTo(piece.id)
    try {
      const res = await fetch("/api/content-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ghost-publish", apiUrl: ghostUrl, adminKey: ghostKey, title: piece.title, html: piece.draft ? `<p>${piece.draft.replace(/\n/g, "</p><p>")}</p>` : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      update((s) => ({ ...s, pieces: s.pieces.map((p) => p.id === piece.id ? { ...p, ghostPostId: data.postId } : p) }))
      toast.success(`Published to Ghost as draft! Post ID: ${data.postId}`)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setPublishingTo(null)
  }

  function saveAnalytics(pieceId: string) {
    const analytics: ContentAnalytics = {
      impressions: anImpressions ? Number(anImpressions) : undefined,
      likes: anLikes ? Number(anLikes) : undefined,
      comments: anComments ? Number(anComments) : undefined,
      shares: anShares ? Number(anShares) : undefined,
      clicks: anClicks ? Number(anClicks) : undefined,
      loggedAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, pieces: s.pieces.map((p) => p.id === pieceId ? { ...p, analytics } : p) }))
    setAnalyticsFor(null)
    toast.success("Analytics saved")
  }

  // ── Calendar helpers ─────────────────────────────────────────────────────
  const calDays = useMemo(() => {
    const first = new Date(calYear, calMonth, 1)
    const last = new Date(calYear, calMonth + 1, 0)
    const startDow = first.getDay()
    const days: (null | number)[] = [...Array(startDow).fill(null)]
    for (let d = 1; d <= last.getDate(); d++) days.push(d)
    return days
  }, [calYear, calMonth])

  function dateKey(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
  }

  const byDate = useMemo(() => {
    const map = new Map<string, ContentPiece[]>()
    store.pieces.filter((p) => p.publishDate).forEach((p) => {
      map.set(p.publishDate!, [...(map.get(p.publishDate!) ?? []), p])
    })
    return map
  }, [store.pieces])

  // Pillar distribution
  const pillarDistribution = useMemo(() => {
    const total = store.pieces.filter((p) => p.status === "published").length
    if (total === 0) return []
    const map = new Map<string, number>()
    store.pieces.filter((p) => p.status === "published").forEach((p) => {
      const key = p.pillarId ?? "uncategorized"
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([id, count]) => ({
      id,
      name: store.pillars.find((p) => p.id === id)?.name ?? "Uncategorized",
      color: store.pillars.find((p) => p.id === id)?.color ?? "gray",
      pct: Math.round((count / total) * 100),
      count,
    }))
  }, [store.pieces, store.pillars])

  const filteredPieces = useMemo(() => {
    let result = store.pieces
    if (filterPlatform !== "all") result = result.filter((p) => p.platform === filterPlatform)
    if (filterStatus !== "all") result = result.filter((p) => p.status === filterStatus)
    return result.sort((a,b) => (b.publishDate ?? b.createdAt).localeCompare(a.publishDate ?? a.createdAt))
  }, [store.pieces, filterPlatform, filterStatus])

  const todayPieces = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return store.pieces.filter((p) => p.publishDate === today)
  }, [store.pieces])

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Content Calendar"
        icon={Calendar}
        color="text-fuchsia-500"
        badge="Creator"
        actions={
          <Button size="sm" onClick={() => openForm()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Content
          </Button>
        }
      />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-6 w-full space-y-6">
        {/* Today banner */}
        {todayPieces.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10">
            <Calendar className="w-4 h-4 text-fuchsia-400 shrink-0" />
            <p className="text-sm">Today: <span className="font-bold text-fuchsia-400">{todayPieces.map(p=>p.title).join(", ")}</span></p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg flex-wrap">
          {([
            { key: "calendar" as MainTab, label: "Calendar", icon: <Calendar className="w-3.5 h-3.5" /> },
            { key: "list" as MainTab,     label: "List",     icon: <List className="w-3.5 h-3.5" /> },
            { key: "ideas" as MainTab,    label: "AI Ideas", icon: <Sparkles className="w-3.5 h-3.5" /> },
            { key: "repurpose" as MainTab,label: "Repurpose",icon: <Repeat2 className="w-3.5 h-3.5" /> },
            { key: "analytics" as MainTab,label: "Analytics",icon: <BarChart3 className="w-3.5 h-3.5" /> },
            { key: "pillars" as MainTab,  label: "Pillars",  icon: <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-xs">⬡</span> },
            { key: "settings" as MainTab, label: "Settings", icon: <Settings className="w-3.5 h-3.5" /> },
          ]).map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <Card className="border-fuchsia-500/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm">{editingPiece ? "Edit Content" : "New Content Piece"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Title *</label>
                  <Input value={fpTitle} onChange={(e) => setFpTitle(e.target.value)} placeholder="Content title" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Platform</label>
                  <select value={fpPlatform} onChange={(e) => setFpPlatform(e.target.value as Platform)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Type</label>
                  <select value={fpType} onChange={(e) => setFpType(e.target.value as ContentType)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {CONTENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Status</label>
                  <select value={fpStatus} onChange={(e) => setFpStatus(e.target.value as ContentStatus)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {(["idea","draft","scheduled","published"] as ContentStatus[]).map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Publish Date</label>
                  <Input type="date" value={fpDate} onChange={(e) => setFpDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Tags (comma-separated)</label>
                  <Input value={fpTags} onChange={(e) => setFpTags(e.target.value)} placeholder="seo, tutorial, react" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Content Pillar</label>
                  <select value={fpPillar} onChange={(e) => setFpPillar(e.target.value)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">None</option>
                    {store.pillars.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Draft</label>
                {fpPlatform === "Twitter/X" && fpType === "thread" ? (
                  <TwitterThreadEditor value={fpDraft} onChange={setFpDraft} />
                ) : (
                  <Textarea value={fpDraft} onChange={(e) => setFpDraft(e.target.value)} rows={4} placeholder="Write your draft here..." />
                )}
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Notes</label>
                <Input value={fpNotes} onChange={(e) => setFpNotes(e.target.value)} placeholder="Internal notes..." />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={savePiece}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                {editingPiece && store.ghostConfig && (
                  <Button size="sm" variant="outline" onClick={() => publishToGhost(editingPiece)} disabled={publishingTo === editingPiece.id}>
                    {publishingTo === editingPiece.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ExternalLink className="w-3.5 h-3.5 mr-1" />}
                    Publish to Ghost
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── CALENDAR ── */}
        {tab === "calendar" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{MONTH_NAMES[calMonth]} {calYear}</h2>
              <div className="flex gap-1">
                <Button variant="outline" size="icon-sm" onClick={() => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()) }}>Today</Button>
                <Button variant="outline" size="icon-sm" onClick={() => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0) } else setCalMonth(m=>m+1) }}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {DOW.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
              {calDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="min-h-24 rounded-lg" />
                const dk = dateKey(day)
                const pieces = byDate.get(dk) ?? []
                const isToday = dk === new Date().toISOString().slice(0,10)
                const isSelected = dk === selectedDate
                return (
                  <div
                    key={dk}
                    onClick={() => setSelectedDate(isSelected ? null : dk)}
                    className={`min-h-24 rounded-lg border p-1.5 cursor-pointer transition-colors hover:bg-muted/30 ${isToday ? "border-fuchsia-500/50 bg-fuchsia-500/5" : "border-border"} ${isSelected ? "ring-2 ring-fuchsia-500" : ""}`}
                  >
                    <div className={`text-xs font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full ${isToday ? "bg-fuchsia-500 text-white" : "text-muted-foreground"}`}>{day}</div>
                    <div className="space-y-0.5">
                      {pieces.slice(0,3).map((p) => (
                        <div key={p.id} className={`text-[9px] px-1 py-0.5 rounded truncate border ${PLATFORM_COLORS[p.platform]}`}>{p.title}</div>
                      ))}
                      {pieces.length > 3 && <div className="text-[9px] text-muted-foreground">+{pieces.length-3} more</div>}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Selected date panel */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{selectedDate}</CardTitle>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openForm(undefined, selectedDate)}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => setSelectedDate(null)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(byDate.get(selectedDate) ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No content scheduled</p>
                  ) : (
                    <div className="space-y-2">
                      {(byDate.get(selectedDate) ?? []).map((p) => (
                        <div key={p.id} className="flex items-center gap-2">
                          <Badge variant="secondary" className={`text-xs border ${PLATFORM_COLORS[p.platform]}`}>{p.platform}</Badge>
                          <span className="text-sm flex-1">{p.title}</span>
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                          <Button size="icon-sm" variant="ghost" onClick={() => openForm(p)}><Edit3 className="w-3 h-3" /></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── LIST ── */}
        {tab === "list" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value as Platform | "all")} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All platforms</option>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ContentStatus | "all")} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
                <option value="all">All statuses</option>
                {(["idea","draft","scheduled","published"] as ContentStatus[]).map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            {filteredPieces.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No content yet. Create your first piece!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPieces.map((p) => {
                  const pillar = store.pillars.find((pl) => pl.id === p.pillarId)
                  return (
                    <Card key={p.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm">{p.title}</span>
                              <Badge variant="secondary" className={`text-xs border ${PLATFORM_COLORS[p.platform]}`}>{p.platform}</Badge>
                              <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[p.status]}`}>{p.status}</Badge>
                              {pillar && <Badge variant="secondary" className={`text-xs ${PILLAR_COLOR_MAP[pillar.color] ?? ""}`}>{pillar.name}</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.publishDate ?? "No date"} · {p.type} · {p.tags.slice(0,3).join(", ")}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon-sm" variant="ghost" onClick={() => openForm(p)}><Edit3 className="w-3.5 h-3.5" /></Button>
                            {ghostUrl && <Button size="icon-sm" variant="ghost" onClick={() => publishToGhost(p)} disabled={publishingTo === p.id}>{publishingTo === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}</Button>}
                            <Button size="icon-sm" variant="ghost" onClick={() => deletePiece(p.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── IDEAS ── */}
        {tab === "ideas" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-fuchsia-400" />AI Content Ideas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Niche / Topic *</label>
                    <Input placeholder="TypeScript, Fitness, Finance..." value={ideasNiche} onChange={(e) => setIdeasNiche(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Audience</label>
                    <Input placeholder="Developers, beginners..." value={ideasAudience} onChange={(e) => setIdeasAudience(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Platform</label>
                    <Input placeholder="Twitter/X, LinkedIn..." value={ideasPlatform} onChange={(e) => setIdeasPlatform(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" onClick={generateIdeas} disabled={ideasLoading}>
                  {ideasLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Generating...</> : <><Sparkles className="w-3.5 h-3.5 mr-1" />Generate 10 Ideas</>}
                </Button>
              </CardContent>
            </Card>
            {ideas.length > 0 && (
              <div className="space-y-3">
                {ideas.map((idea, i) => (
                  <Card key={i}>
                    <CardContent className="py-3">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl font-black text-fuchsia-400/50 w-8 shrink-0">{i+1}</span>
                        <div className="flex-1 space-y-1">
                          <p className="font-semibold text-sm">{idea.title}</p>
                          <p className="text-xs text-fuchsia-400 italic">&ldquo;{idea.hook}&rdquo;</p>
                          <div className="flex gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{idea.format}</Badge>
                            <span className="text-xs text-muted-foreground">Best time: {idea.bestTime}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{idea.whyItWorks}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setFpTitle(idea.title); setFpDraft(idea.hook); setShowForm(true); setTab("calendar") }}>
                          <Plus className="w-3 h-3 mr-1" /> Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPURPOSE ── */}
        {tab === "repurpose" && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Repeat2 className="w-4 h-4 text-fuchsia-400" />Repurposing Engine</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Paste your long-form content (blog post, article, notes)</label>
                  <Textarea value={repurposeContent} onChange={(e) => setRepurposeContent(e.target.value)} rows={6} placeholder="Paste your blog post or article here..." />
                </div>
                <Button size="sm" onClick={repurpose} disabled={repurposeLoading}>
                  {repurposeLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />Repurposing...</> : <><Repeat2 className="w-3.5 h-3.5 mr-1" />Repurpose Content</>}
                </Button>
              </CardContent>
            </Card>
            {repurposed && (
              <div className="space-y-4">
                {repurposed.tweetThreads.map((thread, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-sky-400">Twitter Thread: {thread.title}</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                      {thread.tweets.map((tw, j) => (
                        <div key={j} className="flex gap-2">
                          <span className="text-xs text-muted-foreground w-6 shrink-0">{j+1}.</span>
                          <p className="text-sm flex-1 border rounded-lg p-2 bg-muted/30">{tw}</p>
                          <span className={`text-xs self-end ${tw.length > 280 ? "text-red-400" : "text-muted-foreground"}`}>{tw.length}</span>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={() => { setFpTitle(thread.title); setFpPlatform("Twitter/X"); setFpType("thread"); setFpDraft(thread.tweets.join("\n---\n")); setShowForm(true); setTab("list") }}>
                        <Plus className="w-3 h-3 mr-1" /> Save as draft
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-400">LinkedIn Post</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line border rounded-lg p-3 bg-muted/30">{repurposed.linkedInPost}</p>
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => { setFpTitle("LinkedIn Post"); setFpPlatform("LinkedIn"); setFpDraft(repurposed.linkedInPost); setShowForm(true); setTab("list") }}>
                      <Plus className="w-3 h-3 mr-1" /> Save as draft
                    </Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-pink-400">Instagram Captions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {repurposed.instagramCaptions.map((cap, i) => (
                      <div key={i} className="border rounded-lg p-3 bg-muted/30">
                        <p className="text-sm">{cap}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-400">Newsletter Summary</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-line border rounded-lg p-3 bg-muted/30">{repurposed.newsletterSummary}</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === "analytics" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Analytics</h2>
            {store.pieces.filter((p) => p.status === "published").length === 0 ? (
              <div className="py-12 text-center text-muted-foreground"><BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-20" /><p>No published content yet</p></div>
            ) : (
              <div className="space-y-2">
                {store.pieces.filter((p) => p.status === "published").map((p) => (
                  <Card key={p.id}>
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{p.title}</p>
                          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                            {p.analytics?.impressions != null && <span>👁 {p.analytics.impressions.toLocaleString()}</span>}
                            {p.analytics?.likes != null && <span>❤️ {p.analytics.likes.toLocaleString()}</span>}
                            {p.analytics?.comments != null && <span>💬 {p.analytics.comments.toLocaleString()}</span>}
                            {p.analytics?.shares != null && <span>🔁 {p.analytics.shares.toLocaleString()}</span>}
                            {p.analytics?.clicks != null && <span>🖱 {p.analytics.clicks.toLocaleString()}</span>}
                            {!p.analytics && <span className="italic">No analytics logged</span>}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => {
                          setAnalyticsFor(p.id)
                          setAnImpressions(String(p.analytics?.impressions ?? ""))
                          setAnLikes(String(p.analytics?.likes ?? ""))
                          setAnComments(String(p.analytics?.comments ?? ""))
                          setAnShares(String(p.analytics?.shares ?? ""))
                          setAnClicks(String(p.analytics?.clicks ?? ""))
                        }}>
                          <BarChart3 className="w-3.5 h-3.5 mr-1" /> Log
                        </Button>
                      </div>
                      {analyticsFor === p.id && (
                        <div className="mt-3 grid grid-cols-5 gap-2">
                          {[
                            { label: "Impressions", value: anImpressions, set: setAnImpressions },
                            { label: "Likes", value: anLikes, set: setAnLikes },
                            { label: "Comments", value: anComments, set: setAnComments },
                            { label: "Shares", value: anShares, set: setAnShares },
                            { label: "Clicks", value: anClicks, set: setAnClicks },
                          ].map(({ label, value, set }) => (
                            <div key={label}>
                              <label className="text-xs block mb-1">{label}</label>
                              <Input type="number" className="h-7 text-xs" value={value} onChange={(e) => set(e.target.value)} />
                            </div>
                          ))}
                          <div className="col-span-5 flex gap-2">
                            <Button size="sm" onClick={() => saveAnalytics(p.id)}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setAnalyticsFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PILLARS ── */}
        {tab === "pillars" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Content Pillars</h2>
              <Button size="sm" variant="outline" onClick={() => setShowPillarForm(!showPillarForm)}><Plus className="w-3.5 h-3.5 mr-1" /> New Pillar</Button>
            </div>
            {showPillarForm && (
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1">Name *</label>
                      <Input value={pillarName} onChange={(e) => setPillarName(e.target.value)} placeholder="Education, Entertainment..." />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1">Description</label>
                      <Input value={pillarDesc} onChange={(e) => setPillarDesc(e.target.value)} placeholder="What this pillar is about" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-2">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {PILLAR_COLORS.map((c) => (
                        <button key={c} onClick={() => setPillarColor(c)}
                          className={`w-7 h-7 rounded-full ${PILLAR_COLOR_MAP[c]} border-2 transition-all ${pillarColor === c ? "border-white scale-110" : "border-transparent"}`}>
                          <span className="sr-only">{c}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      if (!pillarName.trim()) { toast.error("Name required"); return }
                      const pillar: ContentPillar = { id: crypto.randomUUID(), name: pillarName.trim(), color: pillarColor, description: pillarDesc.trim() || undefined }
                      update((s) => ({ ...s, pillars: [...s.pillars, pillar] }))
                      setPillarName(""); setPillarDesc("")
                      setShowPillarForm(false)
                      toast.success("Pillar created")
                    }}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowPillarForm(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {store.pillars.length === 0 && !showPillarForm ? (
              <div className="py-10 text-center text-muted-foreground">
                <p>Create 3-5 content pillars to organize your topics</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {store.pillars.map((pillar) => {
                  const count = store.pieces.filter((p) => p.pillarId === pillar.id).length
                  const published = store.pieces.filter((p) => p.pillarId === pillar.id && p.status === "published").length
                  return (
                    <Card key={pillar.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black ${PILLAR_COLOR_MAP[pillar.color] ?? ""}`}>
                            {pillar.name[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{pillar.name}</p>
                            {pillar.description && <p className="text-xs text-muted-foreground">{pillar.description}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{published}</p>
                            <p className="text-xs text-muted-foreground">{count} total</p>
                          </div>
                          <Button size="icon-sm" variant="ghost" onClick={() => update((s) => ({ ...s, pillars: s.pillars.filter((p) => p.id !== pillar.id) }))} className="text-muted-foreground hover:text-destructive">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
            {/* Distribution */}
            {pillarDistribution.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Published Content Distribution</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {pillarDistribution.map((d) => (
                    <div key={d.id} className="flex items-center gap-3">
                      <span className="text-sm w-32 truncate">{d.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${PILLAR_COLOR_MAP[d.color]?.split(" ")[0] ?? "bg-fuchsia-500"}`} style={{ width: `${d.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground w-10 text-right">{d.pct}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div className="space-y-4 max-w-lg">
            <h2 className="text-xl font-bold">Settings</h2>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ghost Integration</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Connect your Ghost blog to publish drafts directly from the calendar.</p>
                <div>
                  <label className="text-xs font-medium block mb-1">Ghost Admin API URL</label>
                  <Input placeholder="https://yourblog.ghost.io" value={ghostUrl} onChange={(e) => setGhostUrl(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Admin API Key (id:secret)</label>
                  <Input type="password" placeholder="64hex:64hex" value={ghostKey} onChange={(e) => setGhostKey(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Find in Ghost Admin → Settings → Integrations → Add custom integration</p>
                </div>
                <Button size="sm" onClick={() => {
                  update((s) => ({ ...s, ghostConfig: ghostUrl && ghostKey ? { apiUrl: ghostUrl, adminKey: ghostKey } : undefined }))
                  toast.success("Ghost config saved")
                }}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
