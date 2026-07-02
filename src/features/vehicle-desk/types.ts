export interface Vehicle {
  id: string
  number: string
  state: string
  make: string
  model: string
  year: number
  fuelType: "petrol" | "diesel" | "cng" | "ev" | "hybrid"
  rcExpiry: string
  insuranceExpiry: string
  pucExpiry: string
  fitnessExpiry: string | null
  lastChallanCheck: string | null
  pendingChallans: number
  notes: string
  createdAt: string
  updatedAt: string
}

export interface ChallanRecord {
  id: string
  vehicleNumber: string
  challanNumber: string
  violation: string
  fine: number
  date: string
  status: "pending" | "paid" | "disputed"
  state: string
  authority: string
  checkedAt: string
}

export interface PucRecord {
  vehicleNumber: string
  certificateNumber: string
  validUpto: string
  status: "valid" | "expired" | "not-found"
  checkedAt: string
}

export type View = "dashboard" | "add-vehicle" | "vehicle-detail" | "challan-check" | "all-reminders"

export const STORAGE_KEY = "vehicle-desk-v1"
export const CHALLAN_KEY = "vehicle-challans-v1"
export const PUC_KEY = "vehicle-puc-v1"

export const INDIAN_STATES = [
  "AP", "AR", "AS", "BR", "CG", "DL", "GA", "GJ", "HR", "HP",
  "JH", "KA", "KL", "LD", "MP", "MH", "MN", "ML", "MZ", "NL",
  "OD", "PB", "RJ", "SK", "TN", "TR", "UP", "UK", "WB", "AN",
  "CH", "DN", "DD", "JK", "LA", "PY",
] as const

export function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function isExpiringSoon(dateStr: string, withinDays = 30): boolean {
  const days = daysUntil(dateStr)
  return days >= 0 && days <= withinDays
}

export function isExpired(dateStr: string): boolean {
  return daysUntil(dateStr) < 0
}
