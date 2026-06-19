"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Rocket, Sparkles, Copy, Check, Loader2, Plus, Trash2, X,
  RefreshCw, Clock, CheckSquare, ChevronDown, ChevronUp, History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type LaunchInput, type LaunchOutput, type LaunchRecord, type ToneId,
  TONES, LAUNCH_CHECKLIST, BEST_TIMES,
} from "./types"

const STORAGE_KEY = "launch-pad-v1"

function load(): LaunchRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: LaunchRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }

type OutputTab = "ph" | "hn" | "tweet" | "reddit" | "email" | "linkedin"

const OUTPUT_TABS: { id: OutputTab; label: string }[] = [
  { id: "ph", label: "Product Hunt" },
  { id: "hn", label: "HN Show HN" },
  { id: "tweet", label: "Tweet Thread" },
  { id: "reddit", label: "Reddit" },
  { id: "email", label: "Cold Email" },
  { id: "linkedin", label: "LinkedIn" },
]

function defaultForm(): LaunchInput {
  return {
    productName: "",
    tagline: "",
    description: "",
    targetAudience: "",
    keyFeatures: ["", "", ""],
    techStack: "",
    launchUrl: "",
    tone: "casual",
  }
}

export function LaunchPadContent() {
  const [records, setRecords] = useState<LaunchRecord[]>([])
  const [view, setView] = useState<"form" | "output" | "history">("form")
  const [loading, setLoading] = useState(false)
  const [regenLoading, setRegenLoading] = useState<OutputTab | null>(null)
  const [currentOutput, setCurrentOutput] = useState<LaunchOutput | null>(null)
  const [outputTab, setOutputTab] = useState<OutputTab>("ph")
  const [copiedKey, setCopiedKey] = useState("")
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [showChecklist, setShowChecklist] = useState(false)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState<LaunchInput>(defaultForm)

  useEffect(() => { setRecords(load()) }, [])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  async function handleGenerate() {
    if (!form.productName.trim()) { toast.error("Product name required"); return }
    if (!form.description.trim()) { toast.error("Description required"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/launch-pad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", input: form }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Generation failed")
      setCurrentOutput(data.output)
      const record: LaunchRecord = {
        id: crypto.randomUUID(),
        input: { ...form },
        output: data.output,
        notes: "",
        createdAt: new Date().toISOString(),
      }
      setRecords((prev) => {
        const next = [record, ...prev]
        save(next)
        return next
      })
      setView("output")
      toast.success("All 6 formats generated!")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setLoading(false)
  }

  function updateFeature(idx: number, value: string) {
    setForm((f) => ({ ...f, keyFeatures: f.keyFeatures.map((k, i) => i === idx ? value : k) }))
  }

  function addFeature() {
    if (form.keyFeatures.length >= 6) return
    setForm((f) => ({ ...f, keyFeatures: [...f.keyFeatures, ""] }))
  }

  function removeFeature(idx: number) {
    setForm((f) => ({ ...f, keyFeatures: f.keyFeatures.filter((_, i) => i !== idx) }))
  }

  function loadRecord(record: LaunchRecord) {
    setCurrentOutput(record.output)
    setForm(record.input)
    setView("output")
  }

  async function regeneratePlatform(platform: OutputTab) {
    if (!currentOutput) return
    setRegenLoading(platform)
    try {
      const res = await fetch("/api/launch-pad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-platform", input: form, platform }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Regeneration failed")
      if (data.partial && Object.keys(data.partial).length > 0) {
        setCurrentOutput((prev) => prev ? { ...prev, ...data.partial } : prev)
        toast.success("Regenerated!")
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Regeneration failed")
    }
    setRegenLoading(null)
  }

  function updateRecordNotes(id: string, notes: string) {
    setRecords((prev) => {
      const next = prev.map((r) => r.id === id ? { ...r, notes } : r)
      save(next)
      return next
    })
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Launch Pad"
        icon={Rocket}
        color="text-orange-500"
        badge="Marketing"
        actions={
          <div className="flex gap-2">
            {view !== "form" && <Button variant="outline" size="sm" onClick={() => { setForm(defaultForm()); setView("form") }}>← New Launch</Button>}
            {records.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setView(view === "history" ? "form" : "history")}>
                <History className="w-3.5 h-3.5 mr-1" /> History
              </Button>
            )}
          </div>
        }
      />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-6 w-full">

        {/* ── FORM ─────────────────────────────────────────────────────────── */}
        {view === "form" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Launch Pad</h1>
              <p className="text-muted-foreground">Describe your product once — get 5 platform-ready launch posts.</p>
            </div>

            <Card>
              <CardContent className="pt-5 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Product name *</label>
                    <Input placeholder="DevDash" value={form.productName} onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Tagline * <span className="text-muted-foreground">({form.tagline.length}/60)</span></label>
                    <Input
                      placeholder="The developer dashboard you've been waiting for"
                      value={form.tagline}
                      onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                      maxLength={80}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">What it does (2-3 sentences) *</label>
                  <Textarea
                    placeholder="DevDash is an all-in-one dashboard that aggregates your GitHub activity, deployment status, and team metrics in one place. No more switching between 5 different tools..."
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div>
                  <label className="text-xs font-medium mb-1 block">Who it's for *</label>
                  <Input
                    placeholder="Full-stack developers who manage multiple projects"
                    value={form.targetAudience}
                    onChange={(e) => setForm((f) => ({ ...f, targetAudience: e.target.value }))}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium">Key features (up to 6)</label>
                    <Button variant="ghost" size="sm" onClick={addFeature} disabled={form.keyFeatures.length >= 6}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.keyFeatures.map((f, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder={`Feature ${i + 1}`}
                          value={f}
                          onChange={(e) => updateFeature(i, e.target.value)}
                        />
                        {form.keyFeatures.length > 1 && (
                          <Button variant="ghost" size="icon-sm" onClick={() => removeFeature(i)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Tech stack (optional)</label>
                    <Input placeholder="Next.js, Postgres, Vercel" value={form.techStack} onChange={(e) => setForm((f) => ({ ...f, techStack: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Launch URL</label>
                    <Input placeholder="https://yourproduct.com" value={form.launchUrl} onChange={(e) => setForm((f) => ({ ...f, launchUrl: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium mb-2 block">Tone</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(TONES) as [ToneId, typeof TONES[ToneId]][]).map(([id, t]) => (
                      <button
                        key={id}
                        onClick={() => setForm((f) => ({ ...f, tone: id }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${form.tone === id ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted"}`}
                      >
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs opacity-70 ml-1 hidden sm:inline">— {t.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button className="w-full" onClick={handleGenerate} disabled={loading}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating all 6 formats...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Generate All Launch Copy</>
                  }
                </Button>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card>
              <button
                className="w-full"
                onClick={() => setShowChecklist(!showChecklist)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-orange-500" /> Before You Launch Checklist</span>
                    {showChecklist ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </CardTitle>
                </CardHeader>
              </button>
              {showChecklist && (
                <CardContent className="pt-0 space-y-2">
                  {LAUNCH_CHECKLIST.map((item, i) => (
                    <label key={i} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!checkedItems[i]}
                        onChange={(e) => setCheckedItems((c) => ({ ...c, [i]: e.target.checked }))}
                        className="w-4 h-4 rounded"
                      />
                      <span className={`text-sm ${checkedItems[i] ? "line-through text-muted-foreground" : ""}`}>{item}</span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground pt-2">
                    {Object.values(checkedItems).filter(Boolean).length}/{LAUNCH_CHECKLIST.length} completed
                  </p>
                </CardContent>
              )}
            </Card>

            {/* Best times */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Best Times to Launch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(BEST_TIMES).map(([platform, time]) => (
                  <div key={platform} className="flex items-start gap-3 text-sm">
                    <span className="font-medium w-32 shrink-0">{platform}</span>
                    <span className="text-muted-foreground">{time}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── OUTPUT ───────────────────────────────────────────────────────── */}
        {view === "output" && currentOutput && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Launch Copy Ready</h1>
              <p className="text-muted-foreground text-sm">6 platform-optimized formats generated.</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Regenerate all
            </Button>
            </div>

            {/* Tone selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Tone:</span>
              {(Object.entries(TONES) as [ToneId, typeof TONES[ToneId]][]).map(([id, t]) => (
                <button
                  key={id}
                  onClick={() => setForm((f) => ({ ...f, tone: id }))}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${form.tone === id ? "bg-orange-500 text-white border-orange-500" : "border-border hover:bg-muted"}`}
                >
                  {t.label}
                </button>
              ))}
              <Button size="sm" variant="outline" onClick={handleGenerate} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                Regenerate with this tone
              </Button>
            </div>

            {/* Output tabs */}
            <div className="flex gap-1 border-b overflow-x-auto">
              {OUTPUT_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOutputTab(t.id)}
                  className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${outputTab === t.id ? "border-orange-500 text-orange-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Per-tab regenerate */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => regeneratePlatform(outputTab)}
                disabled={regenLoading === outputTab}
              >
                {regenLoading === outputTab
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Regenerating...</>
                  : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Regenerate {OUTPUT_TABS.find((t) => t.id === outputTab)?.label}</>}
              </Button>
            </div>

            {outputTab === "ph" && (
              <OutputSection title="Product Hunt Listing">
                <OutputField label="Name" value={currentOutput.productHunt.name} copyKey="ph-name" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField
                  label={`Tagline (${currentOutput.productHunt.tagline.length}/60)`}
                  value={currentOutput.productHunt.tagline}
                  copyKey="ph-tagline"
                  copiedKey={copiedKey}
                  onCopy={copyText}
                  warning={currentOutput.productHunt.tagline.length > 60}
                />
                <OutputField
                  label={`Description (${currentOutput.productHunt.description.length}/260)`}
                  value={currentOutput.productHunt.description}
                  copyKey="ph-desc"
                  copiedKey={copiedKey}
                  onCopy={copyText}
                  warning={currentOutput.productHunt.description.length > 260}
                />
                <OutputField label="First Comment" value={currentOutput.productHunt.firstComment} copyKey="ph-comment" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "hn" && (
              <OutputSection title="Hacker News Show HN">
                <OutputField label="Title" value={currentOutput.hackerNews.title} copyKey="hn-title" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField label="Body" value={currentOutput.hackerNews.body} copyKey="hn-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "tweet" && (
              <OutputSection title="Tweet Thread">
                <div className="space-y-3">
                  {currentOutput.tweetThread.map((tweet, i) => (
                    <div key={i} className="group relative bg-muted/30 rounded-lg p-4 border">
                      <p className="text-sm pr-8">{tweet}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${tweet.length > 280 ? "text-red-500" : "text-muted-foreground"}`}>
                          {tweet.length}/280
                        </span>
                        <button onClick={() => copyText(tweet, `tweet-${i}`)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {copiedKey === `tweet-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => copyText(currentOutput.tweetThread.join("\n\n"), "tweet-all")}>
                    {copiedKey === "tweet-all" ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    Copy full thread
                  </Button>
                </div>
              </OutputSection>
            )}

            {outputTab === "reddit" && (
              <OutputSection title="Reddit Post">
                <OutputField label="Title" value={currentOutput.reddit.title} copyKey="reddit-title" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField label="Body" value={currentOutput.reddit.body} copyKey="reddit-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "email" && (
              <OutputSection title="Cold Email">
                <OutputField label="Subject" value={currentOutput.coldEmail.subject} copyKey="email-subject" copiedKey={copiedKey} onCopy={copyText} />
                <OutputField label="Body" value={currentOutput.coldEmail.body} copyKey="email-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}

            {outputTab === "linkedin" && (
              <OutputSection title="LinkedIn Post">
                <OutputField label={`Post (${currentOutput.linkedInPost?.body?.length ?? 0} chars)`} value={currentOutput.linkedInPost?.body ?? ""} copyKey="linkedin-body" copiedKey={copiedKey} onCopy={copyText} multiline />
              </OutputSection>
            )}
          </div>
        )}

        {/* ── HISTORY ─────────────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Launch History</h1>
              <p className="text-muted-foreground text-sm">{records.length} saved launches</p>
            </div>
            {records.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">No launches yet</CardContent></Card>
            ) : (
              records.map((r) => (
                <Card key={r.id}>
                  <CardContent className="py-4">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => loadRecord(r)}
                    >
                      <div>
                        <p className="font-semibold">{r.input.productName}</p>
                        <p className="text-sm text-muted-foreground">{r.input.tagline}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{r.input.tone}</Badge>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecords((prev) => {
                              const next = prev.filter((rec) => rec.id !== r.id)
                              save(next)
                              return next
                            })
                            toast.success("Deleted")
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    {/* Notes */}
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      {editingNotes === r.id ? (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Add notes about this launch..."
                            value={r.notes}
                            onChange={(e) => updateRecordNotes(r.id, e.target.value)}
                            rows={2}
                            className="text-sm"
                            autoFocus
                          />
                          <Button size="sm" variant="outline" onClick={() => setEditingNotes(null)}>Done</Button>
                        </div>
                      ) : (
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-full"
                          onClick={() => setEditingNotes(r.id)}
                        >
                          {r.notes ? r.notes : "+ Add notes"}
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function OutputSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function OutputField({
  label, value, copyKey, copiedKey, onCopy, multiline, warning,
}: {
  label: string; value: string; copyKey: string; copiedKey: string
  onCopy: (v: string, k: string) => void; multiline?: boolean; warning?: boolean
}) {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1.5">
        <label className={`text-xs font-medium ${warning ? "text-amber-600" : "text-muted-foreground"}`}>{label}</label>
        <button onClick={() => onCopy(value, copyKey)} className="shrink-0">
          {copiedKey === copyKey ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
      </div>
      {multiline ? (
        <div className="bg-muted/30 rounded-lg p-3 border whitespace-pre-wrap text-sm">{value}</div>
      ) : (
        <div className="bg-muted/30 rounded-lg px-3 py-2 border text-sm">{value}</div>
      )}
    </div>
  )
}


