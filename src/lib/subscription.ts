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
  // AI features are excluded here even though the keyword list below would
  // otherwise seem to imply "gemini"/"ai" gate access — AI tools use a
  // bring-your-own-key model (the user supplies their own Gemini key), so
  // the app pays nothing for that usage and there's no reason to gate it
  // behind a paid plan. Pro gates only the features that actually cost us
  // server/DB resources: cross-device sync, data export, analytics.
  const premiumFeatures = [
    "sync", "cloud-sync", "premium", "export", "analytics", "advanced",
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
