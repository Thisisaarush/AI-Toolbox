"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useHashNav } from "@/lib/use-hash-nav"
import { ToolHeader } from "@/components/shared/tool-header"
import { useSubscription } from "@/components/shared/subscription-context"
import {
  Shield, Search, RotateCw, FileText, AlertTriangle,
  CheckCircle2, TrendingUp, ChevronDown, ChevronUp,
  Sparkles, Download, Loader2, ExternalLink, Package,
  Box, Star, AlertCircle, BookOpen, X, Layers, Trash2, Pencil,
  Zap, Info, GitFork, Hash, Calendar,
  Users, ArrowUpDown, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type DepInfo, type ScanResult, type ScanHistoryEntry, type View,
  getScoreCategory, HEALTH_LABELS, HEALTH_COLORS, HEALTH_BG, HEALTH_BAR,
} from "./types"

const STORAGE_KEY = "dependguard-v1"
const HISTORY_KEY = "dependguard-history-v1"


function loadHistory(): ScanHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") } catch { return [] }
}
function saveHistory(entries: ScanHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}
function loadLastResult(): ScanResult | null {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") } catch { return null }
}
function saveLastResult(r: ScanResult) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r))
}

// ── SAMPLE package.json ──────────────────────────────────────────────────────
const SAMPLE_PACKAGE_JSON = JSON.stringify({
  name: "my-project",
  version: "1.0.0",
  dependencies: {
    "next": "14.2.0",
    "react": "18.3.0",
    "react-dom": "18.3.0",
    "axios": "1.6.0",
    "lodash": "4.17.21",
    "zod": "3.22.0",
    "date-fns": "3.0.0",
    "zustand": "4.4.0",
    "clsx": "2.0.0",
  },
  devDependencies: {
    "typescript": "5.3.0",
    "eslint": "8.50.0",
    "prettier": "3.1.0",
    "vitest": "1.2.0",
    "tailwindcss": "3.4.0",
  },
}, null, 2)

// ── Health gauge ──────────────────────────────────────────────────────────────
function HealthGauge({ score, size = "sm" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const category = getScoreCategory(score)
  const dims = size === "lg" ? 64 : size === "md" ? 48 : 36
  const stroke = size === "lg" ? 6 : size === "md" ? 5 : 4
  const radius = (dims - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ
  const fontSize = size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-[10px]"

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dims, height: dims }}>
      <svg width={dims} height={dims} className="-rotate-90">
        <circle cx={dims / 2} cy={dims / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-gray-200 dark:text-gray-700" />
        <circle cx={dims / 2} cy={dims / 2} r={radius} fill="none" strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className={HEALTH_BAR[category]} />
      </svg>
      <span className={`absolute font-bold ${fontSize} ${HEALTH_COLORS[category]}`}>{score}</span>
    </div>
  )
}

// ── Health badge ──────────────────────────────────────────────────────────────
function HealthBadge({ score }: { score: number }) {
  const cat = getScoreCategory(score)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${HEALTH_BG[cat]} ${HEALTH_COLORS[cat]}`}>
      {cat === "good" ? <CheckCircle2 className="w-3 h-3" /> : cat === "fair" ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
      {HEALTH_LABELS[cat]}
    </span>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, loading }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  color: string
  loading?: boolean
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={`p-2 rounded-lg ${color.replace("text-", "bg-").replace("500", "100").replace("600", "100")} dark:${color.replace("text-", "bg-").replace("500", "900/30").replace("600", "900/30")}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
        </div>
        <div className="mt-3">
          {loading ? (
            <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
          ) : (
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
          )}
          <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Dep row ───────────────────────────────────────────────────────────────────
function DepRow({ dep, defaultOpen }: { dep: DepInfo; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const cat = getScoreCategory(dep.healthScore)

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors text-left"
      >
        <HealthGauge score={dep.healthScore} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {dep.scope && (
              <span className="text-[10px] font-mono text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {dep.scope}
              </span>
            )}
            <span className="font-mono text-sm font-semibold truncate">{dep.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{dep.currentVersion}</span>
            {dep.isOutdated && (
              <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                → {dep.latestVersion}
              </span>
            )}
          </div>
          {dep.description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">{dep.description}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dep.typosquatScore > 50 && (
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
              TYPO?
            </span>
          )}
          {dep.isDeprecated && (
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
              DEPRECATED
            </span>
          )}
          {dep.vulnerabilityCount > 0 && (
            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
              {dep.vulnerabilityCount} VULN
            </span>
          )}
          <HealthBadge score={dep.healthScore} />
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50/50 dark:bg-gray-900/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {dep.license && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">License</div>
                <div className="font-medium">{dep.license}</div>
              </div>
            )}
            {dep.lastPublishDate && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Last Published</div>
                <div className="font-medium">{new Date(dep.lastPublishDate).toLocaleDateString()}</div>
              </div>
            )}
            {dep.downloadCount !== null && (
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Monthly Downloads</div>
                <div className="font-medium">{dep.downloadCount.toLocaleString()}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-muted-foreground mb-0.5">Dependencies</div>
              <div className="font-medium">{dep.dependencyCount}</div>
            </div>
          </div>

          {dep.deprecatedReason && (
            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
              <span className="font-semibold">Deprecation:</span> {dep.deprecatedReason}
            </div>
          )}

          {dep.typosquatOf && dep.typosquatScore > 50 && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
              <span className="font-semibold">Typosquatting risk:</span> This package closely resembles "{dep.typosquatOf}" ({dep.typosquatScore}% similarity). Verify it's the intended package.
            </div>
          )}

          {dep.aiRiskSummary && (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-800 dark:text-blue-200">
              <span className="font-semibold">AI Analysis:</span> {dep.aiRiskSummary}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {dep.homepage && (
              <a href={dep.homepage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <ExternalLink className="w-3 h-3" /> Homepage
              </a>
            )}
            {dep.repository && (
              <a href={dep.repository.replace("git+", "").replace(".git", "")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                <GitFork className="w-3 h-3" /> Repository
              </a>
            )}
            <a
              href={`https://www.npmjs.com/package/${dep.name}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Package className="w-3 h-3" /> npm
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sort controls ─────────────────────────────────────────────────────────────
type SortKey = "health" | "name" | "version" | "outdated"
function SortControls({ sortKey, sortDesc, onToggle }: {
  sortKey: SortKey
  sortDesc: boolean
  onToggle: (key: SortKey) => void
}) {
  const sorts: { key: SortKey; label: string }[] = [
    { key: "health", label: "Health" },
    { key: "name", label: "Name" },
    { key: "version", label: "Version" },
    { key: "outdated", label: "Outdated" },
  ]
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Sort:</span>
      {sorts.map((s) => (
        <button
          key={s.key}
          onClick={() => onToggle(s.key)}
          className={`px-2 py-0.5 rounded font-medium transition-colors ${
            sortKey === s.key
              ? "bg-gray-200 dark:bg-gray-700 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {s.label} {sortKey === s.key && (sortDesc ? "↓" : "↑")}
        </button>
      ))}
    </div>
  )
}

// ── AI Summary Panel ──────────────────────────────────────────────────────────
function AISummaryPanel({ summary, loading, error }: {
  summary: string | null
  loading?: boolean
  error?: string | null
}) {
  const [open, setOpen] = useState(true)

  if (!summary && !loading && !error) return null

  return (
    <Card className={loading ? "opacity-60" : ""}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <CardTitle className="text-sm">AI Analysis</CardTitle>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">PRO</Badge>
        </div>
        <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="p-4 pt-2">
          {loading ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-full" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-5/6" />
            </div>
          ) : error ? (
            <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
          ) : (
            <div className="text-sm prose prose-sm dark:prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-1">
              {summary?.split("\n").map((line, i) => {
                if (line.startsWith("**") && line.endsWith("**")) {
                  return <p key={i} className="font-semibold mt-3 mb-1">{line.replace(/\*\*/g, "")}</p>
                }
                if (line.startsWith("- ")) {
                  return <li key={i} className="text-sm">{line.slice(2)}</li>
                }
                if (line.trim() === "") return <br key={i} />
                return <p key={i} className="text-sm">{line}</p>
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── Scan result dashboard ─────────────────────────────────────────────────────
function ScanDashboard({ result, loading, onNewScan, onAiAnalysis, aiLoading, aiError }: {
  result: ScanResult
  loading?: boolean
  onNewScan: () => void
  onAiAnalysis?: () => void
  aiLoading?: boolean
  aiError?: string | null
}) {
  const { subscription } = useSubscription()
  const isPro = subscription.plan === "pro"
  const [searchFilter, setSearchFilter] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("health")
  const [sortDesc, setSortDesc] = useState(true)
  const [showDev, setShowDev] = useState(false)

  const allDeps = useMemo(() => {
    const deps = showDev ? [...result.dependencies, ...result.devDependencies] : result.dependencies
    const filtered = deps.filter((d) => d.name.toLowerCase().includes(searchFilter.toLowerCase()))
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === "health") cmp = a.healthScore - b.healthScore
      else if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "version") cmp = a.currentVersion.localeCompare(b.currentVersion)
      else if (sortKey === "outdated") cmp = Number(a.isOutdated) - Number(b.isOutdated)
      return sortDesc ? -cmp : cmp
    })
    return sorted
  }, [result, searchFilter, sortKey, sortDesc, showDev])

  function handleSortToggle(key: SortKey) {
    if (sortKey === key) setSortDesc(!sortDesc)
    else { setSortKey(key); setSortDesc(true) }
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="flex flex-wrap gap-3">
        <StatCard icon={Package} label="Total Dependencies" value={result.totalDeps} color="text-blue-500" />
        <StatCard icon={TrendingUp} label="Health Score" value={`${result.averageHealthScore}`} sub={`${getScoreCategory(result.averageHealthScore)}`} color={result.averageHealthScore >= 70 ? "text-green-500" : result.averageHealthScore >= 40 ? "text-amber-500" : "text-red-500"} />
        <StatCard icon={AlertTriangle} label="Outdated" value={result.outdatedCount} color={result.outdatedCount > 0 ? "text-amber-500" : "text-green-500"} />
        <StatCard icon={AlertCircle} label="Deprecated" value={result.deprecatedCount} color={result.deprecatedCount > 0 ? "text-red-500" : "text-green-500"} />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewScan}>
          <RotateCw className="w-3.5 h-3.5 mr-1.5" /> New Scan
        </Button>
      </div>

      {isPro && <AISummaryPanel summary={result.aiSummary} loading={aiLoading} error={aiError} />}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter packages..."
            className="pl-8 h-9 text-sm"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>
        <SortControls sortKey={sortKey} sortDesc={sortDesc} onToggle={handleSortToggle} />
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={showDev}
            onChange={(e) => setShowDev(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600"
          />
          Show dev deps
        </label>
      </div>

      {/* Dep list */}
      <div className="space-y-2">
          {allDeps.map((dep) => (
          <DepRow key={dep.name} dep={dep} />
        ))}
        {allDeps.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {searchFilter ? "No packages match your filter" : "No dependencies found"}
          </div>
        )}
      </div>


    </div>
  )
}

// ── Scanner input ─────────────────────────────────────────────────────────────
function ScannerView({ onResult, loading }: {
  onResult: (r: ScanResult) => void
  loading: boolean
}) {
  const [pkgJson, setPkgJson] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleScan() {
    if (!pkgJson.trim()) { toast.error("Enter a package.json"); return }
    try {
      JSON.parse(pkgJson) // validate
    } catch {
      setError("Invalid JSON — check for trailing commas or syntax errors")
      toast.error("Invalid JSON")
      return
    }
    setError(null)

    const res = await fetch("/api/dependguard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan-deps", packageJson: pkgJson }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Scan failed" }))
      setError(err.error)
      toast.error(err.error)
      return
    }

    const result: ScanResult = await res.json()

    // Save to history
    const history = loadHistory()
    history.unshift({
      id: result.id,
      scannedAt: result.scannedAt,
      packageName: "package.json scan",
      totalDeps: result.totalDeps,
      averageHealthScore: result.averageHealthScore,
      vulnerableCount: result.vulnerableCount,
      outdatedCount: result.outdatedCount,
    })
    saveHistory(history.slice(0, 50)) // keep last 50
    saveLastResult(result)

    onResult(result)
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold">Paste your package.json</label>
          <button
            onClick={() => setPkgJson(SAMPLE_PACKAGE_JSON)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Load sample
          </button>
        </div>
        <Textarea
          placeholder={`{\n  "dependencies": {\n    "next": "14.2.0",\n    "react": "18.3.0"\n  }\n}`}
          className="font-mono text-sm min-h-[250px]"
          value={pkgJson}
          onChange={(e) => { setPkgJson(e.target.value); setError(null) }}
        />
        {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
      </div>

      <Button onClick={handleScan} disabled={loading} className="w-full sm:w-auto">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
        {loading ? "Scanning dependencies..." : "Scan Dependencies"}
      </Button>

      {loading && (
        <div className="text-xs text-muted-foreground animate-pulse">
          Fetching package data from npm registry... this may take a moment for projects with many dependencies.
        </div>
      )}
    </div>
  )
}

// ── Package Lookup ────────────────────────────────────────────────────────────
function LookupView() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ name: string; scope: string | null; publisher: string | null; version: string; description: string; lastPublishDate: string; healthScore: number | null }[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
  async function handleSearch() {
    if (query.length < 2) return
    setLoading(true)
    try {
      const res = await fetch("/api/dependguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "search-packages", query }),
      })
      if (!res.ok) throw new Error("Search failed")
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      toast.error("Search failed")
    } finally {
      setLoading(false)
    }
  }

  async function handleLookup(name: string) {
    setSelected(name)
    setDetail(null)
    try {
      const res = await fetch("/api/dependguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lookup-package", name }),
      })
      if (!res.ok) throw new Error("Lookup failed")
      const data = await res.json()
      setDetail(data)
    } catch {
      toast.error("Lookup failed")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search npm packages..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || query.length < 2}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((pkg) => (
            <div key={pkg.name}>
              <button
                onClick={() => handleLookup(pkg.name)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selected === pkg.name
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-700 rounded-b-none"
                    : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {pkg.scope && pkg.scope !== "unscoped" && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          {pkg.scope}
                        </span>
                      )}
                      <span className="font-mono text-sm font-semibold">{pkg.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">v{pkg.version}</span>
                      {pkg.healthScore !== null && (
                        <HealthBadge score={pkg.healthScore} />
                      )}
                    </div>
                    {pkg.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">{pkg.description}</div>
                    )}
                  </div>
                  {pkg.publisher && (
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                      by {pkg.publisher}
                    </span>
                  )}
                </div>
              </button>

              {selected === pkg.name && detail && (
                <Card className="border-t-0 rounded-t-none">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted-foreground">Latest Version</div>
                        <div className="font-mono font-medium">{(detail as any).latestVersion}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">License</div>
                        <div className="font-medium">{(detail as any).license ?? "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Monthly Downloads</div>
                        <div className="font-medium">{(detail as any).downloadCount?.toLocaleString() ?? "N/A"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Total Versions</div>
                        <div className="font-medium">{(detail as any).totalVersions}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Last Published</div>
                        <div className="font-medium">{(detail as any).lastPublishDate ? new Date((detail as any).lastPublishDate).toLocaleDateString() : "N/A"}</div>
                      </div>
                    </div>
                    {(detail as any).description && (
                      <div className="mt-3 text-xs text-muted-foreground">{(detail as any).description}</div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <a href={`https://www.npmjs.com/package/${selected}`} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm"><ExternalLink className="w-3 h-3 mr-1.5" /> npm</Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── History ────────────────────────────────────────────────────────────────────
function HistoryView({ onLoad }: { onLoad: (r: ScanResult) => void }) {
  const [history, setHistory] = useState<ScanHistoryEntry[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  function handleClear() {
    saveHistory([])
    setHistory([])
    toast.success("History cleared")
  }

  function handleDelete(id: string) {
    const updated = history.filter((h) => h.id !== id)
    saveHistory(updated)
    setHistory(updated)
  }

  function handleRename(id: string) {
    const updated = history.map((h) =>
      h.id === id ? { ...h, packageName: editName.trim() || h.packageName } : h
    )
    saveHistory(updated)
    setHistory(updated)
    setEditingId(null)
    toast.success("Renamed")
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
        No scan history yet. Run your first scan to see results here.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{history.length} scans saved</span>
        <Button variant="ghost" size="sm" onClick={handleClear} className="text-xs text-red-500 hover:text-red-600">
          Clear all
        </Button>
      </div>

      {history.map((entry) => (
        <div key={entry.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {editingId === entry.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-8 text-sm max-w-xs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(entry.id)
                      if (e.key === "Escape") setEditingId(null)
                    }}
                  />
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => handleRename(entry.id)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const result = loadLastResult()
                    if (result?.id === entry.id) onLoad(result)
                    else toast.error("Scan result no longer available")
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{entry.packageName ?? "Dependency Scan"}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(entry.id); setEditName(entry.packageName ?? "") }}
                      className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(entry.scannedAt).toLocaleString()} · {entry.totalDeps} deps
                  </div>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 ml-3">
              <HealthBadge score={entry.averageHealthScore} />
              {entry.outdatedCount > 0 && (
                <span className="text-xs text-amber-600 dark:text-amber-400">{entry.outdatedCount} outdated</span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id) }}
                className="text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function DependGuardContent() {
  const [view, setView] = useState<View>("scanner")
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<ScanResult | null>(null)

  useHashNav(view, setView, ["scanner", "lookup", "history"] as const)

  useEffect(() => {
    const saved = loadLastResult()
    if (saved) setLastResult(saved)
  }, [])

  const handleScanResult = useCallback((result: ScanResult) => {
    setLastResult(result)
    setView("scanner") // shows result via lastResult
    toast.success(`Scanned ${result.totalDeps} dependencies`)
  }, [])

  const handleAiAnalysis = useCallback(async () => {
    if (!lastResult || !lastResult.aiSummary) return
    setAiLoading(true)
    setAiError(null)
    const allDeps = [...lastResult.dependencies, ...lastResult.devDependencies]
    try {
      const res = await fetch("/api/dependguard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai-analysis", deps: allDeps, geminiKey: localStorage.getItem("toolbox-gemini-key") }),
      })
      if (res.status === 402) {
        setAiError("AI analysis requires a Gemini API key. Add one in Settings.")
        return
      }
      if (!res.ok) throw new Error("AI analysis failed")
      const data = await res.json()
      const updated = { ...lastResult, aiSummary: data.summary }
      setLastResult(updated)
      saveLastResult(updated)
    } catch {
      setAiError("AI analysis failed. Check your Gemini key and try again.")
    } finally {
      setAiLoading(false)
    }
  }, [lastResult])

  const views: { id: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "scanner", label: "Scanner", icon: Shield },
    { id: "lookup", label: "Package Lookup", icon: Search },
    { id: "history", label: "History", icon: BookOpen },
  ]

  return (
    <div>
      <ToolHeader
        icon={Shield}
        title="DependGuard"
        color="text-emerald-500"
        badge="Dev Tool"
        actions={
          <div className="flex items-center gap-2">
            {views.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  view === v.id
                    ? "bg-gray-200 dark:bg-gray-700 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <v.icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Scan your package.json for outdated, vulnerable, or typosquatted dependencies.</p>
          <p className="text-xs text-muted-foreground/70">
            {view === "scanner" && "Review health scores and alerts for all dependencies."}
            {view === "lookup" && "Search the npm registry for any package."}
            {view === "history" && "Revisit past scans."}
          </p>
        </div>

        {view === "scanner" && (
          <>
            {lastResult && !loading ? (
              <ScanDashboard
                result={lastResult}
                onNewScan={() => { setLastResult(null); setAiError(null) }}
                onAiAnalysis={handleAiAnalysis}
                aiLoading={aiLoading}
                aiError={aiError}
              />
            ) : (
              <ScannerView onResult={handleScanResult} loading={loading} />
            )}

          </>
        )}

        {view === "lookup" && <LookupView />}
        {view === "history" && (
          <HistoryView onLoad={(r) => { setLastResult(r); setView("scanner") }} />
        )}
      </main>
    </div>
  )
}
