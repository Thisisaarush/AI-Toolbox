"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { useHashNav } from "@/lib/use-hash-nav"
import {
  FileText, Plus, Trash2, Download, Copy, Check, Loader2,
  Sparkles, Search, Eye, Edit3, X, DollarSign,
  Clock, AlertCircle, CopyCheck, Files, Bell, TrendingUp,
  TrendingDown, Users, BarChart3, ChevronRight, Receipt,
  ArrowUpRight, ArrowDownRight, LayoutTemplate,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Invoice, type LineItem, type Client, type Currency, type InvoiceStatus,
  type InvoiceTemplate, type Expense, type RecurringInterval,
  calculateInvoiceTotals, formatCurrency, generateInvoiceNumber, isOverdue,
  STATUS_META, CURRENCY_SYMBOLS, avgDaysToPayment, daysOverdue, daysSince,
  EXPENSE_CATEGORIES,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "invoice-zero-v1"
const EXPENSES_KEY = "invoice-zero-expenses-v1"

function load(): Invoice[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(invoices: Invoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
}

function loadExpenses(): Expense[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(EXPENSES_KEY) ?? "[]") } catch { return [] }
}
function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses))
}

type MainTab = "invoices" | "clients" | "expenses" | "aging" | "templates"
type View = "list" | "create" | "edit" | "preview"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP", "INR", "CAD", "AUD"]
const TEMPLATES: { value: InvoiceTemplate; label: string; desc: string }[] = [
  { value: "classic", label: "Classic", desc: "Traditional layout with borders" },
  { value: "modern", label: "Modern", desc: "Left accent bar, bold numbers" },
  { value: "minimal", label: "Minimal", desc: "Clean, no box borders" },
]

function emptyLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unitPrice: 0 }
}

type FormShape = Omit<Invoice, "id" | "createdAt" | "updatedAt">

function defaultInvoice(invoices: Invoice[]): FormShape {
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
    template: "classic",
    isTemplate: false,
    recurringInterval: null,
  }
}

// ── Keyboard shortcut hook ───────────────────────────────────────────────────
function useKeyboardShortcut(key: string, handler: () => void) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key.toLowerCase() === key.toLowerCase() && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        handler()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [key, handler])
}

export function InvoiceZeroContent() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [mainTab, setMainTab] = useState<MainTab>("invoices")
  const [view, setView] = useState<View>("list")
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | "all">("all")
  const [clientFilter, setClientFilter] = useState<string | null>(null)
  const [aiInput, setAiInput] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState<FormShape>(() => defaultInvoice([]))

  // Expense form state
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState("")
  const [expenseAmount, setExpenseAmount] = useState("")
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10))
  const [expenseCategory, setExpenseCategory] = useState<string>(EXPENSE_CATEGORIES[0])
  const [expenseProject, setExpenseProject] = useState("")

  useEffect(() => {
    const loaded = load()
    const updated = loaded.map((inv) =>
      isOverdue(inv) && inv.status === "sent" ? { ...inv, status: "overdue" as InvoiceStatus } : inv
    )
    setInvoices(updated)
    if (updated.some((inv, i) => inv.status !== loaded[i]?.status)) {
      save(updated)
    }
    setExpenses(loadExpenses())
  }, [])

  useHashNav(view, setView, ["list", "create", "edit", "preview"] as const)

  // N shortcut to create new invoice
  const handleNewInvoice = useCallback(() => {
    if (view === "list" && mainTab === "invoices") {
      startCreate()
    }
  }, [view, mainTab]) // eslint-disable-line react-hooks/exhaustive-deps
  useKeyboardShortcut("n", handleNewInvoice)

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const nonTemplates = invoices.filter((i) => !i.isTemplate)
    const total = nonTemplates.reduce((sum, inv) => sum + calculateInvoiceTotals(inv).total, 0)
    const paid = nonTemplates.filter((i) => i.status === "paid").reduce((sum, inv) => sum + calculateInvoiceTotals(inv).total, 0)
    const outstanding = nonTemplates.filter((i) => i.status === "sent" || i.status === "draft").reduce((sum, inv) => sum + calculateInvoiceTotals(inv).total, 0)
    const overdue = nonTemplates.filter((i) => i.status === "overdue").reduce((sum, inv) => sum + calculateInvoiceTotals(inv).total, 0)
    const paidCount = nonTemplates.filter((i) => i.status === "paid").length
    const avgValue = nonTemplates.length > 0 ? total / nonTemplates.length : 0
    const collectionRate = total > 0 ? (paid / total) * 100 : 0
    const avgDays = avgDaysToPayment(nonTemplates)
    const longestOverdue = nonTemplates
      .filter((i) => i.status === "overdue")
      .reduce((max, inv) => Math.max(max, daysOverdue(inv)), 0)

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
    const estimatedProfit = paid - totalExpenses

    return {
      total, paid, outstanding, overdue,
      paidCount, avgValue, collectionRate, avgDays,
      longestOverdue, totalExpenses, estimatedProfit,
      count: nonTemplates.length,
    }
  }, [invoices, expenses])

  const filtered = useMemo(() => {
    let result = invoices.filter((i) => !i.isTemplate)
    if (clientFilter) result = result.filter((i) => i.client.name === clientFilter || i.client.email === clientFilter)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.client.name.toLowerCase().includes(q) ||
          (inv.client.company?.toLowerCase().includes(q) ?? false)
      )
    }
    if (filterStatus !== "all") result = result.filter((i) => i.status === filterStatus)
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [invoices, search, filterStatus, clientFilter])

  const templates = useMemo(() => invoices.filter((i) => i.isTemplate), [invoices])

  // ── Client data ──────────────────────────────────────────────────────────
  const knownClients: Client[] = useMemo(() => {
    const seen = new Map<string, Client>()
    invoices.forEach((inv) => {
      const key = inv.client.email || inv.client.name
      if (key && !seen.has(key)) seen.set(key, inv.client)
    })
    return Array.from(seen.values())
  }, [invoices])

  interface ClientStats {
    client: Client
    totalInvoiced: number
    totalPaid: number
    outstanding: number
    invoiceCount: number
  }
  const clientStats: ClientStats[] = useMemo(() => {
    const map = new Map<string, ClientStats>()
    invoices.filter((i) => !i.isTemplate).forEach((inv) => {
      const key = inv.client.email || inv.client.name
      if (!key) return
      const existing = map.get(key) ?? {
        client: inv.client,
        totalInvoiced: 0,
        totalPaid: 0,
        outstanding: 0,
        invoiceCount: 0,
      }
      const { total } = calculateInvoiceTotals(inv)
      existing.totalInvoiced += total
      existing.invoiceCount += 1
      if (inv.status === "paid") existing.totalPaid += total
      if (inv.status === "sent" || inv.status === "draft" || inv.status === "overdue") existing.outstanding += total
      map.set(key, existing)
    })
    return Array.from(map.values()).sort((a, b) => b.totalInvoiced - a.totalInvoiced)
  }, [invoices])

  // ── Aging buckets ────────────────────────────────────────────────────────
  const aging = useMemo(() => {
    const unpaid = invoices.filter((i) => !i.isTemplate && (i.status === "sent" || i.status === "overdue"))
    const buckets: { label: string; min: number; max: number; invoices: Invoice[]; total: number }[] = [
      { label: "0–30 days", min: 0, max: 30, invoices: [], total: 0 },
      { label: "31–60 days", min: 31, max: 60, invoices: [], total: 0 },
      { label: "61–90 days", min: 61, max: 90, invoices: [], total: 0 },
      { label: "90+ days", min: 91, max: Infinity, invoices: [], total: 0 },
    ]
    for (const inv of unpaid) {
      const age = daysSince(inv.dueDate)
      for (const bucket of buckets) {
        if (age >= bucket.min && age <= bucket.max) {
          bucket.invoices.push(inv)
          bucket.total += calculateInvoiceTotals(inv).total
        }
      }
    }
    return buckets
  }, [invoices])

  // ── Overdue-soon invoices (sent, due in ≤3 days) ─────────────────────────
  const overdueSoon = useMemo(() =>
    invoices.filter((i) => {
      if (i.status !== "sent") return false
      const days = Math.ceil((new Date(i.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 3
    }), [invoices])

  // ── Actions ───────────────────────────────────────────────────────────────
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
      reminderSentAt: inv.reminderSentAt,
      template: inv.template ?? "classic",
      isTemplate: inv.isTemplate ?? false,
      recurringInterval: inv.recurringInterval ?? null,
    })
    setEditingInvoice(inv)
    setView("edit")
  }

  function saveInvoice() {
    if (!form.client.name.trim()) { toast.error("Client name required"); return }
    if (form.lineItems.length === 0) { toast.error("Add at least one line item"); return }

    const stripped = form.lineItems.filter((li) => li.description.trim() !== "" || li.unitPrice !== 0)
    const removedCount = form.lineItems.length - stripped.length
    if (stripped.length === 0) { toast.error("Add at least one line item with a description or price"); return }
    if (removedCount > 0) {
      toast.warning(`Removed ${removedCount} empty line item${removedCount > 1 ? "s" : ""}`)
    }
    const finalLineItems = stripped
    const now = new Date().toISOString()
    const finalForm = { ...form, lineItems: finalLineItems }
    if (editingInvoice) {
      const updated = { ...editingInvoice, ...finalForm, updatedAt: now }
      setInvoices((prev) => {
        const next = prev.map((inv) => inv.id === editingInvoice.id ? updated : inv)
        save(next)
        return next
      })
      toast.success(form.isTemplate ? "Template updated" : "Invoice updated")
    } else {
      const inv: Invoice = { ...finalForm, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      setInvoices((prev) => {
        const next = [inv, ...prev]
        save(next)
        return next
      })
      toast.success(form.isTemplate ? "Template created" : "Invoice created")
    }
    setView("list")
    if (form.isTemplate) setMainTab("templates")
  }

  function deleteInvoice(id: string) {
    setInvoices((prev) => {
      const next = prev.filter((inv) => inv.id !== id)
      save(next)
      return next
    })
    toast.success("Deleted")
  }

  function duplicateInvoice(inv: Invoice) {
    const now = new Date().toISOString()
    const copy: Invoice = {
      ...inv,
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber([...invoices.map((i) => i.invoiceNumber), inv.invoiceNumber]),
      status: "draft",
      isTemplate: false,
      createdAt: now,
      updatedAt: now,
      paidDate: undefined,
      reminderSentAt: undefined,
    }
    setInvoices((prev) => {
      const next = [copy, ...prev]
      save(next)
      return next
    })
    toast.success("Duplicated as draft")
  }

  function generateFromTemplate(template: Invoice) {
    const now = new Date()
    const due = new Date(now)
    due.setDate(due.getDate() + 30)
    const inv: Invoice = {
      ...template,
      id: crypto.randomUUID(),
      invoiceNumber: generateInvoiceNumber(invoices.map((i) => i.invoiceNumber)),
      status: "draft",
      isTemplate: false,
      issueDate: now.toISOString().slice(0, 10),
      dueDate: due.toISOString().slice(0, 10),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      paidDate: undefined,
      reminderSentAt: undefined,
    }
    setInvoices((prev) => {
      const next = [inv, ...prev]
      save(next)
      return next
    })
    toast.success(`Invoice ${inv.invoiceNumber} created from template`)
    setMainTab("invoices")
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

  function copyShareLink(inv: Invoice) {
    const totals = calculateInvoiceTotals(inv)
    const summary = `Invoice ${inv.invoiceNumber} — ${inv.client.name}${inv.client.company ? ` (${inv.client.company})` : ""} — ${formatCurrency(totals.total, inv.currency)} — Due ${inv.dueDate}`
    navigator.clipboard.writeText(summary)
    setCopiedId(inv.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success("Summary copied")
  }

  function sendReminder(inv: Invoice) {
    const totals = calculateInvoiceTotals(inv)
    const template = `Hi ${inv.client.name},\n\nThis is a friendly reminder that Invoice ${inv.invoiceNumber} for ${formatCurrency(totals.total, inv.currency)} is due on ${inv.dueDate}.\n\nPlease arrange payment at your earliest convenience.\n\nThank you,\n${inv.businessName || "Your name"}`
    navigator.clipboard.writeText(template)
    // Mark reminder sent
    setInvoices((prev) => {
      const next = prev.map((i) =>
        i.id === inv.id ? { ...i, reminderSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : i
      )
      save(next)
      return next
    })
    toast.success("Reminder email copied to clipboard")
  }

  async function handleAiGenerate() {
    if (!aiInput.trim()) { toast.error("Enter a description first"); return }
    setAiLoading(true)
    try {
      const res = await aiFetch("/api/invoice-zero", { action: "ai-generate", description: aiInput })
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
      if (err instanceof AiKeyError) {
        toast.error("Add your Gemini API key in Settings to use AI features.")
        setAiLoading(false)
        return
      }
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

  function addExpense() {
    const amount = parseFloat(expenseAmount)
    if (!expenseDesc.trim() || isNaN(amount) || amount <= 0) {
      toast.error("Description and valid amount required")
      return
    }
    const expense: Expense = {
      id: crypto.randomUUID(),
      description: expenseDesc.trim(),
      amount,
      date: expenseDate,
      category: expenseCategory,
      project: expenseProject.trim() || undefined,
      createdAt: new Date().toISOString(),
    }
    const next = [expense, ...expenses]
    setExpenses(next)
    saveExpenses(next)
    setExpenseDesc(""); setExpenseAmount(""); setExpenseProject("")
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setShowExpenseForm(false)
    toast.success("Expense logged")
  }

  function deleteExpense(id: string) {
    const next = expenses.filter((e) => e.id !== id)
    setExpenses(next)
    saveExpenses(next)
  }

  const formTotals = useMemo(() => calculateInvoiceTotals(form), [form])

  // ── Print styles
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
              <Plus className="w-4 h-4 mr-1" /> New Invoice
            </Button>
          )
        }
      />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── LIST ───────────────────────────────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1">Invoice Zero</h1>
                <p className="text-muted-foreground">Freelance invoicing without the bloat.</p>
              </div>
              {invoices.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">N</kbd> to create new
                </p>
              )}
            </div>

            {/* Stats */}
            {invoices.filter((i) => !i.isTemplate).length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard label="Total Invoiced" value={formatCurrency(stats.total, "USD")} icon={<DollarSign className="w-4 h-4" />} color="text-foreground" />
                <StatCard
                  label="Paid"
                  value={formatCurrency(stats.paid, "USD")}
                  icon={<Check className="w-4 h-4" />}
                  color="text-green-500"
                  sub={stats.count > 0 ? `${stats.paidCount} of ${stats.count} invoices` : undefined}
                />
                <StatCard label="Outstanding" value={formatCurrency(stats.outstanding, "USD")} icon={<Clock className="w-4 h-4" />} color="text-blue-500" />
                <StatCard label="Overdue" value={formatCurrency(stats.overdue, "USD")} icon={<AlertCircle className="w-4 h-4" />} color="text-red-500" highlight={stats.overdue > 0} />
              </div>
            )}

            {/* Extended stats row */}
            {stats.count >= 2 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
                <MiniStatCard
                  label="Avg invoice"
                  value={formatCurrency(stats.avgValue, "USD")}
                  icon={<BarChart3 className="w-4 h-4" />}
                />
                <MiniStatCard
                  label="Collection rate"
                  value={`${stats.collectionRate.toFixed(0)}%`}
                  icon={stats.collectionRate >= 80 ? <TrendingUp className="w-4 h-4 text-green-500" /> : <TrendingDown className="w-4 h-4 text-red-500" />}
                />
                <MiniStatCard
                  label="Avg days to pay"
                  value={stats.avgDays !== null ? `${stats.avgDays}d` : "—"}
                  icon={<Clock className="w-4 h-4" />}
                />
                <MiniStatCard
                  label="Longest overdue"
                  value={stats.longestOverdue > 0 ? `${stats.longestOverdue}d` : "None"}
                  icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                />
              </div>
            )}

            {/* Overdue-soon warnings */}
            {overdueSoon.length > 0 && (
              <div className="space-y-3">
                {overdueSoon.map((inv) => {
                  const totals = calculateInvoiceTotals(inv)
                  const daysLeft = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  return (
                    <div key={inv.id} className="flex items-center gap-5 p-5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                      <Bell className="w-4 h-4 text-amber-500 shrink-0" />
                      <p className="text-sm flex-1">
                        <span className="font-medium">{inv.invoiceNumber}</span> ({inv.client.name}) —{" "}
                        {formatCurrency(totals.total, inv.currency)} due in <span className="font-semibold text-amber-600">{daysLeft === 0 ? "today" : `${daysLeft}d`}</span>
                        {inv.reminderSentAt && (
                          <span className="text-xs text-muted-foreground ml-2">Reminder sent {new Date(inv.reminderSentAt).toLocaleDateString()}</span>
                        )}
                      </p>
                      <Button variant="outline" size="sm" onClick={() => sendReminder(inv)}>
                        <Bell className="w-4 h-4 mr-1" /> Send reminder
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-fit flex-wrap">
              {([
                { key: "invoices" as MainTab, label: "Invoices", icon: <FileText className="w-4 h-4" /> },
                { key: "clients" as MainTab, label: "Clients", icon: <Users className="w-4 h-4" /> },
                { key: "expenses" as MainTab, label: "Expenses", icon: <Receipt className="w-4 h-4" /> },
                { key: "aging" as MainTab, label: "Aging", icon: <BarChart3 className="w-4 h-4" /> },
                { key: "templates" as MainTab, label: "Templates", icon: <LayoutTemplate className="w-4 h-4" /> },
              ] satisfies { key: MainTab; label: string; icon: React.ReactNode }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setMainTab(tab.key); setClientFilter(null) }}
                  className={`flex items-center gap-4 px-4 py-2.5 text-sm rounded-md font-medium transition-colors ${
                    mainTab === tab.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* ── Invoices tab ── */}
            {mainTab === "invoices" && (
              <>
                {invoices.filter((i) => !i.isTemplate).length === 0 ? (
                  <EmptyState onAction={startCreate} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-5">
                      <div className="relative flex-1 min-w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                      </div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as InvoiceStatus | "all")}
                        className="h-9 rounded-md border border-input bg-background px-4 text-sm"
                      >
                        <option value="all">All statuses</option>
                        {(["draft", "sent", "paid", "overdue"] as InvoiceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_META[s].label}</option>
                        ))}
                      </select>
                      {(search || filterStatus !== "all" || clientFilter) && (
                        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterStatus("all"); setClientFilter(null) }}>
                          <X className="w-4 h-4 mr-1" /> Clear
                        </Button>
                      )}
                    </div>
                    {clientFilter && (
                      <div className="flex items-center gap-5 text-sm">
                        <span className="text-muted-foreground">Filtered by client:</span>
                        <span className="font-medium">{clientFilter}</span>
                        <button onClick={() => setClientFilter(null)} className="text-muted-foreground hover:text-foreground">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <div className="rounded-xl border overflow-hidden divide-y">
                      {filtered.length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">No invoices match your filters</div>
                      ) : (
                        filtered.map((inv) => (
                          <InvoiceRow
                            key={inv.id}
                            inv={inv}
                            copiedId={copiedId}
                            onMarkPaid={() => markPaid(inv.id)}
                            onPreview={() => { setPreviewInvoice(inv); setView("preview") }}
                            onEdit={() => startEdit(inv)}
                            onPrint={() => printInvoice(inv)}
                            onDuplicate={() => duplicateInvoice(inv)}
                            onCopy={() => copyShareLink(inv)}
                            onDelete={() => deleteInvoice(inv.id)}
                            onSendReminder={() => sendReminder(inv)}
                          />
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Clients tab ── */}
            {mainTab === "clients" && (
              <div className="space-y-4">
                {clientStats.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Users className="w-10 h-11 mx-auto mb-5 opacity-30" />
                    <p>No clients yet. Create your first invoice to see client data.</p>
                  </div>
                ) : (
                  clientStats.map((cs) => (
                    <Card key={cs.client.email || cs.client.name}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-5">
                              <p className="font-semibold text-sm">{cs.client.name}</p>
                              {cs.client.company && (
                                <span className="text-xs text-muted-foreground">{cs.client.company}</span>
                              )}
                            </div>
                            {cs.client.email && (
                              <p className="text-xs text-muted-foreground">{cs.client.email}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-xs text-muted-foreground">Invoiced</p>
                              <p className="text-sm font-bold">{formatCurrency(cs.totalInvoiced, "USD")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Paid</p>
                              <p className="text-sm font-semibold text-green-600">{formatCurrency(cs.totalPaid, "USD")}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Outstanding</p>
                              <p className={`text-sm font-semibold ${cs.outstanding > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                                {formatCurrency(cs.outstanding, "USD")}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Invoices</p>
                              <p className="text-sm font-semibold">{cs.invoiceCount}</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setClientFilter(cs.client.email || cs.client.name)
                                setMainTab("invoices")
                              }}
                            >
                              View <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* ── Expenses tab ── */}
            {mainTab === "expenses" && (
              <div className="space-y-5">
                {/* Profit overview */}
                <div className="grid grid-cols-3 gap-5">
                  <MiniStatCard label="Total expenses" value={formatCurrency(stats.totalExpenses, "USD")} icon={<Receipt className="w-4 h-4 text-red-500" />} />
                  <MiniStatCard label="Total paid" value={formatCurrency(stats.paid, "USD")} icon={<DollarSign className="w-4 h-4 text-green-500" />} />
                  <MiniStatCard
                    label="Est. profit"
                    value={formatCurrency(stats.estimatedProfit, "USD")}
                    icon={stats.estimatedProfit >= 0
                      ? <ArrowUpRight className="w-4 h-4 text-green-500" />
                      : <ArrowDownRight className="w-4 h-4 text-red-500" />}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Expenses</h2>
                  <Button size="sm" variant="outline" onClick={() => setShowExpenseForm(!showExpenseForm)}>
                    <Plus className="w-4 h-4 mr-1" /> Log Expense
                  </Button>
                </div>

                {showExpenseForm && (
                  <Card>
                    <CardContent className="pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-5">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Description *</label>
                          <Input placeholder="AWS monthly bill" value={expenseDesc} onChange={(e) => setExpenseDesc(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Amount *</label>
                          <Input type="number" min={0} placeholder="49.99" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-5">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Date</label>
                          <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Category</label>
                          <select
                            value={expenseCategory}
                            onChange={(e) => setExpenseCategory(e.target.value)}
                            className="w-full h-11 rounded-md border border-input bg-background px-4 text-sm"
                          >
                            {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Project</label>
                          <Input placeholder="Optional" value={expenseProject} onChange={(e) => setExpenseProject(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-5">
                        <Button size="sm" onClick={addExpense}><Check className="w-4 h-4 mr-1" /> Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowExpenseForm(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {expenses.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Receipt className="w-10 h-11 mx-auto mb-5 opacity-30" />
                    <p>No expenses logged yet.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden divide-y">
                    {expenses.map((e) => (
                      <div key={e.id} className="flex items-center gap-5 px-4 py-4 hover:bg-muted/30 group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{e.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.date} · {e.category}
                            {e.project ? ` · ${e.project}` : ""}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-red-600 shrink-0">{formatCurrency(e.amount, "USD")}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteExpense(e.id)}
                          className="text-muted-foreground hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Aging tab ── */}
            {mainTab === "aging" && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">Outstanding invoices grouped by age past due date.</p>
                {aging.every((b) => b.invoices.length === 0) ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <Check className="w-10 h-11 mx-auto mb-5 text-green-500" />
                    <p className="font-medium text-foreground">No outstanding invoices!</p>
                  </div>
                ) : (
                  aging.map((bucket) => (
                    <Card key={bucket.label} className={bucket.invoices.length > 0 && bucket.min > 60 ? "border-red-200 dark:border-red-900" : ""}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{bucket.label}</CardTitle>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${bucket.total > 0 && bucket.min > 60 ? "text-red-600" : ""}`}>
                              {formatCurrency(bucket.total, "USD")}
                            </p>
                            <p className="text-xs text-muted-foreground">{bucket.invoices.length} invoice{bucket.invoices.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      </CardHeader>
                      {bucket.invoices.length > 0 && (
                        <CardContent>
                          <div className="space-y-3">
                            {bucket.invoices.map((inv) => {
                              const totals = calculateInvoiceTotals(inv)
                              return (
                                <div key={inv.id} className="flex items-center justify-between text-sm">
                                  <div>
                                    <span className="font-medium">{inv.invoiceNumber}</span>
                                    <span className="text-muted-foreground ml-2">{inv.client.name}</span>
                                  </div>
                                  <div className="flex items-center gap-5">
                                    <span className="font-semibold">{formatCurrency(totals.total, inv.currency)}</span>
                                    <span className="text-xs text-muted-foreground">Due {inv.dueDate}</span>
                                    <Button size="sm" variant="outline" onClick={() => sendReminder(inv)}>
                                      <Bell className="w-4 h-4 mr-1" /> Remind
                                    </Button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* ── Templates tab ── */}
            {mainTab === "templates" && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">Recurring invoice templates. Click generate to create a new invoice from a template.</p>
                  <Button size="sm" variant="outline" onClick={() => {
                    setForm({ ...defaultInvoice(invoices), isTemplate: true, recurringInterval: "monthly" })
                    setEditingInvoice(null)
                    setView("create")
                  }}>
                    <Plus className="w-4 h-4 mr-1" /> New Template
                  </Button>
                </div>
                {templates.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <LayoutTemplate className="w-10 h-11 mx-auto mb-5 opacity-30" />
                    <p className="font-medium text-foreground">No templates yet</p>
                    <p className="text-xs mt-1">Create an invoice and toggle &quot;Save as recurring template&quot;.</p>
                  </div>
                ) : (
                  templates.map((tmpl) => {
                    const totals = calculateInvoiceTotals(tmpl)
                    return (
                      <Card key={tmpl.id}>
                        <CardContent className="py-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{tmpl.invoiceNumber} — {tmpl.client.name || "No client"}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(totals.total, tmpl.currency)}
                                {tmpl.recurringInterval ? ` · ${tmpl.recurringInterval}` : ""}
                              </p>
                            </div>
                            <div className="flex gap-5">
                              <Button size="sm" variant="outline" onClick={() => startEdit(tmpl)}>
                                <Edit3 className="w-4 h-4 mr-1" /> Edit
                              </Button>
                              <Button size="sm" onClick={() => generateFromTemplate(tmpl)}>
                                <Files className="w-4 h-4 mr-1" /> Generate
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => deleteInvoice(tmpl.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE / EDIT ──────────────────────────────────────────────── */}
        {(view === "create" || view === "edit") && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  {form.isTemplate
                    ? (view === "create" ? "New Template" : `Edit Template`)
                    : (view === "create" ? "New Invoice" : `Edit ${form.invoiceNumber}`)}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {form.isTemplate ? "Recurring invoice template." : "Fill in the details below."}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowAiPanel(!showAiPanel)}>
                <Sparkles className="w-4 h-4 mr-1" /> AI Fill
              </Button>
            </div>

            {/* AI panel */}
            {showAiPanel && (
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Generate invoice from description</p>
                  <Textarea
                    placeholder='e.g. "I built a landing page for Acme Corp, 3 revisions, $2500 total, payment due in 14 days"'
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-5">
                    <Button size="sm" onClick={handleAiGenerate} disabled={aiLoading}>
                      {aiLoading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-1" /> Fill Form</>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowAiPanel(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Template / recurring toggle */}
            <Card className="border-dashed">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Recurring template</p>
                    <p className="text-xs text-muted-foreground">Save as a reusable template to quickly generate new invoices</p>
                  </div>
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.isTemplate ?? false}
                        onChange={(e) => setForm((p) => ({ ...p, isTemplate: e.target.checked }))}
                        className="rounded"
                      />
                      <span className="text-sm">Template</span>
                    </label>
                    {form.isTemplate && (
                      <select
                        value={form.recurringInterval ?? "monthly"}
                        onChange={(e) => setForm((p) => ({ ...p, recurringInterval: e.target.value as RecurringInterval }))}
                        className="h-9 rounded-md border border-input bg-background px-4 text-sm"
                      >
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Left column */}
              <div className="space-y-5">
                {/* Business info */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Your Business</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <LabelInput label="Business name" value={form.businessName} onChange={(v) => setForm((p) => ({ ...p, businessName: v }))} placeholder="Acme Freelance" />
                    <LabelInput label="Email" value={form.businessEmail} onChange={(v) => setForm((p) => ({ ...p, businessEmail: v }))} placeholder="you@yourco.com" />
                    <LabelInput label="Address" value={form.businessAddress} onChange={(v) => setForm((p) => ({ ...p, businessAddress: v }))} placeholder="123 Main St, City, Country" />
                  </CardContent>
                </Card>

                {/* Client info */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Bill To</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
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
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                      <LabelInput label="Invoice #" value={form.invoiceNumber} onChange={(v) => setForm((p) => ({ ...p, invoiceNumber: v }))} />
                      <div>
                        <label className="text-xs font-medium mb-1 block">Currency</label>
                        <select
                          value={form.currency}
                          onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value as Currency }))}
                          className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm"
                        >
                          {CURRENCIES.map((c) => <option key={c} value={c}>{c} ({CURRENCY_SYMBOLS[c]})</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <LabelInput label="Issue date" type="date" value={form.issueDate} onChange={(v) => setForm((p) => ({ ...p, issueDate: v }))} />
                      <LabelInput label="Due date" type="date" value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Status</label>
                        <select
                          value={form.status}
                          onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as InvoiceStatus }))}
                          className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm"
                        >
                          {(["draft", "sent", "paid", "overdue"] as InvoiceStatus[]).map((s) => (
                            <option key={s} value={s}>{STATUS_META[s].label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Visual template</label>
                        <select
                          value={form.template ?? "classic"}
                          onChange={(e) => setForm((p) => ({ ...p, template: e.target.value as InvoiceTemplate }))}
                          className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm"
                        >
                          {TEMPLATES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-5">
                {/* Line items */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Line Items</CardTitle>
                      <Button variant="outline" size="sm" onClick={addLineItem}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {form.lineItems.map((li, idx) => (
                      <div key={li.id} className="grid grid-cols-12 gap-5 items-start">
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
                          <Button variant="ghost" size="icon" onClick={() => removeLineItem(idx)} disabled={form.lineItems.length === 1}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Taxes & discounts */}
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Discount & Tax</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-5">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Discount type</label>
                        <select
                          value={form.discountType}
                          onChange={(e) => setForm((p) => ({ ...p, discountType: e.target.value as "percentage" | "flat" }))}
                          className="w-full h-9 rounded-md border border-input bg-background px-4 text-sm"
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

                {/* Live totals */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4 space-y-3">
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
                  <CardContent className="space-y-4">
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

            <div className="flex gap-5">
              <Button onClick={saveInvoice} className="flex-1 sm:flex-none sm:px-8">
                <Check className="w-4 h-4 mr-1" /> {view === "create" ? (form.isTemplate ? "Create Template" : "Create Invoice") : "Save Changes"}
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

function StatCard({ label, value, icon, color, highlight, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; highlight?: boolean; sub?: string
}) {
  return (
    <Card className={highlight ? "border-red-300 dark:border-red-800" : ""}>
      <CardContent>
        <div className="flex items-center gap-5 mb-1">
          <span className={color}>{icon}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function MiniStatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-xl border bg-card">
      <div className="flex items-center gap-5">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-bold">{value}</span>
    </div>
  )
}

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <Card className="max-w-lg mx-auto mt-8">
      <CardContent className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
          <FileText className="w-8 h-9 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-semibold mb-3">No invoices yet</h2>
        <p className="text-muted-foreground text-sm mb-8">
          Create professional invoices in seconds. Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">N</kbd> or click below.
        </p>
        <Button onClick={onAction}><Plus className="w-4 h-4 mr-1" /> Create Invoice</Button>
      </CardContent>
    </Card>
  )
}

function InvoiceRow({
  inv, copiedId, onMarkPaid, onPreview, onEdit, onPrint, onDuplicate, onCopy, onDelete, onSendReminder,
}: {
  inv: Invoice
  copiedId: string | null
  onMarkPaid: () => void
  onPreview: () => void
  onEdit: () => void
  onPrint: () => void
  onDuplicate: () => void
  onCopy: () => void
  onDelete: () => void
  onSendReminder: () => void
}) {
  const totals = calculateInvoiceTotals(inv)
  const meta = STATUS_META[inv.status]
  const isDueSoon = inv.status === "sent" && (() => {
    const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return days >= 0 && days <= 3
  })()

  return (
    <div className={`flex items-center gap-5 px-0 py-0 hover:bg-muted/40 transition-colors group border-l-4 ${meta.borderColor}`}>
      <div className="flex items-center gap-5 px-4 py-4.5 flex-1 min-w-0">
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-5 mb-0.5">
            <span className="text-sm font-semibold">{inv.invoiceNumber}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
            {isDueSoon && (
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Due soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {inv.client.name}
            {inv.client.company ? ` · ${inv.client.company}` : ""}
          </p>
        </div>

        {/* Center */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold tabular-nums">{formatCurrency(totals.total, inv.currency)}</p>
          <p className="text-xs text-muted-foreground">Due {inv.dueDate}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {inv.status !== "paid" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
              onClick={onMarkPaid}
            >
              Mark paid
            </Button>
          )}
          {isDueSoon && (
            <Button variant="ghost" size="icon" onClick={onSendReminder} title="Send reminder">
              <Bell className="w-4 h-4 text-amber-500" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={onPreview} title="Preview">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onPrint} title="Print / Save PDF">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
            <Files className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onCopy} title="Copy summary">
            {copiedId === inv.id
              ? <CopyCheck className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
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
  const tmpl = invoice.template ?? "classic"

  return (
    <div>
      <div className="flex items-center gap-5 mb-8 no-print">
        <Button variant="outline" size="sm" onClick={onBack}>← Back</Button>
        <Button size="sm" onClick={onPrint}><Download className="w-4 h-4 mr-1" /> Print / Save PDF</Button>
        <span className={`text-xs font-medium px-4 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
        <span className="text-xs text-muted-foreground capitalize">{tmpl} template</span>
      </div>

      {/* Classic template */}
      {tmpl === "classic" && (
        <div id="invoice-print-root" className="bg-background text-foreground print:bg-white print:text-gray-900 p-10 rounded-xl shadow-lg max-w-3xl mx-auto print:shadow-none print:rounded-none print:p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="text-3xl font-bold">{invoice.businessName || "Your Business"}</h1>
              <p className="text-sm text-muted-foreground print:text-gray-500 mt-1 whitespace-pre-line">{invoice.businessAddress}</p>
              {invoice.businessEmail && <p className="text-sm text-muted-foreground print:text-gray-500">{invoice.businessEmail}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-emerald-600">INVOICE</p>
              <p className="text-xl font-semibold mt-1">{invoice.invoiceNumber}</p>
              <span className={`text-xs font-medium px-4 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
            </div>
          </div>
          <InvoiceBody invoice={invoice} totals={totals} meta={meta} />
        </div>
      )}

      {/* Modern template */}
      {tmpl === "modern" && (
        <div id="invoice-print-root" className="bg-background text-foreground print:bg-white print:text-gray-900 rounded-xl shadow-lg max-w-3xl mx-auto print:shadow-none print:rounded-none overflow-hidden">
          <div className="bg-emerald-600 print:bg-emerald-600 text-white p-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{invoice.businessName || "Your Business"}</h1>
              <p className="text-sm text-emerald-100 mt-1 whitespace-pre-line">{invoice.businessAddress}</p>
              {invoice.businessEmail && <p className="text-sm text-emerald-100">{invoice.businessEmail}</p>}
            </div>
            <div className="text-right">
              <p className="text-4xl font-black tracking-tight">INVOICE</p>
              <p className="text-2xl font-semibold mt-1">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <div className="p-8">
            <InvoiceBody invoice={invoice} totals={totals} meta={meta} />
          </div>
        </div>
      )}

      {/* Minimal template */}
      {tmpl === "minimal" && (
        <div id="invoice-print-root" className="bg-background text-foreground print:bg-white print:text-gray-900 p-10 max-w-3xl mx-auto print:p-8">
          <div className="flex justify-between items-end mb-12 border-b pb-6">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Invoice from</p>
              <h1 className="text-2xl font-bold">{invoice.businessName || "Your Business"}</h1>
              {invoice.businessEmail && <p className="text-sm text-muted-foreground">{invoice.businessEmail}</p>}
            </div>
            <div className="text-right">
              <p className="text-xl font-mono font-bold">{invoice.invoiceNumber}</p>
              <span className={`text-xs font-medium px-4 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>{meta.label}</span>
            </div>
          </div>
          <InvoiceBody invoice={invoice} totals={totals} meta={meta} minimal />
        </div>
      )}
    </div>
  )
}

function InvoiceBody({
  invoice, totals, meta, minimal,
}: {
  invoice: Invoice
  totals: ReturnType<typeof calculateInvoiceTotals>
  meta: typeof STATUS_META[InvoiceStatus]
  minimal?: boolean
}) {
  const containerClass = minimal ? "" : ""
  return (
    <div className={containerClass}>
      {/* Bill to + dates */}
      <div className="grid grid-cols-2 gap-8 mb-10">
        <div>
          <p className="text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider mb-3">Bill To</p>
          <p className="font-semibold">{invoice.client.name}</p>
          {invoice.client.company && <p className="text-sm text-muted-foreground print:text-gray-600">{invoice.client.company}</p>}
          {invoice.client.email && <p className="text-sm text-muted-foreground print:text-gray-600">{invoice.client.email}</p>}
          {invoice.client.address && <p className="text-sm text-muted-foreground print:text-gray-500 whitespace-pre-line">{invoice.client.address}</p>}
        </div>
        <div className="text-right">
          <div className="space-y-1">
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-muted-foreground print:text-gray-400">Issue Date</span>
              <span className="font-medium">{invoice.issueDate}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-muted-foreground print:text-gray-400">Due Date</span>
              <span className="font-medium text-red-600">{invoice.dueDate}</span>
            </div>
            {invoice.paidDate && (
              <div className="flex justify-end gap-8 text-sm">
                <span className="text-muted-foreground print:text-gray-400">Paid Date</span>
                <span className="font-medium text-green-600">{invoice.paidDate}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items */}
      <table className="w-full mb-8">
        <thead>
          <tr className={`border-b-2 ${minimal ? "border-foreground/20 print:border-gray-200" : "border-border print:border-gray-200"}`}>
            <th className="text-left py-2.5 text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider">Description</th>
            <th className="text-right py-2.5 text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider w-20">Qty</th>
            <th className="text-right py-2.5 text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider w-32">Unit Price</th>
            <th className="text-right py-2.5 text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider w-32">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((li) => (
            <tr key={li.id} className="border-b border-border/50 print:border-gray-100">
              <td className="py-4 text-sm">{li.description}</td>
              <td className="py-4 text-sm text-right text-muted-foreground print:text-gray-600">{li.quantity}</td>
              <td className="py-4 text-sm text-right text-muted-foreground print:text-gray-600">{formatCurrency(li.unitPrice, invoice.currency)}</td>
              <td className="py-4 text-sm text-right font-medium">{formatCurrency(li.quantity * li.unitPrice, invoice.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-sm text-muted-foreground print:text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(totals.subtotal, invoice.currency)}</span>
          </div>
          {totals.discountAmount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground print:text-gray-600">
              <span>Discount</span><span>-{formatCurrency(totals.discountAmount, invoice.currency)}</span>
            </div>
          )}
          {totals.taxAmount > 0 && (
            <div className="flex justify-between text-sm text-muted-foreground print:text-gray-600">
              <span>Tax ({invoice.taxRate}%)</span><span>{formatCurrency(totals.taxAmount, invoice.currency)}</span>
            </div>
          )}
          <div className="border-t-2 border-foreground print:border-gray-900 pt-2 flex justify-between font-bold text-xl">
            <span>Total</span><span>{formatCurrency(totals.total, invoice.currency)}</span>
          </div>
        </div>
      </div>

      {/* Notes & terms */}
      {(invoice.notes || invoice.paymentTerms) && (
        <div className="border-t border-border/50 print:border-gray-200 pt-6 space-y-4">
          {invoice.notes && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-sm text-muted-foreground print:text-gray-600">{invoice.notes}</p>
            </div>
          )}
          {invoice.paymentTerms && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground print:text-gray-400 uppercase tracking-wider mb-1">Payment Terms</p>
              <p className="text-sm text-muted-foreground print:text-gray-600">{invoice.paymentTerms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
