"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  List, Plus, Sparkles, Loader2, X, Check, ExternalLink,
  Search, Clock, Tag, BookOpen, Zap, Shuffle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type ReadingItem, type ReadingStore, type ReadingStatus,
  STATUS_LABELS, STATUS_COLORS, estimateReadingTime, extractDomain, faviconUrl,
} from "./types"
import { TokenConnect } from "@/components/shared/connect-button"

const STORAGE_KEY = "reading-list-v1"

function loadStore(): ReadingStore {
  if (typeof window === "undefined") return { items: [] }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { items: [] } }
  catch { return { items: [] } }
}
function saveStore(s: ReadingStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type GroupBy = "status" | "domain" | "tag" | "readingTime"
type SortBy = "dateAdded" | "readingTime" | "title"

export function ReadingListContent() {
  const [store, setStore] = useState<ReadingStore>({ items: [] })
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<ReadingStatus | "all">("all")
  const [groupBy, setGroupBy] = useState<GroupBy>("status")
  const [sortBy, setSortBy] = useState<SortBy>("dateAdded")
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showReadwise, setShowReadwise] = useState(false)

  // Add form
  const [addUrl, setAddUrl] = useState("")
  const [addTitle, setAddTitle] = useState("")
  const [addDesc, setAddDesc] = useState("")
  const [addTags, setAddTags] = useState("")
  const [fetchingMeta, setFetchingMeta] = useState(false)

  // Import
  const [importHtml, setImportHtml] = useState("")
  const [readwiseToken, setReadwiseToken] = useState("")
  const [rwLoading, setRwLoading] = useState(false)

  // Summarize loading state per item
  const [summarizingId, setSummarizingId] = useState<string | null>(null)

  // Daily picks (3 random unread, weighted toward older)
  const [dailyPicks, setDailyPicks] = useState<ReadingItem[]>([])

  useEffect(() => {
    const s = loadStore()
    setStore(s)
    const storedToken = localStorage.getItem("readwise-token") || s.readwiseToken || ""
    if (storedToken) setReadwiseToken(storedToken)
    // Pick 3 unread for today (stable per day via date seed)
    const unread = s.items.filter((i) => i.status === "unread")
    if (unread.length > 0) {
      // Weight older items higher
      const sorted = [...unread].sort((a, b) => a.dateAdded.localeCompare(b.dateAdded))
      const picks = sorted.slice(0, Math.min(3, sorted.length))
      setDailyPicks(picks)
    }
  }, [])

  function update(fn: (s: ReadingStore) => ReadingStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  async function fetchMeta() {
    if (!addUrl.trim()) return
    setFetchingMeta(true)
    try {
      const url = addUrl.startsWith("http") ? addUrl : `https://${addUrl}`
      const res = await fetch("/api/reading-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-meta", url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      if (data.data.title) setAddTitle(data.data.title)
      if (data.data.description) setAddDesc(data.data.description)

      // Auto-suggest tags
      if (data.data.title) {
        const tagRes = await fetch("/api/reading-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "suggest-tags", title: data.data.title, description: data.data.description }),
        })
        const tagData = await tagRes.json()
        if (tagRes.ok && tagData.data?.tags) setAddTags(tagData.data.tags.join(", "))
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to fetch metadata") }
    setFetchingMeta(false)
  }

  function addItem() {
    const url = addUrl.startsWith("http") ? addUrl : `https://${addUrl}`
    if (!url.trim() || !addTitle.trim()) { toast.error("URL and title required"); return }
    const domain = extractDomain(url)
    const item: ReadingItem = {
      id: crypto.randomUUID(), url, title: addTitle.trim(),
      description: addDesc.trim() || undefined, domain,
      tags: addTags.split(",").map((t) => t.trim()).filter(Boolean),
      status: "unread", dateAdded: new Date().toISOString(),
    }
    update((s) => ({ ...s, items: [item, ...s.items] }))
    setAddUrl(""); setAddTitle(""); setAddDesc(""); setAddTags("")
    setShowAddForm(false)
    toast.success("Added to reading list")
  }

  function setStatus(id: string, status: ReadingStatus) {
    update((s) => ({ ...s, items: s.items.map((i) => i.id === id ? { ...i, status } : i) }))
  }

  function deleteItem(id: string) {
    update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id) }))
  }

  async function summarize(item: ReadingItem) {
    if (item.aiSummary) return // already cached
    setSummarizingId(item.id)
    try {
      const res = await fetch("/api/reading-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summarize", url: item.url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      update((s) => ({
        ...s,
        items: s.items.map((i) => i.id === item.id ? { ...i, aiSummary: data.data.summary, summaryGeneratedAt: new Date().toISOString() } : i),
      }))
      toast.success("Summary generated")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setSummarizingId(null)
  }

  function parseBrowserBookmarks(html: string): ReadingItem[] {
    const items: ReadingItem[] = []
    const matches = html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi)
    for (const match of matches) {
      const url = match[1]
      const title = match[2]?.trim()
      if (!url || !url.startsWith("http") || !title) continue
      items.push({
        id: crypto.randomUUID(), url, title,
        domain: extractDomain(url), tags: [], status: "unread",
        dateAdded: new Date().toISOString(),
      })
    }
    return items
  }

  function importBookmarks() {
    const items = parseBrowserBookmarks(importHtml)
    if (items.length === 0) { toast.error("No valid links found in HTML"); return }
    update((s) => ({ ...s, items: [...items, ...s.items] }))
    setImportHtml("")
    setShowImport(false)
    toast.success(`Imported ${items.length} items`)
  }

  async function syncReadwise() {
    if (!readwiseToken.trim()) { toast.error("Enter your Readwise token"); return }
    setRwLoading(true)
    try {
      const res = await fetch("/api/reading-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "readwise-import", token: readwiseToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const highlights = data.data as {id:number; text:string; title?:string; author?:string; source_url?:string}[]
      const newItems: ReadingItem[] = highlights
        .filter((h) => h.source_url)
        .reduce((acc: ReadingItem[], h) => {
          const exists = acc.find((i) => i.url === h.source_url)
          if (!exists) {
            acc.push({
              id: crypto.randomUUID(),
              url: h.source_url!,
              title: h.title ?? h.source_url!,
              domain: extractDomain(h.source_url!),
              tags: ["readwise"],
              status: "done",
              author: h.author,
              dateAdded: new Date().toISOString(),
              highlightCount: highlights.filter((x) => x.source_url === h.source_url).length,
            })
          }
          return acc
        }, [])
      update((s) => {
        const existingUrls = new Set(s.items.map((i) => i.url))
        const fresh = newItems.filter((i) => !existingUrls.has(i.url))
        return { ...s, items: [...fresh, ...s.items], readwiseToken }
      })
      toast.success(`Synced ${newItems.length} articles from Readwise`)
      setShowReadwise(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : "Readwise sync failed") }
    setRwLoading(false)
  }

  // ── Filtered & sorted ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = store.items
    if (filterStatus !== "all") result = result.filter((i) => i.status === filterStatus)
    if (search) {
      const s = search.toLowerCase()
      result = result.filter((i) =>
        i.title.toLowerCase().includes(s) ||
        i.description?.toLowerCase().includes(s) ||
        i.tags.some((t) => t.toLowerCase().includes(s)) ||
        i.domain.toLowerCase().includes(s) ||
        i.aiSummary?.toLowerCase().includes(s)
      )
    }
    return [...result].sort((a, b) => {
      if (sortBy === "dateAdded") return b.dateAdded.localeCompare(a.dateAdded)
      if (sortBy === "readingTime") return (b.readingTimeMin ?? 0) - (a.readingTimeMin ?? 0)
      return a.title.localeCompare(b.title)
    })
  }, [store.items, filterStatus, search, sortBy])

  // Grouped
  const grouped = useMemo(() => {
    if (groupBy === "status") {
      const map = new Map<string, ReadingItem[]>()
      ;(["unread","reading","done","archived"] as ReadingStatus[]).forEach((s) => {
        const items = filtered.filter((i) => i.status === s)
        if (items.length > 0) map.set(STATUS_LABELS[s], items)
      })
      return map
    }
    if (groupBy === "domain") {
      const map = new Map<string, ReadingItem[]>()
      filtered.forEach((i) => map.set(i.domain, [...(map.get(i.domain) ?? []), i]))
      return new Map([...map.entries()].sort((a,b) => b[1].length - a[1].length))
    }
    if (groupBy === "tag") {
      const map = new Map<string, ReadingItem[]>()
      filtered.forEach((i) => {
        if (i.tags.length === 0) map.set("Untagged", [...(map.get("Untagged") ?? []), i])
        else i.tags.forEach((t) => map.set(t, [...(map.get(t) ?? []), i]))
      })
      return map
    }
    // readingTime
    const map = new Map<string, ReadingItem[]>()
    const quick = filtered.filter((i) => (i.readingTimeMin ?? 5) < 5)
    const medium = filtered.filter((i) => { const t = i.readingTimeMin ?? 5; return t >= 5 && t <= 15 })
    const long = filtered.filter((i) => (i.readingTimeMin ?? 5) > 15)
    if (quick.length) map.set("Quick reads (<5 min)", quick)
    if (medium.length) map.set("Medium (5-15 min)", medium)
    if (long.length) map.set("Long reads (15+ min)", long)
    return map
  }, [filtered, groupBy])

  function ArticleCard({ item }: { item: ReadingItem }) {
    const rt = item.readingTimeMin ?? (item.wordCount ? estimateReadingTime(item.wordCount) : undefined)
    const [showSummary, setShowSummary] = useState(false)
    return (
      <Card className="group hover:shadow-md transition-shadow">
        <CardContent className="py-3">
          {item.ogImage && !item.ogImage.startsWith("data:") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.ogImage} alt="" className="w-full h-24 object-cover rounded-lg mb-3" onError={(e) => (e.currentTarget.style.display="none")} />
          )}
          <div className="flex items-start gap-3">
            {/* Favicon */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={faviconUrl(item.domain)} alt="" width={16} height={16} className="mt-0.5 shrink-0 rounded-sm" onError={(e) => (e.currentTarget.style.display="none")} />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2">
                <a href={item.url} target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-sm hover:text-indigo-400 transition-colors flex-1 leading-snug">
                  {item.title}
                </a>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{item.domain}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>}

              {/* Summary */}
              {showSummary && item.aiSummary && (
                <div className="mt-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <p className="text-xs text-muted-foreground">{item.aiSummary}</p>
                </div>
              )}

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[item.status]}`}>{STATUS_LABELS[item.status]}</Badge>
                {rt && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />{rt} min
                  </span>
                )}
                {item.tags.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs bg-indigo-500/20 text-indigo-400 cursor-pointer" onClick={() => setSearch(t)}>
                    {t}
                  </Badge>
                ))}
                {item.highlightCount && <span className="text-xs text-muted-foreground">{item.highlightCount} highlights</span>}
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity flex-wrap">
            <select
              value={item.status}
              onChange={(e) => setStatus(item.id, e.target.value as ReadingStatus)}
              className="h-6 text-xs rounded border border-input bg-background px-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {(["unread","reading","done","archived"] as ReadingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <Button size="xs" variant="ghost" onClick={() => {
              setShowSummary(!showSummary)
              if (!item.aiSummary) summarize(item)
            }} disabled={summarizingId === item.id}>
              {summarizingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
              {item.aiSummary ? (showSummary ? "Hide" : "Summary") : "Summarize"}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => deleteItem(item.id)} className="text-muted-foreground hover:text-destructive ml-auto">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = useMemo(() => ({
    total: store.items.length,
    unread: store.items.filter((i) => i.status === "unread").length,
    done: store.items.filter((i) => i.status === "done").length,
    quickReads: store.items.filter((i) => i.status === "unread" && (i.readingTimeMin ?? 5) < 5).length,
  }), [store.items])

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Reading List"
        icon={List}
        color="text-indigo-500"
        badge="Education"
        actions={
          <Button size="sm" onClick={() => { setShowAddForm(!showAddForm); setAddUrl(""); setAddTitle(""); setAddDesc(""); setAddTags("") }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Article
          </Button>
        }
      />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full space-y-6">
        {/* Stats */}
        {store.items.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total", value: stats.total, icon: <BookOpen className="w-4 h-4" /> },
              { label: "Unread", value: stats.unread, icon: <List className="w-4 h-4 text-blue-400" /> },
              { label: "Done", value: stats.done, icon: <Check className="w-4 h-4 text-green-400" /> },
              { label: "Quick reads", value: stats.quickReads, icon: <Zap className="w-4 h-4 text-amber-400" /> },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="py-3 flex items-center gap-2">
                  {s.icon}
                  <div>
                    <p className="text-xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Daily picks */}
        {dailyPicks.length > 0 && (
          <Card className="border-indigo-500/30 bg-indigo-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shuffle className="w-4 h-4 text-indigo-400" />
                Today&apos;s Picks
                <Badge variant="secondary" className="text-xs ml-auto">3 random unread</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dailyPicks.map((item) => (
                <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-500/10 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={faviconUrl(item.domain)} alt="" width={14} height={14} className="shrink-0 rounded-sm" />
                  <span className="text-sm flex-1 truncate">{item.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{item.domain}</span>
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Add form */}
        {showAddForm && (
          <Card className="border-indigo-500/30">
            <CardContent className="pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && fetchMeta()}
                />
                <Button size="sm" variant="outline" onClick={fetchMeta} disabled={fetchingMeta || !addUrl.trim()}>
                  {fetchingMeta ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Title *</label>
                  <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Article title" />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Tags (auto-suggested, comma-separated)</label>
                  <Input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="react, tutorial, performance" />
                </div>
              </div>
              {addDesc && <p className="text-xs text-muted-foreground border rounded-lg p-2 bg-muted/30">{addDesc}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={addItem}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, tags, summaries..." className="pl-9" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as ReadingStatus | "all")} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
            <option value="all">All statuses</option>
            {(["unread","reading","done","archived"] as ReadingStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
            <option value="status">Group by status</option>
            <option value="domain">Group by domain</option>
            <option value="tag">Group by tag</option>
            <option value="readingTime">Group by reading time</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="h-8 rounded-md border border-input bg-background px-3 text-sm">
            <option value="dateAdded">Newest first</option>
            <option value="readingTime">By reading time</option>
            <option value="title">Alphabetical</option>
          </select>
          <Button size="sm" variant="outline" onClick={() => setShowImport(!showImport)}>
            <BookOpen className="w-3.5 h-3.5 mr-1" /> Import
          </Button>
        </div>

        {/* Import from browser */}
        {showImport && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Import Browser Bookmarks</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Chrome:</strong> Bookmarks → ⋮ → Bookmarks manager → ⋮ → Export bookmarks</p>
                <p><strong>Firefox:</strong> Bookmarks → Manage bookmarks → Import and backup → Export bookmarks to HTML</p>
                <p>Then paste the exported HTML file content below:</p>
              </div>
              <Textarea value={importHtml} onChange={(e) => setImportHtml(e.target.value)} rows={6} placeholder="Paste bookmark HTML here..." />
              <div className="flex gap-2">
                <Button size="sm" onClick={importBookmarks}><Check className="w-3.5 h-3.5 mr-1" /> Import</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowImport(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Readwise */}
        <Card className="border-dashed">
          <CardContent className="py-3 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400">Readwise</Badge>
              <p className="text-sm font-medium">Sync highlights from Readwise</p>
            </div>
            <TokenConnect
              serviceName="Readwise"
              storageKey="readwise-token"
              placeholder="Paste Readwise access token"
              helpUrl="https://readwise.io/access_token"
              helpText="Get your Readwise access token"
              onConnected={(token) => setReadwiseToken(token)}
              onDisconnected={() => setReadwiseToken("")}
              description="Import articles you've highlighted in Readwise Reader."
            />
            <Button size="sm" onClick={syncReadwise} disabled={rwLoading || !readwiseToken}>
              {rwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Zap className="w-3.5 h-3.5 mr-1" />Sync</>}
            </Button>
          </CardContent>
        </Card>

        {/* Article list */}
        {store.items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <List className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="font-medium text-foreground text-lg">Your reading list is empty</p>
            <p className="text-sm mt-1">Add articles by URL, import bookmarks, or sync from Readwise</p>
            <Button className="mt-4" size="sm" onClick={() => setShowAddForm(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Article</Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground"><p>No articles match your filters</p></div>
        ) : (
          Array.from(grouped.entries()).map(([group, items]) => (
            <div key={group} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group}</h3>
                <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => <ArticleCard key={item.id} item={item} />)}
              </div>
            </div>
          ))
        )}

        {/* Tag cloud */}
        {store.items.length > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">All Tags</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(store.items.flatMap((i) => i.tags))).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSearch(tag)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors hover:border-indigo-500/50 ${search === tag ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "border-border text-muted-foreground"}`}
                >
                  {tag}
                </button>
              ))}
              {store.items.flatMap((i) => i.tags).length === 0 && <p className="text-xs text-muted-foreground">No tags yet</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
