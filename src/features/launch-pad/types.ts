export interface LaunchInput {
  productName: string
  tagline: string
  description: string
  targetAudience: string
  keyFeatures: string[]
  techStack: string
  launchUrl: string
  tone: ToneId
  launchDate?: string // ISO date string
}

export type ToneId = "professional" | "casual" | "technical" | "excited"

export const TONES: Record<ToneId, { label: string; desc: string }> = {
  professional: { label: "Professional", desc: "Polished and business-focused" },
  casual: { label: "Casual", desc: "Friendly and conversational" },
  technical: { label: "Technical", desc: "Details-first, dev audience" },
  excited: { label: "Excited", desc: "High energy, enthusiastic" },
}

export interface LaunchOutput {
  productHunt: {
    name: string
    tagline: string
    description: string
    firstComment: string
  }
  hackerNews: {
    title: string
    body: string
  }
  tweetThread: string[]
  tweetThreadSubjectLines?: EmailSubjectLine[]
  reddit: {
    title: string
    body: string
  }
  coldEmail: {
    subject: string
    body: string
    altSubjectLines?: EmailSubjectLine[]
  }
  linkedInPost: {
    body: string
  }
}

export interface EmailSubjectLine {
  subject: string
  openRateLabel: "High" | "Medium" | "Low"
  reason: string
}

export interface LaunchRecord {
  id: string
  input: LaunchInput
  output: LaunchOutput
  notes: string
  createdAt: string
  competitorResearch?: CompetitorResearch
  performanceData?: PlatformPerformance[]
  waitlistHtml?: string
  waitlistThankYouHtml?: string
}

// Competitor Research
export interface Competitor {
  name: string
  url: string
  pricingModel: string
  keyDifferentiator: string
  weakness: string
}

export interface CompetitorResearch {
  competitors: Competitor[]
  positioningAngles: string[]
  suggestedUVP: string
  generatedAt: string
}

// Performance Tracking
export type LaunchPlatformId = "ph" | "hn" | "reddit" | "twitter" | "linkedin"

export interface PlatformPerformance {
  platform: LaunchPlatformId
  platformLabel: string
  upvotes: number
  comments: number
  signups: number
  notes: string
  loggedAt: string
}

export const LAUNCH_PLATFORM_OPTIONS: { id: LaunchPlatformId; label: string }[] = [
  { id: "ph", label: "Product Hunt" },
  { id: "hn", label: "Hacker News" },
  { id: "reddit", label: "Reddit" },
  { id: "twitter", label: "Twitter / X" },
  { id: "linkedin", label: "LinkedIn" },
]

// Waitlist Builder
export interface WaitlistFormData {
  productName: string
  headline: string
  description: string
  ctaText: string
  formspreeEndpoint: string
  accentColor: string
}

// Pre-launch timeline
export interface TimelineItem {
  dayOffset: number // negative = before launch
  label: string
  description: string
}

export const PRE_LAUNCH_TIMELINE: TimelineItem[] = [
  { dayOffset: -14, label: "T-14 days", description: "Start building waitlist. Set up landing page, social profiles, and email capture." },
  { dayOffset: -7, label: "T-7 days", description: "Post a teaser tweet/thread. Share what you're building without revealing everything." },
  { dayOffset: -3, label: "T-3 days", description: "DM your network. Reach out personally to 20+ people who would benefit." },
  { dayOffset: -1, label: "T-1 day", description: "Reach out to a Product Hunt hunter. Prepare your assets (logo, screenshots, tagline)." },
  { dayOffset: 0, label: "Launch day 🚀", description: "Post on PH at 12:01 AM PST, cross-post everywhere. Respond to every comment within an hour." },
]

export const LAUNCH_CHECKLIST = [
  "OG image set (1200×628)",
  "Mobile responsive tested",
  "Error pages (404, 500) set up",
  "SSL certificate active",
  "Page load speed < 3 seconds",
  "Meta title & description set",
  "Analytics tracking installed",
  "Contact/support email added",
  "Privacy policy & terms linked",
  "Social media profiles linked",
]

export const BEST_TIMES: Record<string, string> = {
  "Product Hunt": "Tuesday–Thursday, 12:01 AM PST (launches reset daily)",
  "Hacker News": "Tuesday–Thursday, 9–11 AM EST",
  "Reddit": "Tuesday–Thursday, 9 AM–12 PM EST",
  "Twitter / X": "Monday–Wednesday, 9–10 AM local time",
}

// Power words used for subject line scoring heuristic
export const POWER_WORDS = [
  "exclusive", "free", "new", "secret", "introducing", "you", "your",
  "instantly", "proven", "results", "easy", "now", "save", "limited",
  "announcing", "finally", "discover", "unlock", "boost",
]

export function scoreSubjectLine(subject: string): EmailSubjectLine["openRateLabel"] {
  const lower = subject.toLowerCase()
  const len = subject.length
  let score = 0
  // Ideal length 40–50 chars
  if (len >= 30 && len <= 50) score += 2
  else if (len < 30 || len > 70) score -= 1
  // Power words
  const hits = POWER_WORDS.filter((w) => lower.includes(w)).length
  score += hits
  // Question mark is engaging
  if (subject.includes("?")) score += 1
  // Numbers are engaging
  if (/\d/.test(subject)) score += 1
  if (score >= 4) return "High"
  if (score >= 2) return "Medium"
  return "Low"
}
