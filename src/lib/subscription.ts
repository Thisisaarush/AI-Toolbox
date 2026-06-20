export type Plan = "free" | "pro"

export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    "All 75+ tools",
    "Local storage (browser)",
    "Basic tools",
  ],
  pro: [
    "All 75+ tools",
    "Cloud sync across devices",
    "All AI features (Gemini)",
    "Premium tools",
    "Priority support",
  ],
}

export function isPremiumFeature(feature: string): boolean {
  const premiumFeatures = [
    "ai", "gemini", "sync", "cloud-sync", "premium", "export",
    "analytics", "advanced",
  ]
  return premiumFeatures.some((f) => feature.toLowerCase().includes(f))
}

export function getRequiredPlan(feature: string): Plan {
  return isPremiumFeature(feature) ? "pro" : "free"
}

export function canAccess(feature: string, userPlan: Plan): boolean {
  const required = getRequiredPlan(feature)
  if (required === "free") return true
  return userPlan === "pro"
}
