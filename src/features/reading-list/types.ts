export type ReadingStatus = "unread" | "reading" | "done" | "archived"

export interface ReadingItem {
  id: string
  url: string
  title: string
  description?: string
  ogImage?: string
  domain: string
  tags: string[]
  status: ReadingStatus
  readingTimeMin?: number
  wordCount?: number
  aiSummary?: string
  summaryGeneratedAt?: string
  dateAdded: string
  notes?: string
  highlightCount?: number  // from Readwise
  author?: string          // from Readwise
}

export interface ReadwiseHighlight {
  id: number
  text: string
  title?: string
  author?: string
  source_url?: string
  highlighted_at?: string
}

export interface ReadingStore {
  items: ReadingItem[]
  readwiseToken?: string
  lastReadwiseSync?: string
}

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  unread:   "Unread",
  reading:  "Reading",
  done:     "Done",
  archived: "Archived",
}

export const STATUS_COLORS: Record<ReadingStatus, string> = {
  unread:   "bg-blue-500/20 text-blue-400",
  reading:  "bg-amber-500/20 text-amber-400",
  done:     "bg-green-500/20 text-green-400",
  archived: "bg-gray-500/20 text-gray-400",
}

export function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 200))
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
}
