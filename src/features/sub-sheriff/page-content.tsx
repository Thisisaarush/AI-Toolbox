"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  CreditCard, Plus, Trash2, ExternalLink, AlertTriangle,
  TrendingDown, BarChart3, Calendar, ChevronDown, ChevronUp,
  Sparkles, Download, Search, X, Check, Loader2, Mail,
  Star, Tag, Ban, Clock, TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  CATEGORY_META, BILLING_CYCLE_LABELS, formatCurrency, daysUntilRenewal, toMonthly,
  type Subscription, type Category, type BillingCycle, type UsageStatus, type ParsedSubscription,
  type PriceHistoryEntry,
} from "./types"
import { lookupService } from "./service-db"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "sub-sheriff-v1"

function load(): Subscription[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch { return [] }
}
function save(subs: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
}

type View = "dashboard" | "import" | "add" | "detail" | "edit-sub"
type DashTab = "all" | "cancel-queue" | "groups"
type SortKey = "name" | "amount" | "renewal" | "added"
type QuickFilter = "all" | "active" | "unused" | "rarely" | "due-soon"

const USAGE_OPTIONS: { value: UsageStatus; label: string; color: string }[] = [
  { value: "active",  label: "Active",       color: "text-green-600" },
  { value: "rarely",  label: "Rarely used",  color: "text-amber-600" },
  { value: "unused",  label: "Not using",    color: "text-red-600" },
]

// ── Monthly spend forecast helpers ──────────────────────────────────────────

function getMonthForecast(subs: Subscription[]): { forecast: number; lastMonth: number } {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const daysInMonth = endOfMonth.getDate()
  const dayOfMonth = now.getDate()

  // Start of last month
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

  let forecast = 0
  let lastMonth = 0

  for (const s of subs) {
    if (s.billingCycle === "one-time") continue
    const monthly = s.amount

    // Forecast: prorate annual subs by remaining days in month
    if (s.billingCycle === "annual" && s.renewalDate) {
      const renewal = new Date(s.renewalDate)
      // If annual renewal falls this month, count full annual amount
      if (renewal >= startOfMonth && renewal <= endOfMonth) {
        forecast += s.rawAmount
      } else {
        // Otherwise count monthly prorated
        forecast += monthly
      }
    } else {
      // Monthly/quarterly/weekly: scale by days remaining vs full month
      const remaining = daysInMonth - dayOfMonth + 1
      forecast += monthly * (remaining / daysInMonth)
    }

    // Last month: was this sub active last month?
    const createdAt = new Date(s.createdAt)
    if (createdAt <= endOfLastMonth) {
      lastMonth += monthly
    } else if (createdAt >= startOfLastMonth && createdAt <= endOfLastMonth) {
      // Partial: pro-rate by day of month created
      const dayCreated = createdAt.getDate()
      const daysLastMonth = endOfLastMonth.getDate()
      lastMonth += monthly * ((daysLastMonth - dayCreated + 1) / daysLastMonth)
    }
  }

  return { forecast, lastMonth }
}

// ── Spending by month (last 6 months) ───────────────────────────────────────

interface MonthData {
  label: string
  amount: number
}

function getSpendingByMonth(subs: Subscription[]): MonthData[] {
  const now = new Date()
  const months: MonthData[] = []

  for (let i = 5; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    const label = month.toLocaleDateString("en-US", { month: "short", year: "2-digit" })

    let amount = 0
    for (const s of subs) {
      if (s.billingCycle === "one-time") continue
      const created = new Date(s.createdAt)
      // Sub was active before end of this month
      if (created <= monthEnd) {
        amount += s.amount
      }
    }
    months.push({ label, amount })
  }

  return months
}

// ── Cancel queue helpers ─────────────────────────────────────────────────────

function getCancelQueue(subs: Subscription[]): Subscription[] {
  return subs.filter((s) => {
    if (s.usageStatus === "unused") return true
    if (s.usageStatus === "rarely" && s.amount > 10) return true
    if (s.usageStatus === "rarely" && s.renewalDate && daysUntilRenewal(s.renewalDate) <= 14) return true
    return false
  })
}

// ── Groups (by tag) ──────────────────────────────────────────────────────────

interface GroupData {
  name: string
  total: number
  subs: Subscription[]
}

function getGroups(subs: Subscription[]): GroupData[] {
  const map = new Map<string, Subscription[]>()
  for (const s of subs) {
    if (!s.tags || s.tags.length === 0) {
      const g = map.get("(untagged)") ?? []
      g.push(s)
      map.set("(untagged)", g)
    } else {
      for (const tag of s.tags) {
        const g = map.get(tag) ?? []
        g.push(s)
        map.set(tag, g)
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, subsInGroup]) => ({
      name,
      total: subsInGroup.reduce((acc, s) => acc + s.amount, 0),
      subs: subsInGroup,
    }))
    .sort((a, b) => b.total - a.total)
}

export function SubSheriffContent() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [view, setView] = useState<View>("dashboard")
  const [dashTab, setDashTab] = useState<DashTab>("all")
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [filterUsage, setFilterUsage] = useState<UsageStatus | "all">("all")
  const [filterTag, setFilterTag] = useState<string | "all">("all")
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all")
  const [sortKey, setSortKey] = useState<SortKey>("amount")
  const [sortDesc, setSortDesc] = useState(true)

  // Import state
  const [emailText, setEmailText] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [parsedResults, setParsedResults] = useState<(ParsedSubscription & { selected: boolean })[]>([])

  // Add / edit form state
  const [editingSubId, setEditingSubId] = useState<string | null>(null)
  const [addName, setAddName] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addCycle, setAddCycle] = useState<BillingCycle>("monthly")
  const [addCategory, setAddCategory] = useState<Category>("other")
  const [addRenewal, setAddRenewal] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [addRoiNote, setAddRoiNote] = useState("")
  const [addTagsInput, setAddTagsInput] = useState("")

  useEffect(() => { setSubs(load()) }, [])
  useEffect(() => { save(subs) }, [subs])

  // ── Computed ──────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalMonthly = subs.reduce((acc, s) => acc + s.amount, 0)
    const byCategory: Partial<Record<Category, number>> = {}
    subs.forEach((s) => {
      byCategory[s.category] = (byCategory[s.category] ?? 0) + s.amount
    })
    const unusedMonthly = subs
      .filter((s) => s.usageStatus === "unused")
      .reduce((acc, s) => acc + s.amount, 0)
    const rarelyMonthly = subs
      .filter((s) => s.usageStatus === "rarely")
      .reduce((acc, s) => acc + s.amount, 0)

    const duplicates = Object.entries(byCategory)
      .filter(([cat]) => {
        const catSubs = subs.filter((s) => s.category === cat)
        return catSubs.length >= 2
      })
      .map(([cat]) => cat as Category)

    const upcomingRenewals = subs
      .filter((s) => s.renewalDate && daysUntilRenewal(s.renewalDate) <= 30)
      .sort((a, b) =>
        new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime()
      )

    const { forecast, lastMonth } = getMonthForecast(subs)
    const spendingByMonth = getSpendingByMonth(subs)
    const cancelQueue = getCancelQueue(subs)
    const groups = getGroups(subs)

    // All unique tags
    const allTags = Array.from(
      new Set(subs.flatMap((s) => s.tags ?? []))
    ).sort()

    return {
      totalMonthly,
      totalAnnual: totalMonthly * 12,
      byCategory: byCategory as Record<Category, number>,
      unusedMonthly,
      rarelyMonthly,
      savingsIfCancelled: unusedMonthly,
      duplicates,
      upcomingRenewals,
      count: subs.length,
      forecast,
      lastMonth,
      spendingByMonth,
      cancelQueue,
      groups,
      allTags,
    }
  }, [subs])

  const filtered = useMemo(() => {
    let result = [...subs]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q))
      )
    }
    if (filterCategory !== "all") result = result.filter((s) => s.category === filterCategory)
    if (filterUsage !== "all") result = result.filter((s) => s.usageStatus === filterUsage)
    if (filterTag !== "all") result = result.filter((s) => (s.tags ?? []).includes(filterTag))

    // Quick filter
    if (quickFilter === "active") result = result.filter((s) => s.usageStatus === "active")
    if (quickFilter === "unused") result = result.filter((s) => s.usageStatus === "unused")
    if (quickFilter === "rarely") result = result.filter((s) => s.usageStatus === "rarely")
    if (quickFilter === "due-soon") result = result.filter((s) => s.renewalDate && daysUntilRenewal(s.renewalDate) <= 14)

    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === "name")    cmp = a.name.localeCompare(b.name)
      if (sortKey === "amount")  cmp = a.amount - b.amount
      if (sortKey === "renewal") cmp = (a.renewalDate ?? "").localeCompare(b.renewalDate ?? "")
      if (sortKey === "added")   cmp = a.createdAt.localeCompare(b.createdAt)
      return sortDesc ? -cmp : cmp
    })
    return result
  }, [subs, search, filterCategory, filterUsage, filterTag, quickFilter, sortKey, sortDesc])

  // ── Actions ───────────────────────────────────────────────────────────────
  function updateUsage(id: string, status: UsageStatus) {
    setSubs((prev) => prev.map((s) =>
      s.id === id ? { ...s, usageStatus: status, updatedAt: new Date().toISOString() } : s
    ))
    if (selectedSub?.id === id) setSelectedSub((p) => p ? { ...p, usageStatus: status } : p)
    toast.success(`Marked as "${USAGE_OPTIONS.find((o) => o.value === status)?.label}"`)
  }

  function deleteSub(id: string) {
    setSubs((prev) => prev.filter((s) => s.id !== id))
    if (selectedSub?.id === id) { setSelectedSub(null); setView("dashboard") }
    toast.success("Subscription removed")
  }

  function openEdit(sub: Subscription) {
    setEditingSubId(sub.id)
    setAddName(sub.name)
    setAddAmount(String(sub.rawAmount))
    setAddCycle(sub.billingCycle)
    setAddCategory(sub.category)
    setAddRenewal(sub.renewalDate ?? "")
    setAddUrl(sub.url ?? "")
    setAddNotes(sub.notes ?? "")
    setAddRoiNote(sub.roiNote ?? "")
    setAddTagsInput((sub.tags ?? []).join(", "))
    setView("edit-sub")
  }

  function saveEdit() {
    if (!editingSubId) return
    if (!addName.trim() || !addAmount) { toast.error("Name and amount are required"); return }
    const raw = parseFloat(addAmount)
    if (isNaN(raw)) { toast.error("Invalid amount"); return }

    // Find existing sub to check if amount changed
    const existingSub = subs.find((s) => s.id === editingSubId)
    const newTags = addTagsInput.split(",").map((t) => t.trim()).filter(Boolean)

    // Build price history entry if amount changed
    let priceHistory: PriceHistoryEntry[] | undefined = existingSub?.priceHistory
    if (existingSub && existingSub.rawAmount !== raw) {
      const entry: PriceHistoryEntry = {
        amount: existingSub.rawAmount,
        date: new Date().toISOString().slice(0, 10),
      }
      priceHistory = [...(existingSub.priceHistory ?? []), entry]
    }

    const patch = {
      name: addName.trim(),
      url: addUrl || undefined,
      rawAmount: raw,
      amount: toMonthly(raw, addCycle),
      billingCycle: addCycle,
      category: addCategory,
      renewalDate: addRenewal || undefined,
      notes: addNotes || undefined,
      roiNote: addRoiNote || undefined,
      tags: newTags.length > 0 ? newTags : undefined,
      priceHistory,
      updatedAt: new Date().toISOString(),
    }
    setSubs((prev) => prev.map((s) => s.id === editingSubId ? { ...s, ...patch } : s))
    if (selectedSub?.id === editingSubId) {
      setSelectedSub((p) => p ? { ...p, ...patch } : p)
    }
    setEditingSubId(null)
    setAddName(""); setAddAmount(""); setAddCycle("monthly")
    setAddCategory("other"); setAddRenewal(""); setAddUrl(""); setAddNotes("")
    setAddRoiNote(""); setAddTagsInput("")
    toast.success("Subscription updated")
    setView("detail")
  }

  function addSub() {
    if (!addName.trim() || !addAmount) {
      toast.error("Name and amount are required")
      return
    }
    const raw = parseFloat(addAmount)
    if (isNaN(raw)) { toast.error("Invalid amount"); return }
    const db = lookupService(addName)
    const now = new Date().toISOString()
    const newTags = addTagsInput.split(",").map((t) => t.trim()).filter(Boolean)
    const sub: Subscription = {
      id: crypto.randomUUID(),
      name: addName.trim(),
      url: addUrl || db?.cancelUrl?.split("/")[0] || undefined,
      amount: toMonthly(raw, addCycle),
      rawAmount: raw,
      billingCycle: addCycle,
      category: addCategory,
      usageStatus: "active",
      renewalDate: addRenewal || undefined,
      cancelUrl: db?.cancelUrl,
      notes: addNotes || undefined,
      roiNote: addRoiNote || undefined,
      tags: newTags.length > 0 ? newTags : undefined,
      createdAt: now,
      updatedAt: now,
    }
    setSubs((prev) => [sub, ...prev])
    setAddName(""); setAddAmount(""); setAddCycle("monthly")
    setAddCategory("other"); setAddRenewal(""); setAddUrl(""); setAddNotes("")
    setAddRoiNote(""); setAddTagsInput("")
    toast.success(`${sub.name} added`)
    setView("dashboard")
  }

  async function handleParse() {
    if (!emailText.trim()) { toast.error("Paste email content first"); return }
    setIsParsing(true)
    setParsedResults([])
    try {
      const res = await aiFetch("/api/sub-sheriff/parse", { emailText })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Parse failed")
      const results = (data.subscriptions ?? []).map((s: ParsedSubscription) => ({
        ...s,
        selected: true,
      }))
      setParsedResults(results)
      if (results.length === 0) toast.info("No subscriptions detected in this email")
      else toast.success(`Found ${results.length} subscription${results.length !== 1 ? "s" : ""}`)
    } catch (err: unknown) {
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setIsParsing(false)
        return
      }
      toast.error(err instanceof Error ? err.message : "Parse failed")
    }
    setIsParsing(false)
  }

  function importSelected() {
    const toImport = parsedResults.filter((r) => r.selected)
    if (toImport.length === 0) { toast.error("Select at least one subscription"); return }
    const now = new Date().toISOString()
    const newSubs: Subscription[] = toImport.map((r) => ({
      id: crypto.randomUUID(),
      name: r.name,
      url: r.url,
      amount: toMonthly(r.rawAmount, r.billingCycle),
      rawAmount: r.rawAmount,
      billingCycle: r.billingCycle,
      category: r.category,
      usageStatus: "active" as UsageStatus,
      renewalDate: r.renewalDate,
      cancelUrl: r.cancelUrl,
      createdAt: now,
      updatedAt: now,
    }))
    setSubs((prev) => {
      const existingNames = new Set(prev.map((s) => s.name.toLowerCase()))
      const unique = newSubs.filter((s) => !existingNames.has(s.name.toLowerCase()))
      return [...unique, ...prev]
    })
    setParsedResults([])
    setEmailText("")
    toast.success(`Imported ${newSubs.length} subscription${newSubs.length !== 1 ? "s" : ""}`)
    setView("dashboard")
  }

  function exportCsv() {
    const rows = [
      ["Name", "Monthly ($)", "Billed Amount", "Cycle", "Category", "Usage", "Next Renewal", "Cancel URL", "Tags", "ROI Note"],
      ...subs.map((s) => [
        s.name,
        s.amount.toFixed(2),
        s.rawAmount.toFixed(2),
        s.billingCycle,
        CATEGORY_META[s.category].label,
        s.usageStatus,
        s.renewalDate ?? "",
        s.cancelUrl ?? "",
        (s.tags ?? []).join(";"),
        s.roiNote ?? "",
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `sub-sheriff-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("CSV exported")
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDesc((p) => !p)
    else { setSortKey(key); setSortDesc(true) }
  }

  const SortIcon = useCallback(({ k }: { k: SortKey }) => {
    if (sortKey !== k) return null
    return sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />
  }, [sortKey, sortDesc])

  function clearFilters() {
    setFilterCategory("all")
    setFilterUsage("all")
    setFilterTag("all")
    setSearch("")
    setQuickFilter("all")
  }

  const hasActiveFilters = filterCategory !== "all" || filterUsage !== "all" || filterTag !== "all" || search || quickFilter !== "all"

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Sub Sheriff"
        icon={CreditCard}
        color="text-red-500"
        badge="Finance"
        actions={
          <div className="flex gap-2">
            {view !== "dashboard" ? (
              <Button variant="outline" size="sm" onClick={() => {
                if (view === "edit-sub") { setView("detail"); return }
                setView("dashboard"); setParsedResults([])
              }}>
                ← Back
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setView("import")}>
                  <Mail className="w-3.5 h-3.5 mr-1" /> Scan Email
                </Button>
                <Button variant="outline" size="sm" onClick={() => setView("add")}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
                {subs.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={exportCsv}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── Dashboard ──────────────────────────────────────────────────── */}
        {view === "dashboard" && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold mb-1">Sub Sheriff</h1>
              <p className="text-muted-foreground">Every subscription you&apos;re paying for, on one screen.</p>
            </div>

            {subs.length === 0 ? (
              <Card className="max-w-lg mx-auto mt-16">
                <CardContent className="py-16 text-center">
                  <CreditCard className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h2 className="text-xl font-semibold mb-2">No subscriptions yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    Scan your inbox to find them automatically, or add them manually.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={() => setView("import")}>
                      <Mail className="w-4 h-4 mr-1" /> Scan Email
                    </Button>
                    <Button variant="outline" onClick={() => setView("add")}>
                      <Plus className="w-4 h-4 mr-1" /> Add Manually
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                  <SummaryCard
                    label="Monthly spend"
                    value={formatCurrency(summary.totalMonthly)}
                    sub={`${formatCurrency(summary.totalAnnual)}/yr`}
                    icon={<CreditCard className="w-4 h-4" />}
                    color="text-red-500"
                    gradient="from-red-500/10 to-transparent"
                  />
                  <SummaryCard
                    label="This month forecast"
                    value={formatCurrency(summary.forecast)}
                    sub={
                      summary.lastMonth > 0
                        ? `${summary.forecast >= summary.lastMonth ? "+" : ""}${formatCurrency(summary.forecast - summary.lastMonth)} vs last mo`
                        : "projected"
                    }
                    icon={<TrendingUp className="w-4 h-4" />}
                    color="text-blue-500"
                    gradient="from-blue-500/10 to-transparent"
                  />
                  <SummaryCard
                    label="Subscriptions"
                    value={String(summary.count)}
                    sub="tracked"
                    icon={<BarChart3 className="w-4 h-4" />}
                    color="text-violet-500"
                    gradient="from-violet-500/10 to-transparent"
                  />
                  <SummaryCard
                    label="Unused waste"
                    value={formatCurrency(summary.unusedMonthly)}
                    sub="could cancel"
                    icon={<TrendingDown className="w-4 h-4" />}
                    color="text-red-500"
                    highlight={summary.unusedMonthly > 0}
                    gradient="from-red-500/10 to-transparent"
                  />
                  <SummaryCard
                    label="Renewing soon"
                    value={String(summary.upcomingRenewals.length)}
                    sub="in 30 days"
                    icon={<Calendar className="w-4 h-4" />}
                    color="text-amber-500"
                    highlight={summary.upcomingRenewals.length > 0}
                    gradient="from-amber-500/10 to-transparent"
                  />
                </div>

                {/* Alerts */}
                {(summary.unusedMonthly > 0 || summary.rarelyMonthly > 0 || summary.duplicates.length > 0) && (
                  <div className="space-y-2">
                    {summary.unusedMonthly > 0 && (
                      <Alert
                        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                        message={`You're paying ${formatCurrency(summary.unusedMonthly)}/mo for subscriptions you marked "Not using" — that's ${formatCurrency(summary.unusedMonthly * 12)}/yr.`}
                        action="Review unused"
                        onAction={() => { setQuickFilter("unused"); setDashTab("all") }}
                      />
                    )}
                    {summary.rarelyMonthly > 0 && (
                      <Alert
                        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                        message={`${formatCurrency(summary.rarelyMonthly)}/mo on subscriptions you "Rarely use" — consider downgrading or cancelling.`}
                        action="Review rarely used"
                        onAction={() => { setQuickFilter("rarely"); setDashTab("all") }}
                      />
                    )}
                    {summary.duplicates.length > 0 && (
                      <Alert
                        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                        message={`Possible duplicates in: ${summary.duplicates.map((c) => CATEGORY_META[c].label).join(", ")}. You have 2+ subscriptions in the same category.`}
                        action="Review"
                        onAction={() => setFilterCategory(summary.duplicates[0]!)}
                      />
                    )}
                  </div>
                )}

                {/* Upcoming renewals */}
                {summary.upcomingRenewals.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-500" /> Upcoming renewals (30 days)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {summary.upcomingRenewals.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { setSelectedSub(s); setView("detail") }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                          >
                            <span className="font-medium">{s.name}</span>
                            <span className="text-muted-foreground">{formatCurrency(s.amount)}/mo</span>
                            <Badge variant="outline" className="text-[10px]">
                              {daysUntilRenewal(s.renewalDate!) === 0
                                ? "Today"
                                : `${daysUntilRenewal(s.renewalDate!)}d`}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Spending trends chart */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" /> Spending by month (last 6 months)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SpendingChart data={summary.spendingByMonth} />
                  </CardContent>
                </Card>

                {/* Spend by category */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Spend by category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {(Object.entries(summary.byCategory) as [Category, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, amount]) => {
                          const meta = CATEGORY_META[cat]
                          const pct = summary.totalMonthly > 0 ? (amount / summary.totalMonthly) * 100 : 0
                          return (
                            <button
                              key={cat}
                              className="w-full text-left"
                              onClick={() => setFilterCategory(filterCategory === cat ? "all" : cat)}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium w-28 shrink-0 ${meta.color}`}>{meta.label}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${meta.barColor}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-20 text-right shrink-0">
                                  {formatCurrency(amount)}/mo
                                </span>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* Tab bar */}
                <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
                  {([
                    { key: "all" as DashTab, label: "All Subscriptions" },
                    { key: "cancel-queue" as DashTab, label: `Cancel Queue${summary.cancelQueue.length > 0 ? ` (${summary.cancelQueue.length})` : ""}` },
                    { key: "groups" as DashTab, label: "Groups" },
                  ] satisfies { key: DashTab; label: string }[]).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDashTab(tab.key)}
                      className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                        dashTab === tab.key
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── All subscriptions tab ── */}
                {dashTab === "all" && (
                  <>
                    {/* Quick filter pills */}
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: "all" as QuickFilter, label: "All" },
                        { key: "active" as QuickFilter, label: "Active" },
                        { key: "unused" as QuickFilter, label: "Unused" },
                        { key: "rarely" as QuickFilter, label: "Rarely used" },
                        { key: "due-soon" as QuickFilter, label: "Due soon" },
                      ] satisfies { key: QuickFilter; label: string }[]).map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setQuickFilter(f.key)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            quickFilter === f.key
                              ? "bg-foreground text-background border-foreground"
                              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                      {summary.allTags.length > 0 && summary.allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setFilterTag(filterTag === tag ? "all" : tag)}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            filterTag === tag
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          }`}
                        >
                          <Tag className="w-2.5 h-2.5 inline mr-1" />{tag}
                        </button>
                      ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search subscriptions..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value as Category | "all")}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="all">All categories</option>
                        {Object.entries(CATEGORY_META).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          <X className="w-3.5 h-3.5 mr-1" /> Clear
                        </Button>
                      )}
                    </div>

                    {/* Table header */}
                    <div className="rounded-xl border overflow-hidden">
                      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground border-b">
                        <button className="col-span-4 flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                          Service <SortIcon k="name" />
                        </button>
                        <button className="col-span-2 flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("amount")}>
                          Cost/mo <SortIcon k="amount" />
                        </button>
                        <span className="col-span-2">Category</span>
                        <span className="col-span-2">Usage</span>
                        <button className="col-span-2 flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("renewal")}>
                          Renewal <SortIcon k="renewal" />
                        </button>
                      </div>

                      {filtered.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No subscriptions match your filters
                        </div>
                      ) : (
                        filtered.map((sub) => (
                          <SubscriptionRow
                            key={sub.id}
                            sub={sub}
                            onSelect={() => { setSelectedSub(sub); setView("detail") }}
                            onUsageChange={(status) => updateUsage(sub.id, status)}
                            onDelete={() => deleteSub(sub.id)}
                          />
                        ))
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                      Showing {filtered.length} of {subs.length} subscriptions
                      {filtered.length !== subs.length && " (filtered)"}
                    </p>
                  </>
                )}

                {/* ── Cancel queue tab ── */}
                {dashTab === "cancel-queue" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                      <Ban className="w-5 h-5 text-red-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-300">Auto-populated cancel queue</p>
                        <p className="text-xs text-red-600/80 dark:text-red-400/80">
                          Unused subs, rarely-used subs over $10/mo, and annual subs renewing within 14 days marked rarely.
                        </p>
                      </div>
                    </div>

                    {summary.cancelQueue.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        <Check className="w-10 h-10 mx-auto mb-3 text-green-500" />
                        <p className="font-medium text-foreground">Your cancel queue is empty!</p>
                        <p className="text-xs mt-1">No subscriptions flagged for cancellation.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Potential annual savings: <span className="font-bold text-green-600">{formatCurrency(summary.cancelQueue.reduce((acc, s) => acc + s.amount * 12, 0))}</span>
                        </p>
                        {summary.cancelQueue.map((s) => {
                          const meta = CATEGORY_META[s.category]
                          const reason =
                            s.usageStatus === "unused"
                              ? "Marked unused"
                              : s.usageStatus === "rarely" && s.renewalDate && daysUntilRenewal(s.renewalDate) <= 14
                              ? `Annual renewal in ${daysUntilRenewal(s.renewalDate)} days`
                              : "Rarely used & over $10/mo"

                          return (
                            <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-sm">{s.name}</p>
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                                    {meta.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{reason}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{formatCurrency(s.amount)}/mo</p>
                                <p className="text-xs text-green-600 font-medium">Save {formatCurrency(s.amount * 12)}/yr</p>
                              </div>
                              <div className="flex gap-2 shrink-0">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedSub(s); setView("detail") }}
                                >
                                  View
                                </Button>
                                {s.cancelUrl && (
                                  <a
                                    href={s.cancelUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md bg-destructive/10 text-destructive text-xs font-medium px-3 py-1.5 hover:bg-destructive/20 transition-colors border border-destructive/20"
                                  >
                                    Cancel <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Groups tab ── */}
                {dashTab === "groups" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Add tags to subscriptions (e.g. "work-reimbursed", "side-project") to group them here.
                    </p>
                    {summary.groups.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground text-sm">
                        <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-foreground">No tags yet</p>
                        <p className="text-xs mt-1">Edit subscriptions and add tags to group them.</p>
                      </div>
                    ) : (
                      summary.groups.map((group) => (
                        <Card key={group.name}>
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Tag className="w-3.5 h-3.5 text-blue-500" />
                                {group.name}
                              </CardTitle>
                              <div className="text-right">
                                <p className="text-sm font-bold">{formatCurrency(group.total)}/mo</p>
                                <p className="text-xs text-muted-foreground">{formatCurrency(group.total * 12)}/yr · {group.subs.length} subs</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-1">
                              {group.subs.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => { setSelectedSub(s); setView("detail") }}
                                  className="w-full flex items-center justify-between py-1.5 text-sm hover:text-foreground transition-colors"
                                >
                                  <span className="text-muted-foreground hover:text-foreground">{s.name}</span>
                                  <span className="font-medium">{formatCurrency(s.amount)}/mo</span>
                                </button>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Import ─────────────────────────────────────────────────────── */}
        {view === "import" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Scan Email</h1>
              <p className="text-muted-foreground text-sm">
                Paste the text of a billing receipt, renewal email, or subscription confirmation.
                AI will extract the subscription details automatically.
              </p>
            </div>

            {parsedResults.length === 0 ? (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1.5 block">
                      Email content <span className="text-muted-foreground">(paste the full email text)</span>
                    </label>
                    <Textarea
                      placeholder={`Your GitHub Copilot subscription\n\nAmount: $10.00/month\nNext billing date: July 15, 2026\n\nThank you for your subscription to GitHub Copilot...`}
                      value={emailText}
                      onChange={(e) => setEmailText(e.target.value)}
                      rows={14}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-muted-foreground">
                      You can paste multiple emails at once for batch import
                    </p>
                    <Button onClick={handleParse} disabled={isParsing || !emailText.trim()}>
                      {isParsing ? (
                        <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Scanning...</>
                      ) : (
                        <><Sparkles className="w-3.5 h-3.5 mr-1" /> Scan with AI</>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    Found {parsedResults.length} subscription{parsedResults.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setParsedResults([])}>
                      ← Rescan
                    </Button>
                    <Button size="sm" onClick={importSelected}>
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Import {parsedResults.filter((r) => r.selected).length} selected
                    </Button>
                  </div>
                </div>

                {parsedResults.map((r, i) => {
                  const meta = CATEGORY_META[r.category]
                  return (
                    <Card
                      key={i}
                      className={`cursor-pointer transition-colors ${r.selected ? "border-primary" : "opacity-60"}`}
                      onClick={() =>
                        setParsedResults((prev) =>
                          prev.map((p, j) => j === i ? { ...p, selected: !p.selected } : p)
                        )
                      }
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${r.selected ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                              {r.selected && <Check className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{r.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(r.rawAmount)}/{r.billingCycle} ·{" "}
                                {formatCurrency(toMonthly(r.rawAmount, r.billingCycle))}/mo
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.renewalDate && (
                              <span className="text-xs text-muted-foreground">
                                Renews {new Date(r.renewalDate).toLocaleDateString()}
                              </span>
                            )}
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                              {meta.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(r.confidence * 100)}% confident
                            </span>
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

        {/* ── Add manually ───────────────────────────────────────────────── */}
        {view === "add" && (
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Add Subscription</h1>
              <p className="text-muted-foreground text-sm">Add a subscription manually.</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Service name *</label>
                  <Input
                    placeholder="GitHub Copilot"
                    value={addName}
                    onChange={(e) => {
                      setAddName(e.target.value)
                      const db = lookupService(e.target.value)
                      if (db) setAddCategory(db.category)
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Amount *</label>
                    <Input
                      type="number"
                      placeholder="10.00"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Billing cycle</label>
                    <select
                      value={addCycle}
                      onChange={(e) => setAddCycle(e.target.value as BillingCycle)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value as Category)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Next renewal date</label>
                  <Input
                    type="date"
                    value={addRenewal}
                    onChange={(e) => setAddRenewal(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Website URL</label>
                  <Input
                    placeholder="https://..."
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                  <Input
                    placeholder="work-reimbursed, side-project, essential"
                    value={addTagsInput}
                    onChange={(e) => setAddTagsInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Value / ROI</label>
                  <Textarea
                    placeholder="What do you get from this? Is it worth the cost?"
                    value={addRoiNote}
                    onChange={(e) => setAddRoiNote(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea
                    placeholder="What is this for?"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={addSub}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add subscription
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Edit Subscription ──────────────────────────────────────────── */}
        {view === "edit-sub" && editingSubId && (
          <div className="max-w-lg mx-auto space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Edit Subscription</h1>
              <p className="text-muted-foreground text-sm">Update the subscription details. Price changes are tracked automatically.</p>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Service name *</label>
                  <Input
                    placeholder="GitHub Copilot"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Amount *</label>
                    <Input
                      type="number"
                      placeholder="10.00"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Billing cycle</label>
                    <select
                      value={addCycle}
                      onChange={(e) => setAddCycle(e.target.value as BillingCycle)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <select
                    value={addCategory}
                    onChange={(e) => setAddCategory(e.target.value as Category)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(CATEGORY_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Next renewal date</label>
                  <Input
                    type="date"
                    value={addRenewal}
                    onChange={(e) => setAddRenewal(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Website URL</label>
                  <Input
                    placeholder="https://..."
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                  <Input
                    placeholder="work-reimbursed, side-project, essential"
                    value={addTagsInput}
                    onChange={(e) => setAddTagsInput(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Value / ROI</label>
                  <Textarea
                    placeholder="What do you get from this? Is it worth the cost?"
                    value={addRoiNote}
                    onChange={(e) => setAddRoiNote(e.target.value)}
                    rows={2}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea
                    placeholder="What is this for?"
                    value={addNotes}
                    onChange={(e) => setAddNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={saveEdit}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Save changes
                  </Button>
                  <Button variant="outline" onClick={() => setView("detail")}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Detail ─────────────────────────────────────────────────────── */}
        {view === "detail" && selectedSub && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{selectedSub.name}</h1>
                  {selectedSub.roiNote && (
                    <span title="Has ROI note"><Star className="w-4 h-4 text-amber-500 fill-amber-400" /></span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatCurrency(selectedSub.rawAmount)}/{selectedSub.billingCycle} ·{" "}
                  {formatCurrency(selectedSub.amount)}/mo
                </p>
                {selectedSub.tags && selectedSub.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedSub.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => openEdit(selectedSub)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => deleteSub(selectedSub.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="pt-5 space-y-4">
                <Row label="Category" value={
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_META[selectedSub.category].bg} ${CATEGORY_META[selectedSub.category].color}`}>
                    {CATEGORY_META[selectedSub.category].label}
                  </span>
                } />
                <Row label="Billing" value={`${formatCurrency(selectedSub.rawAmount)} ${BILLING_CYCLE_LABELS[selectedSub.billingCycle].toLowerCase()}`} />
                <Row
                  label="Monthly equivalent"
                  value={
                    selectedSub.billingCycle === "one-time"
                      ? <span className="text-muted-foreground italic">One-time charge</span>
                      : formatCurrency(selectedSub.amount)
                  }
                />
                <Row label="Annual cost" value={selectedSub.billingCycle === "one-time" ? "N/A" : `${formatCurrency(selectedSub.amount * 12)}/yr`} />
                {selectedSub.renewalDate && (
                  <Row
                    label="Next renewal"
                    value={
                      <span className={daysUntilRenewal(selectedSub.renewalDate) <= 7 ? "text-amber-600 font-medium" : ""}>
                        {new Date(selectedSub.renewalDate).toLocaleDateString()} ({daysUntilRenewal(selectedSub.renewalDate) === 0 ? "today" : `${daysUntilRenewal(selectedSub.renewalDate)} days`})
                      </span>
                    }
                  />
                )}
                {selectedSub.notes && <Row label="Notes" value={selectedSub.notes} />}
              </CardContent>
            </Card>

            {/* ROI Note */}
            {selectedSub.roiNote && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-500" /> Value / ROI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{selectedSub.roiNote}</p>
                </CardContent>
              </Card>
            )}

            {/* Price history */}
            {selectedSub.priceHistory && selectedSub.priceHistory.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> Price history
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedSub.priceHistory.map((entry, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
                        <span className="text-muted-foreground text-xs">{entry.date}</span>
                        <span className="font-medium">{formatCurrency(entry.amount)}</span>
                        {i < selectedSub.priceHistory!.length - 1 && (
                          <span className="text-xs text-muted-foreground">→</span>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-2 h-2 rounded-full bg-foreground shrink-0" />
                      <span className="text-muted-foreground text-xs">now</span>
                      <span className="font-medium">{formatCurrency(selectedSub.rawAmount)}</span>
                      <span className="text-xs text-muted-foreground ml-auto">current</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Usage status</CardTitle>
                <CardDescription>How often are you actually using this?</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                {USAGE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => updateUsage(selectedSub.id, o.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedSub.usageStatus === o.value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedSub.cancelUrl && (
              <Card className="border-red-200 dark:border-red-900">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Cancel this subscription</p>
                    <p className="text-xs text-muted-foreground">Opens the official cancellation page</p>
                  </div>
                  <a
                    href={selectedSub.cancelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground text-sm font-medium px-3 py-1.5 hover:bg-destructive/90 transition-colors"
                  >
                    Cancel <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon, color, highlight, gradient,
}: {
  label: string; value: string; sub: string
  icon: React.ReactNode; color: string; highlight?: boolean; gradient?: string
}) {
  return (
    <Card className={highlight ? "border-amber-300 dark:border-amber-700" : ""}>
      <CardContent className={`relative overflow-hidden ${gradient ? `bg-gradient-to-br ${gradient}` : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

function Alert({
  icon, message, action, onAction,
}: {
  icon: React.ReactNode; message: string; action: string; onAction: () => void
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      {icon}
      <p className="text-sm flex-1">{message}</p>
      <Button variant="outline" size="sm" onClick={onAction}>{action}</Button>
    </div>
  )
}

function SpendingChart({ data }: { data: { label: string; amount: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1)
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map((d, i) => {
        const pct = (d.amount / max) * 100
        const isLast = i === data.length - 1
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: "72px" }}>
              <div
                className={`w-full rounded-t-sm transition-all ${isLast ? "bg-red-500" : "bg-muted-foreground/30"}`}
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${d.label}: ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(d.amount)}/mo`}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function SubscriptionRow({
  sub, onSelect, onUsageChange, onDelete,
}: {
  sub: Subscription
  onSelect: () => void
  onUsageChange: (status: UsageStatus) => void
  onDelete: () => void
}) {
  const meta = CATEGORY_META[sub.category]
  const usageOption = USAGE_OPTIONS.find((o) => o.value === sub.usageStatus)!

  return (
    <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors group items-center">
      <button className="col-span-4 flex items-center gap-2 text-left min-w-0" onClick={onSelect}>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{sub.name}</p>
            {sub.roiNote && (
              <span title="Has ROI note"><Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" /></span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {sub.url && (
              <p className="text-[10px] text-muted-foreground truncate">{sub.url.replace(/^https?:\/\//, "")}</p>
            )}
            {sub.tags && sub.tags.slice(0, 2).map((tag) => (
              <span key={tag} className="text-[9px] px-1 py-0 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </button>

      <div className="col-span-2">
        <p className="text-sm font-medium">
          {sub.billingCycle === "one-time" ? formatCurrency(sub.rawAmount) : formatCurrency(sub.amount)}
        </p>
        {sub.billingCycle === "one-time" ? (
          <p className="text-[10px] text-muted-foreground">One-time</p>
        ) : sub.billingCycle !== "monthly" ? (
          <p className="text-[10px] text-muted-foreground">{formatCurrency(sub.rawAmount)}/{sub.billingCycle.slice(0, 3)}</p>
        ) : null}
      </div>

      <div className="col-span-2">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
          {meta.label}
        </span>
      </div>

      <div className="col-span-2">
        <select
          value={sub.usageStatus}
          onChange={(e) => onUsageChange(e.target.value as UsageStatus)}
          onClick={(e) => e.stopPropagation()}
          className={`text-[11px] font-medium bg-transparent border-none outline-none cursor-pointer ${usageOption.color}`}
        >
          {USAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="col-span-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {sub.renewalDate
            ? daysUntilRenewal(sub.renewalDate) <= 7
              ? <span className="text-amber-600 font-medium">{daysUntilRenewal(sub.renewalDate) === 0 ? "Today" : `${daysUntilRenewal(sub.renewalDate)}d`}</span>
              : `${daysUntilRenewal(sub.renewalDate)}d`
            : "—"}
        </span>
        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {sub.cancelUrl && (
            <a
              href={sub.cancelUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Open cancel page"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
