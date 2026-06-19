"use client"

import { useState, useMemo, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Code2, TreePine, Columns3, FileJson, Table2, Search,
  Copy, AlertCircle, ChevronRight, ChevronDown, ChevronUp,
  Braces, ArrowLeftRight, Trash2, CheckCircle2, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { JsonValue, JsonTab, SearchResult, DiffLine, DiffLineType } from "./types"

const STORAGE_KEY = "json-studio-v1"

// ── Helpers ──────────────────────────────────────────────────────────────

function tryParse(text: string): { ok: true; data: JsonValue } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) as JsonValue }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function formatJSON(data: JsonValue): string {
  return JSON.stringify(data, null, 2)
}

function minifyJSON(data: JsonValue): string {
  return JSON.stringify(data)
}

function getType(v: JsonValue): string {
  if (v === null) return "null"
  if (Array.isArray(v)) return `array[${v.length}]`
  return typeof v
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("Copied")).catch(() => toast.error("Failed to copy"))
}

function uid(): string { return Math.random().toString(36).slice(2, 8) }

// ── Simple line diff ─────────────────────────────────────────────────────

function computeDiff(a: string, b: string): DiffLine[] {
  const linesA = a.split("\n")
  const linesB = b.split("\n")
  const result: DiffLine[] = []
  const maxLen = Math.max(linesA.length, linesB.length)
  for (let i = 0; i < maxLen; i++) {
    const la: string | null = i < linesA.length ? (linesA[i] ?? null) : null
    const lb: string | null = i < linesB.length ? (linesB[i] ?? null) : null
    if (la === lb) {
      result.push({ type: "unchanged", text: la ?? "", lineNumA: la !== null ? i + 1 : null, lineNumB: lb !== null ? i + 1 : null })
    } else {
      if (la !== null) result.push({ type: "removed", text: la, lineNumA: i + 1, lineNumB: null })
      if (lb !== null) result.push({ type: "added", text: lb, lineNumA: null, lineNumB: i + 1 })
    }
  }
  return result
}

// ── Schema inference ─────────────────────────────────────────────────────

function inferSchema(v: JsonValue): Record<string, unknown> {
  if (v === null) return { type: "null" }
  if (typeof v === "string") return { type: "string" }
  if (typeof v === "number") return { type: "number" }
  if (typeof v === "boolean") return { type: "boolean" }
  if (Array.isArray(v)) {
    if (v.length === 0) return { type: "array", items: { type: "unknown" } }
    const itemTypes = v.map(inferSchema)
    const merged = mergeSchemas(itemTypes)
    return { type: "array", items: merged }
  }
  const props: Record<string, Record<string, unknown>> = {}
  const required: string[] = []
  for (const [key, val] of Object.entries(v)) {
    props[key] = inferSchema(val as JsonValue)
    required.push(key)
  }
  return { type: "object", properties: props, required }
}

function mergeSchemas(schemas: Record<string, unknown>[]): Record<string, unknown> {
  if (schemas.length === 0) return { type: "unknown" }
  const types = [...new Set(schemas.map((s) => s.type as string))]
  if (types.length === 1 && types[0] === "object") {
    const allKeys = new Set<string>()
    schemas.forEach((s) => { if (s.properties) Object.keys(s.properties as Record<string, unknown>).forEach((k) => allKeys.add(k)) })
    const mergedProps: Record<string, Record<string, unknown>> = {}
    for (const key of allKeys) {
      const propSchemas = schemas.map((s) => (s.properties as Record<string, Record<string, unknown>>)?.[key]).filter(Boolean) as Record<string, unknown>[]
      mergedProps[key] = propSchemas.length ? mergeSchemas(propSchemas) : { type: "unknown" }
    }
    return { type: "object", properties: mergedProps }
  }
  return { type: types.length === 1 ? types[0] : types.join(" | ") }
}

// ── JSON to CSV ──────────────────────────────────────────────────────────

function jsonToCSV(data: JsonValue): string {
  if (!Array.isArray(data) || data.length === 0) return ""
  const keys = new Set<string>()
  data.forEach((item) => {
    if (typeof item === "object" && item !== null && !Array.isArray(item)) {
      Object.keys(item as Record<string, unknown>).forEach((k) => keys.add(k))
    }
  })
  const keyArr = [...keys]
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = keyArr.map(esc).join(",")
  const rows = data.map((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return esc(String(item))
    }
    const obj = item as Record<string, JsonValue>
    return keyArr.map((k) => esc(k in obj ? String(obj[k] ?? "") : "")).join(",")
  })
  return [header, ...rows].join("\n")
}

function csvToJSON(text: string): { ok: true; data: JsonValue } | { ok: false; error: string } {
  try {
    const lines = text.trim().split("\n")
    if (lines.length < 2) return { ok: true, data: [] }
    const header = parseCSVLine(lines[0]!)
    const rows = lines.slice(1).map(parseCSVLine)
    const data = rows.map((row) => {
      const obj: Record<string, JsonValue> = {}
      header.forEach((h, i) => {
        let val: JsonValue = row[i]?.trim() ?? ""
        if (val === "") val = null
        else if (!isNaN(Number(val))) val = Number(val)
        else if (val === "true") val = true
        else if (val === "false") val = false
        obj[h] = val
      })
      return obj
    })
    return { ok: true, data }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = ""
    } else { current += ch }
  }
  result.push(current)
  return result
}

// ── Search ───────────────────────────────────────────────────────────────

function searchJSON(data: JsonValue, query: string, path = "$"): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: SearchResult[] = []
  function walk(v: JsonValue, currentPath: string, key: string) {
    const strVal = String(v)
    if (key.toLowerCase().includes(q) || strVal.toLowerCase().includes(q)) {
      results.push({ path: currentPath, key, value: strVal.length > 100 ? strVal.slice(0, 100) + "..." : strVal, type: getType(v) })
    }
    if (typeof v === "object" && v !== null) {
      if (Array.isArray(v)) {
        v.forEach((item, i) => walk(item as JsonValue, `${currentPath}[${i}]`, String(i)))
      } else {
        Object.entries(v as Record<string, JsonValue>).forEach(([k, val]) => walk(val, `${currentPath}.${k}`, k))
      }
    }
  }
  walk(data, path, "root")
  return results
}

// ── Tree Node Component ──────────────────────────────────────────────────

function TreeNode({ value, path, depth, defaultOpen }: {
  value: JsonValue
  path: string
  depth: number
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(depth < 2 || defaultOpen)
  const isObj = typeof value === "object" && value !== null && !Array.isArray(value)
  const isArr = Array.isArray(value)
  const isExpandable = isObj || isArr
  const entries = isObj ? Object.entries(value as Record<string, JsonValue>) : isArr ? (value as JsonValue[]).map((v, i) => [String(i), v] as const) : []
  const empty = isExpandable && entries.length === 0

  if (!isExpandable) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 group cursor-pointer transition-colors" onClick={() => copy(path)} title="Click to copy path">
        <span className="text-sm text-muted-foreground font-mono truncate max-w-[240px]">{path.split(".").pop()?.split("[").pop()?.replace("]", "")}: </span>
        <PrimitiveBadge value={value} />
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/50 w-full text-left group transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <span className="text-sm font-mono text-foreground font-medium truncate">
          {path === "$" ? "root" : path.split(".").pop()?.split("[").pop()?.replace("]", "")}
        </span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 ml-1.5">{isObj ? `{${entries.length}}` : `[${entries.length}]`}</Badge>
      </button>
      {open && !empty && (
        <div className="ml-6 border-l-2 border-border/40 pl-3 mt-1">
          {entries.map(([k, v]) => (
            <TreeNode key={`${path}.${k}`} value={v as JsonValue} path={`${path}.${k}`} depth={depth + 1} defaultOpen={depth < 1} />
          ))}
        </div>
      )}
      {open && empty && <div className="ml-6 text-sm text-muted-foreground italic pl-3 py-1">(empty)</div>}
    </div>
  )
}

function PrimitiveBadge({ value }: { value: JsonValue }) {
  const colors: Record<string, string> = {
    string: "text-green-600 dark:text-green-400",
    number: "text-blue-600 dark:text-blue-400",
    boolean: "text-amber-600 dark:text-amber-400",
    null: "text-muted-foreground",
  }
  const display = value === null ? "null" : typeof value === "string" ? `"${value.length > 50 ? value.slice(0, 50) + "…" : value}"` : String(value)
  return <span className={`text-sm font-mono ${colors[typeof value] ?? ""}`}>{display}</span>
}

// ── Feature Card ─────────────────────────────────────────────────────────

function FeatureHighlight({ icon, label, description }: { icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-500">
        {icon}
      </div>
      <div>
        <div className="font-medium text-sm">{label}</div>
        <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

const TABS: { id: JsonTab; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "edit", label: "Editor", description: "Write, format, and validate JSON with live tree preview", icon: <Code2 className="w-4 h-4" /> },
  { id: "tree", label: "Tree", description: "Explore JSON structure with collapsible tree navigation", icon: <TreePine className="w-4 h-4" /> },
  { id: "diff", label: "Diff", description: "Compare two JSON documents side by side", icon: <Columns3 className="w-4 h-4" /> },
  { id: "schema", label: "Schema", description: "Infer JSON Schema from any JSON document", icon: <FileJson className="w-4 h-4" /> },
  { id: "csv", label: "CSV", description: "Convert between JSON and CSV formats", icon: <Table2 className="w-4 h-4" /> },
  { id: "search", label: "Search", description: "Find keys and values across your JSON tree", icon: <Search className="w-4 h-4" /> },
]

export function JsonStudioContent() {
  const [tab, setTab] = useState<JsonTab>("edit")

  // ── Edit tab ───────────────────────────────────────────────────────────
  const [editText, setEditText] = useState(`{\n  "name": "JSON Studio",\n  "version": 1,\n  "features": ["format", "tree", "diff", "schema", "csv", "search"],\n  "active": true,\n  "meta": {\n    "author": "Toolbox",\n    "published": "2026"\n  }\n}`)
  const [editError, setEditError] = useState("")
  const [minified, setMinified] = useState(false)

  const parsedEdit = useMemo(() => tryParse(editText), [editText])

  useEffect(() => {
    if (!parsedEdit.ok) setEditError(parsedEdit.error)
    else setEditError("")
  }, [parsedEdit])

  function handleFormat() {
    if (!parsedEdit.ok) { toast.error("Invalid JSON"); return }
    setEditText(minified ? formatJSON(parsedEdit.data) : minifyJSON(parsedEdit.data))
    setMinified(!minified)
    toast.success(minified ? "Minified" : "Formatted")
  }

  // ── Tree tab ───────────────────────────────────────────────────────────
  const [treeText, setTreeText] = useState(editText)
  const parsedTree = useMemo(() => tryParse(treeText), [treeText])

  // ── Diff tab ───────────────────────────────────────────────────────────
  const [diffA, setDiffA] = useState(editText)
  const [diffB, setDiffB] = useState("")
  const diffResult = useMemo(() => diffA && diffB ? computeDiff(diffA, diffB) : [], [diffA, diffB])

  // ── Schema tab ─────────────────────────────────────────────────────────
  const [schemaText, setSchemaText] = useState(editText)
  const parsedSchema = useMemo(() => tryParse(schemaText), [schemaText])
  const schemaOutput = useMemo(() => {
    if (!parsedSchema.ok) return ""
    const inferred = inferSchema(parsedSchema.data)
    return formatJSON(inferred as unknown as JsonValue)
  }, [parsedSchema])

  // ── CSV tab ────────────────────────────────────────────────────────────
  const [csvDirection, setCsvDirection] = useState<"to-csv" | "to-json">("to-csv")
  const [csvInput, setCsvInput] = useState(editText)
  const csvOutput = useMemo(() => {
    if (csvDirection === "to-csv") {
      const parsed = tryParse(csvInput)
      if (!parsed.ok) return parsed.error
      return jsonToCSV(parsed.data) || "(empty or non-array JSON)"
    }
    const result = csvToJSON(csvInput)
    if (!result.ok) return result.error
    return formatJSON(result.data)
  }, [csvDirection, csvInput])

  // ── Search tab ─────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState(editText)
  const [searchQuery, setSearchQuery] = useState("")
  const parsedSearch = useMemo(() => tryParse(searchText), [searchText])
  const searchResults = useMemo(() => {
    if (!parsedSearch.ok || !searchQuery.trim()) return []
    return searchJSON(parsedSearch.data, searchQuery)
  }, [parsedSearch, searchQuery])

  return (
    <>
      <ToolHeader title="JSON Studio" icon={Braces} color="text-blue-500" badge="Dev Tool" />

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Feature highlights ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-xl border text-left transition-all ${
                tab === t.id
                  ? "border-blue-500 bg-blue-500/10 shadow-sm"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-foreground/20"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                tab === t.id ? "bg-blue-500 text-white" : "bg-muted/50 text-muted-foreground"
              }`}>
                {t.icon}
              </div>
              <div>
                <div className={`font-semibold text-sm ${tab === t.id ? "text-blue-500" : "text-foreground"}`}>
                  {t.label}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {t.description}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── Edit Tab ──────────────────────────────────────────────── */}
        {tab === "edit" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant={minified ? "outline" : "default"} size="sm" onClick={handleFormat}>
                  {minified ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  {minified ? "Format" : "Minify"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { copy(editText) }}>
                  <Copy className="w-4 h-4" /> Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditText(""); setMinified(false) }}>
                  <Trash2 className="w-4 h-4" /> Clear
                </Button>
              </div>
              {parsedEdit.ok ? (
                <div className="flex items-center gap-1.5 text-sm text-green-500 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Valid JSON
                </div>
              ) : editText.trim() ? (
                <div className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                  <XCircle className="w-4 h-4" />
                  Invalid
                </div>
              ) : null}
            </div>

            {editError && (
              <div className="flex items-start gap-3 bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 border border-destructive/20">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-0.5">Parse Error</div>
                  <div className="font-mono text-sm opacity-90">{editError}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="relative">
                <div className="text-sm font-medium text-muted-foreground mb-2">JSON Input</div>
                <textarea
                  className="w-full h-[55vh] font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="Paste JSON here..."
                  spellCheck={false}
                />
                <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md">
                  {editText.split("\n").length} lines · {editText.length} chars
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Tree Preview</div>
                <div className="border border-input rounded-xl p-4 bg-muted/20 h-[55vh] overflow-y-auto">
                  {parsedEdit.ok ? (
                    <TreeNode value={parsedEdit.data} path="$" depth={0} defaultOpen={true} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                      Fix JSON errors to see the tree preview
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-4 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              Tip: Use <kbd className="px-1 py-0.5 bg-muted rounded text-[11px] font-mono">Format</kbd> to prettify your JSON and <kbd className="px-1 py-0.5 bg-muted rounded text-[11px] font-mono">Minify</kbd> to compress it
            </div>
          </div>
        )}

        {/* ── Tree Tab ──────────────────────────────────────────────── */}
        {tab === "tree" && (
          <div className="space-y-5">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">JSON Input</div>
              <textarea
                className="w-full h-48 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                value={treeText}
                onChange={(e) => setTreeText(e.target.value)}
                placeholder="Paste JSON here..."
                spellCheck={false}
              />
            </div>
            {!parsedTree.ok ? (
              <div className="flex items-start gap-3 bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 border border-destructive/20">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-0.5">Parse Error</div>
                  <div className="font-mono text-sm opacity-90">{parsedTree.error}</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Tree View</div>
                <div className="border border-input rounded-xl p-5 bg-muted/20 max-h-[60vh] overflow-y-auto">
                  <TreeNode value={parsedTree.data} path="$" depth={0} defaultOpen={true} />
                </div>
              </div>
            )}
            {parsedTree.ok && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                Click any node to copy its JSON path to your clipboard
              </div>
            )}
          </div>
        )}

        {/* ── Diff Tab ──────────────────────────────────────────────── */}
        {tab === "diff" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Original</div>
                <textarea
                  className="w-full h-52 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                  value={diffA}
                  onChange={(e) => setDiffA(e.target.value)}
                  placeholder="Paste the original JSON..."
                  spellCheck={false}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">Modified</div>
                <textarea
                  className="w-full h-52 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                  value={diffB}
                  onChange={(e) => setDiffB(e.target.value)}
                  placeholder="Paste the modified JSON..."
                  spellCheck={false}
                />
              </div>
            </div>

            {diffResult.length > 0 && (
              <div className="border border-input rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground flex items-center gap-4 border-b border-border">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {diffResult.filter((l) => l.type === "added").length} additions</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {diffResult.filter((l) => l.type === "removed").length} removals</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" /> {diffResult.filter((l) => l.type === "unchanged").length} unchanged</span>
                </div>
                <div className="max-h-[45vh] overflow-y-auto font-mono text-sm leading-relaxed">
                  {diffResult.map((line, i) => (
                    <div
                      key={i}
                      className={`flex items-stretch border-b border-border/20 ${
                        line.type === "added" ? "bg-green-500/10" : line.type === "removed" ? "bg-red-500/10" : ""
                      }`}
                    >
                      <span className="w-12 shrink-0 text-right pr-2 text-xs text-muted-foreground/50 py-1 select-none border-r border-border/20">
                        {line.lineNumA ?? ""}
                      </span>
                      <span className="w-12 shrink-0 text-right pr-2 text-xs text-muted-foreground/50 py-1 select-none border-r border-border/20">
                        {line.lineNumB ?? ""}
                      </span>
                      <span className={`shrink-0 w-5 text-center py-1 text-sm ${line.type === "added" ? "text-green-500" : line.type === "removed" ? "text-red-500" : "text-muted-foreground/30"}`}>
                        {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                      </span>
                      <span className="flex-1 px-3 py-1 whitespace-pre">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diffA && diffB && diffResult.length === 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/20 rounded-xl px-4 py-6 border border-dashed border-border">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Both documents are identical — no differences found
              </div>
            )}
          </div>
        )}

        {/* ── Schema Tab ────────────────────────────────────────────── */}
        {tab === "schema" && (
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">JSON Input</div>
              <textarea
                className="w-full h-48 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                value={schemaText}
                onChange={(e) => setSchemaText(e.target.value)}
                placeholder="Paste JSON to infer a schema from..."
                spellCheck={false}
              />
            </div>
            {!parsedSchema.ok ? (
              <div className="flex items-start gap-3 bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 border border-destructive/20">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-0.5">Parse Error</div>
                  <div className="font-mono text-sm opacity-90">{parsedSchema.error}</div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Inferred JSON Schema</div>
                    <div className="text-xs text-muted-foreground">Automatically generated from your JSON structure</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copy(schemaOutput)}>
                    <Copy className="w-4 h-4" /> Copy Schema
                  </Button>
                </div>
                <textarea
                  className="w-full h-72 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none leading-relaxed"
                  value={schemaOutput}
                  readOnly
                />
              </div>
            )}
            {parsedSchema.ok && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                The schema infers types, nested structures, array item types, and required fields from your data
              </div>
            )}
          </div>
        )}

        {/* ── CSV Tab ───────────────────────────────────────────────── */}
        {tab === "csv" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Button
                variant={csvDirection === "to-csv" ? "default" : "outline"}
                size="sm"
                onClick={() => setCsvDirection("to-csv")}
              >
                JSON → CSV
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCsvDirection(csvDirection === "to-csv" ? "to-json" : "to-csv")}
                className="text-muted-foreground"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </Button>
              <Button
                variant={csvDirection === "to-json" ? "default" : "outline"}
                size="sm"
                onClick={() => setCsvDirection("to-json")}
              >
                CSV → JSON
              </Button>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                {csvDirection === "to-csv" ? "JSON Input (array of objects)" : "CSV Input"}
              </div>
              <textarea
                className="w-full h-48 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder={csvDirection === "to-csv" ? "Paste a JSON array of objects to convert to CSV..." : "Paste CSV to convert back to JSON..."}
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Output</div>
                  <div className="text-xs text-muted-foreground">{csvDirection === "to-csv" ? "CSV" : "JSON"} result</div>
                </div>
                <Button
                  variant="outline" size="sm"
                  onClick={() => copy(csvOutput)}
                  disabled={!csvOutput || csvOutput.startsWith("(") || !csvOutput.trim()}
                >
                  <Copy className="w-4 h-4" /> Copy
                </Button>
              </div>
              <textarea
                className="w-full h-48 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none leading-relaxed"
                value={csvOutput}
                readOnly
              />
            </div>
          </div>
        )}

        {/* ── Search Tab ────────────────────────────────────────────── */}
        {tab === "search" && (
          <div className="space-y-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">JSON Input</div>
              <textarea
                className="w-full h-48 font-mono text-sm bg-muted/30 border border-input rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Paste JSON to search within..."
                spellCheck={false}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                className="w-full h-12 pl-12 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="Search keys and values across the entire JSON tree..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {!parsedSearch.ok && (
              <div className="flex items-start gap-3 bg-destructive/10 text-destructive text-sm rounded-xl px-4 py-3 border border-destructive/20">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium mb-0.5">Parse Error</div>
                  <div className="font-mono text-sm opacity-90">{parsedSearch.error}</div>
                </div>
              </div>
            )}

            {parsedSearch.ok && searchResults.length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
                </div>
                <div className="border border-input rounded-xl divide-y divide-border max-h-[50vh] overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <div key={i} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 h-5">{r.type}</Badge>
                        <span className="text-sm font-mono text-muted-foreground">{r.path}</span>
                      </div>
                      <div className="text-sm text-foreground font-mono ml-0.5">{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {parsedSearch.ok && searchQuery.trim() && searchResults.length === 0 && (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <div className="text-base font-medium mb-1">No results found</div>
                <div className="text-sm text-muted-foreground">
                  Nothing matches &ldquo;{searchQuery}&rdquo; — try a different search term
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
