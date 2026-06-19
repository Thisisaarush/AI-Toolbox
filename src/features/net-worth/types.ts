export type AssetCategory =
  | "cash-savings"
  | "investments"
  | "real-estate"
  | "retirement"
  | "business"
  | "other-assets"

export type LiabilityCategory =
  | "mortgage"
  | "student-loans"
  | "car-loans"
  | "credit-card"
  | "personal-loans"
  | "other-liabilities"

export type AccountType = AssetCategory | LiabilityCategory

export interface Account {
  id: string
  name: string
  institution?: string
  type: AccountType
  isAsset: boolean
  balance: number          // in original currency
  currency: string         // ISO 4217
  usdEquivalent: number    // computed
  lastUpdated: string      // ISO date
  notes?: string
}

export interface NetWorthSnapshot {
  date: string
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export interface NetWorthGoal {
  id: string
  targetAmount: number
  targetDate: string
  label: string
}

export interface NetWorthState {
  accounts: Account[]
  snapshots: NetWorthSnapshot[]
  goals: NetWorthGoal[]
  baseCurrency: string
}

export const ASSET_CATEGORY_META: Record<AssetCategory, { label: string; color: string; barColor: string }> = {
  "cash-savings":  { label: "Cash & Savings",    color: "text-green-600",   barColor: "bg-green-500" },
  "investments":   { label: "Investments",        color: "text-blue-600",    barColor: "bg-blue-500" },
  "real-estate":   { label: "Real Estate",        color: "text-violet-600",  barColor: "bg-violet-500" },
  "retirement":    { label: "Retirement",         color: "text-amber-600",   barColor: "bg-amber-500" },
  "business":      { label: "Business Equity",    color: "text-orange-600",  barColor: "bg-orange-500" },
  "other-assets":  { label: "Other Assets",       color: "text-gray-600",    barColor: "bg-gray-500" },
}

export const LIABILITY_CATEGORY_META: Record<LiabilityCategory, { label: string; color: string; barColor: string }> = {
  "mortgage":          { label: "Mortgage",       color: "text-red-600",    barColor: "bg-red-500" },
  "student-loans":     { label: "Student Loans",  color: "text-rose-600",   barColor: "bg-rose-500" },
  "car-loans":         { label: "Car Loans",       color: "text-orange-600", barColor: "bg-orange-500" },
  "credit-card":       { label: "Credit Card",    color: "text-pink-600",   barColor: "bg-pink-500" },
  "personal-loans":    { label: "Personal Loans", color: "text-red-500",    barColor: "bg-red-400" },
  "other-liabilities": { label: "Other",          color: "text-gray-600",   barColor: "bg-gray-500" },
}

export function formatUSD(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n)
}
