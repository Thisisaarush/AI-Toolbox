export type DocumentType =
  | "passport"
  | "drivers-license"
  | "national-id"
  | "health-insurance"
  | "vehicle-registration"
  | "voter-id"
  | "social-security"
  | "tax-id"
  | "visa"
  | "work-permit"
  | "bank-card"
  | "emergency-contact"
  | "custom"

export interface VaultDocument {
  id: string
  type: DocumentType
  name: string
  issuingAuthority?: string
  issuingCountry?: string
  documentNumber?: string   // XOR-obfuscated hex
  issueDate?: string        // ISO date
  expiryDate?: string       // ISO date
  notes?: string
  photoBase64?: string      // data URL
  reminderDate?: string     // ISO date
  createdAt: string
  updatedAt: string
}

export interface EmergencyCard {
  name: string
  bloodType?: string
  allergies?: string
  emergencyContacts: { name: string; phone: string; relationship: string }[]
  insuranceNumber?: string
  doctorContact?: string
}

export interface VaultState {
  documents: VaultDocument[]
  pinHash: string | null     // SHA-256 hex of PIN
  emergencyCard: EmergencyCard | null
}

export const DOC_TYPE_META: Record<DocumentType, { label: string; color: string; bg: string }> = {
  "passport":           { label: "Passport",             color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30" },
  "drivers-license":    { label: "Driver's License",     color: "text-green-600",  bg: "bg-green-100 dark:bg-green-900/30" },
  "national-id":        { label: "National ID",          color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30" },
  "health-insurance":   { label: "Health Insurance",     color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30" },
  "vehicle-registration": { label: "Vehicle Reg.",       color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30" },
  "voter-id":           { label: "Voter ID",             color: "text-indigo-600", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  "social-security":    { label: "Social Security",      color: "text-cyan-600",   bg: "bg-cyan-100 dark:bg-cyan-900/30" },
  "tax-id":             { label: "PAN / Tax ID",         color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  "visa":               { label: "Visa",                 color: "text-violet-600", bg: "bg-violet-100 dark:bg-violet-900/30" },
  "work-permit":        { label: "Work Permit",          color: "text-teal-600",   bg: "bg-teal-100 dark:bg-teal-900/30" },
  "bank-card":          { label: "Bank Card",            color: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  "emergency-contact":  { label: "Emergency Contact",    color: "text-rose-600",   bg: "bg-rose-100 dark:bg-rose-900/30" },
  "custom":             { label: "Custom",               color: "text-gray-600",   bg: "bg-gray-100 dark:bg-gray-800" },
}

// XOR cipher with a key string
export function xorCipher(text: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key)
  const textBytes = new TextEncoder().encode(text)
  const result = new Uint8Array(textBytes.length)
  for (let i = 0; i < textBytes.length; i++) {
    result[i] = textBytes[i]! ^ keyBytes[i % keyBytes.length]!
  }
  return Array.from(result).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function xorDecipher(hex: string, key: string): string {
  const keyBytes = new TextEncoder().encode(key)
  const bytes = hex.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []
  const result = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    result[i] = (bytes[i] ?? 0) ^ keyBytes[i % keyBytes.length]!
  }
  return new TextDecoder().decode(result)
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("")
}

export function expiryColor(expiryDate: string): string {
  const diff = new Date(expiryDate).getTime() - Date.now()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days < 0) return "text-red-600"
  if (days < 30) return "text-red-500"
  if (days < 90) return "text-amber-500"
  return "text-green-500"
}

export function daysToExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}
