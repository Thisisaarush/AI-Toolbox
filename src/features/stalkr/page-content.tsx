"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Eye, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus,
  Search, Link2, AlertCircle, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { type BrandAnalysis } from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

function SentimentIcon({ sentiment }: { sentiment: BrandAnalysis["sentiment"] }) {
  if (sentiment === "positive") return <TrendingUp className="w-4 h-4 text-green-500" />
  if (sentiment === "negative") return <TrendingDown className="w-4 h-4 text-red-500" />
  return <Minus className="w-4 h-4 text-amber-500" />
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const color = pct >= 70 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono w-10 text-right">{value}/{max}</span>
    </div>
  )
}

export function StalkrContent() {
  const [brandName, setBrandName] = useState("")
  const [brandUrl, setBrandUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BrandAnalysis | null>(null)

  async function analyze() {
    if (!brandName.trim()) { toast.error("Brand name required"); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await aiFetch("/api/stalkr", { action: "analyze", brandName: brandName.trim(), brandUrl: brandUrl.trim() })
      const data = await res.json()
      if (data.ok) setResult(data.data)
      else toast.error(data.error || "Analysis failed")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Analysis failed")
    } finally { setLoading(false) }
  }

  return (
    <>
      <ToolHeader title="Stalkr" icon={Eye} color="text-teal-500" badge="Research" />
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Input */}
        <Card>
          <CardContent className="py-4">
            <div className="flex gap-3">
              <Input
                placeholder="Brand or company name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && analyze()}
                className="flex-1"
              />
              <Input
                placeholder="URL (optional)"
                value={brandUrl}
                onChange={(e) => setBrandUrl(e.target.value)}
                className="w-48"
              />
              <Button onClick={analyze} disabled={loading || !brandName.trim()}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Analyze
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="text-center py-16">
            <Eye className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">Enter a brand name to get a deep analysis.</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Overview */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SentimentIcon sentiment={result.sentiment} />
                    Sentiment: <span className="capitalize">{result.sentiment}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{result.sentimentSummary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Name Score: {result.nameScore}/100</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(result.nameScoreBreakdown).map(([key, val]) => (
                    <div key={key}>
                      <span className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                      <ScoreBar value={val} max={25} />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">{result.nameScoreReasoning}</p>
                </CardContent>
              </Card>
            </div>

            {/* HN Mentions */}
            {result.hnMentions.length > 0 && (
              <Card>
                <CardHeader><CardTitle>Hacker News Mentions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {result.hnMentions.map((m) => (
                    <a
                      key={m.objectID}
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.points} points · {m.numComments} comments</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-2" />
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* SEO Keywords */}
            <Card>
              <CardHeader><CardTitle>SEO Keywords</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {result.seoKeywords.map((k) => <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>)}
                </div>
              </CardContent>
            </Card>

            {/* Search Links */}
            <Card>
              <CardHeader><CardTitle>Search Links</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {result.searchLinks.map((l) => (
                    <a
                      key={l.label}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
                    >
                      <Link2 className="w-3 h-3" />
                      {l.label}
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Strengths + Improvements */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-green-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Strengths</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => <li key={i} className="text-xs">✓ {s}</li>)}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-amber-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Improvements</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {result.improvements.map((s, i) => <li key={i} className="text-xs">✗ {s}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Input form at bottom when results shown */}
        {result && !loading && (
          <Card>
            <CardContent className="py-4">
              <div className="flex gap-3">
                <Input placeholder="Analyze another brand..." value={brandName} onChange={(e) => setBrandName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} />
                <Input placeholder="URL (optional)" value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} className="w-48" />
                <Button onClick={analyze} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
