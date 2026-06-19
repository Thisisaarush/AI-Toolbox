"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Sparkles, Copy, Check, Loader2, History, ChevronRight,
  MessageSquare, Briefcase, Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type ViralPostInput, type ViralPostResult, type ViralPostRecord,
  type ViralFormat, type Platform,
  FORMAT_LABELS, FORMAT_DESCRIPTIONS, PLATFORM_LABELS,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "viral-post-v1"

function load(): ViralPostRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: ViralPostRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 20))) }
function uid(): string { return Math.random().toString(36).slice(2, 10) }

const FORMATS: ViralFormat[] = ["hot-take", "contrarian", "listicle", "story", "how-to", "unpopular-opinion", "prediction", "roast"]
const PLATFORMS: Platform[] = ["twitter", "linkedin", "reddit", "hn"]

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  twitter: <MessageSquare className="w-3.5 h-3.5" />,
  linkedin: <Briefcase className="w-3.5 h-3.5" />,
  reddit: <MessageSquare className="w-3.5 h-3.5" />,
  hn: <Globe className="w-3.5 h-3.5" />,
}

function initInput(): ViralPostInput {
  return { format: "hot-take", topic: "", context: "", platform: "twitter", angle: "" }
}

export function ViralPostContent() {
  const [records, setRecords] = useState<ViralPostRecord[]>([])
  const [input, setInput] = useState<ViralPostInput>(initInput())
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ViralPostResult | null>(null)
  const [copiedKey, setCopiedKey] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => { setRecords(load()) }, [])

  async function generate() {
    if (!input.topic.trim()) { toast.error("Topic required"); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await aiFetch("/api/viral-post", { action: "generate", input })
      const data = await res.json()
      if (data.ok) {
        setResult(data.result)
        const record: ViralPostRecord = { id: uid(), input: { ...input }, result: data.result, createdAt: new Date().toISOString() }
        const next = [record, ...records].slice(0, 20)
        setRecords(next)
        save(next)
      } else toast.error(data.error || "Generation failed")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Generation failed")
    } finally { setLoading(false) }
  }

  function loadRecord(record: ViralPostRecord) {
    setInput(record.input)
    setResult(record.result)
    setShowHistory(false)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 1500)
  }

  return (
    <>
      <ToolHeader title="Viral Post Studio" icon={Sparkles} color="text-yellow-500" badge="Creator" />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Format picker */}
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <button
              key={f}
              onClick={() => setInput({ ...input, format: f })}
              title={FORMAT_DESCRIPTIONS[f]}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                input.format === f
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="space-y-3">
          <Input placeholder="Topic / subject line" value={input.topic} onChange={(e) => setInput({ ...input, topic: e.target.value })} />
          <Textarea placeholder="Context or details (optional)" value={input.context} onChange={(e) => setInput({ ...input, context: e.target.value })} rows={3} />
          <Input placeholder="Angle or unique spin (optional)" value={input.angle ?? ""} onChange={(e) => setInput({ ...input, angle: e.target.value })} />

          {/* Platform selector */}
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => setInput({ ...input, platform: p })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  input.platform === p
                    ? "bg-foreground text-background border-foreground"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                {PLATFORM_ICONS[p]}
                {PLATFORM_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button onClick={generate} disabled={loading || !input.topic.trim()}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate
            </Button>
            {records.length > 0 && (
              <Button variant="ghost" onClick={() => setShowHistory(!showHistory)}>
                <History className="w-4 h-4" /> History ({records.length})
              </Button>
            )}
          </div>
        </div>

        {/* Result */}
        {result && result.posts.map((post, pi) => (
          <Card key={pi}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {PLATFORM_ICONS[post.platform]}
                  {PLATFORM_LABELS[post.platform]} Post
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Engagement Score: <strong className={post.engagementScore >= 70 ? "text-green-500" : post.engagementScore >= 40 ? "text-amber-500" : "text-red-500"}>{post.engagementScore}</strong>
                  </span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Textarea value={post.content} readOnly rows={Math.max(3, post.content.split("\n").length)} className="text-sm font-mono bg-muted/30" />
                <Button variant="ghost" size="icon-xs" className="absolute top-1 right-1" onClick={() => copyText(post.content, `post-${pi}`)}>
                  {copiedKey === `post-${pi}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{post.engagementReasoning}</span>
                <span>Best time: {post.bestTimeToPost}</span>
              </div>
              {post.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {post.hashtags.map((h) => <Badge key={h} variant="secondary" className="text-[10px]">{h}</Badge>)}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Hook alternatives */}
        {result && result.hookAlternatives.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Hook Alternatives</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {result.hookAlternatives.map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-2 p-2 rounded-lg hover:bg-muted transition-colors">
                  <p className="text-sm flex-1">{h}</p>
                  <Button variant="ghost" size="icon-xs" onClick={() => copyText(h, `hook-${i}`)}>
                    {copiedKey === `hook-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Thread version */}
        {result?.threadVersion && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Thread Version
                <Button variant="ghost" size="xs" onClick={() => copyText(result.threadVersion!, "thread")}>
                  {copiedKey === "thread" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea value={result.threadVersion} readOnly rows={8} className="text-sm" />
            </CardContent>
          </Card>
        )}

        {/* History */}
        {showHistory && records.length > 0 && (
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {records.map((r) => (
                <button
                  key={r.id}
                  onClick={() => loadRecord(r)}
                  className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{r.input.topic}</p>
                    <p className="text-xs text-muted-foreground">{FORMAT_LABELS[r.input.format]} · {PLATFORM_LABELS[r.input.platform]} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
