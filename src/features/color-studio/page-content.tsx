"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Palette, Plus, Trash2, Copy, Lock, Unlock, RefreshCw, Download,
  Sun, Moon, Sparkles, Contrast, Check, X, ChevronDown, Import,
  Undo2, Save, Eye, EyeOff,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────

type PaletteColor = { hex: string; locked: boolean }
type PaletteMode = "analogous" | "complementary" | "triadic" | "monochromatic" | "random"
type ExportFormat = "css-vars" | "tailwind" | "hex-csv"
type StudioTab = "generator" | "contrast" | "gradient"

interface SavedPalette {
  id: string
  name: string
  colors: string[]
  createdAt: number
}

// ── Color utilities ────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToHsl(hex: string): [number, number, number] {
  let [r, g, b] = hexToRgb(hex)
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return [h * 360, s * 100, l * 100]
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360 / 360
  s = Math.max(0, Math.min(100, s)) / 100
  l = Math.max(0, Math.min(100, l)) / 100
  if (s === 0) {
    const v = Math.round(l * 255)
    return rgbToHex(v, v, v)
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255)
  const g = Math.round(hue2rgb(p, q, h) * 255)
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  return rgbToHex(r, g, b)
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const linearize = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function randomHex(): string {
  const bytes = new Uint8Array(3)
  crypto.getRandomValues(bytes)
  return rgbToHex(bytes[0]!, bytes[1]!, bytes[2]!)
}

function isValidHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{3,6}$/.test(s)
}

function normalizeHex(s: string): string {
  let h = s.trim().replace(/^#/, "")
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  return `#${h.toLowerCase()}`
}

function padPalette(palette: PaletteColor[]): PaletteColor[] {
  while (palette.length < 5) palette.push({ hex: randomHex(), locked: false })
  return palette.slice(0, 5)
}

// ── Palette generation ─────────────────────────────────────────

function generatePaletteColors(mode: PaletteMode, baseHex?: string): string[] {
  const base = baseHex ?? randomHex()
  const [h, s, l] = hexToHsl(base)
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const clampH = (v: number) => ((v % 360) + 360) % 360

  switch (mode) {
    case "analogous": {
      const offsets = [-48, -24, 0, 24, 48]
      return offsets.map((off) => hslToHex(clampH(h + off), clamp(s + (off === 0 ? 0 : off < 0 ? 8 : -8)), clamp(l + (off === 0 ? 0 : off < 0 ? -6 : 6))))
    }
    case "complementary": {
      const comp = clampH(h + 180)
      return [
        hslToHex(h, clamp(s), clamp(l)),
        hslToHex(comp, clamp(s), clamp(l)),
        hslToHex(clampH(h + 30), clamp(s - 10), clamp(l + 8)),
        hslToHex(clampH(comp + 30), clamp(s - 10), clamp(l + 8)),
        hslToHex(h, clamp(s + 15), clamp(l - 12)),
      ]
    }
    case "triadic": {
      const t1 = clampH(h + 120), t2 = clampH(h + 240)
      return [
        hslToHex(h, clamp(s), clamp(l)),
        hslToHex(t1, clamp(s), clamp(l)),
        hslToHex(t2, clamp(s), clamp(l)),
        hslToHex(clampH(h + 60), clamp(s - 12), clamp(l + 10)),
        hslToHex(clampH(h + 180), clamp(s - 12), clamp(l - 10)),
      ]
    }
    case "monochromatic": {
      const lightnesses = [28, 40, 52, 64, 76]
      return lightnesses.map((lv) => hslToHex(h, clamp(s + 10), lv))
    }
    case "random": {
      return Array.from({ length: 5 }, () => randomHex())
    }
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 8)
}

// ── LocalStorage helpers ───────────────────────────────────────

const STORAGE_KEY = "color-studio-v1"
const SAVED_KEY = "color-studio-saved-v1"

function loadPalette(): PaletteColor[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as PaletteColor[]
  } catch { /* ignore */ }
  return []
}

function savePaletteState(p: PaletteColor[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

function loadSaved(): SavedPalette[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    if (raw) return JSON.parse(raw) as SavedPalette[]
  } catch { /* ignore */ }
  return []
}

function saveSaved(s: SavedPalette[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(s))
}

function copyToClipboard(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label)).catch(() => toast.error("Failed to copy"))
}

// ── Sub-components ─────────────────────────────────────────────

function ColorSwatch({ color, onColorChange, onLockToggle, onCopy, index }: {
  color: PaletteColor
  onColorChange: (hex: string) => void
  onLockToggle: () => void
  onCopy: () => void
  index: number
}) {
  const textColor = contrastRatio(color.hex, "#000000") > 5 ? "#000000" : "#ffffff"
  return (
    <div className="relative flex flex-col rounded-xl overflow-hidden min-h-28 flex-1 group">
      <div
        className="flex-1 min-h-28 flex flex-col items-center justify-end pb-3 px-2 transition-colors cursor-pointer"
        style={{ backgroundColor: color.hex }}
        onClick={() => onColorChange(color.hex)}
      >
        <input
          type="color"
          value={color.hex}
          onChange={(e) => onColorChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label={`Color ${index + 1}`}
        />
        <div className="flex items-center gap-1.5 relative z-10" style={{ color: textColor }}>
          <span className="text-xs font-mono font-semibold tracking-wide drop-shadow-sm">{color.hex.toUpperCase()}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onCopy() }}
            className="opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            aria-label="Copy hex"
          >
            <Copy className="w-3.5 h-3.5 drop-shadow-sm" style={{ color: textColor }} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-card border-t border-border/40">
        <button
          onClick={onLockToggle}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={color.locked ? "Unlock color" : "Lock color"}
        >
          {color.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        </button>
        <span className="text-[10px] font-mono text-muted-foreground">P{index + 1}</span>
      </div>
    </div>
  )
}

function ColorPickerInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)
  useEffect(() => { setText(value) }, [value])

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground w-24 shrink-0">{label}</span>
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-border/60 cursor-pointer bg-transparent p-0.5"
        />
      </div>
      {editing ? (
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (isValidHex(text)) onChange(normalizeHex(text)); setEditing(false) }}
          onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") { if (isValidHex(text)) onChange(normalizeHex(text)); setEditing(false) } }}
          className="w-28 font-mono text-sm"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm font-mono text-foreground hover:text-muted-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
          {value}
        </button>
      )}
    </div>
  )
}

function SavedPaletteCard({ saved, onRestore, onDelete }: { saved: SavedPalette; onRestore: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
      <button onClick={onRestore} className="flex items-center gap-3 flex-1 min-w-0 text-left">
        <div className="flex gap-0.5 shrink-0">
          {saved.colors.map((c, i) => (
            <div key={i} className="w-5 h-8 rounded-sm first:rounded-l-md last:rounded-r-md" style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{saved.name}</div>
          <div className="text-[10px] text-muted-foreground">{new Date(saved.createdAt).toLocaleDateString()}</div>
        </div>
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        aria-label="Delete saved palette"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

function ContrastBadge({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
      pass ? "bg-green-500/15 text-green-600 dark:text-green-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
    }`}>
      {pass ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </div>
  )
}

// ── Export helpers ─────────────────────────────────────────────

function exportAsCSSVars(colors: string[]): string {
  return colors.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n")
}

function exportAsTailwind(colors: string[]): string {
  const lines = colors.map((c, i) => `    '${i + 1}': '${c}',`)
  return `{\n  colors: {\n${lines.join("\n")}\n  },\n}`
}

function exportAsHexCSV(colors: string[]): string {
  return colors.join(", ")
}

// ── Main Component ─────────────────────────────────────────────

const MODES: { id: PaletteMode; label: string }[] = [
  { id: "analogous", label: "Analogous" },
  { id: "complementary", label: "Complementary" },
  { id: "triadic", label: "Triadic" },
  { id: "monochromatic", label: "Mono" },
  { id: "random", label: "Random" },
]

const TABS: { id: StudioTab; label: string; icon: React.ReactNode }[] = [
  { id: "generator", label: "Palette Generator", icon: <Palette className="w-4 h-4" /> },
  { id: "contrast", label: "Contrast Checker", icon: <Contrast className="w-4 h-4" /> },
  { id: "gradient", label: "Gradient Builder", icon: <Sparkles className="w-4 h-4" /> },
]

export function ColorStudioContent() {
  const [tab, setTab] = useState<StudioTab>("generator")
  const [palette, setPalette] = useState<PaletteColor[]>(() => {
    const saved = loadPalette()
    return saved.length === 5 ? saved : generatePaletteColors("analogous").map((hex) => ({ hex, locked: false }))
  })
  const [mode, setMode] = useState<PaletteMode>("analogous")
  const [savedPalettes, setSavedPalettes] = useState<SavedPalette[]>(() => loadSaved())
  const [importUrl, setImportUrl] = useState("")
  const [showExport, setShowExport] = useState(false)
  const [showSaved, setShowSaved] = useState(false)

  // Contrast checker state
  const [fgHex, setFgHex] = useState("#ffffff")
  const [bgHex, setBgHex] = useState("#1a1a2e")

  // Gradient builder state
  const [grad1, setGrad1] = useState("#6366f1")
  const [grad2, setGrad2] = useState("#ec4899")
  const [gradAngle, setGradAngle] = useState(135)

  // Persist palette to localStorage
  useEffect(() => { savePaletteState(palette) }, [palette])

  const regenerate = useCallback(() => {
    const base = palette.find((c) => !c.locked)?.hex ?? randomHex()
    const fresh = generatePaletteColors(mode, base)
    setPalette((prev) => padPalette(prev.map((c, i) => c.locked ? c : { hex: fresh[i] ?? randomHex(), locked: false })))
  }, [mode, palette])

  const handleColorChange = useCallback((index: number, hex: string) => {
    setPalette((prev) => prev.map((c, i) => i === index ? { ...c, hex } : c))
  }, [])

  const toggleLock = useCallback((index: number) => {
    setPalette((prev) => prev.map((c, i) => i === index ? { ...c, locked: !c.locked } : c))
  }, [])

  const copyHex = useCallback((hex: string) => {
    copyToClipboard(hex, "Hex copied")
  }, [])

  const handleSave = useCallback(() => {
    const name = `Palette #${savedPalettes.length + 1}`
    const sp: SavedPalette = {
      id: uid(),
      name,
      colors: palette.map((c) => c.hex),
      createdAt: Date.now(),
    }
    const updated = [...savedPalettes, sp]
    setSavedPalettes(updated)
    saveSaved(updated)
    toast.success("Palette saved")
  }, [palette, savedPalettes])

  const handleRestore = useCallback((saved: SavedPalette) => {
    setPalette(saved.colors.map((hex) => ({ hex, locked: false })))
    toast.success(`Restored "${saved.name}"`)
  }, [])

  const handleDeleteSaved = useCallback((id: string) => {
    const updated = savedPalettes.filter((s) => s.id !== id)
    setSavedPalettes(updated)
    saveSaved(updated)
    toast.success("Palette deleted")
  }, [savedPalettes])

  const handleImport = useCallback(() => {
    const cleaned = importUrl.trim()
    if (!cleaned) { toast.error("Paste hex values or a URL"); return }
    const parts = cleaned.split(/[,;\s]+/).filter(Boolean)
    const valid = parts.filter((p) => isValidHex(p)).map(normalizeHex)
    if (valid.length < 2) { toast.error("Need at least 2 valid hex colors"); return }
    const imported = valid.slice(0, 5).map((hex) => ({ hex, locked: false }))
    while (imported.length < 5) imported.push({ hex: randomHex(), locked: false })
    setPalette(imported)
    setImportUrl("")
    toast.success(`Imported ${valid.slice(0, 5).length} colors`)
  }, [importUrl])

  const handleExport = useCallback((fmt: ExportFormat) => {
    const colors = palette.map((c) => c.hex)
    let text = ""
    let label = ""
    switch (fmt) {
      case "css-vars":
        text = `:root {\n${exportAsCSSVars(colors)}\n}`
        label = "CSS vars copied"
        break
      case "tailwind":
        text = exportAsTailwind(colors)
        label = "Tailwind config copied"
        break
      case "hex-csv":
        text = exportAsHexCSV(colors)
        label = "Hex codes copied"
        break
    }
    copyToClipboard(text, label)
    setShowExport(false)
  }, [palette])

  // ── Computed values ─────────────────────────────────────────

  const contrastValue = useMemo(() => contrastRatio(fgHex, bgHex), [fgHex, bgHex])
  const contrastAA = contrastValue >= 4.5
  const contrastAALarge = contrastValue >= 3
  const contrastAAA = contrastValue >= 7
  const contrastAAALarge = contrastValue >= 4.5

  const gradientCSS = `background: linear-gradient(${gradAngle}deg, ${grad1}, ${grad2});`

  // ── Render ──────────────────────────────────────────────────

  return (
    <>
      <ToolHeader title="Color & Design Studio" icon={Palette} color="text-fuchsia-500" badge="Design" />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Tab bar ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                tab === t.id
                  ? "bg-fuchsia-500/10 border-fuchsia-500/40 text-fuchs-500 dark:text-fuchsia-400 shadow-sm"
                  : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSaved(!showSaved)}>
              <Eye className="w-4 h-4" />
              {showSaved ? "Hide Saved" : `Saved (${savedPalettes.length})`}
            </Button>
          </div>
        </div>

        {/* ── Tab 1: Palette Generator ──────────────────────── */}
        {tab === "generator" && (
          <div className="space-y-6">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/50">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      mode === m.id
                        ? "bg-fuchsia-500/15 text-fuchs-600 dark:text-fuchsia-400 shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={regenerate}>
                <RefreshCw className="w-4 h-4" /> Generate
              </Button>
            </div>

            {/* Color swatches */}
            <div className="flex gap-3">
              {palette.map((c, i) => (
                <ColorSwatch
                  key={i}
                  color={c}
                  index={i}
                  onColorChange={(hex) => handleColorChange(i, hex)}
                  onLockToggle={() => toggleLock(i)}
                  onCopy={() => copyHex(c.hex)}
                />
              ))}
            </div>

            {/* Import / Save / Export row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative flex-1 min-w-0 max-w-sm">
                  <Import className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") handleImport() }}
                    placeholder="#ff0000, #00ff00, #0000ff"
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleImport}>
                  Import
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4" /> Save
                </Button>
                <div className="relative">
                  <Button variant="outline" size="sm" onClick={() => setShowExport(!showExport)}>
                    <Download className="w-4 h-4" /> Export
                    <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                  {showExport && (
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden">
                      {([
                        ["css-vars", "CSS Variables"],
                        ["tailwind", "Tailwind Config"],
                        ["hex-csv", "Hex Codes"],
                      ] as [ExportFormat, string][]).map(([fmt, label]) => (
                        <button
                          key={fmt}
                          onClick={() => handleExport(fmt)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Saved palettes */}
            {showSaved && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-muted-foreground">Saved Palettes</h3>
                  {savedPalettes.length > 0 && (
                    <button
                      onClick={() => { setSavedPalettes([]); saveSaved([]); toast.success("All palettes cleared") }}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                {savedPalettes.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border/60 rounded-xl">
                    No saved palettes yet. Generate one and hit Save.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                    {[...savedPalettes].reverse().map((sp) => (
                      <SavedPaletteCard
                        key={sp.id}
                        saved={sp}
                        onRestore={() => handleRestore(sp)}
                        onDelete={() => handleDeleteSaved(sp.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Contrast Checker ────────────────────────── */}
        {tab === "contrast" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Colors</h3>
                <ColorPickerInput label="Foreground" value={fgHex} onChange={setFgHex} />
                <ColorPickerInput label="Background" value={bgHex} onChange={setBgHex} />
                <div className="flex gap-2 pt-1">
                  <Button size="xs" variant="outline" onClick={() => { setFgHex("#ffffff"); setBgHex("#1a1a2e") }}>
                    <Sun className="w-3.5 h-3.5" /> Light
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => { setFgHex("#e2e8f0"); setBgHex("#0f172a") }}>
                    <Moon className="w-3.5 h-3.5" /> Dark
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => { setFgHex("#1a1a2e"); setBgHex("#fbbf24") }}>
                    <Eye className="w-3.5 h-3.5" /> Alert
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">WCAG Results</h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Ratio:</span>
                  <span className="font-mono font-bold text-lg tabular-nums">{contrastValue.toFixed(2)}:1</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ContrastBadge pass={contrastAA} label="AA Normal (4.5:1)" />
                  <ContrastBadge pass={contrastAALarge} label="AA Large (3:1)" />
                  <ContrastBadge pass={contrastAAA} label="AAA Normal (7:1)" />
                  <ContrastBadge pass={contrastAAALarge} label="AAA Large (4.5:1)" />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <div
                className="rounded-xl overflow-hidden border border-border/60 min-h-[240px] flex flex-col items-center justify-center p-8"
                style={{ backgroundColor: bgHex }}
              >
                <div
                  className="text-center p-8 rounded-lg max-w-sm w-full"
                  style={{ backgroundColor: bgHex, color: fgHex }}
                >
                  <div className="text-6xl font-bold mb-3 tracking-tight" style={{ color: fgHex }}>Aa</div>
                  <p className="text-lg font-medium mb-1" style={{ color: fgHex }}>The quick brown fox</p>
                  <p className="text-sm opacity-80" style={{ color: fgHex }}>
                    jumps over the lazy dog. 1234567890
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                <div className="w-4 h-4 rounded border border-border/40" style={{ backgroundColor: fgHex }} />
                FG: {fgHex}
                <span className="text-muted-foreground/40">|</span>
                <div className="w-4 h-4 rounded border border-border/40" style={{ backgroundColor: bgHex }} />
                BG: {bgHex}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Gradient Builder ────────────────────────── */}
        {tab === "gradient" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="space-y-5">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Gradient Colors</h3>
                <ColorPickerInput label="Color 1" value={grad1} onChange={setGrad1} />
                <ColorPickerInput label="Color 2" value={grad2} onChange={setGrad2} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Angle: {gradAngle}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={gradAngle}
                  onChange={(e) => setGradAngle(Number(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted/50 accent-fuchsia-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fuchsia-500 [&::-webkit-slider-thumb]:shadow-md"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0°</span>
                  <span>90°</span>
                  <span>180°</span>
                  <span>270°</span>
                  <span>360°</span>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={() => { setGrad1(randomHex()); setGrad2(randomHex()) }}>
                <Sparkles className="w-4 h-4" /> Randomize
              </Button>
            </div>

            {/* Preview & Code */}
            <div className="space-y-4">
              <div
                className="w-full h-48 rounded-xl border border-border/60"
                style={{ background: `linear-gradient(${gradAngle}deg, ${grad1}, ${grad2})` }}
              />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">CSS Code</span>
                  <Button size="xs" variant="ghost" onClick={() => copyToClipboard(gradientCSS, "CSS copied")}>
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </Button>
                </div>
                <pre className="bg-muted/30 border border-border/60 rounded-xl p-4 text-sm font-mono overflow-x-auto">
                  <code>{gradientCSS}</code>
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
