export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue"

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "CAD" | "AUD"

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

export const STATUS_META: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft:   { label: "Draft",   color: "text-gray-600",  bg: "bg-gray-100 dark:bg-gray-800" },
  sent:    { label: "Sent",    color: "text-blue-600",  bg: "bg-blue-100 dark:bg-blue-900/40" },
  paid:    { label: "Paid",    color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/40" },
  overdue: { label: "Overdue", color: "text-red-600",   bg: "bg-red-100 dark:bg-red-900/40" },
}
