export interface DepInfo {
  name: string
  scope: string | null
  currentVersion: string
  latestVersion: string | null
  isOutdated: boolean
  isDevDependency: boolean
  description: string | null
  license: string | null
  homepage: string | null
  repository: string | null
  lastPublishDate: string | null
  downloadCount: number | null
  healthScore: number
  hasVulnerabilities: boolean
  vulnerabilityCount: number
  typosquatScore: number
  typosquatOf: string | null
  suggestedAlternatives: string[]
  aiRiskSummary: string | null
  aiRecommendation: string | null
  dependencyCount: number
  isDeprecated: boolean
  deprecatedReason: string | null
}

export interface ScanResult {
  id: string
  scannedAt: string
  totalDeps: number
  outdatedCount: number
  vulnerableCount: number
  deprecatedCount: number
  averageHealthScore: number
  dependencies: DepInfo[]
  devDependencies: DepInfo[]
  aiSummary: string | null
}

export interface ScanHistoryEntry {
  id: string
  scannedAt: string
  packageName: string | null
  totalDeps: number
  averageHealthScore: number
  vulnerableCount: number
  outdatedCount: number
}

export type View = "scanner" | "lookup" | "history"

export function getScoreCategory(score: number): "good" | "fair" | "poor" {
  if (score >= 70) return "good"
  if (score >= 40) return "fair"
  return "poor"
}

export const HEALTH_LABELS: Record<string, string> = {
  good: "Healthy",
  fair: "At Risk",
  poor: "Critical",
}

export const HEALTH_COLORS: Record<string, string> = {
  good: "text-green-600 dark:text-green-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-red-600 dark:text-red-400",
}

export const HEALTH_BG: Record<string, string> = {
  good: "bg-green-100 dark:bg-green-900/30",
  fair: "bg-amber-100 dark:bg-amber-900/30",
  poor: "bg-red-100 dark:bg-red-900/30",
}

export const HEALTH_BAR: Record<string, string> = {
  good: "bg-green-500",
  fair: "bg-amber-500",
  poor: "bg-red-500",
}
