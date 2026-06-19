"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  FileText, Plus, Trash2, Download, Copy, Check, Loader2,
  Sparkles, Search, Eye, Edit3, X, DollarSign,
  Clock, AlertCircle, CopyCheck, Files,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Invoice, type LineItem, type Client, type Currency, type InvoiceStatus,
  calculateInvoiceTotals, formatCurrency, generateInvoiceNumber, isOverdue,
  STATUS_META, CURRENCY_SYMBOLS,
} from "./types"

const STORAGE_KEY = "invoice-zero-v1"

function load(): Invoice[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(invoices: Invoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
}

type View = "list" | "create" | "edit" | "preview"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"]

function emptyLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }
}

function defaultInvoice(invoices: Invoice[]): Omit<Invoice, "id" | "createdAt" | "updatedAt"> {
  const today = new Date()
  const due = new Date(today)
  due.setDate(due.getDate() + 30)
  return {
    invoiceNumber: generateInvoiceNumber(invoices.map((i) => i.invoiceNumber)),
    status: "draft",
    client: { name: "", email: "", address: "", company: "" },
    businessName: "",
    businessAddress: "",
    businessEmail: "",
    issueDate: today.toISOString().slice(0, 10),
    dueDate: due.toISOString().slice(0, 10),
    lineItems: [emptyLineItem()],
    discountType: "percentage",
    discountValue: 0,
    taxRate: 0,
    currency: "USD",
    notes: "",
    paymentTerms: "Payment due within 30 days. Bank transfer or PayPal accepted.",
  }
}

export function InvoiceZeroContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [view, setView] = useState<View>("list")
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "all">("all")
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState<Omit<Invoice, "id" | "createdAt" | "updatedAt">>(() => defaultInvoice([]))

  useEffect(() => {
    const loaded = load()
    // Auto-mark overdue
    const updated = loaded.map((inv) =>
      isOverdue(inv) && inv.status === "sent" ? { ...inv, status: "overdue" as InvoiceStatus } : inv
    )
    setInvoices(updated)
    if (updated.some((inv, i) => inv.status !== loaded[i]?.status)) {
      save(updated)
    }
  }, [])

  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => {
      const { total } = calculateInvoiceTotals(inv)
      return sum + total
    }, 0)
    const paid = invoices.filter((i) => i.status === "paid").reduce((sum, inv) => {
      const { total } = calculateInvoiceTotals(inv)
      return sum + total
    }, 0)
    const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "draft").reduce((sum, inv) => {
      const { total } = calculateInvoiceTotals(inv)
      return sum + total
    }, 0)
    const overdue = invoices.filter((i) => i.status === "overdue").reduce((sum, inv) => {
      const { total } = calculateInvoiceTotals(inv)
      return sum + total
    }, 0)
    return { total, paid, outstanding, overdue }
  }, [invoices])

  const filtered = useMemo(() => {
    let result = [...invoices]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.client.name.toLowerCase().includes(q) ||
          inv.client.company?.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== "all") result = result.filter((i) => i.status === filterStatus)
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [invoices, search, filterStatus])

  // Known clients for autocomplete
  const knownClients: Client[] = useMemo(() => {
    const seen = new Map<string, Client>()
    invoices.forEach((inv) => {
      const key = inv.client.email || inv.client.name
      if (key && !seen.has(key)) seen.set(key, inv.client)
    })
    return Array.from(seen.values())
  }, [invoices])

  function startCreate() {
    setForm(defaultInvoice(invoices))
    setEditingInvoice(null)
    setView("create")
  }

  function startEdit(inv: Invoice) {
    setForm({
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      client: { ...inv.client },
      businessName: inv.businessName,
      businessAddress: inv.businessAddress,
      businessEmail: inv.businessEmail,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      lineItems: inv.lineItems.map((l) => ({ ...l })),
      discountType: inv.discountType,
      discountValue: inv.discountValue,
      taxRate: inv.taxRate,
      currency: inv.currency,
      notes: inv.notes,
      paymentTerms: inv.paymentTerms,
      paidDate: inv.paidDate,
    })
    setEditingInvoice(inv)
    setView("edit")
  }

  function saveInvoice() {
    if (!form.client.name.trim()) { toast.error("Client name required"); return }
    if (form.lineItems.length === 0) { toast.error("Add at least one line item"); return }
    const now = new Date().toISOString()
    if (editingInvoice) {
      const updated = { ...editingInvoice, ...form, updatedAt: now }
      setInvoices((prev) => {
        const next = prev.map((inv) => inv.id === editingInvoice.id ? updated : inv)
        save(next)
        return next
      })
      toast.success("Invoice updated")
    } else {
      const inv: Invoice = { ...form, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      setInvoices((prev) => {
        const next = [inv, ...prev]
        save(next)
        return next
      })
      toast.success("Invoice created")
    }
    setView("list")
  }

  function deleteInvoice(id: string) {
    setInvoices((prev) => {
      const next = prev.filter((inv) => inv.id !== id)
      save(next)
      return next
    })
    toast.success("Invoice deleted")
  }

  function duplicateInvoice(inv: Invoice) {
    const now = new Date().toISOString()
    const copy: Invoice = {
      ...inv,
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber([...invoices.map((i) => i.invoiceNumber), inv.invoiceNumber]),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      paidDate: undefined,
    }
    setInvoices((prev) => {
      const next = [copy, ...prev]
      save(next)
      return next
    })
    toast.success("Invoice duplicated")
  }

  function markPaid(id: string) {
    setInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.id === id
          ? { ...inv, status: "paid" as InvoiceStatus, paidDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() }
          : inv
      )
      save(next)
      return next
    })
    toast.success("Marked as paid")
  }

  function updateStatus(id: string, status: InvoiceStatus) {
    setInvoices((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, status, updatedAt: new Date().toISOString() } : inv
      )
      save(next)
      return next
    })
  }

  function copyShareLink(inv: Invoice) {
    const url = `${window.location.origin}/invoice/${inv.id}`
    navigator.clipboard.writeText(url)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Share link copied")
  }

  async function handleAiGenerate() {
    if (!aiInput.trim()) { toast.error("Enter a description first"); return }
    setAiLoading(true)
    try {
      const res = await fetch("/api/invoice-zero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ai-generate", description: aiInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "AI failed")
      const d = data.data
      const today = new Date()
      const due = new Date(today)
      due.setDate(due.getDate() + (d.dueInDays ?? 30))
      setForm((prev) => ({
        ...prev,
        client: {
          name: d.clientName ?? "",
          email: d.clientEmail ?? "",
          address: "",
          company: "",
        },
        businessName: d.businessName ?? prev.businessName,
        lineItems: (d.lineItems ?? []).map((li: { description: string; quantity: number; unitPrice: number }) => ({
          id: crypto.randomUUID(),
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
        })),
        taxRate: d.taxRate ?? 0,
        currency: d.currency ?? "USD",
        notes: d.notes ?? "",
        dueDate: due.toISOString().slice(0, 10),
      }))
      setShowAiPanel(false)
      setAiInput("")
      toast.success("Form filled from AI")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI failed")
    }
    setAiLoading(false)
  }

  function updateLineItem(idx: number, field: keyof LineItem, value: string | number) {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, i) => i === idx ? { ...li, [field]: value } : li),
    }))
  }

  function addLineItem() {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }))
  }

  function removeLineItem(idx: number) {
    setForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) }))
  }

  const formTotals = useMemo(() => calculateInvoiceTotals(form), [form])

  // ── Print styles (injected once)
  useEffect(() => {
    const style = document.createElement("style")
    style.id = "invoice-print-styles"
    style.textContent = `
      @media print {
        body > *:not(#invoice-print-root) { display: none !important; }
        #invoice-print-root { display: block !important; position: fixed; top:0; left:0; width:100%; background:white; }
        .no-print { display: none !important; }
      }
    `
    if (!document.getElementById("invoice-print-styles")) {
      document.head.appendChild(style)
    }
  }, [])

  function printInvoice(inv: Invoice) {
    setPreviewInvoice(inv)
    setView("preview")
    setTimeout(() => window.print(), 300)
  }

  // ── Render
  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Invoice Zero"
        icon={FileText}
        color="text-emerald-500"
        badge="Finance"
        actions={
          view !== "list" ? (
            <Button variant="outline" size="sm" onClick={() => setView("list")}>← Back</Button>
          ) : (
            <Button size="sm" onClick={startCreate}>
              <Plus className="w-3.5 h-3.5 mr-1" /> New Invoice
            </Button>
          )
        }
      />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── LIST ───────────────────────────────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Invoice Zero</h1>
              <p className="text-muted-foreground">Freelance invoicing without the bloat.</p>
            </div>

            {/* Stats */}
            {invoices.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Invoiced" value={formatCurrency(stats.total, "USD")} icon={<DollarSign className="w-4 h-4" />} color="text-foreground" />
                <StatCard label="Paid" value={formatCurrency(stats.paid, "USD")} icon={<Check className="w-4 h-4" />} color="text-green-500" />
                <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, "USD")} icon={<Clock className="w-4 h-4" />} color="text-blue-500" />
                <StatCard label="Overdue" value={formatCurrency(stats.overdue, "USD")} icon={<AlertCircle className="w-4 h-4" />} color="text-red-500" highlight={stats.overdue > 0} />
              </div>
            )}

            {/* Filters */}
            {invoices.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as InvoiceStatus | "all")}
                  className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All statuses</option>
                  {(["draft", "sent", "paid", "overdue"] as InvoiceStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
                {(search || filterStatus !== "all") && (
                  <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStatus("all") }}>
                    <X className="w-3.5 h-3.5 mr-1" /> Clear
                  </Button>
                )}
              </div>
            )}

            {invoices.length === 0 ? (
              <Card className="max-w-lg mx-auto mt-16">
                <CardContent className="py-16 text-center">
                  <FileText className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No invoices yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">Create your first invoice in seconds.</p>
                  <Button onClick={startCreate}><Plus className="w-4 h-4 mr-1" /> Create Invoice</Button>
                </CardContent>
              </Card>
            ) : (
            <div className="rounded-xl border overflow-hidden divide-y">
                {filtered.map((inv) => {
                  const totals = calculateInvoiceTotals(inv)
                  const meta = STATUS_META[inv.status]
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors group"
                    >
                      {/* Left — invoice # + client */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold">{inv.invoiceNumber}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {inv.client.name}
                          {inv.client.company ? ` · ${inv.client.company}` : ""}
                        </p>
                      </div>

                      {/* Center — amount + due date */}
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(totals.total, inv.currency)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Due {inv.dueDate}
                        </p>
                      </div>

                      {/* Right — actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {inv.status !== "paid" && (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
                            onClick={() => markPaid(inv.id)}
                          >
                            Mark paid
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => { setPreviewInvoice(inv); setView("preview") }} title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => startEdit(inv)} title="Edit">
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => printInvoice(inv)} title="Download PDF">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => duplicateInvoice(inv)} title="Duplicate">
                          <Files className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => copyShareLink(inv)}
                          title="Copy link"
                        >
                          {copiedId === inv.id
                            ? <CopyCheck className="w-3.5 h-3.5 text-green-500" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => deleteInvoice(inv.id)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE / EDIT ──────────────────────────────────────────────── */}
        {(view === "create" || view === "edit") && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{view === "create" ? "New Invoice" : `Edit ${form.invoiceNumber}`}</h1>
                <p className="text-muted-foreground text-sm">Fill in the details below.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAiPanel(!showAiPanel)}>
                <Sparkles className="w-3.5 h-3.5 mr-1" /> AI Fill
              </Button>
            </div>

            {/* AI panel */}
            {showAiPanel && (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Generate invoice from description</p>
                  <Textarea
                    placeholder='e.g. "I built a landing page for Acme Corp, 3 revisions, $2500 total, payment due in 14 days"'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAiGenerate} disabled={aiLoading}>
                      {aiLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Fill Form</>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-4">
                {/* Business info */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Your Business</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <LabelInput label="Business name" value={form.businessName} onChange={(v) => setForm((p) => ({ ...p, businessName: v }))} placeholder="Acme Freelance" />
                    <LabelInput label="Email" value={form.businessEmail} onChange={(v) => setForm((p) => ({ ...p, businessEmail: v }))} placeholder="you@yourco.com" />
                    <LabelInput label="Address" value={form.businessAddress} onChange={(v) => setForm((p) => ({ ...p, businessAddress: v }))} placeholder="123 Main St, City, Country" />
                  </CardContent>
                </Card>

                {/* Client info */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Bill To</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Client name *</label>
                      <Input
                        placeholder="John Smith"
                        value={form.client.name}
                        onChange={(e) => setForm((p) => ({ ...p, client: { ...p.client, name: e.target.value } }))}
                        list="client-suggestions"
                      />
                      <datalist id="client-suggestions">
                        {knownClients.map((c, i) => <option key={i} value={c.name} />)}
                      </datalist>
                    </div>
                    <LabelInput label="Email" value={form.client.email} onChange={(v) => setForm((p) => ({ ...p, client: { ...p.client, email: v } }))} placeholder="client@example.com" />
                    <LabelInput label="Company" value={form.client.company ?? ""} onChange={(v) => setForm((p) => ({ ...p, client: { ...p.client, company: v } }))} placeholder="Acme Corp" />
                    <LabelInput label="Address" value={form.client.address ?? ""} onChange={(v) => setForm((p) => ({ ...p, client: { ...p.client, address: v } }))} placeholder="456 Client Ave" />
                  </CardContent>
                </Card>

                {/* Invoice details */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Invoice Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <LabelInput label="Invoice #" value={form.invoiceNumber} onChange={(v) => setForm((p) => ({ ...p, invoiceNumber: v }))} />
                      <div>
                        <label className="text-xs font-medium mb-1 block">Currency</label>
                        <select
                          value={form.currency}
                          onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value as Currency }))}
                          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <LabelInput label="Issue date" type="date" value={form.issueDate} onChange={(v) => setForm((p) => ({ ...p, issueDate: v }))} />
                      <LabelInput label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as InvoiceStatus }))}
                        className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {(["draft", "sent", "paid", "overdue"] as InvoiceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Line items */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Line Items</CardTitle>
                      <Button variant="outline" size="sm" onClick={addLineItem}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {form.lineItems.map((li, idx) => (
                      <div key={li.id} className="grid grid-cols-12 gap-2 items-start">
                        <div className="col-span-5">
                          {idx === 0 && <label className="text-xs text-muted-foreground mb-1 block">Description</label>}
                          <Input placeholder="Web design" value={li.description} onChange={(e) => updateLineItem(idx, "description", e.target.value)} />
                        </div>
                        <div className="col-span-2">
                          {idx === 0 && <label className="text-xs text-muted-foreground mb-1 block">Qty</label>}
                          <Input type="number" min={0} placeholder="1" value={li.quantity} onChange={(e) => updateLineItem(idx, "quantity", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="col-span-4">
                          {idx === 0 && <label className="text-xs text-muted-foreground mb-1 block">Unit price</label>}
                          <Input type="number" min={0} placeholder="100.00" value={li.unitPrice} onChange={(e) => updateLineItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="col-span-1 flex items-end pb-0.5">
                          {idx === 0 && <div className="mb-1 h-4" />}
                          <Button variant="ghost" size="icon-sm" onClick={() => removeLineItem(idx)} disabled={form.lineItems.length === 1}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Taxes & discounts */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Discount & Tax</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Discount type</label>
                        <select
                          value={form.discountType}
                          onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "percentage" | "flat" }))}
                          className="w-full h-8 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Flat amount</option>
                        </select>
                      </div>
                      <LabelInput label={`Discount ${form.discountType === "percentage" ? "%" : CURRENCY_SYMBOLS[form.currency]}`} type="number" min={0} value={String(form.discountValue)} onChange={(v) => setForm((p) => ({ ...p, discountValue: parseFloat(v) || 0 }))} />
                    </div>
                    <LabelInput label="Tax rate (%)" type="number" min={0} max={100} value={String(form.taxRate)} onChange={(v) => setForm((p) => ({ ...p, taxRate: parseFloat(v) || 0 }))} />
                  </CardContent>
                </Card>

                {/* Totals */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-2">
                    <TotalRow label="Subtotal" value={formatCurrency(formTotals.subtotal, form.currency)} />
                    {formTotals.discountAmount > 0 && <TotalRow label={`Discount ${form.discountType === "percentage" ? `(${form.discountValue}%)` : ""}`} value={`-${formatCurrency(formTotals.discountAmount, form.currency)}`} />}
                    {formTotals.taxAmount > 0 && <TotalRow label={`Tax (${form.taxRate}%)`} value={formatCurrency(formTotals.taxAmount, form.currency)} />}
                    <div className="border-t pt-2">
                      <TotalRow label="Total" value={formatCurrency(formTotals.total, form.currency)} bold />
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Notes & Terms</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">Notes</label>
                      <Textarea placeholder="Thank you for your business!" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Payment terms</label>
                      <Textarea placeholder="Payment due within 30 days..." value={form.paymentTerms} onChange={(e) => setForm((p) => ({ ...p, paymentTerms: e.target.value }))} rows={2} />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={saveInvoice} className="flex-1 sm:flex-none sm:px-8">
                <Check className="w-3.5 h-3.5 mr-1" /> {view === "create" ? "Create Invoice" : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => setView("list")}>Cancel</Button>
            </div>
          </div>
        )}

        {/* ── PREVIEW ────────────────────────────────────────────────────── */}
        {view === "preview" && previewInvoice && (
          <InvoicePreview
            invoice={previewInvoice}
            onBack={() => setView("list")}
            onPrint={() => window.print()}
          />
        )}
      </main>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color, highlight }: { label: string; value: string; icon: React.ReactNode; color: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-red-300 dark:border-red-800" : ""}>
      <CardContent>
        <div className="flex items-center gap-2 mb-1">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function LabelInput({ label, value, onChange, placeholder, type = "text", min, max }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; min?: number; max?: number
}) {
  return (
    <div>
      <label className="text-xs font-medium mb-1 block">{label}</label>
      <Input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} min={min} max={max} />
    </div>
  )
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold text-base" : ""}>{value}</span>
    </div>
  )
}

function InvoicePreview({ invoice, onBack, onPrint }: { invoice: Invoice; onBack: () => void; onPrint: () => void }) {
  const totals = calculateInvoiceTotals(invoice)
  const meta = STATUS_META[invoice.status]
  return (
    <div>
      <div className="flex items-center gap-3 mb-6 no-print">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <Button size="sm" onClick={onPrint}><Download className="w-3.5 h-3.5 mr-1" /> Download PDF</Button>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
      </div>
      <div id="invoice-print-root" className="bg-white text-gray-900 p-10 rounded-xl shadow-lg max-w-3xl mx-auto print:shadow-none print:rounded-none print:p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{invoice.businessName || "Your Business"}</h1>
            <p className="text-sm text-gray-500 mt-1 whitespace-pre-line">{invoice.businessAddress}</p>
            {invoice.businessEmail && <p className="text-sm text-gray-500">{invoice.businessEmail}</p>}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-600">INVOICE</p>
            <p className="text-lg font-semibold text-gray-700 mt-1">{invoice.invoiceNumber}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
          </div>
        </div>

        {/* Bill to + dates */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Bill To</p>
            <p className="font-semibold text-gray-900">{invoice.client.name}</p>
            {invoice.client.company && <p className="text-sm text-gray-600">{invoice.client.company}</p>}
            {invoice.client.email && <p className="text-sm text-gray-600">{invoice.client.email}</p>}
            {invoice.client.address && <p className="text-sm text-gray-500 whitespace-pre-line">{invoice.client.address}</p>}
          </div>
          <div className="text-right">
            <div className="space-y-1">
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-gray-400">Issue Date</span>
                <span className="font-medium">{invoice.issueDate}</span>
              </div>
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-gray-400">Due Date</span>
                <span className="font-medium text-red-600">{invoice.dueDate}</span>
              </div>
              {invoice.paidDate && (
                <div className="flex justify-end gap-8 text-sm">
                  <span className="text-gray-400">Paid Date</span>
                  <span className="font-medium text-green-600">{invoice.paidDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        <table className="w-full mb-8">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Description</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Qty</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Unit Price</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-100">
                <td className="py-3 text-sm text-gray-700">{li.description}</td>
                <td className="py-3 text-sm text-right text-gray-600">{li.quantity}</td>
                <td className="py-3 text-sm text-right text-gray-600">{formatCurrency(li.unitPrice, invoice.currency)}</td>
                <td className="py-3 text-sm text-right font-medium">{formatCurrency(li.quantity * li.unitPrice, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(totals.subtotal, invoice.currency)}</span>
            </div>
            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Discount</span><span>-{formatCurrency(totals.discountAmount, invoice.currency)}</span>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax ({invoice.taxRate}%)</span><span>{formatCurrency(totals.taxAmount, invoice.currency)}</span>
              </div>
            )}
            <div className="border-t-2 border-gray-900 pt-2 flex justify-between font-bold text-lg">
              <span>Total</span><span>{formatCurrency(totals.total, invoice.currency)}</span>
            </div>
          </div>
        </div>

        {/* Notes & terms */}
        {(invoice.notes || invoice.paymentTerms) && (
          <div className="border-t border-gray-200 pt-6 space-y-3">
            {invoice.notes && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}
            {invoice.paymentTerms && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment Terms</p>
                <p className="text-sm text-gray-600">{invoice.paymentTerms}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
