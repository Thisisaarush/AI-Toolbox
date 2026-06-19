export interface PersonaPain {
  jobTitle: string
  context: string
  frequency: "daily" | "weekly" | "monthly"
  workaround: string
  willingToPay: string
}

export interface Competitor {
  name: string
  description: string
  pros: string[]
  cons: string[]
  pricing: string
}

export interface TamEstimate {
  addressableUniverse: string
  avgWillingnessToPay: number
  annualTam: string
  reasoning: string
}

export interface PivotSuggestion {
  angle: string
  reasoning: string
  targetAudience: string
}

export interface IdeaAnalysis {
  idea: string
  painScore: number
  painScoreReasoning: string
  searchQueries: string[]
  communitySignals: Array<{
    platform: string
    simulatedQuote: string
    sentiment: "frustrated" | "desperate" | "curious"
  }>
  personas: PersonaPain[]
  competitors: Competitor[]
  competitionStrength: "weak" | "moderate" | "strong" | "very-strong"
  verdict: "go" | "no-go" | "pivot"
  verdictReasoning: string
  whereTofindCustomers: Array<{
    type: string
    name: string
    link: string
  }>
  exactLanguage: string[]
  outreachMessage: string
  tamEstimate: TamEstimate
  pivotSuggestions: PivotSuggestion[]
  relatedIdeas: string[]
}

export interface IdeaRecord {
  id: string
  input: string
  analysis: IdeaAnalysis
  createdAt: string
}
