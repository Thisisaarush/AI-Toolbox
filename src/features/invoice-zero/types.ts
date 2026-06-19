export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue"

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "CAD" | "AUD"

export type InvoiceTemplate = "classic" | "modern" | "minimal"

export type RecurringInterval = "weekly" | "monthly" | "quarterly" | null

export interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface Client {
  name: string
  email: string
  address?: string
  company?: string
}

export interface Expense {
  id: string
  description: string
  amount: number
  date: string       // YYYY-MM-DD
  category: string
  project?: string
  createdAt: string
}

export interface Invoice {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  client: Client
  businessName: string
  businessAddress: string
  businessEmail: string
  issueDate: string
  dueDate: string
  lineItems: LineItem[]
  discountType: "percentage" | "flat"
  discountValue: number
  taxRate: number
  currency: Currency
  notes: string
  paymentTerms: string
  paidDate?: string
  reminderSentAt?: string
  template?: InvoiceTemplate
  isTemplate?: boolean
  recurringInterval?: RecurringInterval
  createdAt: string
  updatedAt: string
}

export interface InvoiceTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  CAD: "CA$",
  AUD: "A$",
}

export const EXPENSE_CATEGORIES = [
  "Software & Tools",
  "Hardware",
  "Marketing",
  "Travel",
  "Office",
  "Contractors",
  "Legal & Finance",
  "Other",
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]

export function calculateInvoiceTotals(invoice: Pick<Invoice, "lineItems" | "discountType" | "discountValue" | "taxRate">): InvoiceTotals {
  const subtotal = invoice.lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  let discountAmount = 0
  if (invoice.discountType === "percentage") {
    discountAmount = subtotal * (invoice.discountValue / 100)
  } else {
    discountAmount = invoice.discountValue
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxAmount = afterDiscount * (invoice.taxRate / 100)
  const total = afterDiscount + taxAmount

  return { subtotal, discountAmount, taxAmount, total }
}

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function generateInvoiceNumber(existingNumbers: string[]): string {
  const nums = existingNumbers
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => !isNaN(n))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `INV-${String(max + 1).padStart(4, "0")}`
}

export function isOverdue(invoice: Invoice): boolean {
  if (invoice.status === "paid") return false
  return new Date(invoice.dueDate) < new Date()
}

export function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

export function daysOverdue(invoice: Invoice): number {
  if (invoice.status !== "overdue") return 0
  return daysSince(invoice.dueDate)
}

export function avgDaysToPayment(invoices: Invoice[]): number | null {
  const paid = invoices.filter((i) => i.status === "paid" && i.paidDate)
  if (paid.length === 0) return null
  const total = paid.reduce((sum, i) => {
    const days = Math.floor(
      (new Date(i.paidDate!).getTime() - new Date(i.issueDate).getTime()) / (1000 * 60 * 60 * 24)
    )
    return sum + days
  }, 0)
  return Math.round(total / paid.length)
}

export const STATUS_META: Record<InvoiceStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  draft:   { label: "Draft",   color: "text-gray-600",  bg: "bg-gray-100 dark:bg-gray-800",       borderColor: "border-l-gray-400" },
  sent:    { label: "Sent",    color: "text-blue-600",  bg: "bg-blue-100 dark:bg-blue-900/40",     borderColor: "border-l-blue-500" },
  paid:    { label: "Paid",    color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40",   borderColor: "border-l-green-500" },
  overdue: { label: "Overdue", color: "text-red-600",   bg: "bg-red-100 dark:bg-red-900/40",       borderColor: "border-l-red-500" },
}
