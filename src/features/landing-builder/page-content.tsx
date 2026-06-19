"use client"

import { useState, useEffect, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Layout, Plus, Trash2, Copy, Check, Loader2, Sparkles,
  RefreshCw, Clock, Download, ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type LandingInput, type LandingOutput, type LandingRecord,
  type LandingTone, type PricingType,
  TONE_LABELS, PRICING_LABELS,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "landing-builder-v1"

function load(): LandingRecord[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: LandingRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 20))) }
function uid(): string { return Math.random().toString(36).slice(2, 10) }

type MainTab = "form" | "output" | "history"
type OutputTab = "hero" | "features" | "howItWorks" | "testimonials" | "pricing" | "faq" | "seo"

const OUTPUT_TABS: { id: OutputTab; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "features", label: "Features" },
  { id: "howItWorks", label: "How It Works" },
  { id: "testimonials", label: "Testimonials" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
  { id: "seo", label: "CTA + SEO" },
]

function defaultForm(): LandingInput {
  return {
    productName: "", oneLiner: "", targetAudience: "",
    features: ["", "", ""],
    pricingType: "freemium", tone: "professional", competitor: "",
  }
}

function SectionContent({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed">{children}</CardContent>
    </Card>
  )
}

function CopyButton({ text, id, copiedKey, setCopiedKey }: { text: string; id: string; copiedKey: string; setCopiedKey: (k: string) => void }) {
  return (
    <Button variant="ghost" size="xs" onClick={() => { navigator.clipboard.writeText(text); setCopiedKey(id); setTimeout(() => setCopiedKey(""), 1500) }}>
      {copiedKey === id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
    </Button>
  )
}

export function LandingBuilderContent() {
  const [records, setRecords] = useState<LandingRecord[]>([])
  const [mainTab, setMainTab] = useState<MainTab>("form")
  const [outputTab, setOutputTab] = useState<OutputTab>("hero")
  const [form, setForm] = useState<LandingInput>(defaultForm())
  const [loading, setLoading] = useState(false)
  const [currentOutput, setCurrentOutput] = useState<LandingOutput | null>(null)
  const [copiedKey, setCopiedKey] = useState("")
  const [regenLoading, setRegenLoading] = useState(false)

  useEffect(() => { setRecords(load()) }, [])

  const updateFeature = (index: number, value: string) => {
    setForm((prev) => {
      const features = [...prev.features]
      features[index] = value
      return { ...prev, features }
    })
  }

  const addFeature = () => setForm((prev) => ({ ...prev, features: [...prev.features, ""] }))
  const removeFeature = (index: number) => setForm((prev) => ({ ...prev, features: prev.features.filter((_, i) => i !== index) }))

  async function generate() {
    if (!form.productName.trim()) { toast.error("Product name required"); return }
    setLoading(true)
    try {
      const res = await aiFetch("/api/landing-builder", { action: "generate", input: form })
      const data = await res.json()
      if (data.ok) {
        const output = data.output as LandingOutput
        setCurrentOutput(output)
        const record: LandingRecord = { id: uid(), input: { ...form }, output, createdAt: new Date().toISOString() }
        const next = [record, ...records]
        setRecords(next)
        save(next)
        setMainTab("output")
        toast.success("Landing page generated!")
      } else toast.error(data.error || "Generation failed")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Generation failed")
    } finally { setLoading(false) }
  }

  async function regenerateSection(section: OutputTab) {
    if (!currentOutput || !form.productName.trim()) return
    setRegenLoading(true)
    try {
      const currentContent = JSON.stringify((currentOutput as unknown as Record<string, unknown>)[section])
      const res = await aiFetch("/api/landing-builder", { action: "regenerate-section", input: form, section, currentContent })
      const data = await res.json()
      if (data.ok) {
        setCurrentOutput((prev) => prev ? { ...prev, [section]: data.section === "seo" ? { ...prev.cta, ...data.data } : data.data } as LandingOutput : prev)
        toast.success(`${section} regenerated`)
      } else toast.error(data.error || "Regeneration failed")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Regeneration failed")
    } finally { setRegenLoading(false) }
  }

  function loadRecord(record: LandingRecord) {
    setForm(record.input)
    setCurrentOutput(record.output)
    setMainTab("output")
  }

  function exportHTML() {
    if (!currentOutput) return
    const o = currentOutput
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${o.seo.metaTitle}</title><meta name="description" content="${o.seo.metaDescription}">
<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:0 24px}
.hero{text-align:center;padding:80px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff}
.hero h1{font-size:3rem;margin:0 0 16px}.hero p{font-size:1.25rem;opacity:.8;max-width:600px;margin:0 auto 32px}
.btn{display:inline-block;padding:12px 28px;border-radius:8px;font-weight:600;text-decoration:none;font-size:1rem}
.btn-primary{background:#6366f1;color:#fff}.btn-secondary{border:2px solid rgba(255,255,255,.3);color:#fff;margin-left:12px}
.features{padding:80px 24px;text-align:center}.features h2{font-size:2rem;margin-bottom:48px}
.feature-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px}
.feature-card{padding:32px;border:1px solid #e2e8f0;border-radius:12px;text-align:left}
.feature-card .icon{font-size:2rem;margin-bottom:16px}.feature-card h3{margin:0 0 8px}.feature-card p{margin:0;color:#64748b}
.how{padding:80px 24px;background:#f8fafc}.how h2{text-align:center;font-size:2rem;margin-bottom:48px}
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:32px;max-width:900px;margin:0 auto}
.step{text-align:center}.step-num{width:48px;height:48px;background:#6366f1;color:#fff;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:1.25rem;margin-bottom:16px}
.step h3{margin:0 0 8px}.step p{margin:0;color:#64748b;font-size:.95rem}
.testimonials{padding:80px 24px}.testimonials h2{text-align:center;font-size:2rem;margin-bottom:48px}
.testimonial-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}
.testimonial{padding:24px;background:#f8fafc;border-radius:12px;font-style:italic;color:#475569}
.testimonial .author{margin-top:16px;font-style:normal;font-weight:600;font-size:.9rem;color:#1a1a1a}
.pricing{padding:80px 24px;background:#f8fafc}.pricing h2{text-align:center;font-size:2rem;margin-bottom:48px}
.pricing-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;max-width:900px;margin:0 auto}
.price-card{padding:32px;border:1px solid #e2e8f0;border-radius:12px;text-align:center}
.price-card.highlighted{border-color:#6366f1;box-shadow:0 0 0 2px #6366f1}
.price-card h3{margin:0 0 8px}.price{font-size:2rem;font-weight:bold;margin:16px 0}.price-card ul{list-style:none;padding:0;margin:24px 0}
.price-card li{padding:8px 0;border-bottom:1px solid #f1f5f9}.price-card li::before{content:"✓ ";color:#6366f1}
.faq{padding:80px 24px}.faq h2{text-align:center;font-size:2rem;margin-bottom:48px}
.faq-item{max-width:700px;margin:0 auto 24px}.faq-item h4{margin:0 0 8px}.faq-item p{margin:0;color:#64748b}
.cta-section{padding:80px 24px;text-align:center;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff}
.cta-section h2{font-size:2rem;margin-bottom:16px}.cta-section p{opacity:.8;margin-bottom:32px}
</style></head><body>
<div class="hero"><div class="container"><h1>${o.hero.headline}</h1><p>${o.hero.subheadline}</p>
<div><a href="#" class="btn btn-primary">${o.hero.ctaPrimary}</a><a href="#" class="btn btn-secondary">${o.hero.ctaSecondary}</a></div>
<p style="margin-top:24px;font-size:.9rem;opacity:.6">${o.hero.socialProof}</p></div></div>
<div class="features"><div class="container"><h2>Features</h2><div class="feature-grid">
${o.features.map((f) => `<div class="feature-card"><div class="icon">${f.icon}</div><h3>${f.title}</h3><p>${f.description}</p></div>`).join("")}
</div></div></div>
<div class="how"><div class="container"><h2>How It Works</h2><div class="steps">
${o.howItWorks.map((s) => `<div class="step"><div class="step-num">${s.step}</div><h3>${s.title}</h3><p>${s.description}</p></div>`).join("")}
</div></div></div>
<div class="testimonials"><div class="container"><h2>What People Say</h2><div class="testimonial-grid">
${o.testimonials.map((t) => `<div class="testimonial">"${t.quote}"<div class="author">${t.author} · ${t.role}, ${t.company}</div></div>`).join("")}
</div></div></div>
<div class="pricing"><div class="container"><h2>Pricing</h2><div class="pricing-grid">
${o.pricing.map((p) => `<div class="price-card${p.highlighted ? " highlighted" : ""}"><h3>${p.name}</h3><div class="price">${p.price}</div><p>${p.description}</p><ul>${p.features.map((f) => `<li>${f}</li>`).join("")}</ul><a href="#" class="btn btn-primary">${p.cta}</a></div>`).join("")}
</div></div></div>
<div class="faq"><div class="container"><h2>FAQ</h2>
${o.faq.map((q) => `<div class="faq-item"><h4>${q.question}</h4><p>${q.answer}</p></div>`).join("")}
</div></div>
<div class="cta-section"><h2>${o.cta.headline}</h2><p>${o.cta.subtext}</p><a href="#" class="btn btn-primary">${o.cta.buttonText}</a></div>
</body></html>`
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${form.productName.toLowerCase().replace(/\s+/g, "-")}-landing.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("HTML exported")
  }

  if (records.length === 0 && mainTab === "history") {
    setMainTab("form")
  }

  return (
    <>
      <ToolHeader title="Landing Page Builder" icon={Layout} color="text-purple-500" badge="Launch" />
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-6">
          {(["form", "output", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                mainTab === t ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "form" ? "Create" : t === "output" ? "Output" : `History (${records.length})`}
            </button>
          ))}
        </div>

        {/* ── Form Tab ──────────────────────────────────────────────────── */}
        {mainTab === "form" && (
          <div className="max-w-2xl space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Product Name *</label>
                <Input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="LaunchPilot" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">One-Liner</label>
                <Input value={form.oneLiner} onChange={(e) => setForm({ ...form, oneLiner: e.target.value })} placeholder="Ship your product in 24 hours" />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block">Target Audience</label>
              <Input value={form.targetAudience} onChange={(e) => setForm({ ...form, targetAudience: e.target.value })} placeholder="Solo founders and indie hackers" />
            </div>

            {/* Features */}
            <div>
              <label className="text-xs font-medium mb-2 block">Key Features</label>
              <div className="space-y-2">
                {form.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={f}
                      onChange={(e) => updateFeature(i, e.target.value)}
                      placeholder={`Feature ${i + 1}`}
                    />
                    {form.features.length > 1 && (
                      <Button variant="ghost" size="icon-xs" onClick={() => removeFeature(i)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="ghost" size="xs" onClick={addFeature}><Plus className="w-3 h-3" /> Add feature</Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block">Pricing Type</label>
                <select
                  value={form.pricingType}
                  onChange={(e) => setForm({ ...form, pricingType: e.target.value as PricingType })}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {Object.entries(PRICING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Tone</label>
                <select
                  value={form.tone}
                  onChange={(e) => setForm({ ...form, tone: e.target.value as LandingTone })}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  {Object.entries(TONE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Competitor (optional)</label>
                <Input value={form.competitor ?? ""} onChange={(e) => setForm({ ...form, competitor: e.target.value })} placeholder="e.g. Vercel" />
              </div>
            </div>

            <Button onClick={generate} disabled={loading || !form.productName.trim()} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Landing Page
            </Button>
          </div>
        )}

        {/* ── Output Tab ─────────────────────────────────────────────────── */}
        {mainTab === "output" && currentOutput && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 border-b border-border flex-1 overflow-x-auto">
                {OUTPUT_TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setOutputTab(t.id)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                      outputTab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={exportHTML} className="ml-2 shrink-0">
                <Download className="w-3.5 h-3.5" /> Export HTML
              </Button>
            </div>

            <div className="max-w-2xl">
              {/* Hero */}
              {outputTab === "hero" && (
                <div className="space-y-3">
                  <SectionContent title="Headline">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{currentOutput.hero.headline}</span>
                      <CopyButton text={currentOutput.hero.headline} id="hero-h" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                    </div>
                  </SectionContent>
                  <SectionContent title="Subheadline">
                    <div className="flex items-start justify-between gap-2">
                      <span>{currentOutput.hero.subheadline}</span>
                      <CopyButton text={currentOutput.hero.subheadline} id="hero-s" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                    </div>
                  </SectionContent>
                  <div className="grid grid-cols-2 gap-3">
                    <SectionContent title="Primary CTA">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{currentOutput.hero.ctaPrimary}</Badge>
                        <CopyButton text={currentOutput.hero.ctaPrimary} id="hero-c1" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                    <SectionContent title="Secondary CTA">
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary">{currentOutput.hero.ctaSecondary}</Badge>
                        <CopyButton text={currentOutput.hero.ctaSecondary} id="hero-c2" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  </div>
                  <SectionContent title="Social Proof">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{currentOutput.hero.socialProof}</span>
                      <CopyButton text={currentOutput.hero.socialProof} id="hero-sp" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                    </div>
                  </SectionContent>
                </div>
              )}

              {/* Features */}
              {outputTab === "features" && (
                <div className="space-y-3">
                  {currentOutput.features.map((f, i) => (
                    <SectionContent key={i} title={`${f.icon} ${f.title}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span>{f.description}</span>
                        <CopyButton text={`${f.title}: ${f.description}`} id={`feat-${i}`} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  ))}
                </div>
              )}

              {/* How It Works */}
              {outputTab === "howItWorks" && (
                <div className="space-y-3">
                  {currentOutput.howItWorks.map((s) => (
                    <SectionContent key={s.step} title={`Step ${s.step}: ${s.title}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span>{s.description}</span>
                        <CopyButton text={`Step ${s.step}: ${s.title} — ${s.description}`} id={`how-${s.step}`} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  ))}
                </div>
              )}

              {/* Testimonials */}
              {outputTab === "testimonials" && (
                <div className="space-y-3">
                  {currentOutput.testimonials.map((t, i) => (
                    <SectionContent key={i} title={`${t.author} — ${t.role}, ${t.company}`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="italic text-muted-foreground">&ldquo;{t.quote}&rdquo;</span>
                        <CopyButton text={`"${t.quote}" — ${t.author}, ${t.role} at ${t.company}`} id={`test-${i}`} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  ))}
                </div>
              )}

              {/* Pricing */}
              {outputTab === "pricing" && (
                <div className="space-y-3">
                  {currentOutput.pricing.map((p, i) => (
                    <SectionContent key={i} title={`${p.name} — ${p.price}${p.highlighted ? " (Featured)" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm mb-1">{p.description}</p>
                          <p className="text-xs text-muted-foreground">CTA: {p.cta}</p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {p.features.map((f, fi) => <Badge key={fi} variant="secondary" className="text-[10px]">{f}</Badge>)}
                          </div>
                        </div>
                        <CopyButton text={`${p.name}: ${p.price} — ${p.description}`} id={`price-${i}`} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  ))}
                </div>
              )}

              {/* FAQ */}
              {outputTab === "faq" && (
                <div className="space-y-3">
                  {currentOutput.faq.map((q, i) => (
                    <SectionContent key={i} title={q.question}>
                      <div className="flex items-start justify-between gap-2">
                        <span>{q.answer}</span>
                        <CopyButton text={`${q.question}\n\n${q.answer}`} id={`faq-${i}`} copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                      </div>
                    </SectionContent>
                  ))}
                </div>
              )}

              {/* SEO */}
              {outputTab === "seo" && (
                <div className="space-y-3">
                  <SectionContent title="Closing CTA">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold">{currentOutput.cta.headline}</p>
                        <p className="text-sm text-muted-foreground mt-1">{currentOutput.cta.subtext}</p>
                        <Badge variant="secondary" className="mt-2">{currentOutput.cta.buttonText}</Badge>
                      </div>
                      <CopyButton text={`${currentOutput.cta.headline}\n${currentOutput.cta.subtext}`} id="cta" copiedKey={copiedKey} setCopiedKey={setCopiedKey} />
                    </div>
                  </SectionContent>
                  <SectionContent title="SEO Meta">
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Title:</span> {currentOutput.seo.metaTitle}</div>
                      <div><span className="font-medium">Description:</span> {currentOutput.seo.metaDescription}</div>
                      <div className="flex flex-wrap gap-1 mt-1">{currentOutput.seo.keywords.map((k) => <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>)}</div>
                    </div>
                  </SectionContent>
                  <SectionContent title="Open Graph">
                    <div className="space-y-1 text-sm">
                      <div><span className="font-medium">OG Title:</span> {currentOutput.seo.ogTitle}</div>
                      <div><span className="font-medium">OG Description:</span> {currentOutput.seo.ogDescription}</div>
                    </div>
                  </SectionContent>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => regenerateSection(outputTab)}
              disabled={regenLoading}
            >
              {regenLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Regenerate {OUTPUT_TABS.find((t) => t.id === outputTab)?.label}
            </Button>
          </div>
        )}

        {mainTab === "output" && !currentOutput && (
          <div className="text-center py-20">
            <Layout className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No landing page generated yet. Create one to get started.</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setMainTab("form")}>Create your first</Button>
          </div>
        )}

        {/* ── History Tab ─────────────────────────────────────────────────── */}
        {mainTab === "history" && (
          <div className="space-y-3">
            {records.length === 0 && (
              <div className="text-center py-20">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No history yet.</p>
              </div>
            )}
            {records.map((r) => (
              <Card key={r.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => loadRecord(r)}>
                <CardContent className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{r.input.productName}</p>
                    <p className="text-xs text-muted-foreground">{r.input.oneLiner || "No tagline"} · {r.input.tone} · {new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
