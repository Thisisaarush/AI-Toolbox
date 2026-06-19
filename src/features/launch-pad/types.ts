export interface LaunchInput {
  productName: string
  tagline: string
  description: string
  targetAudience: string
  keyFeatures: string[]
  techStack: string
  launchUrl: string
  tone: ToneId
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
  reddit: {
    title: string
    body: string
  }
  coldEmail: {
    subject: string
    body: string
  }
}

export interface LaunchRecord {
  id: string
  input: LaunchInput
  output: LaunchOutput
  notes: string
  createdAt: string
}

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
