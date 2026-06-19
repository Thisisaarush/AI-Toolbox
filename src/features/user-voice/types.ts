export type ProductStage = "idea" | "mvp" | "beta" | "launched" | "scaling"

export interface UserVoiceInput {
  productName: string
  description: string
  targetUser: string
  stage: ProductStage
  assumption: string
}

export interface SimulatedPersona {
  name: string
  role: string
  age: number
  techSavvy: "low" | "medium" | "high"
  reaction: "excited" | "skeptical" | "neutral" | "confused" | "disappointed"
  firstImpression: string
  topConcern: string
  featureRequests: string[]
  willingToPay: string
  likeliness: number // 1-10
  quote: string
}

export interface AggregateInsights {
  avgLikeliness: number
  topConcerns: string[]
  topRequests: string[]
  paymentConsensus: string
  biggestRisk: string
  fastestWin: string
}

export interface UserVoiceResult {
  personas: SimulatedPersona[]
  insights: AggregateInsights
  actionItems: string[]
  validationScore: number
  validationSummary: string
}

export interface UserVoiceRecord {
  id: string
  input: UserVoiceInput
  result: UserVoiceResult
  createdAt: string
}

export const STAGE_LABELS: Record<ProductStage, string> = {
  idea: "Just an Idea",
  mvp: "Building MVP",
  beta: "In Beta",
  launched: "Launched",
  scaling: "Scaling",
}
