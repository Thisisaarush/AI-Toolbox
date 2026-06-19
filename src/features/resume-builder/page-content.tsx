"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  FileText, Plus, Trash2, Copy, Check, Loader2, Download,
  Sparkles, Eye, AlertCircle, X, ChevronDown, ChevronUp,
  Pencil, ArrowRight, Target, Mail, Upload,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Resume, type Experience, type Education, type Project,
  type ATSScore, type TailorResult, type BulletRewrites,
} from "./types"
import { aiFetch, AiKeyError } from "@/lib/ai-fetch"

const STORAGE_KEY = "resume-builder-v1"
const ACTIVE_KEY = "resume-builder-active"

type TabId = "builder" | "preview" | "ats" | "tailor" | "cover" | "bullets"

function load(): Resume[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function save(r: Resume[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)) }
function loadActive(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(ACTIVE_KEY)
}
function saveActive(id: string) { localStorage.setItem(ACTIVE_KEY, id) }

function uid(): string { return Math.random().toString(36).slice(2, 10) }

function newResume(name: string): Resume {
  const now = new Date().toISOString()
  return {
    id: uid(), name, fullName: "", email: "", phone: "", location: "",
    linkedin: "", github: "", website: "", summary: "",
    experience: [], education: [], skills: [], projects: [], certifications: [],
    template: "modern", createdAt: now, updatedAt: now,
  }
}

const TEMPLATES = ["classic", "modern", "minimal"] as const

// ── Resume Preview Renderer ───────────────────────────────────────────────
function ResumePreview({ resume }: { resume: Resume }) {
  const t = resume.template
  if (t === "modern") {
    return (
      <div className="flex min-h-[800px] bg-white text-black text-xs leading-tight">
        <div className="w-[220px] bg-[#1e293b] text-white p-5 shrink-0">
          <h1 className="text-xl font-bold mb-1">{resume.fullName || "Your Name"}</h1>
          <div className="text-xs text-slate-300 space-y-0.5 mb-5">
            {resume.email && <p>{resume.email}</p>}
            {resume.phone && <p>{resume.phone}</p>}
            {resume.location && <p>{resume.location}</p>}
            {resume.linkedin && <p>{resume.linkedin}</p>}
            {resume.github && <p>{resume.github}</p>}
            {resume.website && <p>{resume.website}</p>}
          </div>
          {resume.skills.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">Skills</h3>
              <div className="flex flex-wrap gap-1.5">
                {resume.skills.map((s) => (
                  <span key={s} className="bg-slate-700 rounded px-1.5 py-0.5 text-[10px]">{s}</span>
                ))}
              </div>
            </div>
          )}
          {resume.certifications.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1.5">Certifications</h3>
              {resume.certifications.map((c) => (
                <div key={c.id} className="mb-1">
                  <p className="font-medium text-xs">{c.name}</p>
                  <p className="text-[10px] text-slate-400">{c.issuer} · {c.date}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 p-5">
          {resume.summary && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 pb-1 mb-1.5">Summary</h3>
              <p className="text-xs leading-relaxed">{resume.summary}</p>
            </div>
          )}
          {resume.experience.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 pb-1 mb-1.5">Experience</h3>
              {resume.experience.map((exp) => (
                <div key={exp.id} className="mb-2.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-xs">{exp.role}</span>
                    <span className="text-[10px] text-slate-500">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                  </div>
                  <p className="text-xs text-slate-600">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
                  <ul className="mt-1 space-y-0.5">
                    {exp.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} className="text-xs flex gap-1.5"><span className="text-slate-400">•</span><span>{b}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {resume.education.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 pb-1 mb-1.5">Education</h3>
              {resume.education.map((edu) => (
                <div key={edu.id} className="mb-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-bold text-xs">{edu.degree} in {edu.field}</span>
                    <span className="text-[10px] text-slate-500">{edu.startDate} – {edu.endDate}</span>
                  </div>
                  <p className="text-xs text-slate-600">{edu.institution}{edu.gpa ? ` · GPA: ${edu.gpa}` : ""}</p>
                </div>
              ))}
            </div>
          )}
          {resume.projects.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-500 border-b border-slate-200 pb-1 mb-1.5">Projects</h3>
              {resume.projects.map((p) => (
                <div key={p.id} className="mb-3">
                  <span className="font-bold text-xs">{p.name}</span>
                  {p.url && <span className="text-[10px] text-blue-600 ml-1">{p.url}</span>}
                  <p className="text-xs text-slate-600">{p.description}</p>
                  {p.tech.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {p.tech.map((t) => <span key={t} className="text-[8px] bg-slate-100 rounded px-1 py-0.5">{t}</span>)}
                    </div>
                  )}
                  <ul className="mt-0.5 space-y-0.5">
                    {p.bullets.filter(Boolean).map((b, i) => (
                      <li key={i} className="text-xs flex gap-1.5"><span className="text-slate-400">•</span><span>{b}</span></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (t === "classic") {
    return (
      <div className="min-h-[800px] bg-white text-black p-6 text-xs leading-tight font-serif">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold">{resume.fullName || "Your Name"}</h1>
          <div className="flex justify-center gap-5 text-xs text-slate-600 mt-1">
            {resume.email && <span>{resume.email}</span>}
            {resume.phone && <span>· {resume.phone}</span>}
            {resume.location && <span>· {resume.location}</span>}
          </div>
          <div className="flex justify-center gap-5 text-xs text-slate-500">
            {resume.linkedin && <span>{resume.linkedin}</span>}
            {resume.github && <span>{resume.github}</span>}
            {resume.website && <span>{resume.website}</span>}
          </div>
        </div>
        <hr className="border-black mb-5" />
        {resume.summary && (
          <div className="mb-5">
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1">Professional Summary</h3>
            <p className="text-xs leading-relaxed">{resume.summary}</p>
          </div>
        )}
        {resume.experience.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1 border-b border-black pb-0.5">Experience</h3>
            {resume.experience.map((exp) => (
              <div key={exp.id} className="mb-3">
                <div className="flex justify-between">
                  <span className="font-bold">{exp.role}</span>
                  <span className="text-[10px] italic">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
                </div>
                <p className="text-xs italic text-slate-600">{exp.company}{exp.location ? `, ${exp.location}` : ""}</p>
                <ul className="mt-1 space-y-0.5">
                  {exp.bullets.filter(Boolean).map((b, i) => (
                    <li key={i} className="text-xs">• {b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {resume.education.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1 border-b border-black pb-0.5">Education</h3>
            {resume.education.map((edu) => (
              <div key={edu.id} className="mb-1">
                <div className="flex justify-between">
                  <span className="font-bold">{edu.degree} in {edu.field}</span>
                  <span className="text-[10px] italic">{edu.startDate} – {edu.endDate}</span>
                </div>
                <p className="text-xs italic text-slate-600">{edu.institution}{edu.gpa ? ` · GPA: ${edu.gpa}` : ""}</p>
              </div>
            ))}
          </div>
        )}
        {resume.skills.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1 border-b border-black pb-0.5">Skills</h3>
            <p className="text-xs">{resume.skills.join(" · ")}</p>
          </div>
        )}
        {resume.projects.length > 0 && (
          <div className="mb-5">
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1 border-b border-black pb-0.5">Projects</h3>
            {resume.projects.map((p) => (
              <div key={p.id} className="mb-1.5">
                <span className="font-bold">{p.name}</span>
                {p.url && <span className="text-[10px] ml-1">({p.url})</span>}
                <p className="text-xs">{p.description}</p>
                {p.tech.length > 0 && <p className="text-[10px] italic">Tech: {p.tech.join(", ")}</p>}
                <ul className="mt-0.5">
                  {p.bullets.filter(Boolean).map((b, i) => (
                    <li key={i} className="text-xs">• {b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {resume.certifications.length > 0 && (
          <div>
            <h3 className="text-xs uppercase font-bold tracking-wider mb-1 border-b border-black pb-0.5">Certifications</h3>
            {resume.certifications.map((c) => (
              <p key={c.id} className="text-xs">{c.name} — {c.issuer} ({c.date})</p>
            ))}
          </div>
        )}
      </div>
    )
  }

  // minimal
  return (
    <div className="min-h-[800px] bg-white text-black p-8 text-xs leading-relaxed">
      <h1 className="text-3xl font-light tracking-wide mb-0.5">{resume.fullName || "Your Name"}</h1>
      <div className="flex flex-wrap gap-5 text-xs text-slate-500 mb-8">
        {resume.email && <span>{resume.email}</span>}
        {resume.phone && <span>{resume.phone}</span>}
        {resume.location && <span>{resume.location}</span>}
        {resume.linkedin && <span>{resume.linkedin}</span>}
        {resume.github && <span>{resume.github}</span>}
        {resume.website && <span>{resume.website}</span>}
      </div>
      {resume.summary && <p className="mb-8 text-xs leading-relaxed">{resume.summary}</p>}
      {resume.experience.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-400 mb-3">Experience</h3>
          {resume.experience.map((exp) => (
            <div key={exp.id} className="mb-5">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-xs">{exp.role}</span>
                <span className="text-[10px] text-slate-400">{exp.startDate} – {exp.current ? "Present" : exp.endDate}</span>
              </div>
              <p className="text-xs text-slate-500">{exp.company}{exp.location ? ` · ${exp.location}` : ""}</p>
              <ul className="mt-1 space-y-0.5">
                {exp.bullets.filter(Boolean).map((b, i) => (
                  <li key={i} className="text-xs">• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {resume.education.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-400 mb-3">Education</h3>
          {resume.education.map((edu) => (
            <div key={edu.id} className="mb-1.5">
              <div className="flex justify-between items-baseline">
                <span className="font-semibold text-xs">{edu.degree} in {edu.field}</span>
                <span className="text-[10px] text-slate-400">{edu.startDate} – {edu.endDate}</span>
              </div>
              <p className="text-xs text-slate-500">{edu.institution}{edu.gpa ? ` · GPA: ${edu.gpa}` : ""}</p>
            </div>
          ))}
        </div>
      )}
      {resume.skills.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-400 mb-3">Skills</h3>
          <div className="flex flex-wrap gap-4">
            {resume.skills.map((s) => <span key={s} className="text-xs border border-slate-200 rounded-full px-4 py-0.5">{s}</span>)}
          </div>
        </div>
      )}
      {resume.projects.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-400 mb-3">Projects</h3>
          {resume.projects.map((p) => (
            <div key={p.id} className="mb-3">
              <span className="font-semibold text-xs">{p.name}</span>
              {p.url && <span className="text-[10px] text-slate-400 ml-1">{p.url}</span>}
              <p className="text-xs">{p.description}</p>
              {p.tech.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {p.tech.map((t) => <span key={t} className="text-[8px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {resume.certifications.length > 0 && (
        <div>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-semibold text-slate-400 mb-3">Certifications</h3>
          {resume.certifications.map((c) => (
            <p key={c.id} className="text-xs">{c.name} — {c.issuer} ({c.date})</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────
export function ResumeBuilderContent() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>("builder")
  const [copiedKey, setCopiedKey] = useState("")

  // AI states
  const [atsLoading, setAtsLoading] = useState(false)
  const [atsResult, setAtsResult] = useState<ATSScore | null>(null)
  const [tailorLoading, setTailorLoading] = useState(false)
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null)
  const [tailorJobDesc, setTailorJobDesc] = useState("")
  const [coverLoading, setCoverLoading] = useState(false)
  const [coverLetter, setCoverLetter] = useState("")
  const [coverJobDesc, setCoverJobDesc] = useState("")
  const [bulletLoading, setBulletLoading] = useState(false)
  const [bulletInput, setBulletInput] = useState("")
  const [bulletRoleContext, setBulletRoleContext] = useState("")
  const [bulletRewrites, setBulletRewrites] = useState<BulletRewrites | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file")
      return
    }
    setUploadLoading(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(",")[1] ?? "")
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
      })
      const res = await aiFetch("/api/resume-builder", { action: "parse-resume", base64 })
      const data = await res.json()
      if (data.ok) {
        const parsed = data.resume as Resume
        const r: Resume = { ...parsed, id: uid(), name: parsed.name || "Uploaded Resume", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        setResumes((prev) => { const next = [...prev, r]; save(next); return next })
        setActiveId(r.id)
        setTab("builder")
        toast.success("Resume parsed from PDF")
      } else {
        toast.error(data.error ?? "Failed to parse resume")
      }
    } catch (err) {
      toast.error(err instanceof AiKeyError ? err.message : "Failed to upload resume")
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  useEffect(() => {
    const loaded = load()
    setResumes(loaded)
    const savedActive = loadActive()
    if (savedActive && loaded.find((r) => r.id === savedActive)) {
      setActiveId(savedActive)
    } else if (loaded.length > 0) {
      setActiveId(loaded[0]!.id)
    }
  }, [])

  const activeResume = resumes.find((r) => r.id === activeId) ?? null

  const updateResume = useCallback((id: string, fn: (r: Resume) => Resume) => {
    setResumes((prev) => {
      const next = prev.map((r) => (r.id === id ? fn({ ...r, updatedAt: new Date().toISOString() }) : r))
      save(next)
      return next
    })
  }, [])

  function addResume() {
    const name = `Resume ${resumes.length + 1}`
    const r = newResume(name)
    setResumes((prev) => { const next = [...prev, r]; save(next); return next })
    setActiveId(r.id)
    saveActive(r.id)
  }

  function deleteResume(id: string) {
    setResumes((prev) => {
      const next = prev.filter((r) => r.id !== id)
      save(next)
      if (activeId === id) {
        const newActive = next[0]?.id ?? null
        setActiveId(newActive)
        if (newActive) saveActive(newActive)
      }
      return next
    })
  }

  function selectResume(id: string) {
    setActiveId(id)
    saveActive(id)
    setTab("builder")
  }

  // ── Copy helper ───────────────────────────────────────────────────────────
  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 1500)
  }

  // ── Print handler ──────────────────────────────────────────────────────────
  function handlePrint() { window.print() }

  // ── ATS Score ──────────────────────────────────────────────────────────────
  async function analyzeATS() {
    if (!activeResume) return
    setAtsLoading(true)
    setAtsResult(null)
    try {
      const res = await aiFetch("/api/resume-builder", { action: "analyze-ats", resume: activeResume })
      const data = await res.json()
      if (data.ok) setAtsResult(data.data)
      else toast.error(data.error || "Failed to analyze resume")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to analyze resume")
    } finally { setAtsLoading(false) }
  }

  // ── Tailor Resume ──────────────────────────────────────────────────────────
  async function tailorResume() {
    if (!activeResume || !tailorJobDesc.trim()) return
    setTailorLoading(true)
    setTailorResult(null)
    try {
      const res = await aiFetch("/api/resume-builder", { action: "tailor-resume", resume: activeResume, jobDescription: tailorJobDesc })
      const data = await res.json()
      if (data.ok) setTailorResult(data.data)
      else toast.error(data.error || "Failed to tailor resume")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to tailor resume")
    } finally { setTailorLoading(false) }
  }

  function applyTailoredBullet(tb: { section: string; itemId: string; bulletIndex: number; rewritten: string }) {
    if (!activeResume) return
    updateResume(activeResume.id, (r) => {
      const exp = r.experience.find((e) => e.id === tb.itemId)
      if (exp) {
        const bullets = [...exp.bullets]
        bullets[tb.bulletIndex] = tb.rewritten
        return { ...r, experience: r.experience.map((e) => e.id === tb.itemId ? { ...e, bullets } : e) }
      }
      return r
    })
    toast.success("Bullet updated")
  }

  // ── Cover Letter ───────────────────────────────────────────────────────────
  async function generateCoverLetter() {
    if (!activeResume || !coverJobDesc.trim()) return
    setCoverLoading(true)
    setCoverLetter("")
    try {
      const res = await aiFetch("/api/resume-builder", { action: "generate-cover-letter", resume: activeResume, jobDescription: coverJobDesc })
      const data = await res.json()
      if (data.ok) setCoverLetter(data.coverLetter)
      else toast.error(data.error || "Failed to generate cover letter")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to generate cover letter")
    } finally { setCoverLoading(false) }
  }

  // ── Bullet Rewriter ────────────────────────────────────────────────────────
  async function rewriteBullet() {
    if (!bulletInput.trim()) return
    setBulletLoading(true)
    setBulletRewrites(null)
    try {
      const res = await aiFetch("/api/resume-builder", { action: "rewrite-bullet", bullet: bulletInput, roleContext: bulletRoleContext })
      const data = await res.json()
      if (data.ok) setBulletRewrites(data.data)
      else toast.error(data.error || "Failed to rewrite bullet")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to rewrite bullet")
    } finally { setBulletLoading(false) }
  }

  // ── Summary Generator ──────────────────────────────────────────────────────
  async function generateSummary() {
    if (!activeResume) return
    setSummaryLoading(true)
    try {
      const res = await aiFetch("/api/resume-builder", { action: "generate-summary", resume: activeResume })
      const data = await res.json()
      if (data.ok) {
        updateResume(activeResume.id, (r) => ({ ...r, summary: data.summary }))
        toast.success("Summary generated")
      } else toast.error(data.error || "Failed to generate summary")
    } catch (e) {
      if (e instanceof AiKeyError) toast.error("Add your Gemini API key in Settings to use AI features.")
      else toast.error("Failed to generate summary")
    } finally { setSummaryLoading(false) }
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (resumes.length === 0) {
    return (
      <>
        <ToolHeader title="Resume Builder" icon={FileText} color="text-sky-600" badge="Career" />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-5" />
          <h2 className="text-2xl font-bold mb-3">No resumes yet</h2>
          <p className="text-muted-foreground text-sm mb-8">Create a new resume or upload an existing one.</p>
          <div className="flex items-center justify-center gap-5">
            <Button onClick={addResume}><Plus className="w-4 h-4" /> New Resume</Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}>
              {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload PDF
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />
        </div>
      </>
    )
  }

  if (!activeResume) return null

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "builder", label: "Builder", icon: <Pencil className="w-4 h-4" /> },
    { id: "preview", label: "Preview", icon: <Eye className="w-4 h-4" /> },
    { id: "ats", label: "ATS Score", icon: <Target className="w-4 h-4" /> },
    { id: "tailor", label: "Job Tailor", icon: <ArrowRight className="w-4 h-4" /> },
    { id: "cover", label: "Cover Letter", icon: <Mail className="w-4 h-4" /> },
    { id: "bullets", label: "Bullet Rewriter", icon: <Sparkles className="w-4 h-4" /> },
  ]

  return (
    <>
      <ToolHeader
        title="Resume Builder"
        icon={FileText}
        color="text-sky-600"
        badge="Career"
        actions={
          <div className="flex items-center gap-5">
            <select
              value={activeResume.template}
              onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, template: e.target.value as Resume["template"] }))}
              className="text-xs border border-input rounded-xl bg-transparent px-4 h-7"
            >
              {TEMPLATES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Download className="w-4 h-4" /> Print / PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadLoading}>
              {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Upload PDF
            </Button>
          </div>
        }
      />
      <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Resume list */}
        <div className="flex gap-5 mb-5 overflow-x-auto pb-2">
          {resumes.map((r) => (
            <button
              key={r.id}
              onClick={() => selectResume(r.id)}
              className={`shrink-0 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                r.id === activeId
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30"
              }`}
            >
              {r.name}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={addResume} className="shrink-0"><Plus className="w-4 h-4" /></Button>
          {resumes.length > 1 && (
            <Button variant="ghost" size="sm" onClick={() => deleteResume(activeResume.id)} className="shrink-0 text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1.5 border-b border-border mb-8 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-4 px-4 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Builder Tab ──────────────────────────────────────────────────── */}
        {tab === "builder" && (
          <div className="max-w-2xl space-y-8">
            {/* Resume name */}
            <Input
              placeholder="Resume name"
              value={activeResume.name}
              onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, name: e.target.value }))}
            />

            {/* Personal Info */}
            <Card>
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-5">
                  <Input placeholder="Full name" value={activeResume.fullName} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, fullName: e.target.value }))} />
                  <Input placeholder="Email" value={activeResume.email} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, email: e.target.value }))} />
                  <Input placeholder="Phone" value={activeResume.phone} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, phone: e.target.value }))} />
                  <Input placeholder="Location" value={activeResume.location} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, location: e.target.value }))} />
                  <Input placeholder="LinkedIn URL" value={activeResume.linkedin ?? ""} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, linkedin: e.target.value }))} />
                  <Input placeholder="GitHub URL" value={activeResume.github ?? ""} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, github: e.target.value }))} />
                  <Input placeholder="Website URL" value={activeResume.website ?? ""} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, website: e.target.value }))} className="col-span-2" />
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Summary
                  <Button variant="ghost" size="sm" onClick={generateSummary} disabled={summaryLoading}>
                    {summaryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    AI Generate
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Professional summary..."
                  value={activeResume.summary}
                  onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, summary: e.target.value }))}
                  rows={4}
                  className="leading-relaxed"
                />
              </CardContent>
            </Card>

            {/* Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Experience
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => updateResume(activeResume.id, (r) => ({
                      ...r, experience: [...r.experience, { id: uid(), company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] }]
                    }))}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {activeResume.experience.map((exp, ei) => (
                  <div key={exp.id} className="border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Experience {ei + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.filter((e) => e.id !== exp.id) }))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <Input placeholder="Role" value={exp.role} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, role: e.target.value } : x) }))} />
                      <Input placeholder="Company" value={exp.company} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, company: e.target.value } : x) }))} />
                      <Input placeholder="Location" value={exp.location} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, location: e.target.value } : x) }))} />
                      <Input placeholder="Start date" value={exp.startDate} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, startDate: e.target.value } : x) }))} />
                      <Input placeholder="End date" value={exp.endDate} disabled={exp.current} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, endDate: e.target.value } : x) }))} />
                      <label className="flex items-center gap-5 text-xs">
                        <input type="checkbox" checked={exp.current} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, current: e.target.checked } : x) }))} />
                        Current
                      </label>
                    </div>
                    <div className="space-y-1">
                      {exp.bullets.map((b, bi) => (
                        <div key={bi} className="flex gap-1.5">
                          <Input
                            placeholder={`Bullet point ${bi + 1}`}
                            value={b}
                            onChange={(e) => updateResume(activeResume.id, (r) => ({
                              ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, bullets: x.bullets.map((bb, bbi) => bbi === bi ? e.target.value : bb) } : x)
                            }))}
                          />
                          <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({
                            ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, bullets: x.bullets.filter((_, bbi) => bbi !== bi) } : x)
                          }))}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => updateResume(activeResume.id, (r) => ({
                        ...r, experience: r.experience.map((x) => x.id === exp.id ? { ...x, bullets: [...x.bullets, ""] } : x)
                      }))}>
                        <Plus className="w-4 h-4" /> Add bullet
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Education */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Education
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => updateResume(activeResume.id, (r) => ({
                      ...r, education: [...r.education, { id: uid(), institution: "", degree: "", field: "", startDate: "", endDate: "", gpa: "" }]
                    }))}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {activeResume.education.map((edu, ei) => (
                  <div key={edu.id} className="border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Education {ei + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.filter((e) => e.id !== edu.id) }))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <Input placeholder="Institution" value={edu.institution} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, institution: e.target.value } : x) }))} />
                      <Input placeholder="Degree" value={edu.degree} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, degree: e.target.value } : x) }))} />
                      <Input placeholder="Field of study" value={edu.field} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, field: e.target.value } : x) }))} />
                      <Input placeholder="GPA (optional)" value={edu.gpa ?? ""} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, gpa: e.target.value } : x) }))} />
                      <Input placeholder="Start date" value={edu.startDate} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, startDate: e.target.value } : x) }))} />
                      <Input placeholder="End date" value={edu.endDate} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, education: r.education.map((x) => x.id === edu.id ? { ...x, endDate: e.target.value } : x) }))} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Skills */}
            <Card>
              <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
              <CardContent>
                <Input
                  placeholder="Comma-separated skills (e.g. React, TypeScript, Node.js)"
                  value={activeResume.skills.join(", ")}
                  onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, skills: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))}
                />
              </CardContent>
            </Card>

            {/* Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Projects
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => updateResume(activeResume.id, (r) => ({
                      ...r, projects: [...r.projects, { id: uid(), name: "", description: "", bullets: [""], url: "", tech: [] }]
                    }))}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {activeResume.projects.map((p, pi) => (
                  <div key={p.id} className="border border-border rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Project {pi + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({ ...r, projects: r.projects.filter((x) => x.id !== p.id) }))}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <Input placeholder="Project name" value={p.name} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x) }))} />
                      <Input placeholder="URL (optional)" value={p.url ?? ""} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, url: e.target.value } : x) }))} />
                    </div>
                    <Textarea placeholder="Description" value={p.description} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, description: e.target.value } : x) }))} rows={2} />
                    <Input placeholder="Technologies (comma-separated)" value={p.tech.join(", ")} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, tech: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x) }))} />
                    <div className="space-y-1">
                      {p.bullets.map((b, bi) => (
                        <div key={bi} className="flex gap-1.5">
                          <Input
                            placeholder={`Bullet ${bi + 1}`}
                            value={b}
                            onChange={(e) => updateResume(activeResume.id, (r) => ({
                              ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, bullets: x.bullets.map((bb, bbi) => bbi === bi ? e.target.value : bb) } : x)
                            }))}
                          />
                          <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({
                            ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, bullets: x.bullets.filter((_, bbi) => bbi !== bi) } : x)
                          }))}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" onClick={() => updateResume(activeResume.id, (r) => ({
                        ...r, projects: r.projects.map((x) => x.id === p.id ? { ...x, bullets: [...x.bullets, ""] } : x)
                      }))}>
                        <Plus className="w-4 h-4" /> Add bullet
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Certifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Certifications
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => updateResume(activeResume.id, (r) => ({
                      ...r, certifications: [...r.certifications, { id: uid(), name: "", issuer: "", date: "" }]
                    }))}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeResume.certifications.map((c) => (
                  <div key={c.id} className="flex gap-5 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-5">
                      <Input placeholder="Certification name" value={c.name} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, certifications: r.certifications.map((x) => x.id === c.id ? { ...x, name: e.target.value } : x) }))} />
                      <Input placeholder="Issuer" value={c.issuer} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, certifications: r.certifications.map((x) => x.id === c.id ? { ...x, issuer: e.target.value } : x) }))} />
                      <Input placeholder="Date" value={c.date} onChange={(e) => updateResume(activeResume.id, (r) => ({ ...r, certifications: r.certifications.map((x) => x.id === c.id ? { ...x, date: e.target.value } : x) }))} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => updateResume(activeResume.id, (r) => ({ ...r, certifications: r.certifications.filter((x) => x.id !== c.id) }))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Preview Tab ──────────────────────────────────────────────────── */}
        {tab === "preview" && (
          <div className="max-w-3xl mx-auto">
            <div className="print:hidden mb-5 flex items-center gap-5">
              <Button variant="outline" size="sm" onClick={handlePrint}><Download className="w-4 h-4" /> Print / Save PDF</Button>
              <span className="text-xs text-muted-foreground">Template: {activeResume.template}</span>
            </div>
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              <ResumePreview resume={activeResume} />
            </div>
          </div>
        )}

        {/* ── ATS Score Tab ─────────────────────────────────────────────────── */}
        {tab === "ats" && (
          <div className="max-w-2xl space-y-8">
            <Button onClick={analyzeATS} disabled={atsLoading}>
              {atsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
              Analyze Resume
            </Button>
            {atsResult && (
              <div className="space-y-5">
                {/* Score circle */}
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                      <circle
                        cx="50" cy="50" r="45" fill="none" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(atsResult.overall / 100) * 283} 283`}
                        className={atsResult.overall >= 80 ? "stroke-green-500" : atsResult.overall >= 60 ? "stroke-amber-500" : "stroke-red-500"}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold">{atsResult.overall}</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">ATS Score</h3>
                    <p className="text-sm text-muted-foreground">
                      {atsResult.overall >= 80 ? "Great! Your resume is ATS-friendly." : atsResult.overall >= 60 ? "Decent. Some improvements needed." : "Needs work. Several issues to fix."}
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <Card>
                  <CardHeader><CardTitle>Score Breakdown</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(atsResult.breakdown).map(([key, val]) => {
                        const max = key === "contentQuality" ? 35 : key === "atsReadability" || key === "jobMatch" ? 25 : key === "writingQuality" ? 10 : 5
                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
                        return (
                          <div key={key} className="flex items-center gap-5">
                            <span className="text-xs w-40 shrink-0">{label}</span>
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${val / max >= 0.7 ? "bg-green-500" : val / max >= 0.4 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${(val / max) * 100}%` }} />
                            </div>
                            <span className="text-xs font-mono w-12 text-right">{val}/{max}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Strengths + Improvements */}
                <div className="grid grid-cols-2 gap-5">
                  <Card>
                    <CardHeader><CardTitle className="text-green-600">Strengths</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {atsResult.strengths.map((s, i) => <li key={i} className="text-xs">✓ {s}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle className="text-amber-600">Improvements</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {atsResult.improvements.map((s, i) => <li key={i} className="text-xs">✗ {s}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                </div>

                {/* Missing Keywords */}
                {atsResult.missingKeywords.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Missing Keywords</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        {atsResult.missingKeywords.map((k) => (
                          <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bullet Rewrites */}
                {atsResult.recommendedBulletRewrites.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Recommended Bullet Rewrites</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {atsResult.recommendedBulletRewrites.map((br, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-xs text-destructive line-through">{br.original}</p>
                          <div className="flex items-start gap-5">
                            <p className="text-xs text-green-600 flex-1">{br.rewritten}</p>
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => copyText(br.rewritten, `br-${i}`)}
                            >
                              {copiedKey === `br-${i}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Job Tailor Tab ────────────────────────────────────────────────── */}
        {tab === "tailor" && (
          <div className="max-w-2xl space-y-5">
            <Textarea
              placeholder="Paste the job description here..."
              value={tailorJobDesc}
              onChange={(e) => setTailorJobDesc(e.target.value)}
              rows={6}
              className="leading-relaxed"
            />
            <Button onClick={tailorResume} disabled={tailorLoading || !tailorJobDesc.trim()}>
              {tailorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Tailor Resume
            </Button>
            {tailorResult && (
              <div className="space-y-5">
                {/* Tailored Summary */}
                <Card>
                  <CardHeader><CardTitle>Tailored Summary</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm">{tailorResult.tailoredSummary}</p>
                    <Button variant="ghost" size="sm" className="mt-2" onClick={() => {
                      updateResume(activeResume.id, (r) => ({ ...r, summary: tailorResult.tailoredSummary }))
                      toast.success("Summary updated")
                    }}>Apply Summary</Button>
                  </CardContent>
                </Card>

                {/* Suggested Skills */}
                {tailorResult.suggestedSkills.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle>Suggested Skills to Add</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4">
                        {tailorResult.suggestedSkills.map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-xs cursor-pointer hover:bg-foreground hover:text-background"
                            onClick={() => {
                              updateResume(activeResume.id, (r) => ({ ...r, skills: [...r.skills, s] }))
                              toast.success(`Added "${s}" to skills`)
                            }}
                          >
                            + {s}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Bullet Changes */}
                {tailorResult.tailoredBullets.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Bullet Rewrites
                        <Button variant="ghost" size="sm" onClick={() => {
                          tailorResult.tailoredBullets.forEach((tb) => applyTailoredBullet(tb))
                        }}>
                          Accept All
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {tailorResult.tailoredBullets.map((tb, i) => (
                        <div key={i} className="border border-border rounded-xl p-5 space-y-1">
                          <p className="text-xs text-destructive line-through">{tb.original}</p>
                          <p className="text-xs text-green-600">{tb.rewritten}</p>
                          <div className="flex gap-1.5 mt-1">
                            <Button variant="ghost" size="sm" onClick={() => applyTailoredBullet(tb)}>
                              <Check className="w-4 h-4" /> Accept
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => copyText(tb.rewritten, `tb-${i}`)}>
                              {copiedKey === `tb-${i}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Cover Letter Tab ──────────────────────────────────────────────── */}
        {tab === "cover" && (
          <div className="max-w-2xl space-y-5">
            <Textarea
              placeholder="Paste the job description (required)..."
              value={coverJobDesc}
              onChange={(e) => setCoverJobDesc(e.target.value)}
              rows={6}
              className="leading-relaxed"
            />
            <Button onClick={generateCoverLetter} disabled={coverLoading || !coverJobDesc.trim()}>
              {coverLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Generate Cover Letter
            </Button>
            {coverLetter && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Cover Letter
                    <Button variant="ghost" size="sm" onClick={() => copyText(coverLetter, "cover")}>
                      {copiedKey === "cover" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} rows={12} className="text-sm leading-relaxed" />
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Bullet Rewriter Tab ────────────────────────────────────────────── */}
        {tab === "bullets" && (
          <div className="max-w-2xl space-y-5">
            <Textarea
              placeholder="Enter a bullet point to rewrite..."
              value={bulletInput}
              onChange={(e) => setBulletInput(e.target.value)}
              rows={3}
              className="leading-relaxed"
            />
            <Input
              placeholder="Role context (optional, e.g. Senior Frontend Engineer)"
              value={bulletRoleContext}
              onChange={(e) => setBulletRoleContext(e.target.value)}
            />
            <Button onClick={rewriteBullet} disabled={bulletLoading || !bulletInput.trim()}>
              {bulletLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Rewrite
            </Button>
            {bulletRewrites && (
              <div className="space-y-4">
                {(["conservative", "moderate", "aggressive"] as const).map((level) => (
                  <Card key={level}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="capitalize">{level}</span>
                        <div className="flex gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => { setBulletInput(bulletRewrites[level]); setBulletRewrites(null) }}>
                            Use as input
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => copyText(bulletRewrites[level], level)}>
                            {copiedKey === level ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{bulletRewrites[level]}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
