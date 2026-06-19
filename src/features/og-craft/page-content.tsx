"use client"

import { useState, useEffect, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Image, Search, Sparkles, Copy, Check, Loader2, Download,
  X, Globe, AlertCircle, RefreshCw, Code, Palette,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  type OGData, type Platform, type OGDesign, type TemplateId,
  PLATFORMS, OG_TEMPLATES,
} from "./types"

const STORAGE_KEY = "og-craft-v1"

type TabId = "checker" | "designer" | "generator" | "batch"

interface HistoryItem { url: string; ogData: OGData; checkedAt: string }

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveHistory(h: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(0, 20)))
}

const FONT_SIZES = { sm: "text-2xl", md: "text-3xl", lg: "text-4xl", xl: "text-5xl" }

export function OGCraftContent() {
  const [tab, setTab] = useState<TabId>("checker")
  const [urlInput, setUrlInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [ogData, setOgData] = useState<OGData | null>(null)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copiedKey, setCopiedKey] = useState("")

  // Designer state
  const [design, setDesign] = useState<OGDesign>({
    templateId: "gradient",
    headline: "Your Awesome Product",
    subheadline: "The tagline that makes people click",
    logoText: "YP",
    customColor: "#6366f1",
    fontSize: "md",
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Meta generator state
  const [genTitle, setGenTitle] = useState("")
  const [genDesc, setGenDesc] = useState("")
  const [genImage, setGenImage] = useState("")
  const [genUrl, setGenUrl] = useState("")

  // AI copy state
  const [aiDesc, setAiDesc] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<{ ogTitle: string; ogDescription: string; twitterTitle: string; twitterDescription: string } | null>(null)

  // Batch state
  const [batchInput, setBatchInput] = useState("")
  const [batchResults, setBatchResults] = useState<Array<{ url: string; status: "pending" | "ok" | "error"; ogData?: OGData; error?: string }>>([])
  const [batchLoading, setBatchLoading] = useState(false)

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
    setBatchResults(urls.map((url) => ({ url, status: "pending" })))
    for (let i = 0; i < urls.length; i++) {
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
    setBatchLoading(false)
    toast.success("Batch check complete")
  }

  function downloadOGImage() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "og-image.png"
    link.href = canvas.toDataURL("image/png")
    link.click()
    toast.success("OG image downloaded")
  }

  // Draw canvas whenever design changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 1200
    canvas.height = 628

    const template = OG_TEMPLATES.find((t) => t.id === design.templateId)

    // Background
    const gradients: Record<TemplateId, string[]> = {
      gradient: ["#6366f1", "#ec4899"],
      dark: ["#0f172a", "#1e293b"],
      light: ["#f8fafc", "#e2e8f0"],
      code: ["#0a0a0a", "#1a1a2e"],
      minimal: ["#ffffff", "#f1f5f9"],
    }
    const colors = gradients[design.templateId]
    const grad = ctx.createLinearGradient(0, 0, 1200, 628)
    grad.addColorStop(0, colors[0]!)
    grad.addColorStop(1, colors[1]!)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1200, 628)

    const isLight = design.templateId === "light" || design.templateId === "minimal"
    const textColor = isLight ? "#0f172a" : "#ffffff"
    const subtextColor = isLight ? "#64748b" : "rgba(255,255,255,0.7)"

    // Logo circle
    ctx.fillStyle = design.customColor
    ctx.beginPath()
    ctx.arc(100, 100, 40, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 24px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(design.logoText.slice(0, 2).toUpperCase(), 100, 100)

    // Headline
    const fontSizes = { sm: 48, md: 64, lg: 80, xl: 96 }
    ctx.fillStyle = textColor
    ctx.font = `bold ${fontSizes[design.fontSize]}px sans-serif`
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"

    const maxWidth = 1100
    const words = design.headline.split(" ")
    let line = ""
    let y = 280
    for (const word of words) {
      const testLine = line + word + " "
      const { width } = ctx.measureText(testLine)
      if (width > maxWidth && line) {
        ctx.fillText(line.trim(), 60, y)
        line = word + " "
        y += fontSizes[design.fontSize] * 1.2
      } else {
        line = testLine
      }
    }
    ctx.fillText(line.trim(), 60, y)

    // Subheadline
    ctx.fillStyle = subtextColor
    ctx.font = `${32}px sans-serif`
    ctx.fillText(design.subheadline.slice(0, 80), 60, y + 60)

    // Bottom accent line
    ctx.fillStyle = design.customColor
    ctx.fillRect(0, 610, 1200, 18)
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

  const TABS: { id: TabId; label: string }[] = [
    { id: "checker", label: "URL Checker" },
    { id: "designer", label: "OG Designer" },
    { id: "generator", label: "Meta Generator" },
    { id: "batch", label: "Batch Check" },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="OG Craft" icon={Image} color="text-violet-500" badge="SEO" />
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">OG Craft</h1>
          <p className="text-muted-foreground">Preview, design, and generate Open Graph meta tags.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-violet-500 text-violet-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── URL CHECKER ─────────────────────────────────────────────────── */}
        {tab === "checker" && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchOG(urlInput)}
                className="flex-1"
              />
              <Button onClick={() => fetchOG(urlInput)} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">Check</span>
              </Button>
            </div>

            {/* AI copy generator inline */}
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

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-48 rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-32 rounded-xl" />
                  <Skeleton className="h-32 rounded-xl" />
                </div>
              </div>
            )}

            {ogData && !loading && (
              <div className="space-y-6">
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

                {/* Platform previews */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {(Object.entries(PLATFORMS) as [Platform, typeof PLATFORMS[Platform]][]).map(([platform, meta]) => (
                    <PlatformPreview key={platform} platform={platform} meta={meta} ogData={ogData} />
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            {history.length > 0 && !ogData && (
              <div>
                <p className="text-sm font-medium mb-3 text-muted-foreground">Recent checks</p>
                <div className="flex flex-wrap gap-2">
                  {history.map((h) => (
                    <button
                      key={h.url}
                      onClick={() => { setUrlInput(h.url); setOgData(h.ogData) }}
                      className="text-xs px-3 py-1.5 rounded-full border hover:bg-muted transition-colors"
                    >
                      {new URL(h.url).hostname}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── OG DESIGNER ─────────────────────────────────────────────────── */}
        {tab === "designer" && (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Design</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-xs font-medium mb-2 block">Template</label>
                      <div className="grid grid-cols-5 gap-2">
                        {OG_TEMPLATES.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => setDesign((d) => ({ ...d, templateId: t.id }))}
                            className={`aspect-video rounded-md border-2 transition-all ${design.templateId === t.id ? "border-violet-500" : "border-transparent"}`}
                            style={{ background: t.preview }}
                            title={t.label}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Headline</label>
                      <Input value={design.headline} onChange={(e) => setDesign((d) => ({ ...d, headline: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">Subheadline</label>
                      <Input value={design.subheadline} onChange={(e) => setDesign((d) => ({ ...d, subheadline: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Logo text</label>
                        <Input maxLength={2} value={design.logoText} onChange={(e) => setDesign((d) => ({ ...d, logoText: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Accent color</label>
                        <input type="color" value={design.customColor} onChange={(e) => setDesign((d) => ({ ...d, customColor: e.target.value }))} className="w-full h-8 rounded-md border border-input cursor-pointer" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-2 block">Font size</label>
                      <div className="flex gap-2">
                        {(["sm", "md", "lg", "xl"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => setDesign((d) => ({ ...d, fontSize: s }))}
                            className={`px-3 py-1 rounded text-sm border transition-colors ${design.fontSize === s ? "bg-violet-500 text-white border-violet-500" : "border-border hover:bg-muted"}`}
                          >
                            {s.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Button onClick={downloadOGImage} className="w-full">
                  <Download className="w-4 h-4 mr-2" /> Download as PNG (1200×628)
                </Button>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview (1200×628)</p>
                <canvas
                  ref={canvasRef}
                  className="w-full rounded-xl border shadow-md"
                  style={{ aspectRatio: "1200/628" }}
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
                  {batchLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Checking...</> : <><Search className="w-3.5 h-3.5 mr-1" /> Check All</>}
                </Button>
              </CardContent>
            </Card>

            {batchResults.length > 0 && (
              <div className="space-y-3">
                {batchResults.map((r, i) => (
                  <Card key={i} className={r.status === "error" ? "border-red-200" : r.status === "ok" && r.ogData?.image ? "" : r.status === "ok" ? "border-amber-200" : ""}>
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
                        {r.status === "ok" && r.ogData && (
                          <Button variant="ghost" size="sm" onClick={() => { setUrlInput(r.url); setOgData(r.ogData!); setTab("checker") }}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1" /> View
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
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
            <p className="text-sm font-semibold line-clamp-1 mt-0.5" style={{ maxWidth: meta.maxTitleLen + "ch" }}>
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
