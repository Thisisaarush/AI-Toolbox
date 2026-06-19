"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Globe, Plus, Trash2, Copy, Check, Loader2, Search,
  AlertCircle, Shield, ChevronRight,
  Download, Info, Zap, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Domain, type DNSRecord, type RecordType, type PropagationResult,
  RECORD_TYPE_DESCRIPTIONS, DNS_TEMPLATES, getDaysUntilExpiry, getExpiryColor,
} from "./types"

const STORAGE_KEY = "dns-desk-v1"
const RECORD_TYPES: RecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA"]

function load(): Domain[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(d: Domain[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)) }

type View = "domains" | "domain-detail" | "propagation" | "cloudflare"

export function DNSDeskContent() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [view, setView] = useState<View>("domains")
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [search, setSearch] = useState("")
  const [copiedKey, setCopiedKey] = useState("")
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

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

  // Cloudflare
  const [cfToken, setCfToken] = useState("")
  const [cfZoneId, setCfZoneId] = useState("")
  const [cfLoading, setCfLoading] = useState(false)

  useEffect(() => { setDomains(load()) }, [])

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

  function updateDomain(id: string, updates: Partial<Domain>) {
    setDomains((prev) => {
      const next = prev.map((d) => d.id === id ? { ...d, ...updates, updatedAt: new Date().toISOString() } : d)
      save(next)
      return next
    })
    if (selectedDomain?.id === id) setSelectedDomain((p) => p ? { ...p, ...updates } : p)
  }

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

  function applyTemplate(templateId: string) {
    if (!selectedDomain) return
    const template = DNS_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const newRecords = template.records.map((r) => ({ ...r, id: crypto.randomUUID() }))
    updateDomain(selectedDomain.id, { records: [...selectedDomain.records, ...newRecords] })
    toast.success(`${template.label} template applied`)
  }

  async function checkPropagation() {
    if (!propDomain.trim()) { toast.error("Enter a domain"); return }
    setPropLoading(true)
    setPropResults([])
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "check-propagation", domain: propDomain, type: propType }),
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
    setHealthLoading(true)
    setHealthResult(null)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  async function importFromCloudflare() {
    if (!cfToken.trim() || !cfZoneId.trim()) { toast.error("API token and Zone ID required"); return }
    setCfLoading(true)
    try {
      const res = await fetch("/api/dns-desk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cloudflare-import", apiToken: cfToken, zoneId: cfZoneId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const now = new Date().toISOString()
      const domain: Domain = {
        id: crypto.randomUUID(),
        name: data.domain.name,
        registrar: "Cloudflare",
        expiryDate: "",
        autoRenewal: false,
        nameservers: data.domain.nameservers ?? [],
        records: data.domain.records,
        notes: `Imported from Cloudflare (Zone ID: ${cfZoneId})`,
        cloudflareZoneId: cfZoneId,
        isCloudflare: true,
        createdAt: now,
        updatedAt: now,
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
    const data = JSON.stringify(domains, null, 2)
    const blob = new Blob([data], { type: "application/json" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "dns-desk-export.json"
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Exported as JSON")
  }

  function exportCSV() {
    const rows = [["Domain", "Registrar", "Expiry", "Record Type", "Name", "Value", "TTL"]]
    domains.forEach((d) => {
      if (d.records.length === 0) {
        rows.push([d.name, d.registrar, d.expiryDate, "", "", "", ""])
      } else {
        d.records.forEach((r) => {
          rows.push([d.name, d.registrar, d.expiryDate, r.type, r.name, r.value, String(r.ttl)])
        })
      }
    })
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "dns-desk-export.csv"
    a.click()
    URL.revokeObjectURL(a.href)
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

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="DNS Desk"
        icon={Globe}
        color="text-teal-500"
        badge="Infrastructure"
        actions={
          <div className="flex gap-2">
            {view !== "domains" && <Button variant="outline" size="sm" onClick={() => { setView("domains"); setSelectedDomain(null) }}>← Back</Button>}
            {view === "domains" && (
              <>
                <Button size="sm" onClick={() => setShowAddDomain(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Domain</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("cloudflare")}>
                  <Zap className="w-3.5 h-3.5 mr-1" /> Cloudflare
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setView("propagation")}>
                  <Search className="w-3.5 h-3.5 mr-1" /> Propagation
                </Button>
                {domains.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={exportData}>
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── DOMAINS LIST ─────────────────────────────────────────────────── */}
        {view === "domains" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">DNS Desk</h1>
              <p className="text-muted-foreground">All your domains and DNS records in one place.</p>
            </div>

            {/* Add domain form */}
            {showAddDomain && (
              <Card className="border-teal-200 dark:border-teal-800">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Add Domain</p>
                    <button onClick={() => setShowAddDomain(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Domain name *</label>
                      <Input placeholder="example.com" value={newDomainName} onChange={(e) => setNewDomainName(e.target.value)} />
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
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addDomain}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAddDomain(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {domains.length > 0 && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search domains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1" /> CSV</Button>
              </div>
            )}

            {filteredDomains.length === 0 && !showAddDomain ? (
              <Card className="max-w-lg mx-auto mt-16">
                <CardContent className="py-16 text-center">
                  <Globe className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No domains yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">Add your domains manually or import from Cloudflare.</p>
                  <div className="flex gap-3 justify-center">
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
                      onClick={() => { setSelectedDomain(domain); setView("domain-detail") }}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <Globe className="w-4 h-4 text-teal-500 shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{domain.name}</p>
                                {domain.isCloudflare && <Badge variant="secondary" className="text-[10px]">Cloudflare</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {domain.registrar || "No registrar"} · {domain.records.length} records
                                {domain.notes && ` · ${domain.notes}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {days !== null && (
                              <div className="text-right">
                                <p className={`text-sm font-semibold ${expiryColor}`}>
                                  {days < 0 ? "Expired" : days === 0 ? "Today" : `${days}d`}
                                </p>
                                <p className="text-xs text-muted-foreground">until expiry</p>
                              </div>
                            )}
                            <Button
                              variant="ghost" size="icon-sm"
                              onClick={(e) => { e.stopPropagation(); deleteDomain(domain.id) }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
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

        {/* ── DOMAIN DETAIL ────────────────────────────────────────────────── */}
        {view === "domain-detail" && selectedDomain && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {selectedDomain.name}
                  {selectedDomain.isCloudflare && <Badge variant="secondary">Cloudflare</Badge>}
                </h1>
                <p className="text-muted-foreground text-sm">{selectedDomain.records.length} DNS records</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={checkHealth} disabled={healthLoading}>
                  {healthLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1" />}
                  Health Check
                </Button>
              </div>
            </div>

            {/* Health result */}
            {healthResult && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-teal-500" /> Domain Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { label: "HTTPS", ok: healthResult.httpsReachable, detail: `Status ${healthResult.httpsStatus}` },
                      { label: "www redirect", ok: healthResult.wwwReachable, detail: `Status ${healthResult.wwwStatus}` },
                      { label: "A Record", ok: healthResult.hasARecord, detail: healthResult.aRecords.slice(0, 2).join(", ") },
                      { label: "MX Record", ok: healthResult.hasMXRecord, detail: healthResult.hasMXRecord ? "Email configured" : "No email setup" },
                    ].map((item) => (
                      <div key={item.label} className={`flex items-center gap-3 p-3 rounded-lg border ${item.ok ? "border-green-200 bg-green-50 dark:bg-green-950" : "border-red-200 bg-red-50 dark:bg-red-950"}`}>
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
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Registrar</label>
                    <Input value={selectedDomain.registrar} onChange={(e) => updateDomain(selectedDomain.id, { registrar: e.target.value })} placeholder="Namecheap" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Expiry date</label>
                    <Input type="date" value={selectedDomain.expiryDate} onChange={(e) => updateDomain(selectedDomain.id, { expiryDate: e.target.value })} />
                  </div>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
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
                  <div className="space-y-2">
                    {subdomainMap.map(([sub, records]) => (
                      <div key={sub} className="flex items-start gap-3 p-2 border rounded">
                        <ChevronRight className="w-3.5 h-3.5 text-teal-500 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-medium">{sub}.{selectedDomain.name}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {records.map((r) => (
                              <span key={r.id} className="text-xs bg-muted/50 px-2 py-0.5 rounded font-mono">{r.type}: {r.value.slice(0, 40)}{r.value.length > 40 ? "..." : ""}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DNS Templates */}
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-teal-500" /> DNS Setup Templates</CardTitle></CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {DNS_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t.id)}
                      className="text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
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
                    <Plus className="w-3 h-3 mr-1" /> Add Record
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showAddRecord && (
                  <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-2">
                        <label className="text-xs font-medium mb-1 block">Type</label>
                        <select
                          value={newRecord.type}
                          onChange={(e) => setNewRecord((r) => ({ ...r, type: e.target.value as RecordType }))}
                          className="w-full h-8 rounded border border-input bg-background px-2 text-xs"
                        >
                          {RECORD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <label className="text-xs font-medium mb-1 block">Name</label>
                        <Input className="h-8 text-xs" value={newRecord.name} onChange={(e) => setNewRecord((r) => ({ ...r, name: e.target.value }))} placeholder="@" />
                      </div>
                      <div className="col-span-5">
                        <label className="text-xs font-medium mb-1 block">Value</label>
                        <Input className="h-8 text-xs" value={newRecord.value} onChange={(e) => setNewRecord((r) => ({ ...r, value: e.target.value }))} placeholder="1.2.3.4" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs font-medium mb-1 block">TTL</label>
                        <Input type="number" className="h-8 text-xs" value={newRecord.ttl} onChange={(e) => setNewRecord((r) => ({ ...r, ttl: parseInt(e.target.value) || 3600 }))} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addRecord}>Add</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddRecord(false)}>Cancel</Button>
                    </div>
                  </div>
                )}

                {selectedDomain.records.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No records yet. Add one or use a template above.</p>
                ) : (
                  <div className="space-y-1">
                    {selectedDomain.records.map((record) => (
                      <div key={record.id} className="group border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-3 px-3 py-2">
                          <Badge variant="secondary" className="font-mono text-[10px] w-12 justify-center shrink-0">{record.type}</Badge>
                          <span className="font-mono text-xs text-muted-foreground w-24 shrink-0 truncate">{record.name}</span>
                          <span className="font-mono text-xs flex-1 truncate">{record.value}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{record.ttl}s</span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                            >
                              <Info className="w-3 h-3" />
                            </button>
                            <button onClick={() => copyText(record.value, record.id)} className="p-1 text-muted-foreground hover:text-foreground">
                              {copiedKey === record.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button onClick={() => deleteRecord(selectedDomain.id, record.id)} className="p-1 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {expandedRecord === record.id && (
                          <div className="px-3 pb-3 border-t bg-muted/20">
                            <p className="text-xs text-muted-foreground mt-2">
                              <strong>What is a {record.type} record?</strong> {RECORD_TYPE_DESCRIPTIONS[record.type]}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── PROPAGATION CHECKER ──────────────────────────────────────────── */}
        {view === "propagation" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">DNS Propagation Checker</h1>
              <p className="text-muted-foreground text-sm">Check if your DNS changes have propagated across major resolvers.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="example.com or sub.example.com"
                    value={propDomain}
                    onChange={(e) => setPropDomain(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && checkPropagation()}
                    className="flex-1"
                  />
                  <select
                    value={propType}
                    onChange={(e) => setPropType(e.target.value as RecordType)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {["A", "AAAA", "CNAME", "MX", "TXT", "NS"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button onClick={checkPropagation} disabled={propLoading}>
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
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-sm">{r.resolver}</p>
                          <p className="text-xs text-muted-foreground">{r.ip} · {r.location}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.status === "ok" ? <Check className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                          {r.responseTime && <span className="text-xs text-muted-foreground">{r.responseTime}ms</span>}
                        </div>
                      </div>
                      {r.answer.length > 0 ? (
                        <div className="space-y-1">
                          {r.answer.map((a, i) => (
                            <code key={i} className="block text-xs bg-muted/50 px-2 py-1 rounded font-mono">{a}</code>
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
          <div className="space-y-6 max-w-lg mx-auto">
            <div>
              <h1 className="text-2xl font-bold mb-1">Cloudflare Import</h1>
              <p className="text-muted-foreground text-sm">Import your zones and DNS records from Cloudflare automatically.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Cloudflare API Token</label>
                  <Input
                    type="password"
                    placeholder="Your API token with Zone:Read, DNS:Read permissions"
                    value={cfToken}
                    onChange={(e) => setCfToken(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Create a token at cloudflare.com/profile/api-tokens with Zone Read + DNS Read permissions
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Zone ID</label>
                  <Input
                    placeholder="Your zone ID from the Cloudflare dashboard"
                    value={cfZoneId}
                    onChange={(e) => setCfZoneId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Found in your domain&apos;s Overview page in the right sidebar</p>
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
