"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Users, Plus, Trash2, Check, X, Download,
  ChevronRight, DollarSign, PieChart, Archive,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Group, type Expense, type Settlement, type SplitterStore,
  type Member, type SplitType, type ExpenseCategory, type SplitAllocation,
  CATEGORIES, CAT_EMOJI, CAT_COLORS,
  calculateSettlements, getCategoryPieData,
} from "./types"

const STORAGE_KEY = "expense-splitter-v1"

function loadStore(): SplitterStore {
  if (typeof window === "undefined") return { groups:[], expenses:[], settlements:[] }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { groups:[], expenses:[], settlements:[] } }
  catch { return { groups:[], expenses:[], settlements:[] } }
}
function saveStore(s: SplitterStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type Tab = "expenses" | "settlements" | "summary"

// ── Pie chart (pure CSS/SVG) ─────────────────────────────────────────────────
const PIE_COLORS = ["#a855f7","#3b82f6","#22c55e","#f59e0b","#ec4899","#ef4444","#94a3b8"]

function PieChartSVG({ data }: { data: { pct: number; label: string }[] }) {
  let cumulative = 0
  const arcs = data.map((d, i) => {
    const startAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2
    cumulative += d.pct
    const endAngle = (cumulative / 100) * 2 * Math.PI - Math.PI / 2
    const x1 = 50 + 40 * Math.cos(startAngle)
    const y1 = 50 + 40 * Math.sin(startAngle)
    const x2 = 50 + 40 * Math.cos(endAngle)
    const y2 = 50 + 40 * Math.sin(endAngle)
    const largeArc = d.pct > 50 ? 1 : 0
    return { path: `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`, color: PIE_COLORS[i % PIE_COLORS.length] }
  })
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0">
      {arcs.map((arc, i) => <path key={i} d={arc.path} fill={arc.color} stroke="#1a1a1a" strokeWidth="0.5" />)}
    </svg>
  )
}

export function ExpenseSplitterContent() {
  const [store, setStore] = useState<SplitterStore>({ groups:[], expenses:[], settlements:[] })
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [tab, setTab] = useState<Tab>("expenses")
  const [showHistory, setShowHistory] = useState(false)

  // New group form
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [ngName, setNgName] = useState("")
  const [ngDesc, setNgDesc] = useState("")
  const [ngMembers, setNgMembers] = useState<string[]>(["", ""])
  const [ngCurrency, setNgCurrency] = useState("USD")

  // New expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [exDesc, setExDesc] = useState("")
  const [exAmount, setExAmount] = useState("")
  const [exCurrency, setExCurrency] = useState("USD")
  const [exPaidBy, setExPaidBy] = useState("")
  const [exSplitType, setExSplitType] = useState<SplitType>("equal")
  const [exCategory, setExCategory] = useState<ExpenseCategory>("food")
  const [exDate, setExDate] = useState(new Date().toISOString().slice(0, 10))
  const [exAllocations, setExAllocations] = useState<SplitAllocation[]>([])

  useEffect(() => { setStore(loadStore()) }, [])

  function update(fn: (s: SplitterStore) => SplitterStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  // Initialize expense paid-by when group selected
  useEffect(() => {
    if (selectedGroup && selectedGroup.members.length > 0) {
      setExPaidBy(selectedGroup.members[0]!.id)
      setExCurrency(selectedGroup.currency)
      setExAllocations(selectedGroup.members.map((m) => ({ memberId: m.id, value: 0 })))
    }
  }, [selectedGroup])

  function createGroup() {
    const memberNames = ngMembers.filter((n) => n.trim())
    if (!ngName.trim() || memberNames.length < 2) { toast.error("Group name and at least 2 members required"); return }
    const members: Member[] = memberNames.map((name) => ({ id: crypto.randomUUID(), name: name.trim() }))
    const group: Group = {
      id: crypto.randomUUID(), name: ngName.trim(), description: ngDesc.trim() || undefined,
      members, currency: ngCurrency, status: "active", createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, groups: [...s.groups, group] }))
    setNgName(""); setNgDesc(""); setNgMembers(["",""])
    setShowNewGroup(false)
    setSelectedGroup(group)
    toast.success("Group created!")
  }

  function addExpense() {
    if (!selectedGroup || !exDesc.trim() || !exAmount) { toast.error("Description and amount required"); return }
    const amount = parseFloat(exAmount)
    if (isNaN(amount) || amount <= 0) { toast.error("Valid amount required"); return }

    const expense: Expense = {
      id: crypto.randomUUID(), groupId: selectedGroup.id,
      description: exDesc.trim(), amount, currency: exCurrency,
      paidById: exPaidBy, splitType: exSplitType,
      category: exCategory, date: exDate,
      allocations: (exSplitType === "percentage" || exSplitType === "fixed") ? exAllocations : undefined,
    }

    // Validate allocations
    if (exSplitType === "percentage") {
      const total = exAllocations.reduce((s, a) => s + a.value, 0)
      if (Math.abs(total - 100) > 0.5) { toast.error(`Percentages must sum to 100% (currently ${total.toFixed(1)}%)`); return }
    }
    if (exSplitType === "fixed") {
      const total = exAllocations.reduce((s, a) => s + a.value, 0)
      if (Math.abs(total - amount) > 0.01) { toast.error(`Fixed amounts must sum to ${amount.toFixed(2)}`); return }
    }

    update((s) => ({ ...s, expenses: [...s.expenses, expense] }))
    setExDesc(""); setExAmount("")
    setShowExpenseForm(false)
    toast.success("Expense added")
  }

  function deleteExpense(id: string) {
    update((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }))
  }

  function markSettlement(fromId: string, toId: string) {
    if (!selectedGroup) return
    const s: Settlement = {
      id: crypto.randomUUID(), groupId: selectedGroup.id,
      fromId, toId, amount: 0, currency: selectedGroup.currency,
      paid: true, paidAt: new Date().toISOString(),
    }
    update((st) => ({ ...st, settlements: [...st.settlements, s] }))
    toast.success("Settlement marked as paid")
  }

  function settleGroup() {
    if (!selectedGroup) return
    update((s) => ({
      ...s,
      groups: s.groups.map((g) => g.id === selectedGroup.id ? { ...g, status: "settled" as const, settledAt: new Date().toISOString() } : g),
    }))
    setSelectedGroup(null)
    toast.success("Group marked as settled")
  }

  function exportCSV() {
    if (!selectedGroup) return
    const exps = groupExpenses
    const rows = [
      ["Date","Description","Amount","Currency","Paid By","Category","Split Type"],
      ...exps.map((e) => [
        e.date, e.description, e.amount.toString(), e.currency,
        selectedGroup.members.find(m=>m.id===e.paidById)?.name ?? "",
        e.category, e.splitType,
      ])
    ]
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${selectedGroup.name}-expenses.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPrint() {
    window.print()
  }

  const groupExpenses = useMemo(
    () => store.expenses.filter((e) => e.groupId === selectedGroup?.id).sort((a,b) => b.date.localeCompare(a.date)),
    [store.expenses, selectedGroup]
  )

  const settlementsNeeded = useMemo(() => {
    if (!selectedGroup) return []
    const paidPairs = store.settlements.filter((s) => s.groupId === selectedGroup.id && s.paid).map((s) => `${s.fromId}-${s.toId}`)
    return calculateSettlements(selectedGroup, groupExpenses).filter((s) => !paidPairs.includes(`${s.from.id}-${s.to.id}`))
  }, [selectedGroup, groupExpenses, store.settlements])

  const pieData = useMemo(() => getCategoryPieData(groupExpenses), [groupExpenses])
  const totalSpend = useMemo(() => groupExpenses.reduce((s, e) => s + e.amount, 0), [groupExpenses])

  const activeGroups = store.groups.filter((g) => g.status === "active")
  const settledGroups = store.groups.filter((g) => g.status === "settled")

  // ── Group detail view ────────────────────────────────────────────────────
  if (selectedGroup) {
    return (
      <div className="min-h-screen flex flex-col">
        <ToolHeader
          title={selectedGroup.name}
          icon={Users}
          color="text-lime-500"
          badge="Finance"
          actions={
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={() => { setSelectedGroup(null); setTab("expenses") }}>← Back</Button>
              <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
              <Button variant="outline" size="sm" onClick={exportPrint}>Print</Button>
            </div>
          }
        />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-8">
          {/* Group info */}
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold">{selectedGroup.name}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {selectedGroup.members.map((m) => <Badge key={m.id} variant="secondary" className="text-xs">{m.name}</Badge>)}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-lime-400">{selectedGroup.currency} {totalSpend.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">total spend</p>
            </div>
          </div>

          {/* Settlements summary card */}
          {settlementsNeeded.length > 0 && (
            <Card className="border-lime-500/30 bg-lime-500/5">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-3 text-lime-400">💸 Who Owes What</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {settlementsNeeded.map((s, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-background border">
                    <div className="flex-1">
                      <span className="font-bold">{s.from.name}</span>
                      <span className="text-muted-foreground mx-2">pays</span>
                      <span className="font-bold">{s.to.name}</span>
                    </div>
                    <span className="text-xl font-black text-lime-400">{selectedGroup.currency} {s.amount.toFixed(2)}</span>
                    <Button size="sm" variant="outline" onClick={() => markSettlement(s.from.id, s.to.id)}>
                      <Check className="w-4 h-4 mr-1" /> Mark Paid
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={settleGroup} className="text-muted-foreground mt-2">
                  <Archive className="w-4 h-4 mr-1" /> Archive Group (all settled)
                </Button>
              </CardContent>
            </Card>
          )}
          {settlementsNeeded.length === 0 && groupExpenses.length > 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <p className="text-sm font-medium text-green-400">All settled up!</p>
                  <Button size="sm" variant="ghost" onClick={settleGroup} className="ml-auto">
                    <Archive className="w-4 h-4 mr-1" /> Archive Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab bar */}
          <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl">
            {([
              { key: "expenses" as Tab, label: `Expenses (${groupExpenses.length})` },
              { key: "settlements" as Tab, label: `Settle (${settlementsNeeded.length})` },
              { key: "summary" as Tab, label: "Summary" },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Expenses ── */}
          {tab === "expenses" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{groupExpenses.length} expenses</p>
                <Button size="sm" onClick={() => setShowExpenseForm(!showExpenseForm)}><Plus className="w-4 h-4 mr-1" /> Add Expense</Button>
              </div>

              {showExpenseForm && (
                <Card className="border-lime-500/30">
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-medium block mb-1">Description *</label>
                        <Input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="Dinner, Uber, Hotel..." />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium block mb-1">Amount *</label>
                          <Input type="number" value={exAmount} onChange={(e) => setExAmount(e.target.value)} placeholder="0.00" />
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1">Currency</label>
                          <Input value={exCurrency} onChange={(e) => setExCurrency(e.target.value)} className="uppercase" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-medium block mb-1">Paid by</label>
                        <select value={exPaidBy} onChange={(e) => setExPaidBy(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm">
                          {selectedGroup.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Split type</label>
                        <select value={exSplitType} onChange={(e) => {
                          const st = e.target.value as SplitType
                          setExSplitType(st)
                          if (st === "percentage") setExAllocations(selectedGroup.members.map((m) => ({ memberId: m.id, value: Math.floor(100 / selectedGroup.members.length) })))
                          if (st === "fixed") setExAllocations(selectedGroup.members.map((m) => ({ memberId: m.id, value: 0 })))
                        }} className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm">
                          <option value="equal">Equal split</option>
                          <option value="percentage">Percentage split</option>
                          <option value="fixed">Fixed amounts</option>
                          <option value="self-paid">I paid for myself</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Category</label>
                        <select value={exCategory} onChange={(e) => setExCategory(e.target.value as ExpenseCategory)} className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_EMOJI[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Allocation fields */}
                    {(exSplitType === "percentage" || exSplitType === "fixed") && (
                      <div className="space-y-3">
                        <p className="text-xs font-medium">{exSplitType === "percentage" ? "Percentages (must sum to 100%)" : `Fixed amounts (must sum to ${parseFloat(exAmount || "0").toFixed(2)})`}</p>
                        {selectedGroup.members.map((m) => {
                          const alloc = exAllocations.find((a) => a.memberId === m.id)
                          return (
                            <div key={m.id} className="flex items-center gap-3">
                              <span className="text-sm w-24">{m.name}</span>
                              <Input type="number" className="w-24" value={alloc?.value ?? 0} onChange={(e) => {
                                setExAllocations((prev) => prev.map((a) => a.memberId === m.id ? { ...a, value: parseFloat(e.target.value) || 0 } : a))
                              }} />
                              <span className="text-xs text-muted-foreground">{exSplitType === "percentage" ? "%" : exCurrency}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className="w-48" />
                    <div className="flex gap-3">
                      <Button size="sm" onClick={addExpense}><Check className="w-4 h-4 mr-1" /> Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {groupExpenses.length === 0 && !showExpenseForm ? (
                <div className="py-12 text-center text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="font-medium text-foreground">No expenses yet</p>
                  <p className="text-sm">Add your first expense to start splitting</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden divide-y">
                  {groupExpenses.map((e) => {
                    const payer = selectedGroup.members.find((m) => m.id === e.paidById)
                    return (
                      <div key={e.id} className="flex items-center gap-4 px-4 py-4 hover:bg-muted/30 group">
                        <span className="text-xl">{CAT_EMOJI[e.category]}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{e.description}</p>
                          <p className="text-xs text-muted-foreground">{e.date} · Paid by <span className="font-medium">{payer?.name}</span> · {e.splitType}</p>
                        </div>
                        <p className="text-sm font-bold shrink-0">{e.currency} {e.amount.toFixed(2)}</p>
                        <Button variant="ghost" size="icon" onClick={() => deleteExpense(e.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Settlements ── */}
          {tab === "settlements" && (
            <div className="space-y-5">
              <h3 className="font-semibold">Settlement Summary</h3>
              {settlementsNeeded.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <Check className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
                  <p className="font-medium text-foreground">All settled up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {settlementsNeeded.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl border bg-card">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-base">{s.from.name}</span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          <span className="font-bold text-base">{s.to.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Transfer {selectedGroup.currency} {s.amount.toFixed(2)} to {s.to.name}</p>
                      </div>
                      <p className="text-2xl font-black text-lime-400 shrink-0">{selectedGroup.currency} {s.amount.toFixed(2)}</p>
                      <Button size="sm" onClick={() => markSettlement(s.from.id, s.to.id)}>
                        <Check className="w-4 h-4 mr-1" /> Paid
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Summary ── */}
          {tab === "summary" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <Card>
                  <CardContent className="py-4">
                    <p className="text-3xl font-bold text-lime-400">{selectedGroup.currency} {totalSpend.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total spend</p>
                    <p className="text-sm mt-2">
                      Per person: <span className="font-bold">{selectedGroup.currency} {(totalSpend / selectedGroup.members.length).toFixed(2)}</span>
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4">
                    <p className="text-sm font-medium mb-2">Member spend</p>
                    {selectedGroup.members.map((m) => {
                      const paid = groupExpenses.filter((e) => e.paidById === m.id).reduce((s, e) => s + e.amount, 0)
                      return (
                        <div key={m.id} className="flex justify-between text-sm">
                          <span>{m.name}</span>
                          <span className="font-mono">{selectedGroup.currency} {paid.toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
              {pieData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-3"><PieChart className="w-4 h-4" />Category Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-6">
                      <PieChartSVG data={pieData.map((d) => ({ pct: d.pct, label: d.category }))} />
                      <div className="space-y-1.5 flex-1">
                        {pieData.map((d, i) => (
                          <div key={d.category} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className={`text-sm flex-1 ${CAT_COLORS[d.category]}`}>{CAT_EMOJI[d.category]} {d.category.charAt(0).toUpperCase() + d.category.slice(1)}</span>
                            <span className="text-sm font-mono">{selectedGroup.currency} {d.amount.toFixed(2)}</span>
                            <span className="text-xs text-muted-foreground w-8 text-right">{d.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    )
  }

  // ── Group list ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Expense Splitter"
        icon={Users}
        color="text-lime-500"
        badge="Finance"
        actions={
          <Button size="sm" onClick={() => setShowNewGroup(!showNewGroup)}>
            <Plus className="w-4 h-4 mr-1" /> New Group
          </Button>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Expense Splitter</h1>
            <p className="text-muted-foreground">Split expenses fairly. No signup needed for others.</p>
          </div>
        </div>

        {/* New group form */}
        {showNewGroup && (
          <Card className="border-lime-500/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm">New Group</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1">Group name *</label>
                  <Input value={ngName} onChange={(e) => setNgName(e.target.value)} placeholder="Road Trip 2026, Roommates..." />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Base currency</label>
                  <Input value={ngCurrency} onChange={(e) => setNgCurrency(e.target.value.toUpperCase())} placeholder="USD" className="uppercase" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Description</label>
                <Input value={ngDesc} onChange={(e) => setNgDesc(e.target.value)} placeholder="Optional description" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-3">Members (at least 2) *</label>
                <div className="space-y-3">
                  {ngMembers.map((name, i) => (
                    <div key={i} className="flex gap-3">
                      <Input
                        value={name}
                        onChange={(e) => setNgMembers((prev) => prev.map((n, idx) => idx === i ? e.target.value : n))}
                        placeholder={`Person ${i+1}`}
                      />
                      {ngMembers.length > 2 && (
                        <Button size="icon" variant="ghost" onClick={() => setNgMembers((prev) => prev.filter((_,idx) => idx !== i))}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => setNgMembers((prev) => [...prev, ""])}>
                    <Plus className="w-4 h-4 mr-1" /> Add member
                  </Button>
                </div>
              </div>
              <div className="flex gap-3">
                <Button size="sm" onClick={createGroup}><Users className="w-4 h-4 mr-1" /> Create Group</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewGroup(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeGroups.length === 0 && !showNewGroup ? (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="w-14 h-14 mx-auto mb-5 opacity-20" />
            <p className="font-medium text-foreground text-lg">No groups yet</p>
            <p className="text-sm mt-1">Create a group for your trip, roommates, or event</p>
            <Button className="mt-4" size="sm" onClick={() => setShowNewGroup(true)}><Plus className="w-4 h-4 mr-1" /> New Group</Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activeGroups.map((g) => {
              const exps = store.expenses.filter((e) => e.groupId === g.id)
              const total = exps.reduce((s, e) => s + e.amount, 0)
              const needed = calculateSettlements(g, exps)
              return (
                <Card key={g.id} className="cursor-pointer hover:shadow-lg transition-shadow hover:border-lime-500/30" onClick={() => setSelectedGroup(g)}>
                  <CardContent className="py-5">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-lime-500/20 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-lime-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold">{g.name}</p>
                        <div className="flex items-center gap-3 flex-wrap mt-0.5">
                          {g.members.map((m) => <span key={m.id} className="text-xs text-muted-foreground">{m.name}</span>)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-black text-lime-400">{g.currency} {total.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {needed.length > 0 ? `${needed.length} settlement${needed.length !== 1 ? "s" : ""} pending` : "All settled"}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* History */}
        {settledGroups.length > 0 && (
          <div className="pt-4 border-t">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archived groups ({settledGroups.length})
            </button>
            {showHistory && (
              <div className="mt-3 space-y-3">
                {settledGroups.map((g) => {
                  const exps = store.expenses.filter((e) => e.groupId === g.id)
                  const total = exps.reduce((s, e) => s + e.amount, 0)
                  return (
                    <button key={g.id} onClick={() => setSelectedGroup(g)} className="w-full text-left p-4 rounded-xl border border-dashed opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{g.name}</span>
                        <span className="text-sm font-mono">{g.currency} {total.toFixed(2)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
