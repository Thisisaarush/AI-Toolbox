"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
  Globe, ChevronDown, ChevronUp, Plus, Trash2,
  Download, Smartphone, Image, Link2, Palette, Check, X,
  Globe2, Mail, ExternalLink,
  Copy, Upload, Square, Grid3x3, Waves,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────

type SocialPlatform =
  | "twitter" | "github" | "linkedin" | "youtube" | "instagram"
  | "tiktok" | "bluesky" | "threads" | "website" | "email"

type SocialLink = {
  platform: SocialPlatform
  url: string
  enabled: boolean
}

type CustomLink = {
  id: string
  title: string
  url: string
  enabled: boolean
  clicks: number
}

type FrameType = "iphone" | "android" | "minimal"

type BgPattern = "solid" | "gradient" | "dots" | "waves"

type Theme = {
  bgColor: string
  cardColor: string
  textColor: string
  accentColor: string
  fontSize: "sm" | "base" | "lg"
  fontFamily: "sans" | "serif" | "mono"
  borderRadius: "sm" | "md" | "lg" | "xl" | "full"
  layout: "centered" | "split"
  bgPattern: BgPattern
  gradientColor: string
  shadow: boolean
  showWatermark: boolean
}

type PageData = {
  profileImage: string
  name: string
  tagline: string
  description: string
  socialLinks: SocialLink[]
  customLinks: CustomLink[]
  theme: Theme
}

// ── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = "indiepage-v1"
const ANALYTICS_KEY = "indiepage-clicks-v1"

type PlatformEntry = { value: SocialPlatform; label: string; icon: React.ComponentType<{ className?: string }> }

const SOCIAL_PLATFORMS: PlatformEntry[] = [
  { value: "twitter", label: "Twitter (X)", icon: TwitterIcon },
  { value: "github", label: "GitHub", icon: GithubIcon },
  { value: "linkedin", label: "LinkedIn", icon: LinkedinIcon },
  { value: "youtube", label: "YouTube", icon: YoutubeIcon },
  { value: "instagram", label: "Instagram", icon: InstagramIcon },
  { value: "tiktok", label: "TikTok", icon: TikTokIcon },
  { value: "bluesky", label: "Bluesky", icon: BlueskyIcon },
  { value: "threads", label: "Threads", icon: ThreadsIcon },
  { value: "website", label: "Website", icon: Globe2 },
  { value: "email", label: "Email", icon: Mail },
]

const FONT_SIZES = [
  { value: "sm" as const, label: "Small" },
  { value: "base" as const, label: "Medium" },
  { value: "lg" as const, label: "Large" },
]

const BORDER_RADII = [
  { value: "sm" as const, label: "Sharp" },
  { value: "md" as const, label: "Slight" },
  { value: "lg" as const, label: "Rounded" },
  { value: "xl" as const, label: "Extra" },
  { value: "full" as const, label: "Full" },
]

const LAYOUTS = [
  { value: "centered" as const, label: "Centered" },
  { value: "split" as const, label: "Split" },
]

const FRAMES: { value: FrameType; label: string; icon: typeof Smartphone }[] = [
  { value: "iphone", label: "iPhone", icon: Smartphone },
  { value: "android", label: "Android", icon: Smartphone },
  { value: "minimal", label: "Minimal", icon: Smartphone },
]

const FONT_FAMILIES = [
  { value: "sans" as const, label: "Sans" },
  { value: "serif" as const, label: "Serif" },
  { value: "mono" as const, label: "Mono" },
]

const BG_PATTERNS: { value: BgPattern; label: string; icon: typeof Square }[] = [
  { value: "solid", label: "Solid", icon: Square },
  { value: "gradient", label: "Gradient", icon: Square },
  { value: "dots", label: "Dots", icon: Grid3x3 },
  { value: "waves", label: "Waves", icon: Waves },
]

const LINK_ICONS: { value: string; label: string; icon: typeof Link2 }[] = [
  { value: "link", label: "Link", icon: Link2 },
  { value: "globe", label: "Globe", icon: Globe },
  { value: "external", label: "External", icon: ExternalLink },
  { value: "email", label: "Email", icon: Mail },
  { value: "github", label: "GitHub", icon: Globe2 },
  { value: "twitter", label: "Twitter", icon: Globe2 },
  { value: "youtube", label: "YouTube", icon: Globe2 },
  { value: "instagram", label: "Instagram", icon: Globe2 },
  { value: "linkedin", label: "LinkedIn", icon: Globe2 },
  { value: "music", label: "Music", icon: Globe2 },
  { value: "chat", label: "Chat", icon: Globe2 },
  { value: "globe2", label: "Website", icon: Globe2 },
]

const BORDER_RADIUS_MAP: Record<string, string> = {
  sm: "rounded-md",
  md: "rounded-lg",
  lg: "rounded-xl",
  xl: "rounded-2xl",
  full: "rounded-full",
}

// ── Defaults ──────────────────────────────────────────────────

function defaultPage(): PageData {
  return {
    profileImage: "",
    name: "Your Name",
    tagline: "Builder & Creator",
    description: "Write a short bio about yourself here. This is your personal landing page.",
    socialLinks: SOCIAL_PLATFORMS.map((p) => ({
      platform: p.value,
      url: "",
      enabled: p.value === "twitter" || p.value === "github" || p.value === "linkedin",
    })),
    customLinks: [],
    theme: {
      bgColor: "#0a0a0a",
      cardColor: "#1a1a2e",
      textColor: "#e0e0e0",
      accentColor: "#6366f1",
      fontSize: "base",
      fontFamily: "sans",
      borderRadius: "lg",
      layout: "centered",
      bgPattern: "solid",
      gradientColor: "#1a1a2e",
      shadow: false,
      showWatermark: true,
    },
  }
}

// ── SVG Brand Icons ───────────────────────────────────────────

function TwitterIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}

function GithubIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )
}

function LinkedinIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

function YoutubeIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  )
}

function InstagramIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/>
    </svg>
  )
}

function TikTokIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
    </svg>
  )
}

function BlueskyIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566 1.176 0 2.391 0 5.362c0 1.21.699 4.217 1.109 4.797.668.944 2.791 1.666 5.233 1.166-2.627.3-5.618.702-6.12 2.627-.656 2.542 1.385 3.856 3.571 4.107 1.48.17 2.875.036 4.154-.22v9.372h3.99v-9.372c1.279.256 2.674.39 4.154.22 2.186-.251 4.227-1.565 3.571-4.107-.502-1.925-3.493-2.327-6.12-2.627 2.442.5 4.565-.222 5.233-1.166.41-.58 1.109-3.587 1.109-4.797 0-2.97-2.565-4.186-5.203-2.443C16.046 4.747 13.087 8.686 12 10.8z"/>
    </svg>
  )
}

function ThreadsIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.94 11.79c-.3-1.2-1.1-2.15-2.21-2.57.45-.98.56-2.13.17-3.34-.51-1.58-1.68-2.7-3.26-3.12-1.58-.41-3.2-.14-4.53.74-1.21.8-1.99 2.02-2.33 3.45-.09.37.2.72.59.65.28-.05.54-.11.78-.18 1.58-.47 2.98-1.07 4.37-2.13.33-.25.69-.37 1.05-.33.41.05.78.26 1 .59.62.89.43 2.06-.12 2.84-.49.7-1.35 1.12-2.27 1.22-.28.03-.66.05-1.2.05-.12 1.41.76 2.39 2 2.64.27.05.52.08.74.08 2.26 0 4.06 1.49 4.18 3.56.11 1.89-1.14 3.36-2.82 3.75-1.61.37-3.08-.32-3.97-1.74-.52-.83-.69-1.7-.52-2.53.12-.63.42-1.16.86-1.57l.01-.01c-.97-.58-1.88-1.25-2.5-2.07-.93-1.23-1.28-2.73-.93-4.15.39-1.58 1.33-2.96 2.63-3.89 1.66-1.19 3.19-1.53 5.18-1.09 1.56.36 2.89 1.35 3.49 2.85.21.5.31 1.03.3 1.57-.01.4.3.72.7.72h.01c.4 0 .72-.3.74-.69.02-.61-.1-1.23-.35-1.82-.68-1.6-2.19-2.8-3.96-3.24-2.36-.59-4.42-.15-6.47 1.28-1.65 1.15-2.86 2.83-3.35 4.74-.42 1.64-.09 3.46 1.02 4.92.91 1.19 2.21 2.02 3.6 2.7-.33.5-.54 1.06-.6 1.66-.13 1.27.21 2.52.98 3.53 1.14 1.5 2.87 2.37 4.82 2.37.56 0 1.13-.08 1.7-.25 2.38-.67 4.11-2.94 3.92-5.12-.1-1.1-.59-2.11-1.39-2.9.81-.36 1.4-1.02 1.65-1.86zM13.46 16.3c-.07-.57-.4-1.05-.9-1.36-1.08-.65-2.62-.24-3.19 1.08-.34.77-.23 1.58.27 2.27.55.75 1.49 1.05 2.44.82.84-.21 1.44-.88 1.55-1.73.01-.11.02-.22 0-.33v-.01z"/>
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function loadPage(): PageData {
  if (typeof window === "undefined") return defaultPage()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultPage()
    return JSON.parse(raw) as PageData
  } catch {
    return defaultPage()
  }
}

function savePage(data: PageData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    toast.error("Failed to save")
  }
}

function loadAnalytics(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY) ?? "{}")
  } catch {
    return {}
  }
}

function saveAnalytics(clicks: Record<string, number>) {
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(clicks))
  } catch {
    /* noop */
  }
}

function socialIcon(platform: SocialPlatform): React.ComponentType<{ className?: string }> {
  const found = SOCIAL_PLATFORMS.find((p) => p.value === platform)
  return found?.icon ?? Globe
}

function linkIcon(iconName: string) {
  const found = LINK_ICONS.find((l) => l.value === iconName)
  return found?.icon ?? Link2
}

// ── Sub-components ────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string
  icon: typeof ChevronDown
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none flex flex-row items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon-xs">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </CardHeader>
      {open && <CardContent className="space-y-3">{children}</CardContent>}
    </Card>
  )
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-muted-foreground w-20 shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg border border-border/60 cursor-pointer bg-transparent p-0.5"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs h-7"
        />
      </div>
    </div>
  )
}

function RadioGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs rounded-lg border transition-all",
            value === opt.value
              ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
              : "border-border/60 text-muted-foreground hover:border-foreground/30"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Device Frame ──────────────────────────────────────────────

function DeviceFrame({ frame, children }: { frame: FrameType; children: React.ReactNode }) {
  if (frame === "minimal") {
    return (
      <div className="w-80 shrink-0 mx-auto overflow-hidden rounded-2xl border border-foreground/10 shadow-2xl bg-background">
        {children}
      </div>
    )
  }

  const isIphone = frame === "iphone"
  return (
    <div className="w-80 shrink-0 mx-auto">
      <div className={`${isIphone ? "rounded-[2.5rem]" : "rounded-[2rem]"} border-4 border-foreground/10 bg-background overflow-hidden shadow-2xl`}>
        {/* Status bar */}
        <div className={`relative ${isIphone ? "h-10" : "h-8"} flex items-center justify-center bg-foreground/5`}>
          {isIphone && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-background rounded-b-2xl flex items-center justify-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-foreground/20" />
            </div>
          )}
          {!isIphone && (
            <div className="absolute top-0 right-6 w-3 h-3 rounded-full bg-foreground/20" />
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          </div>
        </div>
        {children}
        {isIphone && (
          <div className="h-5 flex items-center justify-center bg-foreground/5">
            <div className="w-32 h-1 rounded-full bg-foreground/20" />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Phone Preview ─────────────────────────────────────────────

function PhonePreview({ page, frame, onLinkClick }: { page: PageData; frame: FrameType; onLinkClick: (id: string) => void }) {
  const t = page.theme

  const fsMap = { sm: "14px", base: "16px", lg: "18px" }
  const ffMap = { sans: "system-ui, -apple-system, sans-serif", serif: "Georgia, 'Times New Roman', serif", mono: "'Courier New', Consolas, monospace" }
  const brMap: Record<string, string> = { sm: "6px", md: "10px", lg: "14px", xl: "20px", full: "999px" }
  const cardBr = brMap[t.borderRadius] ?? "12px"

  const bgStyle: React.CSSProperties = {
    backgroundColor: t.bgPattern === "solid" ? t.bgColor : t.bgPattern === "gradient" ? t.gradientColor : t.bgColor,
    color: t.textColor,
    fontFamily: ffMap[t.fontFamily],
    fontSize: fsMap[t.fontSize],
    minHeight: "100%",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "32px 20px",
    gap: "20px",
    boxSizing: "border-box" as const,
  }

  if (t.bgPattern === "gradient") {
    bgStyle.background = `linear-gradient(135deg, ${t.bgColor}, ${t.gradientColor})`
  }

  const linkBtnStyle: React.CSSProperties = {
    backgroundColor: t.cardColor,
    color: t.textColor,
    border: `1px solid ${t.accentColor}40`,
    borderRadius: t.borderRadius === "full" ? "999px" : cardBr,
    padding: "12px 16px",
    width: "100%",
    maxWidth: "320px",
    boxSizing: "border-box" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    fontSize: fsMap[t.fontSize],
    fontWeight: 500,
    textDecoration: "none",
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: t.cardColor,
    borderRadius: cardBr,
    width: "100%",
    maxWidth: "320px",
    padding: "20px",
    boxSizing: "border-box" as const,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    ...(t.shadow ? { boxShadow: `0 8px 32px ${t.accentColor}30` } : {}),
  }

  function renderBgPattern(): React.ReactNode {
    if (t.bgPattern === "dots") {
      return (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(${t.textColor}15 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />
      )
    }
    if (t.bgPattern === "waves") {
      return (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 320'%3E%3Cpath fill='${encodeURIComponent(t.accentColor + "10")}' d='M0,192L48,176C96,160,192,128,288,138.7C384,149,480,203,576,213.3C672,224,768,192,864,165.3C960,139,1056,117,1152,122.7C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'/%3E%3C/svg%3E")`,
            backgroundSize: "cover",
            backgroundPosition: "bottom",
          }}
        />
      )
    }
    return null
  }

  return (
    <DeviceFrame frame={frame}>
      <div style={bgStyle} className="relative overflow-hidden">
        {renderBgPattern()}
        <div className="relative z-10 flex flex-col items-center gap-5 w-full" style={{ maxWidth: 320 }}>
          {page.profileImage && (
              <img
              src={page.profileImage}
              alt={page.name}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-white/10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          )}
          <div style={cardStyle}>
            <div style={{ fontWeight: 700, fontSize: `calc(${fsMap[t.fontSize]} + 4px)` }}>
              {page.name || "Your Name"}
            </div>
            {page.tagline && (
              <div style={{ opacity: 0.6, marginTop: 2 }}>{page.tagline}</div>
            )}
            {page.description && (
              <p style={{ opacity: 0.7, textAlign: "center" as const, lineHeight: 1.5, maxWidth: 280 }}>{page.description}</p>
            )}
            {page.socialLinks.filter((s) => s.enabled && s.url).length > 0 && (
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, justifyContent: "center", padding: "4px 0" }}>
                {page.socialLinks.filter((s) => s.enabled && s.url).map((s) => {
                  const Icon = socialIcon(s.platform)
                  const href = s.platform === "email" ? `mailto:${s.url}` : s.url
                  return (
                    <a key={s.platform} href={href} target="_blank" rel="noopener noreferrer" style={{ color: t.textColor, opacity: 0.8 }} title={s.platform}>
                      <Icon className="w-5 h-5" />
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {page.customLinks.filter((l) => l.enabled).map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={linkBtnStyle}
              onClick={(e) => { e.preventDefault(); onLinkClick(link.id); window.open(link.url, "_blank", "noopener") }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = `${t.accentColor}20` }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.cardColor }}
            >
              <Globe className="w-4 h-4" />
              <span>{link.title}</span>
            </a>
          ))}

          {t.showWatermark && (
            <div style={{ fontSize: 11, opacity: 0.3, marginTop: 4 }}>made with IndiePage</div>
          )}
        </div>
      </div>
    </DeviceFrame>
  )
}

// ── HTML Export ───────────────────────────────────────────────

function generateHtml(page: PageData): string {
  const t = page.theme
  const fsMap = { sm: "14px", base: "16px", lg: "18px" }
  const fs = fsMap[t.fontSize]
  const br = t.borderRadius === "full" ? "999px" : t.borderRadius === "xl" ? "16px" : t.borderRadius === "lg" ? "12px" : t.borderRadius === "md" ? "8px" : "6px"
  const linkBr = t.borderRadius === "full" ? "999px" : "10px"

  const socialIconsHtml = page.socialLinks
    .filter((s) => s.enabled && s.url)
    .map((s) => {
      const iconSvg = socialIcon(s.platform)
      return ""
    })
    .join("")

  const linksHtml = page.customLinks
    .filter((l) => l.enabled)
    .map((l) => {
      const iconName = l.title.toLowerCase().includes("github") ? "github" : "link"
      return `
      <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" style="display:flex;align-items:center;justify-content:center;gap:8px;background:${t.cardColor};color:${t.textColor};border:1px solid ${t.accentColor}40;border-radius:${linkBr};padding:12px 16px;text-decoration:none;font-weight:500;font-size:${fs};width:100%;max-width:320px;box-sizing:border-box;margin:0 auto;transition:background 0.15s;" onmouseenter="this.style.background='${t.accentColor}20'" onmouseleave="this.style.background='${t.cardColor}'">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>${escapeHtml(l.title)}</span>
      </a>`
    })
    .join("\n")

  const socialRows = page.socialLinks
    .filter((s) => s.enabled && s.url)
    .map((s) => {
      const iconSvg = s.platform === "twitter" ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>`
        : s.platform === "github" ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>`
        : s.platform === "linkedin" ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>`
        : s.platform === "youtube" ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.94 2C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/></svg>`
        : s.platform === "instagram" ? `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
      const href = s.platform === "email" ? `mailto:${escapeHtml(s.url)}` : escapeHtml(s.url)
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${t.textColor};opacity:0.8;" title="${s.platform}">${iconSvg}</a>`
    })
    .join("\n")

  const profileImg = page.profileImage
    ? `<img src="${escapeHtml(page.profileImage)}" alt="${escapeHtml(page.name)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.1);" onerror="this.style.display='none'" />`
    : ""

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(page.name)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${t.bgColor};color:${t.textColor};font-family:system-ui,-apple-system,sans-serif;font-size:${fs};min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:20px}
.card{background:${t.cardColor};border-radius:${br};width:100%;max-width:320px;padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.name{font-weight:700;font-size:calc(${fs} + 4px)}
.tagline{opacity:0.6}
.bio{opacity:0.7;line-height:1.5;max-width:280px}
.social-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;padding:4px 0}
.footer{font-size:11px;opacity:0.3;margin-top:8px}
</style>
</head>
<body>
<div class="card">
${profileImg}
<div class="name">${escapeHtml(page.name)}</div>
${page.tagline ? `<div class="tagline">${escapeHtml(page.tagline)}</div>` : ""}
${page.description ? `<p class="bio">${escapeHtml(page.description)}</p>` : ""}
${socialRows ? `<div class="social-row">${socialRows}</div>` : ""}
</div>
${linksHtml}
<div class="footer">made with IndiePage</div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  const el = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
  return text.replace(/[&<>"']/g, (c) => el[c as keyof typeof el])
}

// ── Main Component ────────────────────────────────────────────

export function IndiePageContent() {
  const [page, setPage] = useState<PageData>(defaultPage)
  const [loaded, setLoaded] = useState(false)
  const [analytics, setAnalytics] = useState<Record<string, number>>({})
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  // ── Load on mount ───────────────────────────────────────────

  useEffect(() => {
    const saved = loadPage()
    setPage(saved)
    setAnalytics(loadAnalytics())
    setLoaded(true)
  }, [])

  // ── Save on change ──────────────────────────────────────────

  useEffect(() => {
    if (loaded) savePage(page)
  }, [page, loaded])

  // ── Track link clicks ───────────────────────────────────────

  const trackClick = useCallback(
    (linkId: string) => {
      const next = { ...analytics, [linkId]: (analytics[linkId] ?? 0) + 1 }
      setAnalytics(next)
      saveAnalytics(next)
    },
    [analytics]
  )

  // ── Page update helper ──────────────────────────────────────

  function updatePage(updates: Partial<PageData>) {
    setPage((prev) => ({ ...prev, ...updates }))
  }

  // ── Link management ─────────────────────────────────────────

  function addLink() {
    const newLink: CustomLink = {
      id: uid(),
      title: `Link ${page.customLinks.length + 1}`,
      url: "https://",
      enabled: true,
      clicks: 0,
    }
    updatePage({ customLinks: [...page.customLinks, newLink] })
    toast.success("Link added")
  }

  function updateLink(id: string, updates: Partial<CustomLink>) {
    updatePage({
      customLinks: page.customLinks.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })
  }

  function deleteLink(id: string) {
    updatePage({ customLinks: page.customLinks.filter((l) => l.id !== id) })
    toast.success("Link removed")
  }

  function moveLink(id: string, dir: "up" | "down") {
    const idx = page.customLinks.findIndex((l) => l.id === id)
    if (idx < 0) return
    const next = [...page.customLinks]
    const target = dir === "up" ? idx - 1 : idx + 1
    if (target < 0 || target >= next.length) return
    const a = next[idx]!
    const b = next[target]!
    next[idx] = b
    next[target] = a
    updatePage({ customLinks: next })
  }

  // ── Social management ───────────────────────────────────────

  function updateSocial(platform: SocialPlatform, updates: Partial<SocialLink>) {
    updatePage({
      socialLinks: page.socialLinks.map((s) =>
        s.platform === platform ? { ...s, ...updates } : s
      ),
    })
  }

  function addSocial(platform: SocialPlatform) {
    const exists = page.socialLinks.find((s) => s.platform === platform)
    if (exists) {
      updateSocial(platform, { enabled: true })
      toast.success(`${platform} enabled`)
      return
    }
    updatePage({
      socialLinks: [
        ...page.socialLinks,
        { platform, url: "", enabled: true },
      ],
    })
    toast.success(`${platform} added`)
  }

  // ── Theme helpers ───────────────────────────────────────────

  function updateTheme(updates: Partial<Theme>) {
    setPage((prev) => ({ ...prev, theme: { ...prev.theme, ...updates } }))
  }

  // ── Export ──────────────────────────────────────────────────

  function downloadHtml() {
    const html = generateHtml(page)
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "indiepage.html"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Page exported")
  }

  function copyEmbed() {
    const html = generateHtml(page)
    const escaped = escapeHtml(html)
    const iframe = `<iframe src="data:text/html;charset=utf-8,${encodeURIComponent(html)}" width="100%" height="600" style="border:none;border-radius:12px;"></iframe>`
    navigator.clipboard.writeText(iframe).then(
      () => {
        setCopiedEmbed(true)
        toast.success("Embed code copied")
        setTimeout(() => setCopiedEmbed(false), 2000)
      },
      () => toast.error("Failed to copy")
    )
  }

  // ── Not loaded yet ──────────────────────────────────────────

  if (!loaded) {
    return (
      <>
        <ToolHeader title="IndiePage" icon={Globe} color="text-indigo-500" badge="Builder" />
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
        </div>
      </>
    )
  }

  // ── Frame type & preview state ──────────────────────────────

  const [frameType, setFrameType] = useState<FrameType>("iphone")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      updatePage({ profileImage: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  function openPreviewTab() {
    const html = generateHtml(page)
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
    }
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <>
      <ToolHeader
        title="IndiePage"
        icon={Globe}
        color="text-indigo-500"
        badge="Builder"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={copyEmbed}>
              {copiedEmbed ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Embed
            </Button>
            <Button size="sm" variant="outline" onClick={openPreviewTab}>
              <ExternalLink className="w-4 h-4" />
              Preview
            </Button>
            <Button size="sm" onClick={downloadHtml}>
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-8 items-start justify-center">
          {/* ── Editor ───────────────────────────────────────── */}
          <div className="w-[480px] shrink-0 space-y-4">
            {/* ── Profile Section ── */}
            <CollapsibleSection title="Profile" icon={Image}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Profile Image</label>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                    {page.profileImage && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updatePage({ profileImage: "" })}
                        className="text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {!page.profileImage && (
                    <Input
                      placeholder="https://example.com/avatar.jpg"
                      value={page.profileImage}
                      onChange={(e) => updatePage({ profileImage: e.target.value })}
                      className="h-7 text-xs mt-2"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Name</label>
                  <Input
                    placeholder="Your Name"
                    value={page.name}
                    onChange={(e) => updatePage({ name: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Tagline</label>
                  <Input
                    placeholder="Builder & Creator"
                    value={page.tagline}
                    onChange={(e) => updatePage({ tagline: e.target.value })}
                    className="h-7 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Description</label>
                  <Textarea
                    placeholder="Write a short bio..."
                    value={page.description}
                    onChange={(e) => updatePage({ description: e.target.value })}
                    className="text-xs min-h-[60px]"
                    rows={3}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* ── Links Section ── */}
            <CollapsibleSection title={`Links (${page.customLinks.length})`} icon={Link2}>
              <div className="space-y-2">
                {page.customLinks.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    No links yet. Add your first one.
                  </p>
                )}
                {page.customLinks.map((link, idx) => (
                  <Card key={link.id} size="sm">
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveLink(link.id, "up")}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => moveLink(link.id, "down")}
                            disabled={idx === page.customLinks.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="flex-1 space-y-1.5">
                          <Input
                            placeholder="Title"
                            value={link.title}
                            onChange={(e) => updateLink(link.id, { title: e.target.value })}
                            className="h-7 text-xs"
                          />
                          <Input
                            placeholder="https://..."
                            value={link.url}
                            onChange={(e) => updateLink(link.id, { url: e.target.value })}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant={link.enabled ? "default" : "outline"}
                            size="icon-xs"
                            onClick={() => updateLink(link.id, { enabled: !link.enabled })}
                            title={link.enabled ? "Enabled" : "Disabled"}
                          >
                            {link.enabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => deleteLink(link.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {(() => {
                        const count = analytics[link.id]
                        if (count === undefined || count === 0) return null
                        return (
                          <div className="text-[10px] text-muted-foreground text-right">
                            {count} click{count !== 1 ? "s" : ""}
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-1"
                  onClick={addLink}
                >
                  <Plus className="w-4 h-4" />
                  Add Link
                </Button>
              </div>
            </CollapsibleSection>

            {/* ── Social Section ── */}
            <CollapsibleSection
              title={`Social (${page.socialLinks.filter((s) => s.enabled).length} active)`}
              icon={Globe2}
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  {SOCIAL_PLATFORMS.filter(
                    (p) => !page.socialLinks.find((s) => s.platform === p.value && s.enabled)
                  ).map((platform) => (
                    <Button
                      key={platform.value}
                      variant="outline"
                      size="sm"
                      className="justify-start text-xs h-7"
                      onClick={() => addSocial(platform.value)}
                    >
                      <platform.icon className="w-3.5 h-3.5 shrink-0" />
                      {platform.label}
                    </Button>
                  ))}
                  {page.socialLinks.filter((s) => !s.enabled).length === 0 &&
                    SOCIAL_PLATFORMS.every((p) =>
                      page.socialLinks.find((s) => s.platform === p.value && s.enabled)
                    ) && (
                    <p className="text-xs text-muted-foreground col-span-2 text-center py-2">
                      All platforms active
                    </p>
                  )}
                </div>
                {page.socialLinks
                  .filter((s) => s.enabled)
                  .map((s) => {
                    const platform = SOCIAL_PLATFORMS.find((p) => p.value === s.platform)
                    const Icon = platform?.icon ?? Globe
                    return (
                      <div key={s.platform} className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="text-xs w-16 shrink-0 text-muted-foreground">
                          {platform?.label ?? s.platform}
                        </span>
                        <Input
                          placeholder={
                            s.platform === "email" ? "you@example.com" : "https://..."
                          }
                          value={s.url}
                          onChange={(e) => updateSocial(s.platform, { url: e.target.value })}
                          className="flex-1 h-7 text-xs font-mono"
                        />
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => updateSocial(s.platform, { enabled: false })}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )
                  })}
              </div>
            </CollapsibleSection>

            {/* ── Theme Section ── */}
            <CollapsibleSection title="Theme" icon={Palette}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Colors</p>
                  <ColorRow label="Background" value={page.theme.bgColor} onChange={(v) => updateTheme({ bgColor: v })} />
                  <ColorRow label="Card" value={page.theme.cardColor} onChange={(v) => updateTheme({ cardColor: v })} />
                  <ColorRow label="Text" value={page.theme.textColor} onChange={(v) => updateTheme({ textColor: v })} />
                  <ColorRow label="Accent" value={page.theme.accentColor} onChange={(v) => updateTheme({ accentColor: v })} />
                  {page.theme.bgPattern === "gradient" && (
                    <ColorRow label="Gradient" value={page.theme.gradientColor} onChange={(v) => updateTheme({ gradientColor: v })} />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Font</p>
                  <div className="flex gap-1.5">
                    {FONT_FAMILIES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTheme({ fontFamily: opt.value })}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg border transition-all flex-1",
                          page.theme.fontFamily === opt.value
                            ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
                            : "border-border/60 text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Font Size</p>
                  <div className="flex gap-1.5">
                    {FONT_SIZES.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTheme({ fontSize: opt.value })}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg border transition-all flex-1",
                          page.theme.fontSize === opt.value
                            ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
                            : "border-border/60 text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Border Radius</p>
                  <div className="flex gap-1.5">
                    {BORDER_RADII.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTheme({ borderRadius: opt.value })}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg border transition-all flex flex-col items-center gap-1 flex-1",
                          page.theme.borderRadius === opt.value
                            ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
                            : "border-border/60 text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        <div
                          className="w-6 h-4 border border-current/40"
                          style={{
                            borderRadius:
                              opt.value === "full" ? "999px" :
                              opt.value === "xl" ? "8px" :
                              opt.value === "lg" ? "6px" :
                              opt.value === "md" ? "4px" : "2px",
                          }}
                        />
                        <span className="text-[10px]">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Background</p>
                  <div className="flex gap-1.5">
                    {BG_PATTERNS.map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => updateTheme({ bgPattern: opt.value })}
                          className={cn(
                            "px-3 py-1.5 text-xs rounded-lg border transition-all flex flex-col items-center gap-1 flex-1",
                            page.theme.bgPattern === opt.value
                              ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
                              : "border-border/60 text-muted-foreground hover:border-foreground/30"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          <span className="text-[10px]">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Layout</p>
                  <div className="flex gap-1.5">
                    {LAYOUTS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateTheme({ layout: opt.value })}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-lg border transition-all flex-1",
                          page.theme.layout === opt.value
                            ? "border-accentColor bg-accentColor/10 text-accentColor font-medium"
                            : "border-border/60 text-muted-foreground hover:border-foreground/30"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={page.theme.shadow}
                      onChange={(e) => updateTheme({ shadow: e.target.checked })}
                      className="accent-blue-500 h-4 w-4 rounded border-border cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">Card Shadow</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={page.theme.showWatermark}
                      onChange={(e) => updateTheme({ showWatermark: e.target.checked })}
                      className="accent-blue-500 h-4 w-4 rounded border-border cursor-pointer"
                    />
                    <span className="text-xs text-muted-foreground">Watermark</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setPage(defaultPage())}
                  >
                    Reset All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateTheme(defaultPage().theme)}
                  >
                    Reset Theme
                  </Button>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* ── Preview ─────────────────────────────────────── */}
          <div className="sticky top-24 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-foreground/5 rounded-lg p-0.5">
                {FRAMES.map((f) => {
                  const Icon = f.icon
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFrameType(f.value)}
                      className={cn(
                        "px-2 py-1 text-[10px] rounded-md transition-all flex items-center gap-1",
                        frameType === f.value
                          ? "bg-background text-foreground font-medium shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <PhonePreview page={page} frame={frameType} onLinkClick={trackClick} />
          </div>
        </div>
      </div>
    </>
  )
}
