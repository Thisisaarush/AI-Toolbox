export type TripPurpose = "leisure" | "business" | "backpacking"
export type TripStatus  = "planning" | "booked" | "completed"
export type ExpenseCat  = "food" | "transport" | "accommodation" | "activities" | "shopping" | "utilities" | "misc"

export interface Trip {
  id: string
  destination: string
  departureDate: string   // YYYY-MM-DD
  returnDate: string
  purpose: TripPurpose
  status: TripStatus
  originCountry: string
  createdAt: string
}

export interface DocChecklistItem {
  id: string
  tripId: string
  label: string
  checked: boolean
  expiring?: boolean
  notes?: string
}

export interface Booking {
  id: string
  tripId: string
  type: "flight" | "hotel" | "car" | "activity" | "other"
  title: string
  confirmationCode: string
  date: string
  endDate?: string
  price?: number
  currency?: string
  url?: string
  notes?: string
}

export interface PackingItem {
  id: string
  tripId: string
  category: string
  label: string
  checked: boolean
  qty?: number
}

export interface PackingTemplate {
  id: string
  name: string
  items: { category: string; label: string; qty?: number }[]
}

export interface TripExpense {
  id: string
  tripId: string
  amount: number
  currency: string
  category: ExpenseCat
  date: string
  notes?: string
}

export interface EmergencyInfo {
  tripId: string
  emergencyNumber: string
  embassyContact: string
  insuranceHotline: string
  bloodType?: string
  allergies?: string
}

export interface TravelStore {
  trips: Trip[]
  checklists: DocChecklistItem[]
  bookings: Booking[]
  packingItems: PackingItem[]
  packingTemplates: PackingTemplate[]
  expenses: TripExpense[]
  emergencyInfos: EmergencyInfo[]
  exchangeRates: Record<string, number>
  ratesUpdated?: string
}

export const EXPENSE_CATS: ExpenseCat[] = ["food","transport","accommodation","activities","shopping","utilities","misc"]
export const BOOKING_TYPES = ["flight","hotel","car","activity","other"] as const
export const PURPOSE_LABELS: Record<TripPurpose, string> = { leisure: "Leisure", business: "Business", backpacking: "Backpacking" }
export const STATUS_COLORS: Record<TripStatus, string> = {
  planning: "bg-amber-500/20 text-amber-400",
  booked:   "bg-blue-500/20 text-blue-400",
  completed:"bg-green-500/20 text-green-400",
}
export const CAT_COLORS: Record<ExpenseCat, string> = {
  food:           "text-orange-400",
  transport:      "text-blue-400",
  accommodation:  "text-purple-400",
  activities:     "text-green-400",
  shopping:       "text-pink-400",
  utilities:      "text-gray-400",
  misc:           "text-muted-foreground",
}
