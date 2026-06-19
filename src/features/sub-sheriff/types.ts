export type BillingCycle = "monthly" | "annual" | "quarterly" | "weekly" | "one-time"
export type UsageStatus = "active" | "rarely" | "unused"
export type Category =
  | "dev-tools"
  | "design"
  | "productivity"
  | "media"
  | "ai-llm"
  | "cloud-hosting"
  | "marketing"
  | "security"
  | "finance"
  | "other"

export interface Subscription {
  id: string
  name: string
  url?: string
  logoUrl?: string
  amount: number          // always stored in USD/mo equivalent
  rawAmount: number       // original billed amount
  billingCycle: BillingCycle
  category: Category
  usageStatus: UsageStatus
  renewalDate?: string    // ISO date
  startDate?: string      // ISO date
  notes?: string
  cancelUrl?: string
  createdAt: string
  updatedAt: string
}

export type CreateSubscription = Omit<Subscription, "id" | "createdAt" | "updatedAt" | "amount"> & {
  amount?: number
}

export interface ParsedSubscription {
  name: string
  rawAmount: number
  billingCycle: BillingCycle
  category: Category
  renewalDate?: string
  url?: string
  cancelUrl?: string
  confidence: number      // 0-1
}

export interface SpendSummary {
  totalMonthly: number
  totalAnnual: number
  byCategory: Record<Category, number>
  unusedMonthly: number
  rarelyMonthly: number
  savingsIfCancelled: number
}

export const CATEGORY_META: Record<Category, { label: string; color: string; bg: string }> = {
  "dev-tools":     { label: "Dev Tools",      color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  "design":        { label: "Design",          color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
  "productivity":  { label: "Productivity",    color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30" },
  "media":         { label: "Media",           color: "text-pink-600",   bg: "bg-pink-100 dark:bg-pink-900/30" },
  "ai-llm":        { label: "AI / LLM",        color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  "cloud-hosting": { label: "Cloud / Hosting", color: "text-cyan-600",   bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  "marketing":     { label: "Marketing",       color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  "security":      { label: "Security",        color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30" },
  "finance":       { label: "Finance",         color: "text-emerald-600",bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  "other":         { label: "Other",           color: "text-gray-600",   bg: "bg-gray-100 dark:bg-gray-800" },
}

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly:   "Monthly",
  annual:    "Annual",
  quarterly: "Quarterly",
  weekly:    "Weekly",
  "one-time": "One-time",
}

// Convert any billing amount to monthly equivalent
export function toMonthly(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case "monthly":   return amount
    case "annual":    return amount / 12
    case "quarterly": return amount / 3
    case "weekly":    return amount * 4.33
    case "one-time":  return 0
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(amount)
}

export function daysUntilRenewal(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}
