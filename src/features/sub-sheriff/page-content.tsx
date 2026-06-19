"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  CreditCard, Plus, Trash2, ExternalLink, AlertTriangle,
  TrendingDown, BarChart3, Calendar, ChevronDown, ChevronUp,
  Sparkles, Download, Search, X, Check, Loader2, Mail,
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
} from "./types"
import { lookupService } from "./service-db"

const STORAGE_KEY = "sub-sheriff-v1"

function load(): Subscription[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch { return [] }
}
function save(subs: Subscription[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subs))
}

type View = "dashboard" | "import" | "add" | "detail"
type SortKey = "name" | "amount" | "renewal" | "added"

const USAGE_OPTIONS: { value: UsageStatus; label: string; color: string }[] = [
  { value: "active",  label: "Active",       color: "text-green-600" },
  { value: "rarely",  label: "Rarely used",  color: "text-amber-600" },
  { value: "unused",  label: "Not using",    color: "text-red-600" },
]

export function SubSheriffContent() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [view, setView] = useState<View>("dashboard")
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null)
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all")
  const [filterUsage, setFilterUsage] = useState<UsageStatus | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("amount")
  const [sortDesc, setSortDesc] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<Category | null>(null)

  // Import state
  const [emailText, setEmailText] = useState("")
  const [isParsing, setIsParsing] = useState(false)
  const [parsedResults, setParsedResults] = useState<(ParsedSubscription & { selected: boolean })[]>([])

  // Add form state
  const [addName, setAddName] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addCycle, setAddCycle] = useState<BillingCycle>("monthly")
  const [addCategory, setAddCategory] = useState<Category>("other")
  const [addRenewal, setAddRenewal] = useState("")
  const [addUrl, setAddUrl] = useState("")
  const [addNotes, setAddNotes] = useState("")

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

    // Duplicate detection: multiple subs in same category with similar cost
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
    }
  }, [subs])

  const filtered = useMemo(() => {
    let result = [...subs]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((s) => s.name.toLowerCase().includes(q))
    }
    if (filterCategory !== "all") result = result.filter((s) => s.category === filterCategory)
    if (filterUsage !== "all") result = result.filter((s) => s.usageStatus === filterUsage)
    result.sort((a, b) => {
      let cmp = 0
      if (sortKey === "name")    cmp = a.name.localeCompare(b.name)
      if (sortKey === "amount")  cmp = a.amount - b.amount
      if (sortKey === "renewal") cmp = (a.renewalDate ?? "").localeCompare(b.renewalDate ?? "")
      if (sortKey === "added")   cmp = a.createdAt.localeCompare(b.createdAt)
      return sortDesc ? -cmp : cmp
    })
    return result
  }, [subs, search, filterCategory, filterUsage, sortKey, sortDesc])

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

  function addSub() {
    if (!addName.trim() || !addAmount) {
      toast.error("Name and amount are required")
      return
    }
    const raw = parseFloat(addAmount)
    if (isNaN(raw)) { toast.error("Invalid amount"); return }
    const db = lookupService(addName)
    const now = new Date().toISOString()
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
      createdAt: now,
      updatedAt: now,
    }
    setSubs((prev) => [sub, ...prev])
    setAddName(""); setAddAmount(""); setAddCycle("monthly")
    setAddCategory("other"); setAddRenewal(""); setAddUrl(""); setAddNotes("")
    toast.success(`${sub.name} added`)
    setView("dashboard")
  }

  async function handleParse() {
    if (!emailText.trim()) { toast.error("Paste email content first"); return }
    setIsParsing(true)
    setParsedResults([])
    try {
      const res = await fetch("/api/sub-sheriff/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailText }),
      })
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
      // Deduplicate by name (case-insensitive)
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
      ["Name", "Monthly ($)", "Billed Amount", "Cycle", "Category", "Usage", "Next Renewal", "Cancel URL"],
      ...subs.map((s) => [
        s.name,
        s.amount.toFixed(2),
        s.rawAmount.toFixed(2),
        s.billingCycle,
        CATEGORY_META[s.category].label,
        s.usageStatus,
        s.renewalDate ?? "",
        s.cancelUrl ?? "",
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
              <Button variant="outline" size="sm" onClick={() => { setView("dashboard"); setParsedResults([]) }}>
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
              <p className="text-muted-foreground">Every subscription you're paying for, on one screen.</p>
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <SummaryCard
                    label="Monthly spend"
                    value={formatCurrency(summary.totalMonthly)}
                    sub={`${formatCurrency(summary.totalAnnual)}/yr`}
                    icon={<CreditCard className="w-4 h-4" />}
                    color="text-foreground"
                  />
                  <SummaryCard
                    label="Subscriptions"
                    value={String(summary.count)}
                    sub="tracked"
                    icon={<BarChart3 className="w-4 h-4" />}
                    color="text-blue-500"
                  />
                  <SummaryCard
                    label="Unused"
                    value={formatCurrency(summary.unusedMonthly)}
                    sub="could cancel"
                    icon={<TrendingDown className="w-4 h-4" />}
                    color="text-red-500"
                    highlight={summary.unusedMonthly > 0}
                  />
                  <SummaryCard
                    label="Renewing soon"
                    value={String(summary.upcomingRenewals.length)}
                    sub="in 30 days"
                    icon={<Calendar className="w-4 h-4" />}
                    color="text-amber-500"
                    highlight={summary.upcomingRenewals.length > 0}
                  />
                </div>

                {/* Alerts */}
                {(summary.unusedMonthly > 0 || summary.duplicates.length > 0) && (
                  <div className="space-y-2">
                    {summary.unusedMonthly > 0 && (
                      <Alert
                        icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                        message={`You're paying ${formatCurrency(summary.unusedMonthly)}/mo for subscriptions you marked "Not using" — that's ${formatCurrency(summary.unusedMonthly * 12)}/yr.`}
                        action="Review unused"
                        onAction={() => setFilterUsage("unused")}
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
                                    className="h-full rounded-full bg-current opacity-60 transition-all"
                                    style={{ width: `${pct}%`, color: meta.color.replace("text-", "bg-").replace("600", "500") }}
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

                {/* Filters + list */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
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
                  <select
                    value={filterUsage}
                    onChange={(e) => setFilterUsage(e.target.value as UsageStatus | "all")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">All usage</option>
                    {USAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {(filterCategory !== "all" || filterUsage !== "all" || search) && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setFilterCategory("all"); setFilterUsage("all"); setSearch("") }}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Clear
                    </Button>
                  )}
                </div>

                {/* Table header */}
                <div className="rounded-lg border overflow-hidden">
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
                      // Auto-fill from service DB
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

        {/* ── Detail ─────────────────────────────────────────────────────── */}
        {view === "detail" && selectedSub && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selectedSub.name}</h1>
                <p className="text-muted-foreground text-sm">
                  {formatCurrency(selectedSub.rawAmount)}/{selectedSub.billingCycle} ·{" "}
                  {formatCurrency(selectedSub.amount)}/mo
                </p>
              </div>
              <Button
                variant="ghost" size="sm"
                onClick={() => deleteSub(selectedSub.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <Card>
              <CardContent className="pt-5 space-y-4">
                <Row label="Category" value={
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_META[selectedSub.category].bg} ${CATEGORY_META[selectedSub.category].color}`}>
                    {CATEGORY_META[selectedSub.category].label}
                  </span>
                } />
                <Row label="Billing" value={`${formatCurrency(selectedSub.rawAmount)} ${BILLING_CYCLE_LABELS[selectedSub.billingCycle].toLowerCase()}`} />
                <Row label="Monthly equivalent" value={formatCurrency(selectedSub.amount)} />
                <Row label="Annual cost" value={`${formatCurrency(selectedSub.amount * 12)}/yr`} />
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
  label, value, sub, icon, color, highlight,
}: {
  label: string; value: string; sub: string
  icon: React.ReactNode; color: string; highlight?: boolean
}) {
  return (
    <Card className={highlight ? "border-amber-300 dark:border-amber-700" : ""}>
      <CardContent>
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
          <p className="text-sm font-medium truncate">{sub.name}</p>
          {sub.url && (
            <p className="text-[10px] text-muted-foreground truncate">{sub.url.replace(/^https?:\/\//, "")}</p>
          )}
        </div>
      </button>

      <div className="col-span-2">
        <p className="text-sm font-medium">{formatCurrency(sub.amount)}</p>
        {sub.billingCycle !== "monthly" && (
          <p className="text-[10px] text-muted-foreground">{formatCurrency(sub.rawAmount)}/{sub.billingCycle.slice(0, 3)}</p>
        )}
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
