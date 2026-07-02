"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useHashNav } from "@/lib/use-hash-nav"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Car, Plus, Trash2, AlertTriangle, CheckCircle2, Clock,
  ExternalLink, Search, Shield, ChevronRight, X, Loader2,
  Calendar, FileText, Fuel, Eye, Bell, Download, ArrowLeft,
  Edit3, MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { Vehicle, View } from "./types"
import {
  STORAGE_KEY, INDIAN_STATES, daysUntil, isExpiringSoon, isExpired,
} from "./types"

function loadVehicles(): Vehicle[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveVehicles(v: Vehicle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function formatNumber(n: string): string {
  const cleaned = n.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (cleaned.length <= 2) return cleaned
  if (cleaned.length <= 4) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 10)}`
}

function expiryColor(days: number): string {
  if (days < 0) return "text-red-600"
  if (days <= 15) return "text-red-500"
  if (days <= 30) return "text-amber-500"
  if (days <= 60) return "text-yellow-600"
  return "text-green-600"
}

function expiryBg(days: number): string {
  if (days < 0) return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
  if (days <= 15) return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
  if (days <= 30) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900"
  if (days <= 60) return "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
  return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900"
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="border border-border/60 rounded-xl p-4 bg-card flex-1 min-w-[140px]">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color ?? "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color ?? ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export function VehicleDeskContent() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [view, setView] = useState<View>("dashboard")
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  // API lookup states
  const [rcData, setRcData] = useState<Record<string, unknown> | null>(null)
  const [rcLoading, setRcLoading] = useState(false)
  const [rcError, setRcError] = useState("")
  const [challanData, setChallanData] = useState<Record<string, unknown> | null>(null)
  const [challanLoading, setChallanLoading] = useState(false)
  const [challanError, setChallanError] = useState("")

  // New vehicle form
  const [newNumber, setNewNumber] = useState("")
  const [newState, setNewState] = useState("KA")
  const [newMake, setNewMake] = useState("")
  const [newModel, setNewModel] = useState("")
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString())
  const [newFuel, setNewFuel] = useState<Vehicle["fuelType"]>("petrol")
  const [newPuc, setNewPuc] = useState("")
  const [newInsurance, setNewInsurance] = useState("")
  const [newRc, setNewRc] = useState("")
  const [newNotes, setNewNotes] = useState("")

  useHashNav(view, setView, ["dashboard", "add-vehicle", "vehicle-detail", "challan-check", "all-reminders"] as const)

  useEffect(() => { setVehicles(loadVehicles()) }, [])

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId],
  )

  const reminders = useMemo(() => {
    const items: { vehicle: Vehicle; label: string; date: string; days: number }[] = []
    for (const v of vehicles) {
      if (v.rcExpiry) items.push({ vehicle: v, label: "RC Expiry", date: v.rcExpiry, days: daysUntil(v.rcExpiry) })
      if (v.insuranceExpiry) items.push({ vehicle: v, label: "Insurance Expiry", date: v.insuranceExpiry, days: daysUntil(v.insuranceExpiry) })
      if (v.pucExpiry) items.push({ vehicle: v, label: "PUC Expiry", date: v.pucExpiry, days: daysUntil(v.pucExpiry) })
    }
    return items.sort((a, b) => a.days - b.days)
  }, [vehicles])

  const pendingChallansCount = useMemo(
    () => vehicles.reduce((s, v) => s + (v.pendingChallans ?? 0), 0),
    [vehicles],
  )
  const expiredCount = useMemo(
    () => reminders.filter((r) => r.days < 0).length,
    [reminders],
  )
  const expiringCount = useMemo(
    () => reminders.filter((r) => r.days >= 0 && r.days <= 30).length,
    [reminders],
  )

  function addVehicle() {
    if (!newNumber.trim()) { toast.error("Vehicle number is required"); return }
    const number = newNumber.toUpperCase().replace(/\s+/g, "")
    if (vehicles.some((v) => v.number === number)) { toast.error("Vehicle already added"); return }

    const vehicle: Vehicle = {
      id: uid(),
      number,
      state: newState,
      make: newMake,
      model: newModel,
      year: parseInt(newYear) || new Date().getFullYear(),
      fuelType: newFuel,
      rcExpiry: newRc,
      insuranceExpiry: newInsurance,
      pucExpiry: newPuc,
      fitnessExpiry: null,
      lastChallanCheck: null,
      pendingChallans: 0,
      notes: newNotes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [vehicle, ...vehicles]
    saveVehicles(updated)
    setVehicles(updated)
    setShowAdd(false)
    resetForm()
    toast.success(`${number} added`)
  }

  function removeVehicle(id: string) {
    const updated = vehicles.filter((v) => v.id !== id)
    saveVehicles(updated)
    setVehicles(updated)
    if (selectedVehicleId === id) { setSelectedVehicleId(null); setView("dashboard") }
    toast.success("Vehicle removed")
  }

  function resetForm() {
    setNewNumber(""); setNewMake(""); setNewModel("")
    setNewYear(new Date().getFullYear().toString())
    setNewFuel("petrol"); setNewPuc(""); setNewInsurance("")
    setNewRc(""); setNewNotes("")
  }

  function openDetail(v: Vehicle) {
    setSelectedVehicleId(v.id)
    setRcData(null); setRcError("")
    setChallanData(null); setChallanError("")
    setView("vehicle-detail")
  }

  async function lookupRC(number: string) {
    setRcLoading(true); setRcError(""); setRcData(null)
    try {
      const res = await fetch("/api/vehicle/rc-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleNumber: number }),
      })
      const json = await res.json()
      if (!res.ok) { setRcError(json.error ?? "Lookup failed"); return }
      setRcData(json.data)
    } catch { setRcError("Network error") }
    finally { setRcLoading(false) }
  }

  async function lookupChallans(number: string) {
    setChallanLoading(true); setChallanError(""); setChallanData(null)
    try {
      const res = await fetch("/api/vehicle/challan-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleNumber: number }),
      })
      const json = await res.json()
      if (!res.ok) { setChallanError(json.error ?? "Lookup failed"); return }
      setChallanData(json.data)
    } catch { setChallanError("Network error") }
    finally { setChallanLoading(false) }
  }

  return (
    <div>
      <ToolHeader
        icon={Car}
        title="Vehicle Desk"
        color="text-blue-600"
        badge="Personal"
        actions={
          view !== "dashboard" ? (
            <Button variant="ghost" size="sm" onClick={() => { setView("dashboard"); setSelectedVehicleId(null) }}>
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
            </Button>
          ) : (
            <Button size="sm" onClick={() => setView("add-vehicle")}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
            </Button>
          )
        }
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Track your vehicles, check challans, manage PUC and insurance expiries.</p>
          <p className="text-xs text-muted-foreground/70">
            {view === "dashboard" && "Overview of all saved vehicles with expiry alerts and pending challans."}
            {view === "add-vehicle" && "Add a new vehicle to your portfolio."}
            {view === "vehicle-detail" && "View vehicle details, expiries, and perform checks."}
            {view === "challan-check" && "Check pending traffic challans for any vehicle."}
            {view === "all-reminders" && "All upcoming expirations across your vehicles."}
          </p>
        </div>

        {/* ── Dashboard ─────────────────────────────────────────────── */}
        {view === "dashboard" && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex flex-wrap gap-3">
              <StatCard icon={Car} label="Vehicles" value={vehicles.length} color="text-blue-500" />
              <StatCard icon={AlertTriangle} label="Pending Challans" value={pendingChallansCount} color={pendingChallansCount > 0 ? "text-red-500" : "text-green-500"} />
              <StatCard icon={Clock} label="Expiring Soon" value={expiringCount} sub="within 30 days" color={expiringCount > 0 ? "text-amber-500" : "text-green-500"} />
              <StatCard icon={X} label="Expired" value={expiredCount} color={expiredCount > 0 ? "text-red-500" : "text-green-500"} />
            </div>

            {/* Reminders alert */}
            {reminders.filter((r) => r.days <= 30).length > 0 && (
              <Card className={`border-2 ${expiredCount > 0 ? "border-red-300 dark:border-red-800" : "border-amber-300 dark:border-amber-800"}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-500" />
                    Reminders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reminders.filter((r) => r.days <= 30).slice(0, 5).map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-medium">{r.vehicle.number}</span>
                          <span className="text-muted-foreground text-xs">{r.label}</span>
                        </div>
                        <span className={`text-xs font-medium shrink-0 ${expiryColor(r.days)}`}>
                          {r.days < 0 ? `Expired ${Math.abs(r.days)}d ago` : `in ${r.days}d`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {reminders.filter((r) => r.days <= 30).length > 5 && (
                    <Button variant="link" size="sm" className="text-xs mt-2" onClick={() => setView("all-reminders")}>
                      View all reminders
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Vehicle list */}
            {vehicles.length === 0 ? (
              <div className="text-center py-16">
                <Car className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">No vehicles yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Add your first vehicle to start tracking</p>
                <Button onClick={() => setView("add-vehicle")}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((v) => {
                  const pucDays = v.pucExpiry ? daysUntil(v.pucExpiry) : null
                  const insDays = v.insuranceExpiry ? daysUntil(v.insuranceExpiry) : null
                  const rcDays = v.rcExpiry ? daysUntil(v.rcExpiry) : null
                  const hasIssue = (pucDays !== null && pucDays <= 30) || (insDays !== null && insDays <= 30) || (rcDays !== null && rcDays <= 30) || (v.pendingChallans ?? 0) > 0

                  return (
                    <button
                      key={v.id}
                      onClick={() => openDetail(v)}
                      className="text-left border border-border/60 rounded-xl p-4 bg-card hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-base font-bold">{formatNumber(v.number)}</span>
                        <Badge variant={hasIssue ? "destructive" : "outline"} className="text-[10px]">
                          {hasIssue ? "Attention needed" : "All good"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.make} {v.model} · {v.year} · {v.fuelType.toUpperCase()}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rcDays !== null && (
                          <span className={`text-[10px] font-medium ${expiryColor(rcDays)}`}>
                            RC {rcDays < 0 ? "EXPIRED" : `${rcDays}d left`}
                          </span>
                        )}
                        {insDays !== null && (
                          <span className={`text-[10px] font-medium ${expiryColor(insDays)}`}>
                            Insurance {insDays < 0 ? "EXPIRED" : `${insDays}d left`}
                          </span>
                        )}
                        {pucDays !== null && (
                          <span className={`text-[10px] font-medium ${expiryColor(pucDays)}`}>
                            PUC {pucDays < 0 ? "EXPIRED" : `${pucDays}d left`}
                          </span>
                        )}
                        {(v.pendingChallans ?? 0) > 0 && (
                          <span className="text-[10px] font-medium text-red-500">
                            {v.pendingChallans} challan{v.pendingChallans !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Add Vehicle ───────────────────────────────────────────── */}
        {view === "add-vehicle" && (
          <div className="max-w-lg mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Add Vehicle</CardTitle>
                <CardDescription>Enter your vehicle details to add it to your portfolio</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-muted-foreground block mb-1">Vehicle Number</label>
                    <Input
                      placeholder="KA01AB1234"
                      value={newNumber}
                      onChange={(e) => setNewNumber(e.target.value.toUpperCase())}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">State</label>
                    <select
                      value={newState}
                      onChange={(e) => setNewState(e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    >
                      {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Make</label>
                    <Input placeholder="Maruti" value={newMake} onChange={(e) => setNewMake(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Model</label>
                    <Input placeholder="Swift" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Year</label>
                    <Input type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Fuel Type</label>
                  <div className="flex gap-2">
                    {(["petrol", "diesel", "cng", "ev", "hybrid"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setNewFuel(f)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          newFuel === f
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">RC Expiry</label>
                    <Input type="date" value={newRc} onChange={(e) => setNewRc(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Insurance Expiry</label>
                    <Input type="date" value={newInsurance} onChange={(e) => setNewInsurance(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">PUC Expiry</label>
                    <Input type="date" value={newPuc} onChange={(e) => setNewPuc(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <textarea
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button onClick={addVehicle} className="flex-1">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Vehicle
                  </Button>
                  <Button variant="outline" onClick={() => setView("dashboard")}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Vehicle Detail ────────────────────────────────────────── */}
        {view === "vehicle-detail" && selectedVehicle && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-mono text-xl">{formatNumber(selectedVehicle.number)}</CardTitle>
                    <CardDescription>{selectedVehicle.make} {selectedVehicle.model} · {selectedVehicle.year} · {selectedVehicle.fuelType.toUpperCase()}</CardDescription>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeVehicle(selectedVehicle.id)}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {/* Expiry Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "RC Expiry", date: selectedVehicle.rcExpiry, action: "Renew RC" },
                { label: "Insurance Expiry", date: selectedVehicle.insuranceExpiry, action: "Renew Insurance" },
                { label: "PUC Expiry", date: selectedVehicle.pucExpiry, action: "Get PUC" },
              ].map((item) => {
                if (!item.date) return null
                const days = daysUntil(item.date)
                return (
                  <div key={item.label} className={`border rounded-xl p-4 ${expiryBg(days)}`}>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-sm font-semibold">{new Date(item.date).toLocaleDateString()}</div>
                    <div className={`text-xs font-medium mt-1 ${expiryColor(days)}`}>
                      {days < 0 ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`}
                    </div>
                    <div className="mt-3 space-y-1">
                      {item.label === "PUC Expiry" && (
                        <a href={`https://puc.parivahan.gov.in/puc/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Check on Parivahan
                        </a>
                      )}
                      {item.label === "RC Expiry" && (
                        <a href={`https://vahan.parivahan.gov.in/vahan/`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline">
                          <ExternalLink className="w-3 h-3" /> Check on Vahan
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* RC Lookup */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> RC Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!rcData && !rcLoading && !rcError && (
                  <Button onClick={() => lookupRC(selectedVehicle.number)} size="sm">
                    <Search className="w-4 h-4 mr-1.5" /> Lookup RC from VAHAN
                  </Button>
                )}
                {rcLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Fetching RC data...
                  </div>
                )}
                {rcError && (
                  <div className="text-sm text-red-500 space-y-2">
                    <p>{rcError}</p>
                    <Button variant="outline" size="sm" onClick={() => lookupRC(selectedVehicle.number)}>
                      Retry
                    </Button>
                  </div>
                )}
                {rcData && (
                  <div className="text-sm space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-medium">Data fetched from VAHAN</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-3">
                      {Object.entries(rcData).map(([key, val]) => (
                        <div key={key} className="flex gap-1">
                          <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}:</span>
                          <span className="font-medium">{String(val ?? "-")}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Challan Check */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Traffic Challans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {selectedVehicle.pendingChallans > 0
                      ? `${selectedVehicle.pendingChallans} pending challan(s) on record`
                      : "No pending challans on record"}
                  </span>
                </div>
                {!challanData && !challanLoading && !challanError && (
                  <Button onClick={() => lookupChallans(selectedVehicle.number)} size="sm">
                    <Search className="w-4 h-4 mr-1.5" /> Check Challans Now
                  </Button>
                )}
                {challanLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Checking challans...
                  </div>
                )}
                {challanError && (
                  <div className="text-sm text-red-500 space-y-2">
                    <p>{challanError}</p>
                    <Button variant="outline" size="sm" onClick={() => lookupChallans(selectedVehicle.number)}>
                      Retry
                    </Button>
                  </div>
                )}
                {challanData && (
                  <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="font-medium">Challan check complete</span>
                    </div>
                    <pre className="text-xs bg-muted/30 rounded-lg p-3 overflow-x-auto max-h-60">
                      {JSON.stringify(challanData, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedVehicle.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedVehicle.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── All Reminders ─────────────────────────────────────────── */}
        {view === "all-reminders" && (
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No reminders. Add vehicles with expiry dates.</p>
              </div>
            ) : (
              reminders.map((r, i) => (
                <div key={i} className={`border rounded-xl p-4 ${expiryBg(r.days)}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold">{formatNumber(r.vehicle.number)}</span>
                        <span className="text-xs text-muted-foreground">{r.vehicle.make} {r.vehicle.model}</span>
                      </div>
                      <div className="text-sm mt-0.5">{r.label}</div>
                      <div className="text-xs text-muted-foreground">Expires: {new Date(r.date).toLocaleDateString()}</div>
                    </div>
                    <div className={`text-sm font-bold ${expiryColor(r.days)}`}>
                      {r.days < 0 ? `${Math.abs(r.days)}d ago` : `${r.days}d`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
