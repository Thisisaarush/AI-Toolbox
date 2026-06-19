"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  TrendingUp, Plus, Trash2, Sparkles, RefreshCw, Target,
  Loader2, AlertTriangle, CheckCircle, Info, Building2, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type {
  Account, NetWorthSnapshot, NetWorthGoal, AssetCategory, LiabilityCategory,
} from "./types"
import {
  ASSET_CATEGORY_META, LIABILITY_CATEGORY_META, formatUSD,
} from "./types"

const STORAGE_KEY = "net-worth-v1"

interface NWState {
  accounts: Account[]
  snapshots: NetWorthSnapshot[]
  goals: NetWorthGoal[]
  baseCurrency: string
}

function load(): NWState {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { accounts: [], snapshots: [], goals: [], baseCurrency: "USD" } }
  catch { return { accounts: [], snapshots: [], goals: [], baseCurrency: "USD" } }
}
function save(s: NWState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR", "CHF", "CNY", "MXN"]

type View = "dashboard" | "add-account" | "goals"

interface Insight {
  title: string
  insight: string
  type: "warning" | "tip" | "positive"
}

export function NetWorthContent() {
  const [state, setState] = useState<NWState>({ accounts: [], snapshots: [], goals: [], baseCurrency: "USD" })
  const [view, setView] = useState<View>("dashboard")
  const [fxRates, setFxRates] = useState<Record<string, number>>({})
  const [fxLoading, setFxLoading] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Add account form
  const [addName, setAddName] = useState("")
  const [addInstitution, setAddInstitution] = useState("")
  const [addType, setAddType] = useState<AssetCategory | LiabilityCategory>("cash-savings")
  const [addIsAsset, setAddIsAsset] = useState(true)
  const [addBalance, setAddBalance] = useState("")
  const [addCurrency, setAddCurrency] = useState("USD")
  const [addNotes, setAddNotes] = useState("")

  // Goal form
  const [goalLabel, setGoalLabel] = useState("")
  const [goalTarget, setGoalTarget] = useState("")
  const [goalDate, setGoalDate] = useState("")

  useEffect(() => { setState(load()) }, [])
  useEffect(() => { save(state) }, [state])

  // FX rates
  async function fetchRates() {
    setFxLoading(true)
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD")
      const data = await res.json() as { rates: Record<string, number> }
      setFxRates(data.rates ?? {})
      toast.success("Currency rates updated")
    } catch {
      toast.error("Failed to fetch currency rates")
    }
    setFxLoading(false)
  }

  useEffect(() => { fetchRates() }, [])

  function toUSD(amount: number, currency: string) {
    if (currency === "USD") return amount
    const rate = fxRates[currency]
    if (!rate) return amount
    return amount / rate
  }

  const computed = useMemo(() => {
    const accounts = state.accounts.map((a) => ({
      ...a,
      usdEquivalent: toUSD(a.balance, a.currency),
    }))
    const totalAssets = accounts.filter((a) => a.isAsset).reduce((acc, a) => acc + a.usdEquivalent, 0)
    const totalLiabilities = accounts.filter((a) => !a.isAsset).reduce((acc, a) => acc + a.usdEquivalent, 0)
    const netWorth = totalAssets - totalLiabilities

    const assetsByCategory: Partial<Record<AssetCategory, number>> = {}
    accounts.filter((a) => a.isAsset).forEach((a) => {
      const cat = a.type as AssetCategory
      assetsByCategory[cat] = (assetsByCategory[cat] ?? 0) + a.usdEquivalent
    })

    return { accounts, totalAssets, totalLiabilities, netWorth, assetsByCategory }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.accounts, fxRates])

  function addAccount() {
    if (!addName.trim() || !addBalance) { toast.error("Name and balance required"); return }
    const balance = parseFloat(addBalance)
    if (isNaN(balance) || balance < 0) { toast.error("Invalid balance"); return }
    const account: Account = {
      id: crypto.randomUUID(),
      name: addName.trim(),
      institution: addInstitution.trim() || undefined,
      type: addType,
      isAsset: addIsAsset,
      balance,
      currency: addCurrency,
      usdEquivalent: toUSD(balance, addCurrency),
      lastUpdated: new Date().toISOString().slice(0, 10),
      notes: addNotes.trim() || undefined,
    }
    setState((prev) => ({ ...prev, accounts: [...prev.accounts, account] }))
    setAddName(""); setAddInstitution(""); setAddBalance(""); setAddNotes("")
    setAddType("cash-savings"); setAddIsAsset(true); setAddCurrency("USD")
    toast.success(`"${account.name}" added`)
    setView("dashboard")
  }

  function deleteAccount(id: string) {
    setState((prev) => ({ ...prev, accounts: prev.accounts.filter((a) => a.id !== id) }))
    toast.success("Account removed")
  }

  function takeSnapshot() {
    const snapshot: NetWorthSnapshot = {
      date: new Date().toISOString().slice(0, 10),
      totalAssets: computed.totalAssets,
      totalLiabilities: computed.totalLiabilities,
      netWorth: computed.netWorth,
    }
    setState((prev) => ({ ...prev, snapshots: [...prev.snapshots, snapshot] }))
    toast.success("Snapshot saved")
  }

  function addGoal() {
    if (!goalLabel.trim() || !goalTarget || !goalDate) { toast.error("All goal fields required"); return }
    const goal: NetWorthGoal = {
      id: crypto.randomUUID(),
      label: goalLabel.trim(),
      targetAmount: parseFloat(goalTarget),
      targetDate: goalDate,
    }
    setState((prev) => ({ ...prev, goals: [...prev.goals, goal] }))
    setGoalLabel(""); setGoalTarget(""); setGoalDate("")
    toast.success("Goal added")
  }

  async function getInsights() {
    setInsightsLoading(true)
    try {
      const breakdown = {
        assetsByCategory: computed.assetsByCategory,
        totalAssets: computed.totalAssets,
        totalLiabilities: computed.totalLiabilities,
      }
      const res = await fetch("/api/net-worth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai-insights",
          netWorth: computed.netWorth,
          totalAssets: computed.totalAssets,
          totalLiabilities: computed.totalLiabilities,
          breakdown,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setInsights(data.insights)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI insights failed")
    }
    setInsightsLoading(false)
  }

  const snapshotChartData = useMemo(() => {
    const sorted = [...state.snapshots].sort((a, b) => a.date.localeCompare(b.date)).slice(-12)
    if (sorted.length === 0 && computed.netWorth !== 0) {
      return [{ date: "Now", netWorth: computed.netWorth }]
    }
    return sorted.map((s) => ({ date: s.date.slice(5), netWorth: s.netWorth }))
  }, [state.snapshots, computed.netWorth])

  const maxSnapshotNW = useMemo(() =>
    Math.max(...snapshotChartData.map((d) => Math.abs(d.netWorth)), 1),
    [snapshotChartData]
  )

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Net Worth Tracker"
        icon={TrendingUp}
        color="text-emerald-500"
        badge="Finance"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchRates} disabled={fxLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${fxLoading ? "animate-spin" : ""}`} /> Rates
            </Button>
            <Button variant="outline" size="sm" onClick={takeSnapshot}>
              Save Snapshot
            </Button>
            <Button size="sm" onClick={() => setView("add-account")}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Account
            </Button>
          </div>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full space-y-6">

        {/* ── Add Account ── */}
        {view === "add-account" && (
          <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setView("dashboard")}>← Back</Button>
              <h1 className="text-2xl font-bold">Add Account</h1>
            </div>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setAddIsAsset(true); setAddType("cash-savings") }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${addIsAsset ? "bg-emerald-600 text-white border-emerald-600" : "border-border hover:bg-muted/50"}`}
                  >
                    Asset
                  </button>
                  <button
                    onClick={() => { setAddIsAsset(false); setAddType("mortgage") }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${!addIsAsset ? "bg-red-600 text-white border-red-600" : "border-border hover:bg-muted/50"}`}
                  >
                    Liability
                  </button>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Account Name *</label>
                  <Input placeholder="e.g. Chase Savings" value={addName} onChange={(e) => setAddName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Institution</label>
                  <Input placeholder="Chase, Fidelity..." value={addInstitution} onChange={(e) => setAddInstitution(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as AssetCategory | LiabilityCategory)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {addIsAsset
                      ? Object.entries(ASSET_CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)
                      : Object.entries(LIABILITY_CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)
                    }
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Balance *</label>
                    <Input type="number" placeholder="50000" value={addBalance} onChange={(e) => setAddBalance(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Currency</label>
                    <select value={addCurrency} onChange={(e) => setAddCurrency(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      {COMMON_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <Button className="w-full" onClick={addAccount}>
                  <Plus className="w-4 h-4 mr-2" /> Add {addIsAsset ? "Asset" : "Liability"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Dashboard ── */}
        {view === "dashboard" && (
          <>
            {/* Net Worth hero */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="sm:col-span-1">
                <CardContent className="py-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Net Worth</p>
                  <p className={`text-3xl font-bold ${computed.netWorth >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {formatUSD(computed.netWorth)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Total assets − liabilities</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Assets</p>
                  <p className="text-3xl font-bold text-emerald-500">{formatUSD(computed.totalAssets)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{state.accounts.filter((a) => a.isAsset).length} accounts</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Total Liabilities</p>
                  <p className="text-3xl font-bold text-red-500">{formatUSD(computed.totalLiabilities)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{state.accounts.filter((a) => !a.isAsset).length} accounts</p>
                </CardContent>
              </Card>
            </div>

            {state.accounts.length === 0 ? (
              <Card className="max-w-md mx-auto mt-8">
                <CardContent className="py-16 text-center">
                  <TrendingUp className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">Start tracking net worth</h2>
                  <p className="text-muted-foreground text-sm mb-6">Add your assets and liabilities to get started.</p>
                  <Button onClick={() => setView("add-account")}>
                    <Plus className="w-4 h-4 mr-1" /> Add First Account
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Asset allocation */}
                {computed.totalAssets > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Asset Allocation</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {(Object.entries(computed.assetsByCategory) as [AssetCategory, number][])
                          .sort(([, a], [, b]) => b - a)
                          .map(([cat, amt]) => {
                            const meta = ASSET_CATEGORY_META[cat]
                            const pct = (amt / computed.totalAssets) * 100
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className={`text-xs font-medium w-32 shrink-0 ${meta.color}`}>{meta.label}</span>
                                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${meta.barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                <div className="text-right shrink-0 w-28">
                                  <span className="text-xs text-muted-foreground">{formatUSD(amt)}</span>
                                  <span className="text-xs text-muted-foreground ml-1">({pct.toFixed(0)}%)</span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Net worth over time */}
                {snapshotChartData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Net Worth Over Time</CardTitle>
                        <Button size="sm" variant="outline" onClick={takeSnapshot}>Save Snapshot</Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-1.5 h-28">
                        {snapshotChartData.map((d, i) => {
                          const pct = Math.abs(d.netWorth) / maxSnapshotNW
                          const isPositive = d.netWorth >= 0
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className={`w-full rounded-t ${isPositive ? "bg-emerald-500/70" : "bg-red-500/70"}`}
                                style={{ height: `${pct * 100}px` }}
                              />
                              <span className="text-[9px] text-muted-foreground">{d.date}</span>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Accounts list */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Assets */}
                  <div>
                    <h2 className="text-sm font-semibold text-emerald-500 uppercase tracking-wider mb-3">Assets</h2>
                    <div className="space-y-2">
                      {computed.accounts.filter((a) => a.isAsset).map((a) => {
                        const meta = ASSET_CATEGORY_META[a.type as AssetCategory]
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{meta?.label}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                {a.currency !== "USD" ? `${a.currency} ${a.balance.toLocaleString()} ` : ""}
                                {formatUSD(a.usdEquivalent)}
                              </p>
                            </div>
                            <button onClick={() => deleteAccount(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                      {computed.accounts.filter((a) => a.isAsset).length === 0 && (
                        <p className="text-sm text-muted-foreground py-3 text-center">No assets yet</p>
                      )}
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div>
                    <h2 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3">Liabilities</h2>
                    <div className="space-y-2">
                      {computed.accounts.filter((a) => !a.isAsset).map((a) => {
                        const meta = LIABILITY_CATEGORY_META[a.type as LiabilityCategory]
                        return (
                          <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 group">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{a.name}</p>
                              <p className="text-xs text-muted-foreground">{meta?.label}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                {formatUSD(a.usdEquivalent)}
                              </p>
                            </div>
                            <button onClick={() => deleteAccount(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                      {computed.accounts.filter((a) => !a.isAsset).length === 0 && (
                        <p className="text-sm text-muted-foreground py-3 text-center">No liabilities yet</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* AI Insights */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-500" /> AI Insights
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={getInsights} disabled={insightsLoading}>
                        {insightsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Analyze"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {insights.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Click &quot;Analyze&quot; for AI-powered insights based on your current breakdown.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {insights.map((ins, i) => (
                          <div key={i} className={`p-3 rounded-lg border flex gap-3 ${
                            ins.type === "warning" ? "border-amber-500/30 bg-amber-500/5" :
                            ins.type === "positive" ? "border-emerald-500/30 bg-emerald-500/5" :
                            "border-blue-500/30 bg-blue-500/5"
                          }`}>
                            {ins.type === "warning"
                              ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              : ins.type === "positive"
                              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              : <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            }
                            <div>
                              <p className="text-sm font-medium">{ins.title}</p>
                              <p className="text-sm text-muted-foreground mt-0.5">{ins.insight}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Goals */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" /> Net Worth Goals
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Goal label" value={goalLabel} onChange={(e) => setGoalLabel(e.target.value)} />
                      <Input type="number" placeholder="Target ($)" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                      <Input type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
                    </div>
                    <Button size="sm" variant="outline" onClick={addGoal}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Goal
                    </Button>
                    {state.goals.map((goal) => {
                      const pct = Math.min(100, (computed.netWorth / goal.targetAmount) * 100)
                      const monthsLeft = Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
                      const neededPerMonth = monthsLeft > 0 ? (goal.targetAmount - computed.netWorth) / monthsLeft : 0
                      return (
                        <div key={goal.id} className="p-3 rounded-lg border space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">{goal.label}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant={pct >= 100 ? "default" : neededPerMonth < 0 ? "default" : "secondary"}>
                                {pct >= 100 ? "Achieved!" : `${pct.toFixed(0)}%`}
                              </Badge>
                              <button onClick={() => setState((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== goal.id) }))}>
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                              </button>
                            </div>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatUSD(computed.netWorth)} / {formatUSD(goal.targetAmount)}</span>
                            {monthsLeft > 0 && <span>~{formatUSD(Math.max(0, neededPerMonth))}/mo needed · {monthsLeft}mo left</span>}
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Plaid Teaser */}
                <Card className="border-dashed">
                  <CardContent className="py-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">Connect Bank Accounts</p>
                        <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Plaid integration will auto-sync balances from 12,000+ banks. Accounts update daily.
                      </p>
                    </div>
                    <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
