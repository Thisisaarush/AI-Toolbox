export interface OGData {
  url: string
  title: string
  description: string
  image: string
  siteName: string
  twitterCard: string
  twitterTitle: string
  twitterDescription: string
  twitterImage: string
  favicon: string
  ogType: string
  ogUrl: string
  fetchedAt: string
}

export type Platform = "twitter" | "linkedin" | "discord" | "whatsapp" | "imessage" | "facebook"

export interface PlatformMeta {
  label: string
  color: string
  bg: string
  maxTitleLen: number
  maxDescLen: number
  showImage: boolean
  imageAspect: string
}

export const PLATFORMS: Record<Platform, PlatformMeta> = {
  twitter: {
    label: "Twitter / X",
    color: "text-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950",
    maxTitleLen: 70,
    maxDescLen: 200,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
  linkedin: {
    label: "LinkedIn",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950",
    maxTitleLen: 100,
    maxDescLen: 300,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
  discord: {
    label: "Discord",
    color: "text-indigo-500",
    bg: "bg-indigo-950",
    maxTitleLen: 256,
    maxDescLen: 4096,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
  whatsapp: {
    label: "WhatsApp",
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950",
    maxTitleLen: 80,
    maxDescLen: 250,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
  facebook: {
    label: "Facebook",
    color: "text-blue-700",
    bg: "bg-blue-100 dark:bg-blue-950",
    maxTitleLen: 100,
    maxDescLen: 300,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
  imessage: {
    label: "iMessage",
    color: "text-gray-500",
    bg: "bg-gray-100 dark:bg-gray-900",
    maxTitleLen: 60,
    maxDescLen: 120,
    showImage: true,
    imageAspect: "aspect-[1200/628]",
  },
}

export type TemplateId =
  | "gradient"
  | "dark"
  | "light"
  | "code"
  | "minimal"
  | "brand"
  | "announcement"
  | "blog"

export interface OGTemplate {
  id: TemplateId
  label: string
  preview: string
}

export const OG_TEMPLATES: OGTemplate[] = [
  { id: "gradient", label: "Gradient", preview: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)" },
  { id: "dark", label: "Dark", preview: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" },
  { id: "light", label: "Light", preview: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)" },
  { id: "code", label: "Code", preview: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)" },
  { id: "minimal", label: "Minimal", preview: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)" },
  { id: "brand", label: "Brand", preview: "linear-gradient(90deg, #6366f1 0%, #6366f1 12%, #ffffff 12%)" },
  { id: "announcement", label: "Announce", preview: "radial-gradient(ellipse at 30% 50%, #1e0a3c 0%, #0f0720 100%)" },
  { id: "blog", label: "Blog", preview: "linear-gradient(135deg, #fafafa 0%, #f0f4ff 100%)" },
]

export type CanvasSizeId = "og" | "twitter" | "linkedin-banner" | "instagram-square" | "instagram-story"

export interface CanvasSize {
  id: CanvasSizeId
  label: string
  width: number
  height: number
}

export const CANVAS_SIZES: CanvasSize[] = [
  { id: "og", label: "OG Image (1200×628)", width: 1200, height: 628 },
  { id: "twitter", label: "Twitter Card (1200×628)", width: 1200, height: 628 },
  { id: "linkedin-banner", label: "LinkedIn Banner (1584×396)", width: 1584, height: 396 },
  { id: "instagram-square", label: "Instagram Square (1080×1080)", width: 1080, height: 1080 },
  { id: "instagram-story", label: "Instagram Story (1080×1920)", width: 1080, height: 1920 },
]

export interface OGDesign {
  templateId: TemplateId
  headline: string
  subheadline: string
  logoText: string
  customColor: string
  fontSize: "sm" | "md" | "lg" | "xl"
  canvasSize: { width: number; height: number }
}

export interface URLHistory {
  url: string
  ogData: OGData
  checkedAt: string
}

// OG Score computed client-side
export interface OGScore {
  score: number
  details: OGScoreDetail[]
}

export interface OGScoreDetail {
  label: string
  pass: boolean
  points: number
}

export function computeOGScore(data: OGData): OGScore {
  const details: OGScoreDetail[] = [
    { label: "Has og:title", pass: !!data.title, points: 20 },
    { label: "og:title length 30–70 chars", pass: data.title.length >= 30 && data.title.length <= 70, points: 10 },
    { label: "Has og:description", pass: !!data.description, points: 20 },
    { label: "og:description length 70–160 chars", pass: data.description.length >= 70 && data.description.length <= 160, points: 10 },
    { label: "Has og:image", pass: !!data.image, points: 25 },
    { label: "Has twitter:card", pass: !!data.twitterCard, points: 15 },
  ]
  const score = details.filter((d) => d.pass).reduce((s, d) => s + d.points, 0)
  return { score, details }
}

export interface BulkGenerateItem {
  path: string
  title: string
  description: string
}

export interface ValidationItem {
  label: string
  pass: boolean
  hint: string
}

export function validateOGData(data: OGData): ValidationItem[] {
  return [
    {
      label: "og:title present and good length",
      pass: !!data.title && data.title.length >= 30 && data.title.length <= 70,
      hint: data.title ? `${data.title.length} chars (ideal: 30–70)` : "Missing",
    },
    {
      label: "og:description present and good length",
      pass: !!data.description && data.description.length >= 70 && data.description.length <= 160,
      hint: data.description ? `${data.description.length} chars (ideal: 70–160)` : "Missing",
    },
    {
      label: "og:image present",
      pass: !!data.image,
      hint: data.image ? "Found" : "Missing — critical for social previews",
    },
    {
      label: "twitter:card set",
      pass: !!data.twitterCard,
      hint: data.twitterCard || "Not set",
    },
    {
      label: "og:type set",
      pass: !!data.ogType,
      hint: data.ogType || "Not set",
    },
    {
      label: "og:url matches page URL",
      pass: !!data.ogUrl && data.ogUrl.replace(/\/$/, "") === data.url.replace(/\/$/, ""),
      hint: data.ogUrl ? (data.ogUrl === data.url ? "Matches" : `Set to: ${data.ogUrl}`) : "Not set",
    },
  ]
}
