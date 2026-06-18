export type DreamAnalysisResult = {
  analysis: string
  imageUrl: string | null
}

export type DreamHistoryItem = {
  id: string
  content: string
  imageUrl: string | null
  createdAt: string
}
