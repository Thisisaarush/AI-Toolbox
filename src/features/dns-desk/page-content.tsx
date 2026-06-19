"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Globe, Plus, Trash2, Copy, Check, Loader2, Search,
  AlertCircle, Shield, ChevronRight,
  Info, Zap, X, Pencil, FileCode2,
  Lock, RefreshCw, ArrowLeftRight, Activity,
  TrendingUp, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Domain, type DNSRecord, type RecordType, type PropagationResult,
  type SSLInfo, type WhoisInfo, type DnsDiffResult,
  RECORD_TYPE_DESCRIPTIONS, RECORD_TYPE_COLORS, DNS_TEMPLATES,
  getDaysUntilExpiry, getExpiryColor, getExpiryBadgeColor, estimateDomainValue,
} from "./types"

const STORAGE_KEY = "dns-desk-v1"
const RECORD_TYPES: RecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"]

function load(): Domain[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(d: Domain[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) }

type View = "domains" | "domain-detail" | "propagation" | "cloudflare" | "health-dashboard"
type DetailTab = "records" | "ssl" | "whois" | "diff"

interface EditingRecord {
  id: string
  type: RecordType
  name: string
  value: string
  ttl: number
}

// ── Record type pill ─────────────────────────────────────────────────────────
function RecordTypePill({ type }: { type: RecordType }) {
  return (
    <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold font-mono shrink-0 w-14 ${RECORD_TYPE_COLORS[type]}`}>
      {type}
    </span>
  )
}

// ── Expiry badge ─────────────────────────────────────────────────────────────
function ExpiryBadge({ days }: { days: number | null }) {
  const cls = getExpiryBadgeColor(days)
  const label = days === null
    ? "No expiry"
    : days < 0 ? "Expired"
      : days === 0 ? "Today"
        : `${days}d`
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── SSL expiry colour helper ──────────────────────────────────────────────────
function sslExpiryColor(days: number): string {
  if (days < 30) return "text-red-500"
  if (days < 90) return "text-amber-500"
  return "text-green-500"
}

export function DNSDeskContent() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [view, setView] = useState<View>("domains")
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>("records")
  const [search, setSearch] = useState("")
  const [copiedKey, setCopiedKey] = useState("")
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  // Inline record editing
  const [editingRecord, setEditingRecord] = useState<EditingRecord | null>(null)

  // Add domain form
  const [showAddDomain, setShowAddDomain] = useState(false)
  const [newDomainName, setNewDomainName] = useState("")
  const [newDomainRegistrar, setNewDomainRegistrar] = useState("")
  const [newDomainExpiry, setNewDomainExpiry] = useState("")
  const [newDomainNotes, setNewDomainNotes] = useState("")

  // Add record form
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [newRecord, setNewRecord] = useState<Omit<DNSRecord, "id">>({ type: "A", name: "@", value: "", ttl: 3600 })

  // Propagation checker
  const [propDomain, setPropDomain] = useState("")
  const [propType, setPropType] = useState<RecordType>("A")
  const [propResults, setPropResults] = useState<PropagationResult[]>([])
  const [propLoading, setPropLoading] = useState(false)

  // Domain health
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthResult, setHealthResult] = useState<{
    domain: string; httpsReachable: boolean; httpsStatus: number
    wwwReachable: boolean; wwwStatus: number; hasARecord: boolean
    hasMXRecord: boolean; aRecords: string[]; mxRecords: string[]
  } | null>(null)

  // SSL checker
  const [sslLoading, setSslLoading] = useState(false)
  const [sslInfo, setSslInfo] = useState<SSLInfo | null>(null)
  const [sslError, setSslError] = useState<string | null>(null)

  // WHOIS
  const [whoisLoading, setWhoisLoading] = useState(false)
  const [whoisInfo, setWhoisInfo] = useState<WhoisInfo | null>(null)

  // DNS Diff
  const [diffDomain, setDiffDomain] = useState("")
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffResult, setDiffResult] = useState<DnsDiffResult | null>(null)

  // Reverse DNS (PTR) per record
  const [ptrLoading, setPtrLoading] = useState<Record<string, boolean>>({})
  const [ptrResults, setPtrResults] = useState<Record<string, string | null>>({})

  // Health dashboard
  const [healthDashLoading, setHealthDashLoading] = useState<Record<string, boolean>>({})

  // Portfolio value
  const [showPortfolio, setShowPortfolio] = useState(false)

  // Cloudflare
  const [cfToken, setCfToken] = useState("")
  const [cfZoneId, setCfZoneId] = useState("")
  const [cfLoading, setCfLoading] = useState(false)

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false)

  useEffect(() => { setDomains(load()) }, [])

  useEffect(() => {
    if (!showExportMenu) return
    const handler = () => setShowExportMenu(false)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [showExportMenu])

  // Sync selectedDomain from domains state when domains update
  useEffect(() => {
    if (selectedDomain) {
      const updated = domains.find((d) => d.id === selectedDomain.id)
      if (updated) setSelectedDomain(updated)
    }
  }, [domains]) // eslint-disable-line react-hooks/exhaustive-deps

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  function addDomain() {
    if (!newDomainName.trim()) { toast.error("Domain name required"); return }
    const now = new Date().toISOString()
    const domain: Domain = {
      id: crypto.randomUUID(),
      name: newDomainName.trim().toLowerCase(),
      registrar: newDomainRegistrar,
      expiryDate: newDomainExpiry,
      autoRenewal: false,
      nameservers: [],
      records: [],
      notes: newDomainNotes,
      isCloudflare: false,
      createdAt: now,
      updatedAt: now,
    }
    setDomains((prev) => {
      const next = [...prev, domain]
      save(next)
      return next
    })
    setNewDomainName(""); setNewDomainRegistrar(""); setNewDomainExpiry(""); setNewDomainNotes("")
    setShowAddDomain(false)
    toast.success("Domain added")
  }

  const updateDomain = useCallback((id: string, updates: Partial<Domain>) => {
    setDomains((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
      save(next)
      return next
    })
  }, [])

  function deleteDomain(id: string) {
    setDomains((prev) => { const next = prev.filter((d) => d.id !== id); save(next); return next })
    if (selectedDomain?.id === id) { setSelectedDomain(null); setView("domains") }
    toast.success("Domain removed")
  }

  function addRecord() {
    if (!selectedDomain) return
    if (!newRecord.value.trim()) { toast.error("Record value required"); return }
    const record: DNSRecord = { ...newRecord, id: crypto.randomUUID() }
    const updatedRecords = [...selectedDomain.records, record]
    updateDomain(selectedDomain.id, { records: updatedRecords })
    setNewRecord({ type: "A", name: "@", value: "", ttl: 3600 })
    setShowAddRecord(false)
    toast.success("Record added")
  }

  function deleteRecord(domainId: string, recordId: string) {
    const domain = domains.find((d) => d.id === domainId)
    if (!domain) return
    updateDomain(domainId, { records: domain.records.filter((r) => r.id !== recordId) })
    toast.success("Record deleted")
  }

  function startEditRecord(record: DNSRecord) {
    setEditingRecord({ id: record.id, type: record.type, name: record.name, value: record.value, ttl: record.ttl })
    setExpandedRecord(null)
  }

  function saveEditRecord() {
    if (!selectedDomain || !editingRecord) return
    if (!editingRecord.value.trim()) { toast.error("Record value required"); return }
    const updatedRecords = selectedDomain.records.map((r) =>
      r.id === editingRecord.id
        ? { ...r, type: editingRecord.type, name: editingRecord.name, value: editingRecord.value, ttl: editingRecord.ttl }
        : r
    )
    updateDomain(selectedDomain.id, { records: updatedRecords })
    setEditingRecord(null)
    toast.success("Record updated")
  }

  function applyTemplate(templateId: string) {
    if (!selectedDomain) return
    const template = DNS_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const existingSet = new Set(selectedDomain.records.map((r) => `${r.type}:${r.name}:${r.value}`))
    const toAdd: DNSRecord[] = []
    let skipped = 0
    for (const r of template.records) {
      if (existingSet.has(`${r.type}:${r.name}:${r.value}`)) { skipped++ } else {
        toAdd.push({ ...r, id: crypto.randomUUID() })
      }
    }
    if (toAdd.length > 0) {
      updateDomain(selectedDomain.id, { records: [...selectedDomain.records, ...toAdd] })
    }
    if (skipped > 0) toast.warning(`Skipped ${skipped} duplicate record${skipped > 1 ? "s" : ""}`)
    if (toAdd.length > 0) toast.success(`${template.label} applied (${toAdd.length} records added)`)
    else if (skipped === template.records.length) toast.info("All records from this template already exist")
  }

  async function checkPropagation(domain?: string) {
    const target = domain ?? propDomain
    if (!target.trim()) { toast.error("Enter a domain"); return }
    if (domain) setPropDomain(domain)
    setPropLoading(true); setPropResults([]); setView("propagation")
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-propagation", domain: target, type: propType }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Check failed")
      setPropResults(data.results)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Check failed")
    }
    setPropLoading(false)
  }

  async function checkHealth() {
    if (!selectedDomain) return
    setHealthLoading(true); setHealthResult(null)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "domain-health", domain: selectedDomain.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Health check failed")
      setHealthResult(data.health)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Health check failed")
    }
    setHealthLoading(false)
  }

  async function checkSSL() {
    if (!selectedDomain) return
    setSslLoading(true); setSslInfo(null); setSslError(null)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-ssl", domain: selectedDomain.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "SSL check failed")
      if (data.ssl) {
        setSslInfo(data.ssl)
        updateDomain(selectedDomain.id, { sslInfo: data.ssl })
      } else {
        setSslError(data.message ?? "No SSL data found")
      }
    } catch (err: unknown) {
      setSslError(err instanceof Error ? err.message : "SSL check failed")
    }
    setSslLoading(false)
  }

  async function checkWHOIS() {
    if (!selectedDomain) return
    setWhoisLoading(true); setWhoisInfo(null)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "whois", domain: selectedDomain.name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "WHOIS lookup failed")
      setWhoisInfo(data.whois)
      updateDomain(selectedDomain.id, { whoisInfo: data.whois })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "WHOIS failed")
    }
    setWhoisLoading(false)
  }

  async function fetchPTR(recordId: string, ip: string) {
    setPtrLoading((p) => ({ ...p, [recordId]: true }))
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse-dns", ip }),
      })
      const data = await res.json()
      setPtrResults((p) => ({ ...p, [recordId]: data.ptr ?? null }))
    } catch {
      setPtrResults((p) => ({ ...p, [recordId]: null }))
    }
    setPtrLoading((p) => ({ ...p, [recordId]: false }))
  }

  async function runDNSDiff() {
    if (!selectedDomain || !diffDomain.trim()) { toast.error("Enter a domain to compare"); return }
    setDiffLoading(true); setDiffResult(null)
    try {
      const [aRes, bRes] = await Promise.all([
        fetch("/api/dns-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check-propagation", domain: selectedDomain.name, type: "A" }) }),
        fetch("/api/dns-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check-propagation", domain: diffDomain.trim(), type: "A" }) }),
      ])
      const [, bData] = await Promise.all([aRes.json(), bRes.json()])

      // Build simple record sets from domain's stored records + propagation data
      const domainARecords = selectedDomain.records.map((r) => ({ type: r.type, name: r.name, value: r.value }))
      const domainBAnswers: Array<{ type: RecordType; name: string; value: string }> = []

      // Use propagation result for comparison domain
      for (const result of (bData.results ?? [])) {
        for (const answer of (result.answer as string[] ?? [])) {
          domainBAnswers.push({ type: "A", name: "@", value: answer })
        }
        if (domainBAnswers.length > 0) break // only need one resolver's result
      }

      // Set diff: compare by type+name combination
      const aMap = new Map<string, string>()
      const bMap = new Map<string, string>()

      domainARecords.forEach((r) => { aMap.set(`${r.type}:${r.name}`, r.value) })
      domainBAnswers.forEach((r) => { bMap.set(`${r.type}:${r.name}`, r.value) })

      const onlyInA: DnsDiffResult["onlyInA"] = []
      const onlyInB: DnsDiffResult["onlyInB"] = []
      const different: DnsDiffResult["different"] = []
      const identical: DnsDiffResult["identical"] = []
      const allKeys = new Set([...aMap.keys(), ...bMap.keys()])

      for (const key of allKeys) {
        const [type, name] = key.split(":") as [RecordType, string]
        const va = aMap.get(key)
        const vb = bMap.get(key)
        if (va && !vb) onlyInA.push({ type, name, value: va })
        else if (!va && vb) onlyInB.push({ type, name, value: vb })
        else if (va && vb) {
          if (va !== vb) different.push({ type, name, valueA: va, valueB: vb })
          else identical.push({ type, name, value: va })
        }
      }

      setDiffResult({ onlyInA, onlyInB, different, identical })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_err: unknown) {
      toast.error("DNS diff failed")
    }
    setDiffLoading(false)
  }

  function copyZoneFile() {
    if (!selectedDomain) return
    const lines = [
      `$ORIGIN ${selectedDomain.name}.`,
      `$TTL 3600`,
      ``,
      ...selectedDomain.records.map((r) => {
        const name = r.name === "@" ? "@" : r.name
        const priority = r.priority != null ? `${r.priority} ` : ""
        return `${name} IN ${r.type} ${priority}${r.value}`
      }),
    ]
    copyText(lines.join("\n"), "zone-file")
  }

  async function runHealthDashboardCheck(domain: Domain) {
    setHealthDashLoading((p) => ({ ...p, [domain.id]: true }))
    try {
      const [healthRes, sslRes] = await Promise.all([
        fetch("/api/dns-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "domain-health", domain: domain.name }) }),
        fetch("/api/dns-desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "check-ssl", domain: domain.name }) }),
      ])
      const [healthData, sslData] = await Promise.all([healthRes.json(), sslRes.json()])
      const cache = {
        https: healthData.health?.httpsReachable ?? false,
        sslDays: sslData.ssl?.daysUntilExpiry ?? null,
        lastChecked: new Date().toISOString(),
      }
      updateDomain(domain.id, { healthCache: cache })
    } catch {
      // silently fail per-domain
    }
    setHealthDashLoading((p) => ({ ...p, [domain.id]: false }))
  }

  async function runCheckAllHealth() {
    for (const domain of domains) {
      await runHealthDashboardCheck(domain)
    }
    toast.success("All health checks complete")
  }

  async function importFromCloudflare() {
    if (!cfToken.trim() || !cfZoneId.trim()) { toast.error("API token and Zone ID required"); return }
    setCfLoading(true)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cloudflare-import", apiToken: cfToken, zoneId: cfZoneId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const now = new Date().toISOString()
      const domain: Domain = {
        id: crypto.randomUUID(), name: data.domain.name, registrar: "Cloudflare",
        expiryDate: "", autoRenewal: false, nameservers: data.domain.nameservers ?? [],
        records: data.domain.records, notes: `Imported from Cloudflare (Zone ID: ${cfZoneId})`,
        cloudflareZoneId: cfZoneId, isCloudflare: true, createdAt: now, updatedAt: now,
      }
      setDomains((prev) => {
        const next = [domain, ...prev.filter((d) => d.name !== domain.name)]
        save(next)
        return next
      })
      setCfToken(""); setCfZoneId("")
      toast.success(`Imported ${data.domain.name} with ${data.domain.records.length} records`)
      setView("domains")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    }
    setCfLoading(false)
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(domains, null, 2)], { type: "application/json" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dns-desk-export.json"; a.click(); URL.revokeObjectURL(a.href)
    toast.success("Exported as JSON")
  }

  function exportCSV() {
    const rows = [["Domain", "Registrar", "Expiry", "Record Type", "Name", "Value", "TTL"]]
    domains.forEach((d) => {
      if (d.records.length === 0) rows.push([d.name, d.registrar, d.expiryDate, "", "", "", ""])
      else d.records.forEach((r) => rows.push([d.name, d.registrar, d.expiryDate, r.type, r.name, r.value, String(r.ttl)]))
    })
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "dns-desk-export.csv"; a.click(); URL.revokeObjectURL(a.href)
    toast.success("Exported as CSV")
  }

  const filteredDomains = useMemo(() => {
    if (!search) return domains
    return domains.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
  }, [domains, search])

  const subdomainMap = useMemo(() => {
    if (!selectedDomain) return []
    const subs = new Map<string, DNSRecord[]>()
    selectedDomain.records.forEach((r) => {
      const key = r.name === "@" || r.name === selectedDomain.name ? "(root)" : r.name
      if (!subs.has(key)) subs.set(key, [])
      subs.get(key)!.push(r)
    })
    return Array.from(subs.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [selectedDomain])

  const portfolioTotal = useMemo(() => domains.reduce((sum, d) => sum + estimateDomainValue(d.name), 0), [domains])

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="DNS Desk"
        icon={Globe}
        color="text-teal-500"
        badge="Infrastructure"
        actions={
          <div className="flex gap-3 items-center">
            {view !== "domains" && (
              <Button variant="outline" size="sm" onClick={() => { setView("domains"); setSelectedDomain(null) }}>← Back</Button>
            )}
            {view === "domains" && (
              <>
                <span className="text-xs text-muted-foreground hidden sm:inline">{domains.length} domain{domains.length !== 1 ? "s" : ""}</span>
                <Button size="sm" onClick={() => setShowAddDomain(true)}><Plus className="w-4 h-4 mr-1" /> Add Domain</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("health-dashboard")}>
                  <Activity className="w-4 h-4 mr-1" /> Health
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView("cloudflare")}>
                  <Zap className="w-4 h-4 mr-1" /> Cloudflare
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setPropDomain(""); setView("propagation") }}>
                  <Search className="w-4 h-4 mr-1" /> Propagation
                </Button>
                {domains.length > 0 && (
                  <div className="relative" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => setShowExportMenu((v) => !v)}>Export</Button>
                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-md p-1 flex flex-col min-w-[100px]">
                        <button className="text-sm px-4 py-2 rounded hover:bg-muted text-left" onClick={() => { exportData(); setShowExportMenu(false) }}>JSON</button>
                        <button className="text-sm px-4 py-2 rounded hover:bg-muted text-left" onClick={() => { exportCSV(); setShowExportMenu(false) }}>CSV</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        }
      />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── DOMAINS LIST ─────────────────────────────────────────────────── */}
        {view === "domains" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold mb-1">DNS Desk</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">All your domains and DNS records in one place.</p>
            </div>

            {/* Add domain form */}
            {showAddDomain && (
              <Card className="border-teal-200 dark:border-teal-800">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Add Domain</p>
                    <button onClick={() => setShowAddDomain(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Domain name *</label>
                      <Input placeholder="example.com" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDomain()} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Registrar</label>
                      <Input placeholder="Namecheap, GoDaddy, Cloudflare..." value={newDomainRegistrar} onChange={(e) => setNewDomainRegistrar(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Expiry date</label>
                      <Input type="date" value={newDomainExpiry} onChange={(e) => setNewDomainExpiry(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Notes</label>
                      <Input placeholder="Production site, client X..." value={newDomainNotes} onChange={(e) => setNewDomainNotes(e.target.value)} />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button size="sm" onClick={addDomain}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDomain(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {domains.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search domains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
            )}

            {filteredDomains.length === 0 && !showAddDomain ? (
              <Card className="max-w-lg mx-auto mt-16">
                <CardContent className="py-16 text-center">
                  <Globe className="w-14 h-14 mx-auto mb-5 text-muted-foreground opacity-40" />
                  <h2 className="text-2xl font-semibold mb-3">No domains yet</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-8">Add your domains manually or import from Cloudflare.</p>
                  <div className="flex gap-4 justify-center">
                    <Button onClick={() => setShowAddDomain(true)}><Plus className="w-4 h-4 mr-1" /> Add Domain</Button>
                    <Button variant="outline" onClick={() => setView("cloudflare")}><Zap className="w-4 h-4 mr-1" /> Cloudflare Import</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredDomains.map((domain) => {
                  const days = domain.expiryDate ? getDaysUntilExpiry(domain.expiryDate) : null
                  const expiryColor = days !== null ? getExpiryColor(days) : "text-muted-foreground"
                  return (
                    <Card
                      key={domain.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedDomain(domain); setDetailTab("records"); setView("domain-detail") }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${domain.healthCache?.https === true ? "bg-green-500" : domain.healthCache?.https === false ? "bg-red-500" : "bg-gray-300 dark:bg-gray-600"}`} title={domain.healthCache ? (domain.healthCache.https ? "HTTPS OK" : "HTTPS unreachable") : "Not checked"} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <p className="font-semibold font-mono text-sm">{domain.name}</p>
                                {domain.isCloudflare && <Badge variant="secondary" className="text-xs">CF</Badge>}
                                <span className="text-xs text-muted-foreground">{domain.records.length} records</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{domain.registrar || "No registrar"}{domain.notes ? ` · ${domain.notes}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            {days !== null && (
                              <div className="text-right hidden sm:block">
                                <p className={`text-sm font-semibold tabular-nums ${expiryColor}`}>
                                  {days < 0 ? "Expired" : days === 0 ? "Today" : `${days}d`}
                                </p>
                                <p className="text-xs text-muted-foreground">expiry</p>
                              </div>
                            )}
                            <ExpiryBadge days={days} />
                            <Button
                              variant="ghost" size="icon"
                              onClick={(e) => { e.stopPropagation(); deleteDomain(domain.id) }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Portfolio Value Estimator */}
            {domains.length > 0 && (
              <div>
                <button
                  onClick={() => setShowPortfolio((v) => !v)}
                  className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Portfolio Value Estimator
                  {showPortfolio ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showPortfolio && (
                  <Card className="mt-2 border-dashed">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-muted-foreground">Estimated total portfolio value</p>
                        <p className="text-xl font-bold text-teal-600">${portfolioTotal.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        {domains.map((d) => {
                          const val = estimateDomainValue(d.name)
                          return (
                            <div key={d.id} className="flex items-center justify-between text-xs">
                              <span className="font-mono text-muted-foreground">{d.name}</span>
                              <span className="font-medium">${val.toLocaleString()}</span>
                            </div>
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-3 italic">Estimated values only — not financial advice. Based on TLD, length, and word count heuristics.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── HEALTH DASHBOARD ─────────────────────────────────────────────── */}
        {view === "health-dashboard" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold">Domain Health Dashboard</h1>
                <p className="text-muted-foreground text-sm leading-relaxed">HTTPS, SSL, and expiry status across all domains.</p>
              </div>
              <Button onClick={runCheckAllHealth} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1" /> Check All
              </Button>
            </div>
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">No domains to check.</p>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left px-4 py-2.5 font-medium">Domain</th>
                        <th className="text-center px-4 py-2.5 font-medium">HTTPS</th>
                        <th className="text-center px-4 py-2.5 font-medium">SSL (days)</th>
                        <th className="text-center px-4 py-2.5 font-medium">Domain expiry</th>
                        <th className="text-center px-4 py-2.5 font-medium">Last checked</th>
                        <th className="text-center px-4 py-2.5 font-medium">Check</th>
                      </tr>
                    </thead>
                    <tbody>
                      {domains.map((domain) => {
                        const loading = healthDashLoading[domain.id]
                        const cache = domain.healthCache
                        const domainDays = domain.expiryDate ? getDaysUntilExpiry(domain.expiryDate) : null
                        return (
                          <tr key={domain.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-2.5">
                              <button
                                className="font-mono text-sm font-medium hover:text-teal-500 transition-colors text-left"
                                onClick={() => { setSelectedDomain(domain); setDetailTab("records"); setView("domain-detail") }}
                              >
                                {domain.name}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {cache ? (
                                cache.https
                                  ? <Check className="w-4 h-4 text-green-500 mx-auto" />
                                  : <X className="w-4 h-4 text-red-500 mx-auto" />
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {cache?.sslDays != null ? (
                                <span className={`font-medium tabular-nums ${sslExpiryColor(cache.sslDays)}`}>{cache.sslDays}d</span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <ExpiryBadge days={domainDays} />
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                              {cache ? new Date(cache.lastChecked).toLocaleString() : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Button variant="ghost" size="icon" onClick={() => runHealthDashboardCheck(domain)} disabled={loading}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── DOMAIN DETAIL ────────────────────────────────────────────────── */}
        {view === "domain-detail" && selectedDomain && (
          <div className="space-y-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold font-mono flex items-center gap-3">
                  {selectedDomain.name}
                  {selectedDomain.isCloudflare && <Badge variant="secondary">Cloudflare</Badge>}
                </h1>
                <p className="text-muted-foreground text-sm leading-relaxed">{selectedDomain.records.length} DNS records · {selectedDomain.registrar || "No registrar"}</p>
              </div>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
                  {healthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
                  Health
                </Button>
                <Button variant="outline" size="sm" onClick={() => checkPropagation(selectedDomain.name)}>
                  <Search className="w-4 h-4 mr-1" /> Propagation
                </Button>
                <Button variant="outline" size="sm" onClick={copyZoneFile}>
                  <FileCode2 className="w-4 h-4 mr-1" /> Copy Zone File
                </Button>
              </div>
            </div>

            {/* Health result */}
            {healthResult && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-3"><Shield className="w-4 h-4 text-teal-500" /> Domain Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: "HTTPS", ok: healthResult.httpsReachable, detail: `Status ${healthResult.httpsStatus}` },
                      { label: "www redirect", ok: healthResult.wwwReachable, detail: `Status ${healthResult.wwwStatus}` },
                      { label: "A Record", ok: healthResult.hasARecord, detail: healthResult.aRecords.slice(0, 2).join(", ") },
                      { label: "MX Record", ok: healthResult.hasMXRecord, detail: healthResult.hasMXRecord ? "Email configured" : "No email setup" },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-4 p-4 rounded-lg border ${item.ok ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}`}>
                        {item.ok ? <Check className="w-4 h-4 text-green-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Domain info */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Domain Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Registrar</label>
                    <Input value={selectedDomain.registrar} onChange={(e) => updateDomain(selectedDomain.id, { registrar: e.target.value })} placeholder="Namecheap" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Expiry date</label>
                    <Input type="date" value={selectedDomain.expiryDate} onChange={(e) => updateDomain(selectedDomain.id, { expiryDate: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-4 cursor-pointer">
                  <input type="checkbox" checked={selectedDomain.autoRenewal} onChange={(e) => updateDomain(selectedDomain.id, { autoRenewal: e.target.checked })} className="w-4 h-4 rounded" />
                  <span className="text-sm">Auto-renewal enabled</span>
                </label>
                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea value={selectedDomain.notes} onChange={(e) => updateDomain(selectedDomain.id, { notes: e.target.value })} rows={2} placeholder="Production site, client notes..." />
                </div>
              </CardContent>
            </Card>

            {/* Subdomain map */}
            {subdomainMap.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Subdomain Map</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {subdomainMap.map(([sub, records]) => {
                      const displayLabel = sub === "(root)" ? selectedDomain.name : `${sub}.${selectedDomain.name}`
                      return (
                        <div key={sub} className="flex items-start gap-4 p-3 border rounded-lg">
                          <ChevronRight className="w-4 h-4 text-teal-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono font-medium">{displayLabel}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {records.map((r) => (
                                <span key={r.id} className={`text-xs px-1.5 py-0.5 rounded font-mono ${RECORD_TYPE_COLORS[r.type]}`}>{r.type}: {r.value.slice(0, 40)}{r.value.length > 40 ? "…" : ""}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Detail tabs */}
            <div className="flex gap-1.5 border-b">
              {(["records", "ssl", "whois", "diff"] as DetailTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${detailTab === tab ? "border-teal-500 text-teal-600 dark:text-teal-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {tab === "ssl" ? "SSL" : tab === "diff" ? "DNS Diff" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* ── Records Tab ─────────────────────────────────────────────── */}
            {detailTab === "records" && (
              <div className="space-y-5">
                {/* DNS Templates */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-3"><Zap className="w-4 h-4 text-teal-500" /> DNS Setup Templates</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {DNS_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t.id)}
                          className="text-left p-2.5 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-xs text-muted-foreground">{t.description} · {t.records.length} records</p>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* DNS Records */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">DNS Records ({selectedDomain.records.length})</CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setShowAddRecord(!showAddRecord)}>
                        <Plus className="w-4 h-4 mr-1" /> Add Record
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {showAddRecord && (
                      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs font-medium mb-1 block">Type</label>
                            <select value={newRecord.type} onChange={(e) => setNewRecord((r) => ({ ...r, type: e.target.value as RecordType }))} className="w-full h-9 rounded border border-input bg-background px-3 text-xs">
                              {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div className="col-span-3">
                            <label className="text-xs font-medium mb-1 block">Name</label>
                            <Input className="h-9 text-xs" value={newRecord.name} onChange={(e) => setNewRecord((r) => ({ ...r, name: e.target.value }))} placeholder="@" />
                          </div>
                          <div className="col-span-5">
                            <label className="text-xs font-medium mb-1 block">Value</label>
                            <Input className="h-9 text-xs" value={newRecord.value} onChange={(e) => setNewRecord((r) => ({ ...r, value: e.target.value }))} placeholder="1.2.3.4" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-medium mb-1 block">TTL (s)</label>
                            <Input type="number" className="h-9 text-xs" value={newRecord.ttl} onChange={(e) => setNewRecord((r) => ({ ...r, ttl: parseInt(e.target.value) || 3600 }))} />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">3600 = 1h · 86400 = 1d · 300 = 5m</p>
                        <div className="flex gap-3">
                          <Button size="sm" onClick={addRecord}>Add</Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowAddRecord(false)}>Cancel</Button>
                        </div>
                      </div>
                    )}

                    {selectedDomain.records.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No records yet. Add one or apply a template above.</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedDomain.records.map((record) => {
                          if (editingRecord?.id === record.id) {
                            return (
                              <div key={record.id} className="border rounded-lg p-4 bg-muted/20 space-y-3">
                                <div className="grid grid-cols-12 gap-3">
                                  <div className="col-span-2">
                                    <label className="text-xs font-medium mb-1 block">Type</label>
                                    <select value={editingRecord.type} onChange={(e) => setEditingRecord((r) => r ? { ...r, type: e.target.value as RecordType } : r)} className="w-full h-9 rounded border border-input bg-background px-3 text-xs">
                                      {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  <div className="col-span-3">
                                    <label className="text-xs font-medium mb-1 block">Name</label>
                                    <Input className="h-9 text-xs" value={editingRecord.name} onChange={(e) => setEditingRecord((r) => r ? { ...r, name: e.target.value } : r)} />
                                  </div>
                                  <div className="col-span-5">
                                    <label className="text-xs font-medium mb-1 block">Value</label>
                                    <Input className="h-9 text-xs" value={editingRecord.value} onChange={(e) => setEditingRecord((r) => r ? { ...r, value: e.target.value } : r)} />
                                  </div>
                                  <div className="col-span-2">
                                    <label className="text-xs font-medium mb-1 block">TTL (s)</label>
                                    <Input type="number" className="h-9 text-xs" value={editingRecord.ttl} onChange={(e) => setEditingRecord((r) => r ? { ...r, ttl: parseInt(e.target.value) || 3600 } : r)} />
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Button size="sm" onClick={saveEditRecord}><Check className="w-4 h-4 mr-1" /> Save</Button>
                                  <Button variant="ghost" size="sm" onClick={() => setEditingRecord(null)}>Cancel</Button>
                                </div>
                              </div>
                            )
                          }

                          const showPTR = record.type === "A"
                          return (
                            <div key={record.id} className="border rounded-lg overflow-hidden">
                              <div className="flex items-center gap-3 px-4 py-2.5">
                                <RecordTypePill type={record.type} />
                                <span className="font-mono text-xs text-muted-foreground w-20 shrink-0 truncate">{record.name}</span>
                                <span className="font-mono text-xs flex-1 truncate">{record.value}</span>
                                <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">{record.ttl}s</span>
                                <div className="flex gap-1.5 shrink-0">
                                  {showPTR && (
                                    <button
                                      onClick={() => fetchPTR(record.id, record.value)}
                                      className="px-1.5 py-0.5 text-xs font-mono border rounded hover:bg-muted text-muted-foreground"
                                      title="Reverse DNS lookup"
                                      disabled={ptrLoading[record.id]}
                                    >
                                      {ptrLoading[record.id] ? "…" : "PTR"}
                                    </button>
                                  )}
                                  <button onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)} className="p-1 text-muted-foreground hover:text-foreground" title="Info">
                                    <Info className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => startEditRecord(record)} className="p-1 text-muted-foreground hover:text-foreground" title="Edit">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => copyText(record.value, record.id)} className="p-1 text-muted-foreground hover:text-foreground">
                                    {copiedKey === record.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                  </button>
                                  <button onClick={() => deleteRecord(selectedDomain.id, record.id)} className="p-1 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {/* PTR result */}
                              {showPTR && ptrResults[record.id] !== undefined && (
                                <div className="px-4 pb-2 flex items-center gap-3 text-xs">
                                  <span className="text-muted-foreground">PTR:</span>
                                  <code className="font-mono">{ptrResults[record.id] ?? "No PTR record"}</code>
                                </div>
                              )}
                              {expandedRecord === record.id && (
                                <div className="px-4 pb-3 border-t bg-muted/20">
                                  <p className="text-xs text-muted-foreground mt-2">
                                    <strong>What is a {record.type} record?</strong> {RECORD_TYPE_DESCRIPTIONS[record.type]}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ── SSL Tab ──────────────────────────────────────────────────── */}
            {detailTab === "ssl" && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-3"><Lock className="w-4 h-4 text-teal-500" /> SSL Certificate</CardTitle>
                    <Button variant="outline" size="sm" onClick={checkSSL} disabled={sslLoading}>
                      {sslLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      Check SSL
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {sslError && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                      {sslError}
                    </div>
                  )}
                  {(sslInfo ?? selectedDomain.sslInfo) && (() => {
                    const info = sslInfo ?? selectedDomain.sslInfo!
                    return (
                      <div className="space-y-4">
                        <div className={`flex items-center gap-3 p-4 rounded-lg border ${info.isValid ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}`}>
                          {info.isValid ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                          <div>
                            <p className="text-sm font-semibold">{info.isValid ? "Valid certificate" : "Certificate expired or invalid"}</p>
                            <p className={`text-xs font-medium ${sslExpiryColor(info.daysUntilExpiry)}`}>{info.daysUntilExpiry > 0 ? `${info.daysUntilExpiry} days until expiry` : "Expired"}</p>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Issuer</p>
                            <p className="text-xs font-mono">{info.issuer}</p>
                          </div>
                          {info.certName && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">Common Name</p>
                              <p className="text-xs font-mono">{info.certName}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Valid From</p>
                            <p className="text-xs">{info.validFrom ? new Date(info.validFrom).toLocaleDateString() : "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Valid To</p>
                            <p className="text-xs">{info.validTo ? new Date(info.validTo).toLocaleDateString() : "—"}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                  {!sslInfo && !selectedDomain.sslInfo && !sslError && !sslLoading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Click "Check SSL" to fetch certificate transparency data from crt.sh.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── WHOIS Tab ────────────────────────────────────────────────── */}
            {detailTab === "whois" && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-3"><Globe className="w-4 h-4 text-teal-500" /> WHOIS Lookup</CardTitle>
                    <Button variant="outline" size="sm" onClick={checkWHOIS} disabled={whoisLoading}>
                      {whoisLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
                      WHOIS Lookup
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(whoisInfo ?? selectedDomain.whoisInfo) && (() => {
                    const info = whoisInfo ?? selectedDomain.whoisInfo!
                    return (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          {info.registrar && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">Registrar</p>
                              <p className="text-sm">{info.registrar}</p>
                            </div>
                          )}
                          {info.creationDate && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">Created</p>
                              <p className="text-sm">{info.creationDate}</p>
                            </div>
                          )}
                          {info.expiryDate && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">Expires</p>
                              <p className="text-sm">{info.expiryDate}</p>
                            </div>
                          )}
                          {info.nameServers && info.nameServers.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">Name Servers</p>
                              <div className="space-y-0.5">
                                {info.nameServers.map((ns) => (
                                  <p key={ns} className="text-xs font-mono">{ns}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {!info.registrar && !info.creationDate && !info.expiryDate && (
                          <p className="text-sm text-muted-foreground">WHOIS data not available via API.</p>
                        )}
                        <a
                          href={info.whoisUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs text-teal-600 hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                          View full WHOIS on who.is
                        </a>
                      </div>
                    )
                  })()}
                  {!whoisInfo && !selectedDomain.whoisInfo && !whoisLoading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">Click "WHOIS Lookup" to fetch registration data.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── DNS Diff Tab ─────────────────────────────────────────────── */}
            {detailTab === "diff" && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-3"><ArrowLeftRight className="w-4 h-4 text-teal-500" /> DNS Diff</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-xs text-muted-foreground">Compare DNS records between <strong>{selectedDomain.name}</strong> and another domain (e.g. staging vs production).</p>
                  <div className="flex gap-3">
                    <Input
                      placeholder="staging.example.com"
                      value={diffDomain}
                      onChange={(e) => setDiffDomain(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && runDNSDiff()}
                      className="flex-1"
                    />
                    <Button variant="outline" size="sm" onClick={runDNSDiff} disabled={diffLoading}>
                      {diffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                    </Button>
                  </div>

                  {diffResult && (
                    <div className="space-y-4">
                      {diffResult.onlyInA.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-600 mb-1">Only in {selectedDomain.name} ({diffResult.onlyInA.length})</p>
                          <div className="space-y-1">
                            {diffResult.onlyInA.map((r, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded text-xs font-mono">
                                <RecordTypePill type={r.type} />
                                <span className="text-muted-foreground">{r.name}</span>
                                <span>{r.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {diffResult.onlyInB.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-green-600 mb-1">Only in {diffDomain} ({diffResult.onlyInB.length})</p>
                          <div className="space-y-1">
                            {diffResult.onlyInB.map((r, i) => (
                              <div key={i} className="flex items-center gap-3 px-3 py-1.5 bg-green-50 dark:bg-green-950 rounded text-xs font-mono">
                                <RecordTypePill type={r.type} />
                                <span className="text-muted-foreground">{r.name}</span>
                                <span>{r.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {diffResult.different.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-orange-600 mb-1">Different values ({diffResult.different.length})</p>
                          <div className="space-y-3">
                            {diffResult.different.map((r, i) => (
                              <div key={i} className="text-xs font-mono">
                                <div className="flex items-center gap-3 mb-1">
                                  <RecordTypePill type={r.type} />
                                  <span>{r.name}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950 rounded truncate">{r.valueA}</div>
                                  <div className="px-3 py-1.5 bg-green-50 dark:bg-green-950 rounded truncate">{r.valueB}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {diffResult.identical.length > 0 && (
                        <p className="text-xs text-muted-foreground">{diffResult.identical.length} record{diffResult.identical.length !== 1 ? "s" : ""} identical in both domains.</p>
                      )}
                      {diffResult.onlyInA.length === 0 && diffResult.onlyInB.length === 0 && diffResult.different.length === 0 && (
                        <p className="text-sm text-green-600">All compared records are identical.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── PROPAGATION CHECKER ──────────────────────────────────────────── */}
        {view === "propagation" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-3xl font-bold mb-1">DNS Propagation Checker</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">Check if your DNS changes have propagated across major resolvers.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="example.com or sub.example.com"
                    value={propDomain}
                    onChange={(e) => setPropDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkPropagation()}
                    className="flex-1"
                  />
                  <select value={propType} onChange={(e) => setPropType(e.target.value as RecordType)} className="h-10 rounded-md border border-input bg-background px-4 text-sm">
                    {["A", "AAAA", "CNAME", "MX", "TXT", "NS"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button onClick={() => checkPropagation()} disabled={propLoading}>
                    {propLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {propResults.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-4">
                {propResults.map((r) => (
                  <Card key={r.resolver} className={r.status === "ok" ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="font-semibold text-sm">{r.resolver}</p>
                          <p className="text-xs text-muted-foreground">{r.ip} · {r.location}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {r.status === "ok" ? <Check className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                          {r.responseTime && <span className="text-xs text-muted-foreground">{r.responseTime}ms</span>}
                        </div>
                      </div>
                      {r.answer.length > 0 ? (
                        <div className="space-y-1">
                          {r.answer.map((a, i) => (
                            <code key={i} className="block text-xs bg-muted/50 px-3 py-1.5 rounded font-mono">{a}</code>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No records found</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CLOUDFLARE IMPORT ────────────────────────────────────────────── */}
        {view === "cloudflare" && (
          <div className="space-y-5 max-w-lg mx-auto">
            <div>
              <h1 className="text-3xl font-bold mb-1">Cloudflare Import</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">Import your zones and DNS records from Cloudflare automatically.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-5">
                <div>
                  <label className="text-xs font-medium mb-1 block">Cloudflare API Token</label>
                  <Input type="password" placeholder="Your API token with Zone:Read, DNS:Read permissions" value={cfToken} onChange={(e) => setCfToken(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Create at cloudflare.com/profile/api-tokens — Zone Read + DNS Read permissions</p>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Zone ID</label>
                  <Input placeholder="Your zone ID from the Cloudflare dashboard" value={cfZoneId} onChange={(e) => setCfZoneId(e.target.value)} />
                  <p className="text-xs text-muted-foreground mt-1">Found in your domain&apos;s Overview page (right sidebar)</p>
                </div>
                <Button className="w-full" onClick={importFromCloudflare} disabled={cfLoading}>
                  {cfLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                    : <><Zap className="w-4 h-4 mr-2" /> Import from Cloudflare</>
                  }
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
