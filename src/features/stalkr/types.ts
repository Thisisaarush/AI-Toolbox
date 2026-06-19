export interface HNMention {
  title: string
  url: string
  points: number
  numComments: number
  createdAt: string
  objectID: string
}

export interface BrandAnalysis {
  brandName: string
  url?: string
  hnMentions: HNMention[]
  sentiment: "positive" | "neutral" | "negative" | "mixed"
  sentimentSummary: string
  nameScore: number
  nameScoreBreakdown: {
    memorability: number
    pronounceability: number
    uniqueness: number
    domainFriendly: number
  }
  nameScoreReasoning: string
  seoKeywords: string[]
  searchLinks: Array<{ label: string; url: string }>
  improvements: string[]
  strengths: string[]
}
