"use client"

import { useState, useEffect, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Image, Search, Sparkles, Copy, Check, Loader2, Download,
  X, Globe, AlertCircle, RefreshCw, Code, Palette, List,
  Clock, ExternalLink, ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  type OGData, type Platform, type OGDesign, type CanvasSizeId,
  PLATFORMS, OG_TEMPLATES, CANVAS_SIZES, computeOGScore, validateOGData,
  type BulkGenerateItem,
} from "./types"

const STORAGE_KEY = "og-craft-v1"

type TabId = "checker" | "designer" | "generator" | "batch" | "bulk"

interface HistoryItem {
  url: string
  ogData: OGData
  checkedAt: string
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveHistory(h: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 20)))
}

const TABS: { id: TabId; label: string; icon?: React.ReactNode }[] = [
  { id: "checker", label: "URL Checker" },
  { id: "designer", label: "OG Designer" },
  { id: "generator", label: "Meta Generator" },
  { id: "batch", label: "Batch Check" },
  { id: "bulk", label: "Bulk Generate" },
]

export function OGCraftContent() {
  const [tab, setTab] = useState<TabId>("checker")
  const [urlInput, setUrlInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [ogData, setOgData] = useState<OGData | null>(null)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copiedKey, setCopiedKey] = useState("")
  const [showValidate, setShowValidate] = useState(false)

  // Designer state
  const [design, setDesign] = useState<OGDesign>({
    templateId: "gradient",
    headline: "Your Awesome Product",
    subheadline: "The tagline that makes people click",
    logoText: "YP",
    customColor: "#6366f1",
    fontSize: "md",
    canvasSize: { width: 1200, height: 628 },
  })
  const [selectedSizeId, setSelectedSizeId] = useState<CanvasSizeId>("og")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Meta generator state
  const [genTitle, setGenTitle] = useState("")
  const [genDesc, setGenDesc] = useState("")
  const [genImage, setGenImage] = useState("")
  const [genUrl, setGenUrl] = useState("")

  // AI copy state
  const [showAiCopy, setShowAiCopy] = useState(false)
  const [aiDesc, setAiDesc] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ ogTitle: string; ogDescription: string; twitterTitle: string; twitterDescription: string } | null>(null)

  // Batch state
  const [batchInput, setBatchInput] = useState("")
  const [batchResults, setBatchResults] = useState<Array<{ url: string; status: "pending" | "ok" | "error"; ogData?: OGData; error?: string }>>([])
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)

  // Bulk generate state
  const [bulkPaths, setBulkPaths] = useState("")
  const [bulkBaseUrl, setBulkBaseUrl] = useState("")
  const [bulkResults, setBulkResults] = useState<BulkGenerateItem[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)

  useEffect(() => { setHistory(loadHistory()) }, [])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function fetchOG(url: string) {
    if (!url.trim()) { toast.error("Enter a URL"); return }
    setLoading(true)
    setError("")
    setOgData(null)
    setShowValidate(false)
    try {
      const res = await fetch("/api/og-craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetch-og", url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Fetch failed")
      setOgData(data.ogData)
      const item: HistoryItem = { url: data.ogData.url, ogData: data.ogData, checkedAt: new Date().toISOString() }
      setHistory((prev) => {
        const next = [item, ...prev.filter((h) => h.url !== data.ogData.url)]
        saveHistory(next)
        return next
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed"
      setError(msg)
      toast.error(msg)
    }
    setLoading(false)
  }

  async function handleAiCopy() {
    if (!aiDesc.trim()) { toast.error("Enter a description"); return }
    setAiLoading(true)
    try {
      const res = await fetch("/api/og-craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-copy", description: aiDesc }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "AI failed")
      setAiResult(data.data)
      toast.success("OG copy generated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "AI failed")
    }
    setAiLoading(false)
  }

  async function handleBatchCheck() {
    const urls = batchInput.split("\n").map((u) => u.trim()).filter(Boolean)
    if (urls.length === 0) { toast.error("Enter at least one URL"); return }
    if (urls.length > 10) { toast.error("Max 10 URLs at once"); return }
    setBatchLoading(true)
    setBatchProgress(0)
    setBatchResults(urls.map((url) => ({ url, status: "pending" })))
    for (let i = 0; i < urls.length; i++) {
      setBatchProgress(i + 1)
      const url = urls[i]!
      try {
        const res = await fetch("/api/og-craft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fetch-og", url }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setBatchResults((prev) => prev.map((r, j) => j === i ? { ...r, status: "ok", ogData: data.ogData } : r))
      } catch (err: unknown) {
        setBatchResults((prev) => prev.map((r, j) => j === i ? { ...r, status: "error", error: err instanceof Error ? err.message : "Failed" } : r))
      }
    }
    setBatchProgress(0)
    setBatchLoading(false)
    toast.success("Batch check complete")
  }

  async function handleBulkGenerate() {
    const paths = bulkPaths.split("\n").map((p) => p.trim()).filter(Boolean)
    if (paths.length === 0) { toast.error("Enter at least one path"); return }
    if (paths.length > 20) { toast.error("Max 20 paths"); return }
    if (!bulkBaseUrl.trim()) { toast.error("Enter a base URL"); return }
    setBulkLoading(true)
    setBulkResults([])
    try {
      const res = await fetch("/api/og-craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk-generate", paths, baseUrl: bulkBaseUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Bulk generation failed")
      setBulkResults(data.items)
      toast.success(`Generated ${data.items.length} OG entries`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bulk generation failed")
    }
    setBulkLoading(false)
  }

  function downloadFavicon(faviconUrl: string) {
    fetch(faviconUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const ext = faviconUrl.split(".").pop()?.split("?")[0] ?? "ico"
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `favicon.${ext}`
        a.click()
        URL.revokeObjectURL(url)
        toast.success("Favicon downloaded")
      })
      .catch(() => toast.error("Could not download favicon"))
  }

  function downloadOGImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = `og-image-${design.canvasSize.width}x${design.canvasSize.height}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
    toast.success("OG image downloaded")
  }

  function copyBulkAsJSON() {
    const json = JSON.stringify(
      bulkResults.map((r) => ({ url: `${bulkBaseUrl}${r.path}`, title: r.title, description: r.description })),
      null,
      2,
    )
    copyText(json, "bulk-json")
  }

  // Draw canvas whenever design changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = design.canvasSize.width
    const H = design.canvasSize.height
    canvas.width = W
    canvas.height = H

    const { templateId } = design
    const color = design.customColor

    // ── GRADIENT template ──
    if (templateId === "gradient") {
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, "#6366f1")
      grad.addColorStop(1, "#ec4899")
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)
      drawLogoCircle(ctx, color, design.logoText, 80, 80, 36)
      drawHeadline(ctx, design, "#ffffff", "rgba(255,255,255,0.75)", W, H, 60, H * 0.45)
      ctx.fillStyle = color; ctx.fillRect(0, H - 14, W, 14)
    }
    // ── DARK template ──
    else if (templateId === "dark") {
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, "#0f172a"); grad.addColorStop(1, "#1e293b")
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      drawLogoCircle(ctx, color, design.logoText, 80, 80, 36)
      drawHeadline(ctx, design, "#ffffff", "rgba(255,255,255,0.7)", W, H, 60, H * 0.45)
      ctx.fillStyle = color; ctx.fillRect(0, H - 14, W, 14)
    }
    // ── LIGHT template ──
    else if (templateId === "light") {
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, "#f8fafc"); grad.addColorStop(1, "#e2e8f0")
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      drawLogoCircle(ctx, color, design.logoText, 80, 80, 36)
      drawHeadline(ctx, design, "#0f172a", "#64748b", W, H, 60, H * 0.45)
      ctx.fillStyle = color; ctx.fillRect(0, H - 14, W, 14)
    }
    // ── CODE template ──
    else if (templateId === "code") {
      const grad = ctx.createLinearGradient(0, 0, W, H)
      grad.addColorStop(0, "#0a0a0a"); grad.addColorStop(1, "#1a1a2e")
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
      // Code-like grid dots
      ctx.fillStyle = "rgba(99,102,241,0.08)"
      for (let x = 0; x < W; x += 40) for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill()
      }
      drawLogoCircle(ctx, color, design.logoText, 80, 80, 36)
      drawHeadline(ctx, design, "#e2e8f0", "rgba(99,235,99,0.8)", W, H, 60, H * 0.45)
      ctx.fillStyle = color; ctx.fillRect(0, H - 14, W, 14)
    }
    // ── MINIMAL template ──
    else if (templateId === "minimal") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = "#f1f5f9"; ctx.fillRect(W - 300, 0, 300, H)
      drawLogoCircle(ctx, color, design.logoText, 80, 80, 36)
      drawHeadline(ctx, design, "#0f172a", "#64748b", W, H, 60, H * 0.45)
      ctx.fillStyle = color; ctx.fillRect(0, H - 8, W, 8)
    }
    // ── BRAND template ──
    else if (templateId === "brand") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H)
      // Bold colored left stripe
      const stripeW = Math.round(W * 0.12)
      ctx.fillStyle = color; ctx.fillRect(0, 0, stripeW, H)
      // Logo text large on left stripe
      ctx.save()
      ctx.fillStyle = "#ffffff"
      ctx.font = `bold ${Math.round(H * 0.2)}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.translate(stripeW / 2, H / 2)
      ctx.rotate(-Math.PI / 2)
      ctx.fillText(design.logoText.slice(0, 2).toUpperCase(), 0, 0)
      ctx.restore()
      // Headline on right
      const pad = stripeW + 60
      const fontSizes = { sm: Math.round(H * 0.1), md: Math.round(H * 0.13), lg: Math.round(H * 0.16), xl: Math.round(H * 0.2) }
      ctx.fillStyle = "#0f172a"
      ctx.font = `bold ${fontSizes[design.fontSize]}px sans-serif`
      ctx.textAlign = "left"
      ctx.textBaseline = "alphabetic"
      wrapText(ctx, design.headline, pad, H * 0.42, W - pad - 60, fontSizes[design.fontSize] * 1.2)
      ctx.fillStyle = "#64748b"
      ctx.font = `${Math.round(H * 0.05)}px sans-serif`
      ctx.fillText(design.subheadline.slice(0, 80), pad, H * 0.42 + fontSizes[design.fontSize] * 1.4)
    }
    // ── ANNOUNCEMENT template ──
    else if (templateId === "announcement") {
      // Dark bg with radial glow
      const radial = ctx.createRadialGradient(W * 0.3, H * 0.5, 0, W * 0.3, H * 0.5, W * 0.7)
      radial.addColorStop(0, "#1e0a3c")
      radial.addColorStop(1, "#050208")
      ctx.fillStyle = radial; ctx.fillRect(0, 0, W, H)
      // Glow accent blob
      const glow = ctx.createRadialGradient(W * 0.3, H * 0.5, 0, W * 0.3, H * 0.5, H * 0.6)
      glow.addColorStop(0, color + "55")
      glow.addColorStop(1, "transparent")
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
      // "ANNOUNCING" label at top
      ctx.fillStyle = color
      ctx.font = `bold ${Math.round(H * 0.06)}px sans-serif`
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
      ctx.fillText("ANNOUNCING", 60, H * 0.22)
      // Underline accent
      ctx.fillStyle = color; ctx.fillRect(60, H * 0.24, 200, 3)
      drawHeadline(ctx, design, "#ffffff", "rgba(255,255,255,0.65)", W, H, 60, H * 0.52)
    }
    // ── BLOG template ──
    else if (templateId === "blog") {
      ctx.fillStyle = "#fafafa"; ctx.fillRect(0, 0, W, H)
      // Subtle top accent bar
      ctx.fillStyle = color; ctx.fillRect(0, 0, W, Math.round(H * 0.012))
      const pad = 80
      // Category / byline label
      ctx.fillStyle = color
      ctx.font = `600 ${Math.round(H * 0.05)}px sans-serif`
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
      ctx.fillText(design.logoText.slice(0, 20), pad, H * 0.3)
      // Headline — serif-like (we'll use bold sans)
      const fontSizes = { sm: Math.round(H * 0.1), md: Math.round(H * 0.12), lg: Math.round(H * 0.15), xl: Math.round(H * 0.18) }
      ctx.fillStyle = "#111827"
      ctx.font = `bold ${fontSizes[design.fontSize]}px Georgia, serif`
      ctx.textBaseline = "alphabetic"
      wrapText(ctx, design.headline, pad, H * 0.5, W - pad * 2, fontSizes[design.fontSize] * 1.25)
      // Byline / date
      ctx.fillStyle = "#9ca3af"
      ctx.font = `${Math.round(H * 0.045)}px sans-serif`
      ctx.fillText(design.subheadline.slice(0, 80), pad, H * 0.78)
    }
  }, [design])

  const metaTagBlock = `<!-- Primary Meta Tags -->
<title>${genTitle}</title>
<meta name="title" content="${genTitle}" />
<meta name="description" content="${genDesc}" />

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${genUrl}" />
<meta property="og:title" content="${genTitle}" />
<meta property="og:description" content="${genDesc}" />
${genImage ? `<meta property="og:image" content="${genImage}" />` : ""}

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image" />
<meta property="twitter:url" content="${genUrl}" />
<meta property="twitter:title" content="${genTitle}" />
<meta property="twitter:description" content="${genDesc}" />
${genImage ? `<meta property="twitter:image" content="${genImage}" />` : ""}`

  const nextjsMetaBlock = `import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "${genTitle}",
  description: "${genDesc}",
  openGraph: {
    type: "website",
    url: "${genUrl}",
    title: "${genTitle}",
    description: "${genDesc}",${genImage ? `\n    images: ["${genImage}"],` : ""}
  },
  twitter: {
    card: "summary_large_image",
    title: "${genTitle}",
    description: "${genDesc}",${genImage ? `\n    images: ["${genImage}"],` : ""}
  },
}`

  const ogScore = ogData ? computeOGScore(ogData) : null
  const validationItems = ogData ? validateOGData(ogData) : []

  function scoreColor(score: number) {
    if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
    if (score >= 50) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
    return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="OG Craft" icon={Image} color="text-violet-500" badge="SEO" />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">OG Craft</h1>
          <p className="text-muted-foreground">Preview, design, and generate Open Graph meta tags.</p>
        </div>

        {/* Pill tabs */}
        <div className="flex gap-1.5 mb-6 p-1 bg-muted/60 rounded-xl w-fit flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${tab === t.id ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/10" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── URL CHECKER ─────────────────────────────────────────────────── */}
        {tab === "checker" && (
          <div className="space-y-6">
            {/* Prominent search box */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="https://example.com — paste any URL to inspect its OG tags"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchOG(urlInput)}
                  className="pl-10 h-11 text-base rounded-xl"
                />
              </div>
              <Button onClick={() => fetchOG(urlInput)} disabled={loading} className="h-11 px-5 rounded-xl">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
              <Button variant="outline" onClick={() => setShowAiCopy(!showAiCopy)} className="h-11 rounded-xl">
                <Sparkles className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">AI Copy</span>
              </Button>
            </div>

            {/* AI copy generator */}
            {showAiCopy && (
              <Card className="border-violet-200 dark:border-violet-800">
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm font-medium text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> AI OG Copy Generator
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Describe your product or page..."
                      value={aiDesc}
                      onChange={(e) => setAiDesc(e.target.value)}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleAiCopy} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                  {aiResult && (
                    <div className="grid sm:grid-cols-2 gap-3 pt-1">
                      {[
                        { label: "og:title", value: aiResult.ogTitle, key: "ogt" },
                        { label: "og:description", value: aiResult.ogDescription, key: "ogd" },
                        { label: "twitter:title", value: aiResult.twitterTitle, key: "twt" },
                        { label: "twitter:description", value: aiResult.twitterDescription, key: "twd" },
                      ].map((item) => (
                        <div key={item.key} className="group relative">
                          <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                          <div className="flex items-start gap-2 bg-muted/50 rounded p-2">
                            <p className="text-sm flex-1">{item.value}</p>
                            <button onClick={() => copyText(item.value, item.key)} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {copiedKey === item.key ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              </div>
            )}

            {ogData && !loading && (
              <div className="space-y-6">
                {/* Score + favicon bar */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
                  {ogData.favicon && (
                    <div className="flex items-center gap-3 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ogData.favicon}
                        alt="favicon"
                        className="w-8 h-8 rounded-md object-contain border bg-white"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadFavicon(ogData.favicon)}
                      >
                        <Download className="w-3 h-3 mr-1" /> Favicon
                      </Button>
                    </div>
                  )}
                  {ogScore && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-muted-foreground">OG Score</span>
                      <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${scoreColor(ogScore.score)}`}>
                        {ogScore.score}/100
                      </span>
                    </div>
                  )}
                  <a
                    href={ogData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {(() => { try { return new URL(ogData.url).hostname } catch { return ogData.url } })()}
                  </a>
                </div>

                {/* Meta tags extracted */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Extracted Meta Tags</span>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => {
                          const tags = Object.entries(ogData).map(([k, v]) => `${k}: ${v}`).join("\n")
                          copyText(tags, "all-tags")
                        }}
                      >
                        {copiedKey === "all-tags" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        Copy all
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {[
                        { label: "og:title", value: ogData.title },
                        { label: "og:description", value: ogData.description },
                        { label: "og:image", value: ogData.image },
                        { label: "og:site_name", value: ogData.siteName },
                        { label: "og:type", value: ogData.ogType },
                        { label: "og:url", value: ogData.ogUrl },
                        { label: "twitter:card", value: ogData.twitterCard },
                        { label: "twitter:title", value: ogData.twitterTitle },
                        { label: "twitter:description", value: ogData.twitterDescription },
                        { label: "twitter:image", value: ogData.twitterImage },
                      ].map((tag) => (
                        <div key={tag.label} className="group flex items-start gap-2 p-2 rounded border bg-muted/30">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-mono text-muted-foreground">{tag.label}</p>
                            <p className="text-xs truncate">{tag.value || <span className="italic text-muted-foreground">not set</span>}</p>
                          </div>
                          {tag.value && (
                            <button onClick={() => copyText(tag.value, tag.label)} className="opacity-0 group-hover:opacity-100 shrink-0">
                              {copiedKey === tag.label ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Validate section */}
                <Card>
                  <button className="w-full text-left" onClick={() => setShowValidate(!showValidate)}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-violet-500" /> Meta Tag Validator
                          {ogScore && (
                            <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(ogScore.score)}`}>
                              {ogScore.score}/100
                            </span>
                          )}
                        </span>
                        {showValidate ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </CardTitle>
                    </CardHeader>
                  </button>
                  {showValidate && (
                    <CardContent className="pt-0 space-y-2">
                      {validationItems.map((item) => (
                        <div key={item.label} className="flex items-start gap-3 text-sm">
                          <span className={`mt-0.5 shrink-0 text-base ${item.pass ? "text-green-500" : "text-red-500"}`}>
                            {item.pass ? "✅" : "❌"}
                          </span>
                          <div>
                            <p className={item.pass ? "" : "text-muted-foreground"}>{item.label}</p>
                            <p className="text-xs text-muted-foreground">{item.hint}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>

                {/* Platform previews — 2×3 grid */}
                <div>
                  <p className="text-sm font-medium mb-3">Platform Previews</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {(Object.entries(PLATFORMS) as [Platform, typeof PLATFORMS[Platform]][]).map(([platform, meta]) => (
                      <PlatformPreview key={platform} platform={platform} meta={meta} ogData={ogData} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Checks Timeline — last 5 as mini cards */}
            {history.length > 0 && !loading && (
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Recent Checks
                </p>
                <div className="space-y-2">
                  {history.slice(0, 5).map((h) => {
                    const score = computeOGScore(h.ogData)
                    return (
                      <button
                        key={h.url}
                        onClick={() => { setUrlInput(h.url); setOgData(h.ogData) }}
                        className="w-full text-left flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors group"
                      >
                        {h.ogData.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={h.ogData.image}
                            alt=""
                            className="w-16 h-9 object-cover rounded-md border shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                          />
                        ) : (
                          <div className="w-16 h-9 rounded-md bg-muted shrink-0 flex items-center justify-center">
                            <Image className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{h.ogData.title || (() => { try { return new URL(h.url).hostname } catch { return h.url } })()}</p>
                          <p className="text-xs text-muted-foreground truncate">{(() => { try { return new URL(h.url).hostname } catch { return h.url } })()}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(score.score)}`}>
                          {score.score}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OG DESIGNER ─────────────────────────────────────────────────── */}
        {tab === "designer" && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Design Controls</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {/* Size preset */}
                    <div>
                      <label className="text-xs font-medium mb-2 block">Canvas Size</label>
                      <select
                        value={selectedSizeId}
                        onChange={(e) => {
                          const id = e.target.value as CanvasSizeId
                          setSelectedSizeId(id)
                          const preset = CANVAS_SIZES.find((s) => s.id === id)
                          if (preset) setDesign((d) => ({ ...d, canvasSize: { width: preset.width, height: preset.height } }))
                        }}
                        className="w-full h-8 text-xs rounded-md border border-input bg-background px-2"
                      >
                        {CANVAS_SIZES.map((s) => (
                          <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Templates */}
                    <div>
                      <label className="text-xs font-medium mb-2 block">Template</label>
                      <div className="grid grid-cols-4 gap-2">
                        {OG_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setDesign((d) => ({ ...d, templateId: t.id }))}
                            className={`aspect-video rounded-md border-2 transition-all relative ${design.templateId === t.id ? "border-violet-500 ring-2 ring-violet-500/30" : "border-transparent hover:border-muted-foreground/30"}`}
                            style={{ background: t.preview }}
                            title={t.label}
                          >
                            <span className="absolute bottom-0.5 inset-x-0 text-[8px] text-center text-white/80 drop-shadow">{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium mb-1 block">Headline</label>
                      <Input value={design.headline} onChange={(e) => setDesign((d) => ({ ...d, headline: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Subheadline / Byline</label>
                      <Input value={design.subheadline} onChange={(e) => setDesign((d) => ({ ...d, subheadline: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Logo / Brand text</label>
                        <Input value={design.logoText} onChange={(e) => setDesign((d) => ({ ...d, logoText: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Accent color</label>
                        <input type="color" value={design.customColor} onChange={(e) => setDesign((d) => ({ ...d, customColor: e.target.value }))} className="w-full h-8 rounded-md border border-input cursor-pointer" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-2 block">Font size</label>
                      <div className="flex gap-1.5">
                        {(["sm", "md", "lg", "xl"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setDesign((d) => ({ ...d, fontSize: s }))}
                            className={`px-3 py-1 rounded-lg text-sm border transition-colors flex-1 ${design.fontSize === s ? "bg-violet-500 text-white border-violet-500" : "border-border hover:bg-muted"}`}
                          >
                            {s.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Button onClick={downloadOGImage} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG ({design.canvasSize.width}×{design.canvasSize.height})
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Preview ({design.canvasSize.width}×{design.canvasSize.height})
                </p>
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-xl border shadow-md"
                  style={{ aspectRatio: `${design.canvasSize.width}/${design.canvasSize.height}` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── META GENERATOR ────────────────────────────────────────────────── */}
        {tab === "generator" && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Page Details</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Title <span className="text-muted-foreground">({genTitle.length}/60)</span></label>
                    <Input placeholder="My Awesome Product" value={genTitle} onChange={(e) => setGenTitle(e.target.value)} maxLength={100} />
                    {genTitle.length > 60 && <p className="text-xs text-amber-500 mt-1">Over 60 chars — may be truncated in search results</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Description <span className="text-muted-foreground">({genDesc.length}/160)</span></label>
                    <Textarea placeholder="A brief, compelling description..." value={genDesc} onChange={(e) => setGenDesc(e.target.value)} rows={3} maxLength={300} />
                    {genDesc.length > 160 && <p className="text-xs text-amber-500 mt-1">Over 160 chars — may be truncated</p>}
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">OG Image URL</label>
                    <Input placeholder="https://yourdomain.com/og.png" value={genImage} onChange={(e) => setGenImage(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Page URL</label>
                    <Input placeholder="https://yourdomain.com/page" value={genUrl} onChange={(e) => setGenUrl(e.target.value)} />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2"><Code className="w-4 h-4" /> Generated Tags</p>
                  <Button variant="outline" size="sm" onClick={() => copyText(metaTagBlock, "meta-block")}>
                    {copiedKey === "meta-block" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy all
                  </Button>
                </div>
                <pre className="text-xs bg-muted/50 p-4 rounded-xl border overflow-auto max-h-96 font-mono whitespace-pre-wrap">
                  {metaTagBlock}
                </pre>

                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm font-medium flex items-center gap-2"><Code className="w-4 h-4" /> Next.js <code className="text-xs bg-muted px-1 rounded">metadata</code> export</p>
                  <Button variant="outline" size="sm" onClick={() => copyText(nextjsMetaBlock, "nextjs-block")}>
                    {copiedKey === "nextjs-block" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy
                  </Button>
                </div>
                <pre className="text-xs bg-muted/50 p-4 rounded-xl border overflow-auto max-h-64 font-mono whitespace-pre-wrap">
                  {nextjsMetaBlock}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ── BATCH CHECK ───────────────────────────────────────────────────── */}
        {tab === "batch" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Batch URL Checker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder={"https://example.com\nhttps://myproduct.io\nhttps://startup.dev"}
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  rows={6}
                />
                <Button onClick={handleBatchCheck} disabled={batchLoading}>
                  {batchLoading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Checking {batchProgress}/{batchInput.split("\n").filter((u) => u.trim()).length}...</>
                    : <><Search className="w-3.5 h-3.5 mr-1" /> Check All</>}
                </Button>
              </CardContent>
            </Card>

            {batchResults.length > 0 && (
              <div className="space-y-3">
                {batchResults.map((r, i) => {
                  const score = r.status === "ok" && r.ogData ? computeOGScore(r.ogData) : null
                  return (
                    <Card key={i} className={r.status === "error" ? "border-red-200" : ""}>
                      <CardContent className="py-3">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {r.status === "pending" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                            {r.status === "ok" && (r.ogData?.image ? <Check className="w-4 h-4 text-green-500" /> : <AlertCircle className="w-4 h-4 text-amber-500" />)}
                            {r.status === "error" && <X className="w-4 h-4 text-red-500" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.url}</p>
                            {r.status === "ok" && r.ogData && (
                              <div className="mt-1 space-y-0.5">
                                <p className="text-xs text-muted-foreground">Title: {r.ogData.title || <span className="italic text-amber-600">missing</span>}</p>
                                <p className="text-xs text-muted-foreground">Image: {r.ogData.image ? <span className="text-green-600">✓ found</span> : <span className="italic text-red-500">missing</span>}</p>
                                <p className="text-xs text-muted-foreground">Description: {r.ogData.description || <span className="italic text-amber-600">missing</span>}</p>
                              </div>
                            )}
                            {r.status === "error" && <p className="text-xs text-red-500">{r.error}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {score && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(score.score)}`}>
                                {score.score}
                              </span>
                            )}
                            {r.status === "ok" && r.ogData && (
                              <Button variant="ghost" size="sm" onClick={() => { setUrlInput(r.url); setOgData(r.ogData!); setTab("checker") }}>
                                <RefreshCw className="w-3.5 h-3.5 mr-1" /> View
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── BULK GENERATE ─────────────────────────────────────────────────── */}
        {tab === "bulk" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">Bulk OG Generator</h2>
              <p className="text-sm text-muted-foreground">Paste page paths and a base URL — AI generates OG title and description for each.</p>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Base URL</label>
                  <Input
                    placeholder="https://yoursite.com"
                    value={bulkBaseUrl}
                    onChange={(e) => setBulkBaseUrl(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Page paths (one per line, max 20)</label>
                  <Textarea
                    placeholder={"/blog/how-we-grew-to-10k-users\n/products/widget\n/about\n/pricing"}
                    value={bulkPaths}
                    onChange={(e) => setBulkPaths(e.target.value)}
                    rows={8}
                    className="font-mono text-xs"
                  />
                </div>
                <Button onClick={handleBulkGenerate} disabled={bulkLoading}>
                  {bulkLoading
                    ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Generating...</>
                    : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Generate OG Copy</>}
                </Button>
              </CardContent>
            </Card>

            {bulkResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <List className="w-4 h-4" /> Results ({bulkResults.length} pages)
                  </p>
                  <Button variant="outline" size="sm" onClick={copyBulkAsJSON}>
                    {copiedKey === "bulk-json" ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Copy all as JSON
                  </Button>
                </div>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[25%]">Path</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 w-[30%]">OG Title</th>
                        <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">OG Description</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResults.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/20 group">
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground truncate max-w-0 w-[25%]">{row.path}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-start gap-2">
                              <span className="truncate">{row.title}</span>
                              <button
                                onClick={() => copyText(row.title, `bulk-title-${i}`)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {copiedKey === `bulk-title-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            <div className="flex items-start gap-2">
                              <span className="line-clamp-2">{row.description}</span>
                              <button
                                onClick={() => copyText(row.description, `bulk-desc-${i}`)}
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                {copiedKey === `bulk-desc-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-2">
                            <button
                              onClick={() => copyText(JSON.stringify({ url: `${bulkBaseUrl}${row.path}`, title: row.title, description: row.description }), `bulk-row-${i}`)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {copiedKey === `bulk-row-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Canvas helpers ─────────────────────────────────────────────────────────────

function drawLogoCircle(
  ctx: CanvasRenderingContext2D,
  color: string,
  logoText: string,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#ffffff"
  ctx.font = `bold ${Math.round(r * 0.7)}px sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText(logoText.slice(0, 2).toUpperCase(), cx, cy)
}

function drawHeadline(
  ctx: CanvasRenderingContext2D,
  design: OGDesign,
  textColor: string,
  subtextColor: string,
  W: number,
  H: number,
  paddingLeft: number,
  baseY: number,
) {
  const fontSizes: Record<string, number> = {
    sm: Math.round(H * 0.077),
    md: Math.round(H * 0.1),
    lg: Math.round(H * 0.128),
    xl: Math.round(H * 0.153),
  }
  const fs = fontSizes[design.fontSize] ?? fontSizes["md"]!
  ctx.fillStyle = textColor
  ctx.font = `bold ${fs}px sans-serif`
  ctx.textAlign = "left"
  ctx.textBaseline = "alphabetic"
  const lh = fs * 1.2
  const y = wrapText(ctx, design.headline, paddingLeft, baseY, W - paddingLeft * 2, lh)
  ctx.fillStyle = subtextColor
  ctx.font = `${Math.round(H * 0.05)}px sans-serif`
  ctx.fillText(design.subheadline.slice(0, 80), paddingLeft, y + fs * 0.8)
}

/** Wraps text and returns the y position after the last line */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ")
  let line = ""
  let curY = y
  for (const word of words) {
    const testLine = line + word + " "
    const { width } = ctx.measureText(testLine)
    if (width > maxWidth && line) {
      ctx.fillText(line.trim(), x, curY)
      line = word + " "
      curY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, curY)
  return curY
}

function PlatformPreview({ platform, meta, ogData }: { platform: Platform; meta: typeof PLATFORMS[Platform]; ogData: OGData }) {
  const title = (platform === "twitter" ? ogData.twitterTitle || ogData.title : ogData.title) || "No title"
  const desc = (platform === "twitter" ? ogData.twitterDescription || ogData.description : ogData.description) || "No description"
  const image = (platform === "twitter" ? ogData.twitterImage || ogData.image : ogData.image)
  const domain = (() => { try { return new URL(ogData.url).hostname } catch { return ogData.url } })()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-xs ${meta.color}`}>{meta.label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={`rounded-lg overflow-hidden border ${meta.bg}`}>
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt="OG preview"
              className={`w-full object-cover ${meta.imageAspect}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          )}
          {!image && (
            <div className={`w-full ${meta.imageAspect} bg-muted/50 flex items-center justify-center`}>
              <p className="text-xs text-muted-foreground italic">No image</p>
            </div>
          )}
          <div className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">{domain}</p>
            <p className="text-sm font-semibold line-clamp-1 mt-0.5">
              {title.slice(0, meta.maxTitleLen)}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {desc.slice(0, meta.maxDescLen)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
