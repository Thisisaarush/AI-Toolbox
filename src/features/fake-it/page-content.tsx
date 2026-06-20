"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Database, Copy, RefreshCw, Table, Code, FileSpreadsheet,
  Plus, Minus, Check,
} from "lucide-react"

// ── Helpers ─────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ── Data Pools ───────────────────────────────────────────────────

const FIRST_NAMES = [
  "Alice","Bob","Charlie","Diana","Ethan","Fiona","George","Hannah",
  "Ivan","Julia","Kevin","Laura","Michael","Nora","Oliver","Patricia",
  "Quinn","Rachel","Samuel","Tina","Uma","Victor","Wendy","Xavier",
  "Yvonne","Zach","Amelia","Benjamin","Charlotte","Daniel","Elizabeth",
  "Frank","Grace","Henry","Isabella",
] as const

const LAST_NAMES = [
  "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller",
  "Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez",
  "Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
  "Lee","Perez","Thompson","White","Harris","Sanchez","Clark",
  "Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright",
] as const

const EMAIL_DOMAINS = [
  "gmail.com","outlook.com","yahoo.com","proton.me","icloud.com",
  "aol.com","mail.com","zoho.com","fastmail.com",
] as const

const CITIES = [
  "New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia",
  "San Antonio","San Diego","Dallas","Austin","Jacksonville","Fort Worth",
  "Columbus","Charlotte","Indianapolis","San Francisco","Seattle","Denver",
  "Nashville","Portland","Memphis","Las Vegas","Louisville","Baltimore",
  "Milwaukee","Albuquerque","Tucson","Fresno",
] as const

const STATES = [
  "California","Texas","Florida","New York","Illinois","Pennsylvania",
  "Ohio","Georgia","North Carolina","Michigan","New Jersey","Virginia",
  "Washington","Arizona","Massachusetts",
] as const

const COUNTRIES = [
  "United States","Canada","United Kingdom","Germany","France","Spain",
  "Italy","Australia","Japan","Brazil","Mexico","Netherlands","Sweden",
  "Switzerland","India",
] as const

const COMPANIES = [
  "Acme Corp","Globex Inc","Initech","Hooli","Stark Industries",
  "Wayne Enterprises","Umbrella Corp","Cyberdyne Systems","Soylent Corp",
  "Wonka Industries","Massive Dynamic","Oscorp","LexCorp","Tyrell Corp",
  "Weyland-Yutani","Pied Piper","Dunder Mifflin","Sterling Cooper",
  "Oceanic Airlines","Buy n Large","Westworld","Kingsman","Virtucon",
  "Genco Purity","Bluth Company",
] as const

const JOB_TITLES = [
  "Software Engineer","Product Manager","Data Scientist","UX Designer",
  "DevOps Engineer","Marketing Manager","Sales Representative",
  "Financial Analyst","HR Coordinator","Project Manager","Graphic Designer",
  "Content Writer","Business Analyst","Customer Success Manager",
  "QA Engineer","Solutions Architect","Brand Manager","Operations Manager",
  "Research Scientist","Account Executive","Technical Writer","Art Director",
  "Chief Technology Officer","VP of Engineering","Director of Marketing",
] as const

const LOREM_SENTENCES = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
  "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis.",
  "Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit.",
  "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
] as const

const STREET_NAMES = [
  "Main Street","Oak Avenue","Maple Drive","Elm Street","Pine Lane",
  "Cedar Road","Birch Boulevard","Walnut Way","Cherry Street",
  "Forest Avenue","Lake Drive","Hill Road","River Road","Park Avenue",
  "Sunset Boulevard","Broadway","Church Street","Market Street",
  "Washington Street","Lincoln Avenue",
] as const

// ── Types ────────────────────────────────────────────────────────

type FieldId =
  | "name" | "email" | "phone" | "address" | "city" | "state" | "zip"
  | "country" | "company" | "jobTitle" | "avatarUrl" | "id" | "dob"
  | "creditCard" | "loremIpsum"

interface FieldState {
  id: FieldId
  label: string
  enabled: boolean
}

type OutputFormat = "plain-json" | "pretty-json" | "csv"

type DataRow = Record<string, string>

// ── Field Definitions ────────────────────────────────────────────

const ALL_FIELDS: FieldState[] = [
  { id: "name", label: "Name", enabled: true },
  { id: "email", label: "Email", enabled: false },
  { id: "phone", label: "Phone", enabled: false },
  { id: "address", label: "Address", enabled: false },
  { id: "city", label: "City", enabled: false },
  { id: "state", label: "State", enabled: false },
  { id: "zip", label: "ZIP", enabled: false },
  { id: "country", label: "Country", enabled: false },
  { id: "company", label: "Company", enabled: false },
  { id: "jobTitle", label: "Job Title", enabled: false },
  { id: "avatarUrl", label: "Avatar URL", enabled: false },
  { id: "id", label: "ID", enabled: false },
  { id: "dob", label: "Date of Birth", enabled: false },
  { id: "creditCard", label: "Credit Card", enabled: false },
  { id: "loremIpsum", label: "Lorem Ipsum", enabled: false },
]

// ── Generation Helpers ───────────────────────────────────────────

function generatePhone(): string {
  return `(555) ${rng(100, 999)}-${rng(1000, 9999)}`
}

function generateZip(): string {
  return String(rng(10000, 99999))
}

function generateCreditCard(): string {
  return `XXXX-XXXX-XXXX-${rng(1000, 9999)}`
}

function generateDateOfBirth(): string {
  const year = rng(1950, 2005)
  const month = rng(1, 12)
  const day = rng(1, 28)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// ── LocalStorage ─────────────────────────────────────────────────

const STORAGE_KEY = "fake-it-v1"

interface SavedState {
  fields: { id: FieldId; enabled: boolean }[]
  count: number
}

function loadSavedState(): SavedState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as SavedState
  } catch { /* ignore */ }
  return null
}

function persistState(state: SavedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

// ── Row Generation ───────────────────────────────────────────────

function generateRow(fields: FieldId[]): DataRow {
  const first = pick(FIRST_NAMES)
  const last = pick(LAST_NAMES)
  const name = `${first} ${last}`

  const row: DataRow = {}

  for (const id of fields) {
    switch (id) {
      case "name":
        row[id] = name
        break
      case "email":
        row[id] = `${first.toLowerCase()}.${last.toLowerCase()}@${pick(EMAIL_DOMAINS)}`
        break
      case "phone":
        row[id] = generatePhone()
        break
      case "address":
        row[id] = `${rng(100, 9999)} ${pick(STREET_NAMES)}`
        break
      case "city":
        row[id] = pick(CITIES)
        break
      case "state":
        row[id] = pick(STATES)
        break
      case "zip":
        row[id] = generateZip()
        break
      case "country":
        row[id] = pick(COUNTRIES)
        break
      case "company":
        row[id] = pick(COMPANIES)
        break
      case "jobTitle":
        row[id] = pick(JOB_TITLES)
        break
      case "avatarUrl":
        row[id] = `https://i.pravatar.cc/150?u=${uid()}`
        break
      case "id":
        row[id] = `ID-${uid().toUpperCase()}`
        break
      case "dob":
        row[id] = generateDateOfBirth()
        break
      case "creditCard":
        row[id] = generateCreditCard()
        break
      case "loremIpsum":
        row[id] = pick(LOREM_SENTENCES)
        break
    }
  }

  return row
}

// ── Copy ─────────────────────────────────────────────────────────

function copyToClipboard(text: string, label = "Copied") {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(label))
    .catch(() => toast.error("Failed to copy"))
}

// ── CSV ──────────────────────────────────────────────────────────

function toCSV(data: DataRow[], fields: FieldState[]): string {
  const active = fields.filter((f) => f.enabled)
  const headers = active.map((f) => f.label)
  const rows = data.map((row) =>
    active
      .map((f) => {
        const val = row[f.id] ?? ""
        return val.includes(",") || val.includes('"') || val.includes("\n")
          ? `"${val.replace(/"/g, '""')}"`
          : val
      })
      .join(","),
  )
  return [headers.join(","), ...rows].join("\n")
}

// ── Main Component ───────────────────────────────────────────────

export function FakeItContent() {
  const saved = loadSavedState()

  const [fields, setFields] = useState<FieldState[]>(() => {
    if (saved) {
      return ALL_FIELDS.map((f) => {
        const sf = saved.fields.find((x) => x.id === f.id)
        return { ...f, enabled: sf ? sf.enabled : f.enabled }
      })
    }
    return ALL_FIELDS
  })

  const [count, setCount] = useState(() => saved?.count ?? 10)
  const [data, setData] = useState<DataRow[]>([])
  const [format, setFormat] = useState<OutputFormat>("pretty-json")

  useEffect(() => {
    persistState({
      fields: fields.map((f) => ({ id: f.id, enabled: f.enabled })),
      count,
    })
  }, [fields, count])

  const enabledFields = useMemo(() => fields.filter((f) => f.enabled), [fields])

  const toggleField = useCallback((id: FieldId) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f)))
  }, [])

  const toggleAll = useCallback(() => {
    const allOn = enabledFields.length === ALL_FIELDS.length
    setFields((prev) => prev.map((f) => ({ ...f, enabled: !allOn })))
  }, [enabledFields.length])

  const handleGenerate = useCallback(() => {
    if (enabledFields.length === 0) {
      toast.error("Select at least one field")
      return
    }
    const ids = fields.filter((f) => f.enabled).map((f) => f.id)
    const generated = Array.from({ length: count }, () => generateRow(ids))
    setData(generated)
    toast.success(`Generated ${count} rows`)
  }, [fields, count, enabledFields.length])

  const handleCopyJSON = useCallback(() => {
    if (data.length === 0) { toast.error("No data to copy"); return }
    copyToClipboard(JSON.stringify(data, null, 2), "JSON copied")
  }, [data])

  const handleCopyCSV = useCallback(() => {
    if (data.length === 0) { toast.error("No data to copy"); return }
    copyToClipboard(toCSV(data, fields), "CSV copied")
  }, [data, fields])

  const handleCopyFormatted = useCallback(() => {
    if (data.length === 0) { toast.error("No data to copy"); return }
    if (format === "csv") {
      copyToClipboard(toCSV(data, fields), "CSV copied")
    } else if (format === "plain-json") {
      copyToClipboard(JSON.stringify(data), "JSON copied")
    } else {
      copyToClipboard(JSON.stringify(data, null, 2), "JSON copied")
    }
  }, [data, format, fields])

  const formatLabel = format === "csv" ? "CSV" : format === "plain-json" ? "Plain JSON" : "Pretty JSON"

  // ── Render ──────────────────────────────────────────────────

  return (
    <>
      <ToolHeader title="Fake Data Generator" icon={Database} color="text-blue-500" badge="Data" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-7">

        {/* ── Fields ─────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Fields</h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                {enabledFields.length}/{ALL_FIELDS.length}
              </Badge>
              <button
                onClick={toggleAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {enabledFields.length === ALL_FIELDS.length ? "Deselect all" : "Select all"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {fields.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleField(f.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                  f.enabled
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                {f.enabled && <Check className="w-3 h-3 shrink-0" />}
                {f.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Row Count ──────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Rows</h2>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount(Math.max(1, count - 1))}
              disabled={count <= 1}
              aria-label="Decrease row count"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
              className="w-20 h-9 text-center text-sm font-mono rounded-xl border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCount(Math.min(100, count + 1))}
              disabled={count >= 100}
              aria-label="Increase row count"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <input
              type="range"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-32 h-2 rounded-full appearance-none cursor-pointer bg-muted/50 accent-blue-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:shadow-md"
            />
            <span className="text-xs text-muted-foreground">1 – 100</span>
          </div>
        </section>

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={handleGenerate} disabled={enabledFields.length === 0}>
            <Database className="w-4 h-4" /> Generate
          </Button>
          <div className="w-px h-6 bg-border/50" />
          <Button variant="outline" size="sm" onClick={handleCopyJSON} disabled={data.length === 0}>
            <Code className="w-4 h-4" /> Copy JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopyCSV} disabled={data.length === 0}>
            <FileSpreadsheet className="w-4 h-4" /> Copy CSV
          </Button>
          {data.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setData([])}>
              <RefreshCw className="w-4 h-4" /> Clear
            </Button>
          )}
        </div>

        {/* ── Output Format ──────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Output Format</h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/50">
              {([
                { id: "plain-json" as const, label: "Plain JSON", icon: Code },
                { id: "pretty-json" as const, label: "Pretty JSON", icon: Code },
                { id: "csv" as const, label: "CSV", icon: FileSpreadsheet },
              ]).map((opt) => {
                const Icon = opt.icon
                const active = format === opt.id
                return (
                  <button
                    key={opt.id}
                    onClick={() => setFormat(opt.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyFormatted}
              disabled={data.length === 0}
            >
              <Copy className="w-4 h-4" /> Copy as {formatLabel}
            </Button>
          </div>
        </section>

        {/* ── Table / Preview ────────────────────────────────── */}
        {data.length > 0 && enabledFields.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                <Table className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Generated Data
              </h2>
              <Badge variant="secondary" className="text-xs font-mono">
                {data.length} row{data.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/60">
                    <th className="sticky top-0 bg-muted/50 px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">
                      #
                    </th>
                    {enabledFields.map((f) => (
                      <th
                        key={f.id}
                        className="sticky top-0 bg-muted/50 px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.map((row, i) => (
                    <tr
                      key={i}
                      className={`${i % 2 === 0 ? "bg-background" : "bg-muted/15"} hover:bg-muted/25 transition-colors`}
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">{i + 1}</td>
                      {enabledFields.map((f) => (
                        <td
                          key={f.id}
                          className="px-4 py-2.5 text-foreground max-w-[260px] truncate"
                          title={row[f.id]}
                        >
                          {row[f.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Code preview */}
            <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-muted/20">
                <span className="text-xs font-medium text-muted-foreground">
                  {format === "csv" ? "CSV" : format === "plain-json" ? "Plain JSON" : "Pretty JSON"}
                </span>
                <Button size="sm" variant="ghost" onClick={handleCopyFormatted}>
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto max-h-72 text-foreground/80 leading-relaxed">
                <code>
                  {format === "csv"
                    ? toCSV(data, fields)
                    : format === "plain-json"
                      ? JSON.stringify(data)
                      : JSON.stringify(data, null, 2)}
                </code>
              </pre>
            </div>
          </section>
        )}

        {/* ── Empty State ───────────────────────────────────── */}
        {data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/60 rounded-xl text-center">
            <Database className="w-12 h-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-1">No data generated yet</p>
            <p className="text-xs text-muted-foreground/60">
              Select fields, set row count, and click Generate
            </p>
          </div>
        )}
      </div>
    </>
  )
}
