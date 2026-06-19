export type ViralFormat =
  | "hot-take"
  | "contrarian"
  | "listicle"
  | "story"
  | "how-to"
  | "unpopular-opinion"
  | "prediction"
  | "roast"

export type Platform = "twitter" | "linkedin" | "reddit" | "hn"

export interface ViralPostInput {
  format: ViralFormat
  topic: string
  context: string
  platform: Platform
  angle?: string
}

export interface PlatformPost {
  platform: Platform
  content: string
  engagementScore: number
  engagementReasoning: string
  bestTimeToPost: string
  hashtags: string[]
}

export interface ViralPostResult {
  posts: PlatformPost[]
  hookAlternatives: string[]
  threadVersion?: string
}

export interface ViralPostRecord {
  id: string
  input: ViralPostInput
  result: ViralPostResult
  createdAt: string
}

export const FORMAT_LABELS: Record<ViralFormat, string> = {
  "hot-take": "Hot Take",
  "contrarian": "Contrarian View",
  "listicle": "Listicle",
  "story": "Story / Journey",
  "how-to": "How-To / Tutorial",
  "unpopular-opinion": "Unpopular Opinion",
  "prediction": "Bold Prediction",
  "roast": "Roast / Satire",
}

export const FORMAT_DESCRIPTIONS: Record<ViralFormat, string> = {
  "hot-take": "Strong opinion that sparks debate",
  "contrarian": "Goes against the mainstream consensus",
  "listicle": "Quick list of insights or tips",
  "story": "Personal experience or transformation arc",
  "how-to": "Step-by-step guide people will save",
  "unpopular-opinion": "Honest take most people won't say",
  "prediction": "Bold call about the future",
  "roast": "Satirical take on an industry trend",
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  hn: "Hacker News",
}
