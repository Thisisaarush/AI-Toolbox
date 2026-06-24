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
  | "music"
  | "food"
  | "health-fitness"
  | "education"
  | "transportation"
  | "shopping"
  | "entertainment"
  | "news"
  | "social"
  | "storage"
  | "utilities"
  | "gaming"
  | "insurance"
  | (string & {})

export interface PriceHistoryEntry {
  amount: number
  date: string // ISO date string
}

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
  roiNote?: string        // What value / ROI the user gets from this
  tags?: string[]         // Custom tags: "work-reimbursed", "side-project", etc.
  priceHistory?: PriceHistoryEntry[] // Track price changes over time
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
  byCategory: Record<string, number>
  unusedMonthly: number
  rarelyMonthly: number
  savingsIfCancelled: number
}

export const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; barColor: string }> = {
  "dev-tools":       { label: "Dev Tools",        color: "text-blue-600",     bg: "bg-blue-100 dark:bg-blue-900/30",       barColor: "bg-blue-500" },
  "design":          { label: "Design",            color: "text-purple-600",   bg: "bg-purple-100 dark:bg-purple-900/30",   barColor: "bg-purple-500" },
  "productivity":    { label: "Productivity",      color: "text-green-600",    bg: "bg-green-100 dark:bg-green-900/30",     barColor: "bg-green-500" },
  "media":           { label: "Media",             color: "text-pink-600",     bg: "bg-pink-100 dark:bg-pink-900/30",       barColor: "bg-pink-500" },
  "ai-llm":          { label: "AI / LLM",          color: "text-amber-600",    bg: "bg-amber-100 dark:bg-amber-900/30",     barColor: "bg-amber-500" },
  "cloud-hosting":   { label: "Cloud / Hosting",   color: "text-cyan-600",     bg: "bg-cyan-100 dark:bg-cyan-900/30",       barColor: "bg-cyan-500" },
  "marketing":       { label: "Marketing",          color: "text-orange-600",   bg: "bg-orange-100 dark:bg-orange-900/30",   barColor: "bg-orange-500" },
  "security":        { label: "Security",          color: "text-red-600",      bg: "bg-red-100 dark:bg-red-900/30",         barColor: "bg-red-500" },
  "finance":         { label: "Finance",           color: "text-emerald-600",  bg: "bg-emerald-100 dark:bg-emerald-900/30", barColor: "bg-emerald-500" },
  "other":           { label: "Other",             color: "text-gray-600",     bg: "bg-gray-100 dark:bg-gray-800",          barColor: "bg-gray-500" },
  "music":           { label: "Music",             color: "text-green-600",    bg: "bg-green-100 dark:bg-green-900/30",     barColor: "bg-green-500" },
  "food":            { label: "Food",              color: "text-orange-600",   bg: "bg-orange-100 dark:bg-orange-900/30",   barColor: "bg-orange-500" },
  "health-fitness":  { label: "Health & Fitness",  color: "text-lime-600",     bg: "bg-lime-100 dark:bg-lime-900/30",       barColor: "bg-lime-500" },
  "education":       { label: "Education",         color: "text-indigo-600",   bg: "bg-indigo-100 dark:bg-indigo-900/30",   barColor: "bg-indigo-500" },
  "transportation":  { label: "Transportation",    color: "text-yellow-600",   bg: "bg-yellow-100 dark:bg-yellow-900/30",   barColor: "bg-yellow-500" },
  "shopping":        { label: "Shopping",           color: "text-rose-600",     bg: "bg-rose-100 dark:bg-rose-900/30",       barColor: "bg-rose-500" },
  "entertainment":   { label: "Entertainment",     color: "text-fuchsia-600",  bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", barColor: "bg-fuchsia-500" },
  "news":            { label: "News",              color: "text-stone-600",    bg: "bg-stone-100 dark:bg-stone-900/30",     barColor: "bg-stone-500" },
  "social":          { label: "Social",            color: "text-sky-600",      bg: "bg-sky-100 dark:bg-sky-900/30",         barColor: "bg-sky-500" },
  "storage":         { label: "Storage",           color: "text-teal-600",     bg: "bg-teal-100 dark:bg-teal-900/30",       barColor: "bg-teal-500" },
  "utilities":       { label: "Utilities",         color: "text-slate-600",    bg: "bg-slate-100 dark:bg-slate-900/30",     barColor: "bg-slate-500" },
  "gaming":          { label: "Gaming",            color: "text-violet-600",   bg: "bg-violet-100 dark:bg-violet-900/30",   barColor: "bg-violet-500" },
  "insurance":       { label: "Insurance",         color: "text-neutral-600",  bg: "bg-neutral-100 dark:bg-neutral-900/30", barColor: "bg-neutral-500" },
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
