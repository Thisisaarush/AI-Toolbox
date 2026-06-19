"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Plane, Plus, Trash2, Loader2, Check, X, MapPin,
  FileText, Package, DollarSign, AlertTriangle, Clock,
  ExternalLink, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Trip, type TravelStore, type DocChecklistItem, type Booking,
  type PackingItem, type TripExpense, type EmergencyInfo,
  type TripPurpose, type TripStatus, type ExpenseCat,
  EXPENSE_CATS, PURPOSE_LABELS, STATUS_COLORS, CAT_COLORS,
} from "./types"

const STORAGE_KEY = "travel-docs-v1"
function loadStore(): TravelStore {
  if (typeof window === "undefined") return { trips:[], checklists:[], bookings:[], packingItems:[], packingTemplates:[], expenses:[], emergencyInfos:[], exchangeRates:{} }
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { trips:[], checklists:[], bookings:[], packingItems:[], packingTemplates:[], expenses:[], emergencyInfos:[], exchangeRates:{} } }
  catch { return { trips:[], checklists:[], bookings:[], packingItems:[], packingTemplates:[], expenses:[], emergencyInfos:[], exchangeRates:{} } }
}
function saveStore(s: TravelStore) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type MainTab = "trips" | "packing" | "expenses" | "emergency"
type TripTab = "overview" | "docs" | "bookings" | "packing" | "expenses"

function daysUntil(d: string) {
  return Math.ceil((new Date(d + "T12:00:00").getTime() - Date.now()) / 86400000)
}
function tripDuration(t: Trip) {
  return Math.max(1, Math.ceil((new Date(t.returnDate + "T12:00:00").getTime() - new Date(t.departureDate + "T12:00:00").getTime()) / 86400000))
}

// ── Boarding pass card ────────────────────────────────────────────────────────
function BoardingPassCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const days = daysUntil(trip.departureDate)
  const dur = tripDuration(trip)
  const statusCls = STATUS_COLORS[trip.status]
  const isPast = days < 0

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden border hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 group"
    >
      {/* Colored top strip */}
      <div className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-600" />
      <div className="p-5 bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="w-4 h-4 text-cyan-400 shrink-0" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">To</span>
            </div>
            <h3 className="text-2xl font-black tracking-tight truncate">{trip.destination}</h3>
            <p className="text-sm text-muted-foreground mt-1">{PURPOSE_LABELS[trip.purpose]} · {dur} day{dur !== 1 ? "s" : ""}</p>
          </div>
          <div className="text-right shrink-0">
            <Badge variant="secondary" className={`${statusCls} mb-2`}>{trip.status}</Badge>
            <div>
              {isPast ? (
                <p className="text-xs text-muted-foreground">Completed</p>
              ) : (
                <>
                  <p className="text-3xl font-black text-cyan-400">{days}</p>
                  <p className="text-xs text-muted-foreground">days away</p>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Dashed divider with circle cutouts */}
        <div className="relative my-4 border-t border-dashed border-border" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Depart: <span className="text-foreground font-medium">{trip.departureDate}</span></span>
          <span>Return: <span className="text-foreground font-medium">{trip.returnDate}</span></span>
        </div>
      </div>
    </button>
  )
}

export function TravelDocsContent() {
  const [store, setStore] = useState<TravelStore>({ trips:[], checklists:[], bookings:[], packingItems:[], packingTemplates:[], expenses:[], emergencyInfos:[], exchangeRates:{} })
  const [mainTab, setMainTab] = useState<MainTab>("trips")
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null)
  const [tripTab, setTripTab] = useState<TripTab>("overview")
  const [showNewTrip, setShowNewTrip] = useState(false)

  // New trip form
  const [ntDest, setNtDest] = useState("")
  const [ntOrigin, setNtOrigin] = useState("USA")
  const [ntDepart, setNtDepart] = useState("")
  const [ntReturn, setNtReturn] = useState("")
  const [ntPurpose, setNtPurpose] = useState<TripPurpose>("leisure")
  const [ntStatus, setNtStatus] = useState<TripStatus>("planning")

  // Booking form
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [bkType, setBkType] = useState<Booking["type"]>("flight")
  const [bkTitle, setBkTitle] = useState("")
  const [bkCode, setBkCode] = useState("")
  const [bkDate, setBkDate] = useState("")
  const [bkEndDate, setBkEndDate] = useState("")
  const [bkPrice, setBkPrice] = useState("")
  const [bkUrl, setBkUrl] = useState("")
  const [bkNotes, setBkNotes] = useState("")

  // Expense form
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [exAmount, setExAmount] = useState("")
  const [exCurrency, setExCurrency] = useState("USD")
  const [exCat, setExCat] = useState<ExpenseCat>("food")
  const [exDate, setExDate] = useState(new Date().toISOString().slice(0, 10))
  const [exNotes, setExNotes] = useState("")

  // AI loaders
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [loadingPacking, setLoadingPacking] = useState(false)

  useEffect(() => { setStore(loadStore()) }, [])

  function update(fn: (s: TravelStore) => TravelStore) {
    setStore((prev) => { const next = fn(prev); saveStore(next); return next })
  }

  function createTrip() {
    if (!ntDest.trim() || !ntDepart || !ntReturn) { toast.error("Destination and dates required"); return }
    const trip: Trip = {
      id: crypto.randomUUID(), destination: ntDest.trim(), departureDate: ntDepart,
      returnDate: ntReturn, purpose: ntPurpose, status: ntStatus,
      originCountry: ntOrigin, createdAt: new Date().toISOString(),
    }
    update((s) => ({ ...s, trips: [...s.trips, trip] }))
    setNtDest(""); setNtDepart(""); setNtReturn("")
    setShowNewTrip(false)
    toast.success("Trip created!")
  }

  function deleteTrip(id: string) {
    update((s) => ({
      ...s,
      trips: s.trips.filter((t) => t.id !== id),
      checklists: s.checklists.filter((c) => c.tripId !== id),
      bookings: s.bookings.filter((b) => b.tripId !== id),
      packingItems: s.packingItems.filter((p) => p.tripId !== id),
      expenses: s.expenses.filter((e) => e.tripId !== id),
    }))
    setSelectedTrip(null)
    toast.success("Trip deleted")
  }

  async function generateDocChecklist(trip: Trip) {
    setLoadingDocs(true)
    try {
      const res = await fetch("/api/travel-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "doc-checklist", destination: trip.destination, origin: trip.originCountry, purpose: trip.purpose }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const items: DocChecklistItem[] = (data.data as {label:string; notes?:string; expiring?:boolean}[]).map((d) => ({
        id: crypto.randomUUID(), tripId: trip.id, label: d.label, checked: false, notes: d.notes, expiring: d.expiring,
      }))
      update((s) => ({
        ...s, checklists: [...s.checklists.filter((c) => c.tripId !== trip.id), ...items],
      }))
      toast.success("Checklist generated!")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setLoadingDocs(false)
  }

  async function generatePackingList(trip: Trip) {
    setLoadingPacking(true)
    try {
      const dur = tripDuration(trip)
      const season = trip.departureDate ? (() => {
        const m = new Date(trip.departureDate + "T12:00:00").getMonth()
        if (m < 3 || m === 11) return "winter"
        if (m < 6) return "spring"
        if (m < 9) return "summer"
        return "autumn"
      })() : "unknown"
      const res = await fetch("/api/travel-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "packing-list", destination: trip.destination, durationDays: dur, purpose: trip.purpose, season }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      const items: PackingItem[] = (data.data as {category:string; label:string; qty?:number}[]).map((d) => ({
        id: crypto.randomUUID(), tripId: trip.id, category: d.category, label: d.label, checked: false, qty: d.qty,
      }))
      update((s) => ({
        ...s, packingItems: [...s.packingItems.filter((p) => p.tripId !== trip.id), ...items],
      }))
      toast.success("Packing list generated!")
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed") }
    setLoadingPacking(false)
  }

  function toggleDoc(id: string) {
    update((s) => ({ ...s, checklists: s.checklists.map((c) => c.id === id ? { ...c, checked: !c.checked } : c) }))
  }

  function togglePacking(id: string) {
    update((s) => ({ ...s, packingItems: s.packingItems.map((p) => p.id === id ? { ...p, checked: !p.checked } : p) }))
  }

  function addBooking() {
    if (!selectedTrip || !bkTitle.trim() || !bkDate) { toast.error("Title and date required"); return }
    const b: Booking = {
      id: crypto.randomUUID(), tripId: selectedTrip.id, type: bkType, title: bkTitle.trim(),
      confirmationCode: bkCode.trim(), date: bkDate, endDate: bkEndDate || undefined,
      price: bkPrice ? parseFloat(bkPrice) : undefined, currency: "USD", url: bkUrl.trim() || undefined, notes: bkNotes.trim() || undefined,
    }
    update((s) => ({ ...s, bookings: [...s.bookings, b] }))
    setBkTitle(""); setBkCode(""); setBkDate(""); setBkEndDate(""); setBkPrice(""); setBkUrl(""); setBkNotes("")
    setShowBookingForm(false)
    toast.success("Booking saved")
  }

  function addExpense() {
    if (!selectedTrip || !exAmount) { toast.error("Amount required"); return }
    const e: TripExpense = {
      id: crypto.randomUUID(), tripId: selectedTrip.id, amount: parseFloat(exAmount),
      currency: exCurrency, category: exCat, date: exDate, notes: exNotes.trim() || undefined,
    }
    update((s) => ({ ...s, expenses: [...s.expenses, e] }))
    setExAmount(""); setExNotes("")
    setShowExpenseForm(false)
    toast.success("Expense logged")
  }

  const tripDocs    = useMemo(() => store.checklists.filter((c) => c.tripId === selectedTrip?.id), [store.checklists, selectedTrip])
  const tripBookings = useMemo(() => store.bookings.filter((b) => b.tripId === selectedTrip?.id).sort((a,b) => a.date.localeCompare(b.date)), [store.bookings, selectedTrip])
  const tripPacking = useMemo(() => store.packingItems.filter((p) => p.tripId === selectedTrip?.id), [store.packingItems, selectedTrip])
  const tripExpenses = useMemo(() => store.expenses.filter((e) => e.tripId === selectedTrip?.id), [store.expenses, selectedTrip])

  const packingGroups = useMemo(() => {
    const map = new Map<string, PackingItem[]>()
    tripPacking.forEach((p) => { map.set(p.category, [...(map.get(p.category) ?? []), p]) })
    return Array.from(map.entries())
  }, [tripPacking])

  const totalExpenses = useMemo(() => tripExpenses.reduce((s, e) => s + e.amount, 0), [tripExpenses])

  const emergencyInfo = useMemo(
    () => store.emergencyInfos.find((e) => e.tripId === selectedTrip?.id),
    [store.emergencyInfos, selectedTrip]
  )

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedTrip) {
    const trip = selectedTrip
    const days = daysUntil(trip.departureDate)
    const dur = tripDuration(trip)

    return (
      <div className="min-h-screen flex flex-col">
        <ToolHeader
          title={trip.destination}
          icon={Plane}
          color="text-cyan-500"
          badge="Travel"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setSelectedTrip(null); setTripTab("overview") }}>← Back</Button>
              <Button variant="ghost" size="sm" onClick={() => deleteTrip(trip.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          }
        />
        <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
          {/* Trip header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-black">{trip.destination}</h1>
              <p className="text-muted-foreground">{trip.departureDate} → {trip.returnDate} · {dur} days · {PURPOSE_LABELS[trip.purpose]}</p>
            </div>
            <div className="text-right">
              <Badge variant="secondary" className={STATUS_COLORS[trip.status]}>{trip.status}</Badge>
              {days > 0 && <p className="text-sm text-cyan-400 font-bold mt-1">{days} days away</p>}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg flex-wrap">
            {([
              { key: "overview" as TripTab, label: "Overview" },
              { key: "docs" as TripTab,     label: `Docs (${tripDocs.length})` },
              { key: "bookings" as TripTab, label: `Bookings (${tripBookings.length})` },
              { key: "packing" as TripTab,  label: `Packing (${tripPacking.filter(p=>p.checked).length}/${tripPacking.length})` },
              { key: "expenses" as TripTab, label: `Expenses ($${totalExpenses.toFixed(0)})` },
            ]).map((t) => (
              <button key={t.key} onClick={() => setTripTab(t.key)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${tripTab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Overview ── */}
          {tripTab === "overview" && (
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="w-4 h-4" />Documents</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{tripDocs.filter(d=>d.checked).length}/{tripDocs.length} ready</p>
                    <Button size="sm" variant="outline" onClick={() => generateDocChecklist(trip)} disabled={loadingDocs}>
                      {loadingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      {tripDocs.length > 0 ? "Regenerate" : "Generate AI Checklist"}
                    </Button>
                  </div>
                  {tripDocs.slice(0, 4).map((d) => (
                    <div key={d.id} className="flex items-center gap-2 py-1">
                      <input type="checkbox" checked={d.checked} onChange={() => toggleDoc(d.id)} className="rounded" />
                      <span className={`text-sm ${d.checked ? "line-through text-muted-foreground" : ""}`}>{d.label}</span>
                      {d.expiring && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                    </div>
                  ))}
                  {tripDocs.length > 4 && <p className="text-xs text-muted-foreground mt-1">+{tripDocs.length-4} more → Docs tab</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Package className="w-4 h-4" />Packing</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{tripPacking.filter(p=>p.checked).length}/{tripPacking.length} packed</p>
                    <Button size="sm" variant="outline" onClick={() => generatePackingList(trip)} disabled={loadingPacking}>
                      {loadingPacking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      {tripPacking.length > 0 ? "Regenerate" : "Generate AI List"}
                    </Button>
                  </div>
                  {tripPacking.length > 0 && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden mb-3">
                      <div className="h-full rounded-full bg-cyan-500 transition-all" style={{ width: `${tripPacking.length > 0 ? (tripPacking.filter(p=>p.checked).length / tripPacking.length) * 100 : 0}%` }} />
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" />Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {tripBookings.length === 0 ? <p className="text-sm text-muted-foreground">No bookings yet</p> : tripBookings.map((b) => (
                    <div key={b.id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                      <span className="text-muted-foreground text-xs">{b.date}</span>
                      <span className="font-medium truncate">{b.title}</span>
                      {b.confirmationCode && <span className="text-xs text-muted-foreground font-mono">{b.confirmationCode}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Expenses</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-cyan-400">${totalExpenses.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">across {tripExpenses.length} transactions</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Docs ── */}
          {tripTab === "docs" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Document Checklist</h3>
                <Button size="sm" variant="outline" onClick={() => generateDocChecklist(trip)} disabled={loadingDocs}>
                  {loadingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  {tripDocs.length > 0 ? "Regenerate" : "Generate AI Checklist"}
                </Button>
              </div>
              {tripDocs.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground"><FileText className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Click Generate to get AI-powered document checklist</p></div>
              ) : (
                <div className="space-y-2">
                  {tripDocs.map((d) => (
                    <div key={d.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${d.checked ? "border-transparent bg-green-500/10" : "border-border"}`}>
                      <input type="checkbox" checked={d.checked} onChange={() => toggleDoc(d.id)} className="rounded mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${d.checked ? "line-through text-muted-foreground" : ""}`}>{d.label}</span>
                          {d.expiring && <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Check expiry</Badge>}
                        </div>
                        {d.notes && <p className="text-xs text-muted-foreground mt-0.5">{d.notes}</p>}
                      </div>
                      <Button variant="ghost" size="icon-sm" onClick={() => update((s) => ({ ...s, checklists: s.checklists.filter((c) => c.id !== d.id) }))}>
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Bookings ── */}
          {tripTab === "bookings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Bookings</h3>
                <Button size="sm" variant="outline" onClick={() => setShowBookingForm(!showBookingForm)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Booking</Button>
              </div>
              {showBookingForm && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Type</label>
                        <select value={bkType} onChange={(e) => setBkType(e.target.value as Booking["type"])} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                          {["flight","hotel","car","activity","other"].map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Title *</label>
                        <Input placeholder="Delta DL 123 / Hotel XYZ" value={bkTitle} onChange={(e) => setBkTitle(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Date *</label>
                        <Input type="date" value={bkDate} onChange={(e) => setBkDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">End Date</label>
                        <Input type="date" value={bkEndDate} onChange={(e) => setBkEndDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Confirmation Code</label>
                        <Input placeholder="ABC123" value={bkCode} onChange={(e) => setBkCode(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Price</label>
                        <Input type="number" placeholder="0.00" value={bkPrice} onChange={(e) => setBkPrice(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">URL</label>
                        <Input placeholder="https://..." value={bkUrl} onChange={(e) => setBkUrl(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addBooking}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowBookingForm(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {tripBookings.length === 0 && !showBookingForm ? (
                <div className="py-10 text-center text-muted-foreground"><Clock className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No bookings yet</p></div>
              ) : (
                <div className="space-y-2">
                  {tripBookings.map((b) => (
                    <Card key={b.id}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                            {b.type === "flight" ? <Plane className="w-4 h-4 text-cyan-400" /> : <MapPin className="w-4 h-4 text-cyan-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{b.title}</p>
                            <p className="text-xs text-muted-foreground">{b.date}{b.endDate ? ` → ${b.endDate}` : ""} · {b.type}</p>
                            {b.confirmationCode && <p className="text-xs font-mono text-cyan-400">{b.confirmationCode}</p>}
                          </div>
                          {b.price && <p className="text-sm font-bold shrink-0">${b.price}</p>}
                          {b.url && <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>}
                          <Button variant="ghost" size="icon-sm" onClick={() => update((s) => ({ ...s, bookings: s.bookings.filter((x) => x.id !== b.id) }))}>
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Packing ── */}
          {tripTab === "packing" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Packing List</h3>
                <Button size="sm" variant="outline" onClick={() => generatePackingList(trip)} disabled={loadingPacking}>
                  {loadingPacking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                  {tripPacking.length > 0 ? "Regenerate" : "Generate AI List"}
                </Button>
              </div>
              {tripPacking.length > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{tripPacking.filter(p=>p.checked).length}/{tripPacking.length} packed</span>
                      <span className="text-sm text-cyan-400">{Math.round(tripPacking.filter(p=>p.checked).length / tripPacking.length * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-cyan-500" style={{ width: `${tripPacking.filter(p=>p.checked).length / tripPacking.length * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {packingGroups.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground"><Package className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>Click Generate for AI-powered packing list</p></div>
              ) : (
                packingGroups.map(([cat, items]) => (
                  <div key={cat} className="space-y-1">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</h4>
                    {items.map((p) => (
                      <div key={p.id} className={`flex items-center gap-2 p-2 rounded-lg ${p.checked ? "opacity-50" : ""}`}>
                        <input type="checkbox" checked={p.checked} onChange={() => togglePacking(p.id)} className="rounded shrink-0" />
                        <span className={`text-sm flex-1 ${p.checked ? "line-through text-muted-foreground" : ""}`}>{p.label}</span>
                        {p.qty && <span className="text-xs text-muted-foreground">×{p.qty}</span>}
                        <Button variant="ghost" size="icon-sm" onClick={() => update((s) => ({ ...s, packingItems: s.packingItems.filter((x) => x.id !== p.id) }))}>
                          <X className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Expenses ── */}
          {tripTab === "expenses" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Trip Expenses</h3>
                <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(!showExpenseForm)}><Plus className="w-3.5 h-3.5 mr-1" /> Log Expense</Button>
              </div>
              {showExpenseForm && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Amount *</label>
                        <Input type="number" placeholder="0.00" value={exAmount} onChange={(e) => setExAmount(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Currency</label>
                        <Input placeholder="USD" value={exCurrency} onChange={(e) => setExCurrency(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Date</label>
                        <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium block mb-1">Category</label>
                        <select value={exCat} onChange={(e) => setExCat(e.target.value as ExpenseCat)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                          {EXPENSE_CATS.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium block mb-1">Notes</label>
                        <Input placeholder="Dinner at..." value={exNotes} onChange={(e) => setExNotes(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addExpense}><Check className="w-3.5 h-3.5 mr-1" /> Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              <Card className="border-cyan-500/30">
                <CardContent className="py-4">
                  <p className="text-3xl font-black text-cyan-400">${totalExpenses.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total spend · {tripExpenses.length} transactions</p>
                </CardContent>
              </Card>
              {tripExpenses.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground"><DollarSign className="w-10 h-10 mx-auto mb-2 opacity-20" /><p>No expenses yet</p></div>
              ) : (
                <div className="space-y-1 rounded-xl border overflow-hidden divide-y">
                  {tripExpenses.sort((a,b) => b.date.localeCompare(a.date)).map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 group">
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${CAT_COLORS[e.category]}`}>{e.category.charAt(0).toUpperCase() + e.category.slice(1)}</p>
                        <p className="text-xs text-muted-foreground">{e.date}{e.notes ? ` · ${e.notes}` : ""}</p>
                      </div>
                      <p className="text-sm font-bold">{e.currency} {e.amount.toFixed(2)}</p>
                      <Button variant="ghost" size="icon-sm" onClick={() => update((s) => ({ ...s, expenses: s.expenses.filter((x) => x.id !== e.id) }))} className="opacity-0 group-hover:opacity-100">
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Emergency Info */}
          <Card className="border-red-500/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-red-400"><AlertTriangle className="w-4 h-4" />Emergency Info Card</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Emergency Number", key: "emergencyNumber" as const, placeholder: "112 / 911" },
                  { label: "Embassy Contact", key: "embassyContact" as const, placeholder: "+1 202-xxx-xxxx" },
                  { label: "Insurance Hotline", key: "insuranceHotline" as const, placeholder: "+1 800-xxx-xxxx" },
                  { label: "Blood Type", key: "bloodType" as const, placeholder: "A+" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <label className="text-xs font-medium block mb-1">{label}</label>
                    <Input
                      placeholder={placeholder}
                      value={(emergencyInfo?.[key]) ?? ""}
                      onChange={(e) => {
                        update((s) => {
                          const info = s.emergencyInfos.find((x) => x.tripId === trip.id)
                          const updated: EmergencyInfo = info
                            ? { ...info, [key]: e.target.value }
                            : { tripId: trip.id, emergencyNumber: "", embassyContact: "", insuranceHotline: "", [key]: e.target.value }
                          return { ...s, emergencyInfos: info ? s.emergencyInfos.map((x) => x.tripId === trip.id ? updated : x) : [...s.emergencyInfos, updated] }
                        })
                      }}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gmail parsing teaser */}
          <Card className="border-dashed opacity-60">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-xs">Coming Soon</Badge>
                <div>
                  <p className="text-sm font-medium">Gmail Auto-Import</p>
                  <p className="text-xs text-muted-foreground">Forward booking confirmation emails and they&apos;ll be parsed and imported automatically. Requires Gmail OAuth integration.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // ── Trip list ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Travel Docs"
        icon={Plane}
        color="text-cyan-500"
        badge="Travel"
        actions={
          <Button size="sm" onClick={() => setShowNewTrip(!showNewTrip)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> New Trip
          </Button>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-bold">Travel Docs</h1>
            <p className="text-muted-foreground">All your trips, documents, and bookings in one place.</p>
          </div>
        </div>

        {/* New trip form */}
        {showNewTrip && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">New Trip</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Destination *</label>
                  <Input placeholder="Tokyo, Japan" value={ntDest} onChange={(e) => setNtDest(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Traveling from</label>
                  <Input placeholder="USA" value={ntOrigin} onChange={(e) => setNtOrigin(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Departure *</label>
                  <Input type="date" value={ntDepart} onChange={(e) => setNtDepart(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Return *</label>
                  <Input type="date" value={ntReturn} onChange={(e) => setNtReturn(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1">Purpose</label>
                  <select value={ntPurpose} onChange={(e) => setNtPurpose(e.target.value as TripPurpose)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {(["leisure","business","backpacking"] as TripPurpose[]).map((p) => <option key={p} value={p}>{PURPOSE_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Status</label>
                  <select value={ntStatus} onChange={(e) => setNtStatus(e.target.value as TripStatus)} className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm">
                    {(["planning","booked","completed"] as TripStatus[]).map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createTrip}><Plane className="w-3.5 h-3.5 mr-1" /> Create Trip</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowNewTrip(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
          {([
            { key: "trips" as MainTab, label: "My Trips" },
            { key: "packing" as MainTab, label: "Packing Templates" },
          ]).map((t) => (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${mainTab === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {mainTab === "trips" && (
          <>
            {store.trips.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Plane className="w-14 h-14 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground text-lg">No trips yet</p>
                <p className="text-sm mt-1">Create your first trip to start organizing your travel documents</p>
                <Button className="mt-4" size="sm" onClick={() => setShowNewTrip(true)}><Plus className="w-3.5 h-3.5 mr-1" /> New Trip</Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {store.trips.sort((a,b) => a.departureDate.localeCompare(b.departureDate)).map((t) => (
                  <BoardingPassCard key={t.id} trip={t} onClick={() => { setSelectedTrip(t); setTripTab("overview") }} />
                ))}
              </div>
            )}
          </>
        )}

        {mainTab === "packing" && (
          <div className="py-10 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p>Packing templates are auto-saved when you generate AI lists for a trip.</p>
            {store.packingTemplates.length === 0 ? <p className="text-sm mt-1">No templates yet</p> : (
              <div className="mt-4 text-left space-y-2 max-w-sm mx-auto">
                {store.packingTemplates.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.items.length} items</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Collapsible (small inline helper) ────────────────────────────────────────
function _CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold w-full text-left py-1">
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {title}
      </button>
      {open && children}
    </div>
  )
}
// suppress unused warning
void _CollapsibleSection
