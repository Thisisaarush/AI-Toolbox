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
  imessage: {
    label: "iMessage",
    color: "text-gray-500",
    bg: "bg-gray-100 dark:bg-gray-900",
    maxTitleLen: 60,
    maxDescLen: 120,
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
}

export type TemplateId = "gradient" | "dark" | "light" | "code" | "minimal"

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
]

export interface OGDesign {
  templateId: TemplateId
  headline: string
  subheadline: string
  logoText: string
  customColor: string
  fontSize: "sm" | "md" | "lg" | "xl"
}

export interface URLHistory {
  url: string
  ogData: OGData
  checkedAt: string
}
