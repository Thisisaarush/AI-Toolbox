"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  FileText, Plus, Trash2, Printer, Type, HelpCircle,
  CheckSquare, Minus, ChevronUp, ChevronDown, FilePlus,
  Text, ListChecks, MessageSquare, Grid3x3, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

type BlockType = "text" | "question" | "checklist" | "lined" | "grid"

type Block = {
  id: string
  type: BlockType
  content: string
  items?: string[]
  lines?: number
}

type Workbook = {
  title: string
  subtitle: string
  blocks: Block[]
}

const STORAGE_KEY = "workbook-pdf-v1"

const DEFAULT: Workbook = { title: "Workbook", subtitle: "", blocks: [] }

function loadStore(): Workbook {
  if (typeof window === "undefined") return DEFAULT
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? DEFAULT }
  catch { return DEFAULT }
}

function saveStore(w: Workbook) { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)) }

const TEMPLATES: { name: string; icon: React.ReactNode; build(): Workbook }[] = [
  {
    name: "Blank",
    icon: <FilePlus className="w-3.5 h-3.5" />,
    build: () => ({ title: "Workbook", subtitle: "", blocks: [] }),
  },
  {
    name: "Lined Paper",
    icon: <Minus className="w-3.5 h-3.5" />,
    build: () => ({
      title: "Lined Paper",
      subtitle: "",
      blocks: [{ id: crypto.randomUUID(), type: "lined", content: "", lines: 25 }],
    }),
  },
  {
    name: "Grid Paper",
    icon: <Grid3x3 className="w-3.5 h-3.5" />,
    build: () => ({
      title: "Grid Paper",
      subtitle: "",
      blocks: [{ id: crypto.randomUUID(), type: "grid", content: "", lines: 30 }],
    }),
  },
  {
    name: "To-Do List",
    icon: <ListChecks className="w-3.5 h-3.5" />,
    build: () => ({
      title: "To-Do List",
      subtitle: "",
      blocks: [{
        id: crypto.randomUUID(),
        type: "checklist",
        content: "",
        items: ["Buy groceries", "Finish project", "Call dentist", "Read 30 min", "Clean desk"],
      }],
    }),
  },
  {
    name: "Quiz",
    icon: <HelpCircle className="w-3.5 h-3.5" />,
    build: () => ({
      title: "Quiz",
      subtitle: "Answer the following questions",
      blocks: [
        { id: crypto.randomUUID(), type: "question", content: "What is the capital of France?", lines: 4 },
        { id: crypto.randomUUID(), type: "question", content: "Explain the water cycle in three steps.", lines: 6 },
        { id: crypto.randomUUID(), type: "question", content: "What is 12 × 15?", lines: 4 },
        { id: crypto.randomUUID(), type: "question", content: "Who wrote Romeo and Juliet?", lines: 4 },
      ],
    }),
  },
  {
    name: "Meeting Notes",
    icon: <MessageSquare className="w-3.5 h-3.5" />,
    build: () => ({
      title: "",
      subtitle: "Meeting Notes",
      blocks: [
        { id: crypto.randomUUID(), type: "text", content: "Date:\nAttendees:\nTopic:" },
        { id: crypto.randomUUID(), type: "lined", content: "", lines: 20 },
      ],
    }),
  },
]

const BLOCK_TYPES: { type: BlockType; label: string; icon: React.ReactNode }[] = [
  { type: "text", label: "Text", icon: <Text className="w-4 h-4" /> },
  { type: "question", label: "Question", icon: <HelpCircle className="w-4 h-4" /> },
  { type: "checklist", label: "Checklist", icon: <ListChecks className="w-4 h-4" /> },
  { type: "lined", label: "Lined", icon: <Minus className="w-4 h-4" /> },
]

const PRINT_STYLES = `
.print-only { display: none; }
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  body { background: white !important; color: black !important; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .workbook-print-area { max-width: 100% !important; padding: 0.5in !important; margin: 0 !important; }
}`

export function WorkbookPDFContent() {
  const [workbook, setWorkbook] = useState<Workbook>(DEFAULT)
  const [ready, setReady] = useState(false)

  useEffect(() => { setWorkbook(loadStore()); setReady(true) }, [])

  useEffect(() => {
    if (ready) saveStore(workbook)
  }, [workbook, ready])

  function update(fn: (w: Workbook) => Workbook) {
    setWorkbook((prev) => fn(prev))
  }

  function updateBlock(id: string, p: Partial<Block>) {
    update((w) => ({ ...w, blocks: w.blocks.map((b) => (b.id === id ? { ...b, ...p } : b)) }))
  }

  function addBlock(type: BlockType) {
    const block: Block = { id: crypto.randomUUID(), type, content: "" }
    if (type === "checklist") block.items = [""]
    if (type === "question") block.lines = 5
    if (type === "lined") block.lines = 15
    if (type === "grid") block.lines = 25
    update((w) => ({ ...w, blocks: [...w.blocks, block] }))
  }

  function removeBlock(id: string) {
    update((w) => ({ ...w, blocks: w.blocks.filter((b) => b.id !== id) }))
  }

  function moveBlock(id: string, dir: "up" | "down") {
    update((w) => {
      const i = w.blocks.findIndex((b) => b.id === id)
      if (i === -1) return w
      if (dir === "up" && i === 0) return w
      if (dir === "down" && i === w.blocks.length - 1) return w
      const b = [...w.blocks]
      const j = dir === "up" ? i - 1 : i + 1
      ;[b[i]!, b[j]!] = [b[j]!, b[i]!]
      return { ...w, blocks: b }
    })
  }

  function applyTemplate(name: string) {
    const t = TEMPLATES.find((x) => x.name === name)
    if (!t) return
    setWorkbook(t.build())
    toast.success(`Applied template: ${name}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <style>{PRINT_STYLES}</style>

      <div className="no-print">
        <ToolHeader
          title="Workbook / Worksheet"
          icon={FileText}
          color="text-sky-500"
          badge="Education"
        />
      </div>

      <main className="workbook-print-area flex-1 max-w-4xl mx-auto px-4 py-6 w-full space-y-6">
        {/* Templates */}
        <div className="no-print flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground">Templates:</span>
          {TEMPLATES.map((t) => (
            <Button key={t.name} size="sm" variant="outline" onClick={() => applyTemplate(t.name)}
              className="gap-1.5 text-xs">
              {t.icon}{t.name}
            </Button>
          ))}
        </div>

        {/* Title & subtitle */}
        <div className="space-y-2">
          <Input
            value={workbook.title}
            onChange={(e) => update((w) => ({ ...w, title: e.target.value }))}
            placeholder="Workbook Title"
            className="no-print text-2xl font-bold h-auto py-3 px-4 border-0 border-b border-border rounded-none focus-visible:ring-0"
          />
          <p className="print-only text-2xl font-bold">{workbook.title || "Workbook"}</p>
          <Input
            value={workbook.subtitle}
            onChange={(e) => update((w) => ({ ...w, subtitle: e.target.value }))}
            placeholder="Subtitle or description"
            className="no-print text-sm h-auto py-2 px-4 border-0 border-b border-border rounded-none focus-visible:ring-0 text-muted-foreground"
          />
          {workbook.subtitle && <p className="print-only text-sm text-muted-foreground">{workbook.subtitle}</p>}
        </div>

        {/* Blocks */}
        <div className="space-y-5 print:space-y-3">
          {workbook.blocks.length === 0 && (
            <div className="py-16 text-center text-muted-foreground no-print">
              <FileText className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-foreground text-lg">No content blocks</p>
              <p className="text-sm mt-1">Add a block below or pick a template above</p>
            </div>
          )}

          {workbook.blocks.map((block, i, arr) => (
            <div key={block.id}
              className="group relative p-5 rounded-xl border bg-card print:border-0 print:p-0 print:rounded-none print:shadow-none print:bg-transparent">
              {/* Controls */}
              <div className="no-print flex items-center gap-0.5 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 rounded-lg border px-1 py-0.5">
                <button onClick={() => moveBlock(block.id, "up")} disabled={i === 0}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => moveBlock(block.id, "down")} disabled={i === arr.length - 1}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => removeBlock(block.id)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Block content */}
              {block.type === "text" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 no-print">
                    <Type className="w-3 h-3" />Text
                  </label>
                  <p className="text-sm leading-relaxed print-only whitespace-pre-wrap">{block.content}</p>
                  <Textarea
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    placeholder="Type your text here..."
                    className="min-h-[90px] text-sm no-print"
                  />
                </div>
              )}

              {block.type === "question" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 no-print">
                    <HelpCircle className="w-3 h-3" />Question
                  </label>
                  <Textarea
                    value={block.content}
                    onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                    placeholder="Write your question here..."
                    rows={2}
                    className="text-sm mb-4 no-print"
                  />
                  <p className="text-sm font-medium mb-3 print-only whitespace-pre-wrap">{block.content}</p>
                  <div className="space-y-1.5">
                    {Array.from({ length: block.lines ?? 5 }).map((_, j) => (
                      <div key={j} className="border-b border-dashed border-muted-foreground/20 h-8 print:border-black/20" />
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => updateBlock(block.id, { lines: (block.lines ?? 5) + 1 })}
                    className="mt-2 no-print gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add line
                  </Button>
                </div>
              )}

              {block.type === "checklist" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 no-print">
                    <ListChecks className="w-3 h-3" />Checklist
                  </label>
                  <div className="space-y-1">
                    {(block.items ?? []).map((item, j) => (
                      <div key={j} className="flex items-center gap-3 py-1 group/checkitem">
                        <CheckSquare className="w-4 h-4 text-muted-foreground shrink-0 print:text-black" />
                        <Input
                          value={item}
                          onChange={(e) => {
                            const items = [...(block.items ?? [])]
                            items[j] = e.target.value
                            updateBlock(block.id, { items })
                          }}
                          placeholder="Checklist item..."
                          className="h-8 text-sm border-0 border-b border-transparent hover:border-border focus:border-border rounded-none px-0 no-print"
                        />
                        <span className="text-sm print-only">{item}</span>
                        <button onClick={() => {
                          const items = (block.items ?? []).filter((_, k) => k !== j)
                          updateBlock(block.id, { items })
                        }}
                          className="opacity-0 group-hover/checkitem:opacity-100 text-muted-foreground hover:text-destructive transition-opacity no-print">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    updateBlock(block.id, { items: [...(block.items ?? []), ""] })
                  }}
                    className="mt-2 no-print gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add item
                  </Button>
                </div>
              )}

              {block.type === "lined" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 no-print">
                    <Minus className="w-3 h-3" />Lined Paper
                  </label>
                  <div className="space-y-0.5">
                    {Array.from({ length: block.lines ?? 15 }).map((_, j) => (
                      <div key={j} className="border-b border-muted-foreground/20 h-8 print:border-black/20" />
                    ))}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => updateBlock(block.id, { lines: (block.lines ?? 15) + 5 })}
                    className="mt-2 no-print gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add 5 lines
                  </Button>
                </div>
              )}

              {block.type === "grid" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5 no-print">
                    <Grid3x3 className="w-3 h-3" />Grid Paper
                  </label>
                  <div
                    className="rounded-xl print:rounded-none"
                    style={{
                      height: (block.lines ?? 25) * 20,
                      backgroundImage: [
                        "linear-gradient(to right, #8883 1px, transparent 1px)",
                        "linear-gradient(to bottom, #8883 1px, transparent 1px)",
                      ].join(", "),
                      backgroundSize: "20px 20px",
                      WebkitPrintColorAdjust: "exact",
                      printColorAdjust: "exact",
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => updateBlock(block.id, { lines: (block.lines ?? 25) + 5 })}
                    className="mt-2 no-print gap-1.5 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add 5 rows
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add block buttons */}
        <div className="no-print flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium text-muted-foreground">Add:</span>
          {BLOCK_TYPES.map((bt) => (
            <Button key={bt.type} size="sm" variant="secondary" onClick={() => addBlock(bt.type)}
              className="gap-1.5 text-xs">
              {bt.icon}{bt.label}
            </Button>
          ))}
        </div>

        {/* Print button */}
        <div className="no-print pt-2">
          <Button size="lg" onClick={() => window.print()} className="gap-3 w-full sm:w-auto">
            <Printer className="w-5 h-5" />
            Print / Export PDF
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Uses your browser&apos;s print dialog. Choose &quot;Save as PDF&quot; to export.
          </p>
        </div>
      </main>
    </div>
  )
}
