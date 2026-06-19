export type ApplicationStatus =
  | "wishlist"
  | "applied"
  | "phone-screen"
  | "technical"
  | "final-round"
  | "offer"
  | "accepted"
  | "rejected"

export type InterviewType = "phone" | "video" | "onsite" | "technical" | "other"
export type WorkMode = "remote" | "hybrid" | "onsite"

export interface Interview {
  id: string
  date: string
  type: InterviewType
  interviewerName?: string
  prepNotes?: string
  outcomeNotes?: string
  completed: boolean
}

export interface Application {
  id: string
  company: string
  role: string
  salaryMin?: number
  salaryMax?: number
  currency?: string
  location?: string
  workMode?: WorkMode
  jobUrl?: string
  appliedDate?: string
  status: ApplicationStatus
  recruiterName?: string
  recruiterEmail?: string
  notes?: string
  companyNotes?: string   // culture, tech stack, etc.
  techStack?: string
  benefitsNotes?: string
  rating: number          // 1-5
  resumeVersionId?: string
  interviews: Interview[]
  snoozedUntil?: string   // ISO date — for follow-up snooze
  portfolioItems?: string[]  // GitHub repo names attached
  createdAt: string
  updatedAt: string
}

export interface ResumeVersion {
  id: string
  label: string
  content: string       // pasted text or base64 file
  isFile?: boolean
  createdAt: string
}

export interface GitHubRepo {
  id: number
  name: string
  description: string | null
  html_url: string
  stargazers_count: number
  language: string | null
  updated_at: string
  topics: string[]
}

export const STATUS_META: Record<ApplicationStatus, { label: string; color: string; bg: string; order: number }> = {
  "wishlist":      { label: "Wishlist",      color: "text-gray-600",   bg: "bg-gray-100 dark:bg-gray-800",          order: 0 },
  "applied":       { label: "Applied",       color: "text-blue-600",   bg: "bg-blue-100 dark:bg-blue-900/30",        order: 1 },
  "phone-screen":  { label: "Phone Screen",  color: "text-purple-600", bg: "bg-purple-100 dark:bg-purple-900/30",    order: 2 },
  "technical":     { label: "Technical",     color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30",    order: 3 },
  "final-round":   { label: "Final Round",   color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30",      order: 4 },
  "offer":         { label: "Offer",         color: "text-emerald-600",bg: "bg-emerald-100 dark:bg-emerald-900/30",  order: 5 },
  "accepted":      { label: "Accepted",      color: "text-green-700",  bg: "bg-green-100 dark:bg-green-900/30",      order: 6 },
  "rejected":      { label: "Rejected",      color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30",          order: 7 },
}
