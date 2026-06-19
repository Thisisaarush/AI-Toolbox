export type ContractType =
  | "nda-mutual"
  | "nda-one-way"
  | "freelance-service"
  | "sow"
  | "ip-assignment"
  | "employment-offer"
  | "tos"
  | "privacy-policy"
  | "consulting"
  | "contractor"

export type Jurisdiction =
  | "us"
  | "uk"
  | "eu"
  | "india"
  | "canada"
  | "australia"

export interface ContractField {
  key: string
  label: string
  type: "text" | "textarea" | "date" | "number" | "select"
  placeholder?: string
  options?: string[]
  required?: boolean
}

export interface ContractVersion {
  id: string
  content: string
  editedContent: string
  createdAt: string
  label?: string
}

export interface ContractRecord {
  id: string
  type: ContractType
  jurisdiction: Jurisdiction
  title: string
  fieldValues: Record<string, string>
  versions: ContractVersion[]
  activeVersionId: string
  createdAt: string
  updatedAt: string
}

export const CONTRACT_META: Record<ContractType, { label: string; description: string }> = {
  "nda-mutual":         { label: "Mutual NDA",             description: "Both parties share confidential information" },
  "nda-one-way":        { label: "One-Way NDA",            description: "One party discloses confidential information" },
  "freelance-service":  { label: "Freelance Agreement",    description: "Service contract for freelancers" },
  "sow":                { label: "Statement of Work",      description: "Detailed project scope and deliverables" },
  "ip-assignment":      { label: "IP Assignment",          description: "Transfer intellectual property rights" },
  "employment-offer":   { label: "Employment Offer",       description: "Job offer letter with terms" },
  "tos":                { label: "Terms of Service",       description: "Website/app terms of service" },
  "privacy-policy":     { label: "Privacy Policy",         description: "GDPR/CCPA compliant privacy policy" },
  "consulting":         { label: "Consulting Agreement",   description: "Consulting services contract" },
  "contractor":         { label: "Contractor Agreement",   description: "Independent contractor agreement" },
}

export const JURISDICTION_META: Record<Jurisdiction, string> = {
  "us":        "United States",
  "uk":        "United Kingdom",
  "eu":        "European Union",
  "india":     "India",
  "canada":    "Canada",
  "australia": "Australia",
}
