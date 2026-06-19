export type Platform =
  | "Twitter/X" | "LinkedIn" | "Instagram" | "YouTube"
  | "Newsletter" | "Blog" | "TikTok"

export type ContentType =
  | "thread" | "post" | "video" | "article" | "newsletter" | "short"

export type ContentStatus =
  | "idea" | "draft" | "scheduled" | "published"

export interface ContentPillar {
  id: string
  name: string
  color: string  // tailwind color name
  description?: string
}

export interface ContentPiece {
  id: string
  title: string
  platform: Platform
  type: ContentType
  status: ContentStatus
  publishDate?: string   // YYYY-MM-DD
  tags: string[]
  pillarId?: string
  draft?: string
  notes?: string
  ghostPostId?: string
  analytics?: ContentAnalytics
  createdAt: string
  updatedAt: string
}

export interface ContentAnalytics {
  impressions?: number
  likes?: number
  comments?: number
  shares?: number
  clicks?: number
  loggedAt?: string
}

export interface GhostConfig {
  apiUrl: string
  adminKey: string
}

export interface ContentStore {
  pieces: ContentPiece[]
  pillars: ContentPillar[]
  ghostConfig?: GhostConfig
}

export const PLATFORMS: Platform[] = [
  "Twitter/X","LinkedIn","Instagram","YouTube","Newsletter","Blog","TikTok"
]

export const PLATFORM_COLORS: Record<Platform, string> = {
  "Twitter/X": "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "LinkedIn":  "bg-blue-600/20 text-blue-400 border-blue-600/30",
  "Instagram": "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "YouTube":   "bg-red-500/20 text-red-400 border-red-500/30",
  "Newsletter":"bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Blog":      "bg-green-500/20 text-green-400 border-green-500/30",
  "TikTok":    "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
}

export const STATUS_COLORS: Record<ContentStatus, string> = {
  idea:       "bg-gray-500/20 text-gray-400",
  draft:      "bg-amber-500/20 text-amber-400",
  scheduled:  "bg-blue-500/20 text-blue-400",
  published:  "bg-green-500/20 text-green-400",
}

export const CONTENT_TYPES: ContentType[] = [
  "thread","post","video","article","newsletter","short"
]

export const PILLAR_COLORS = [
  "fuchsia","purple","violet","blue","cyan","teal","green","amber","orange","rose","pink","red"
] as const
export type PillarColor = typeof PILLAR_COLORS[number]

export const PILLAR_COLOR_MAP: Record<string, string> = {
  fuchsia: "bg-fuchsia-500/20 text-fuchsia-400",
  purple:  "bg-purple-500/20 text-purple-400",
  violet:  "bg-violet-500/20 text-violet-400",
  blue:    "bg-blue-500/20 text-blue-400",
  cyan:    "bg-cyan-500/20 text-cyan-400",
  teal:    "bg-teal-500/20 text-teal-400",
  green:   "bg-green-500/20 text-green-400",
  amber:   "bg-amber-500/20 text-amber-400",
  orange:  "bg-orange-500/20 text-orange-400",
  rose:    "bg-rose-500/20 text-rose-400",
  pink:    "bg-pink-500/20 text-pink-400",
  red:     "bg-red-500/20 text-red-400",
}
