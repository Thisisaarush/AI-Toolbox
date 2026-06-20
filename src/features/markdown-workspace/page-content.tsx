"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  FileText, Plus, Trash2, Download, Bold, Italic, Heading,
  Link2, List, Code, Eye, Edit3, GripVertical, FileEdit, Menu, X, ChevronRight,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────

type MDDocument = {
  id: string
  title: string
  content: string
  updatedAt: string
}

// ── Constants ──────────────────────────────────────────────────

const STORAGE_KEY = "markdown-workspace-v1"
const SAVE_DELAY = 800

const DEFAULT_DOC: MDDocument = {
  id: "default",
  title: "Untitled",
  content: `# Welcome to Markdown Workspace\n\nStart typing here...\n\n## Features\n\n- **Bold** and *italic* text\n- \`Inline code\` and code blocks\n- [Links](https://example.com)\n- Lists and blockquotes\n- And more!`,
  updatedAt: new Date().toISOString(),
}

// ── Helpers ────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ── Storage ────────────────────────────────────────────────────

function loadDocs(): MDDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [DEFAULT_DOC]
    const docs = JSON.parse(raw) as MDDocument[]
    return docs.length === 0 ? [DEFAULT_DOC] : docs
  } catch {
    return [DEFAULT_DOC]
  }
}

function saveDocs(docs: MDDocument[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs))
}

// ── Word / char / reading time ────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function countChars(text: string): number {
  return text.length
}

function readingTime(text: string): string {
  const wc = countWords(text)
  const min = Math.ceil(wc / 200)
  return min < 1 ? "< 1 min read" : `${min} min read`
}

// ── Markdown renderer ──────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function renderMarkdown(md: string): string {
  let html = escapeHtml(md)

  // Horizontal rules (must be before other block processing)
  html = html.replace(/^---$/gm, "<hr />")

  // Code blocks (fenced) — must be before inline code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre class="bg-muted/80 border border-border/50 rounded-xl p-4 overflow-x-auto text-sm leading-relaxed my-4"><code>${code.trim()}</code></pre>`
  })

  // Blockquotes
  html = html.replace(/^>\s?(.*)$/gm, "<blockquote class=\"border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3\">$1</blockquote>")

  // Headings (h1-h6)
  html = html.replace(/^######\s+(.*)$/gm, "<h6 class=\"text-sm font-semibold mt-5 mb-2\">$1</h6>")
  html = html.replace(/^#####\s+(.*)$/gm, "<h5 class=\"text-base font-semibold mt-5 mb-2\">$1</h5>")
  html = html.replace(/^####\s+(.*)$/gm, "<h4 class=\"text-lg font-semibold mt-6 mb-2\">$1</h4>")
  html = html.replace(/^###\s+(.*)$/gm, "<h3 class=\"text-xl font-semibold mt-6 mb-2\">$1</h3>")
  html = html.replace(/^##\s+(.*)$/gm, "<h2 class=\"text-2xl font-bold mt-6 mb-3\">$1</h2>")
  html = html.replace(/^#\s+(.*)$/gm, "<h1 class=\"text-3xl font-bold mt-6 mb-4\">$1</h1>")

  // Unordered lists
  html = html.replace(/^[-*]\s+(.*)$/gm, "<li class=\"ml-5 list-disc my-1\">$1</li>")

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code class=\"bg-muted/70 px-1.5 py-0.5 rounded text-sm font-mono text-foreground\">$1</code>")

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong class=\"font-semibold\">$1</strong>")

  // Italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "<img src=\"$2\" alt=\"$1\" class=\"max-w-full rounded-xl my-4\" />")

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-blue-500 underline underline-offset-2 hover:text-blue-400\">$1</a>")

  // Paragraphs — wrap remaining text blocks
  const lines = html.split("\n")
  const result: string[] = []
  let inPre = false
  let inBlockquote = false
  let inList = false
  let inParagraph = false

  for (const line of lines) {
    if (line.startsWith("<pre") || line.startsWith("<blockquote")) {
      if (inParagraph) { result.push("</p>"); inParagraph = false }
      result.push(line)
      if (line.startsWith("<pre")) inPre = true
      if (line.startsWith("<blockquote")) inBlockquote = true
      continue
    }
    if (inPre || inBlockquote) {
      if (line === "</pre>" || line === "</blockquote>") {
        result.push(line)
        if (line === "</pre>") inPre = false
        if (line === "</blockquote>") inBlockquote = false
        continue
      }
      result.push(line)
      continue
    }
    if (
      line.startsWith("<h") || line.startsWith("<hr") || line.startsWith("<li") ||
      line === "" || line.startsWith("</pre") || line.startsWith("</blockquote") ||
      line.startsWith("<pre") || line.startsWith("<blockquote") || line.startsWith("<img")
    ) {
      if (inParagraph) { result.push("</p>"); inParagraph = false }
      result.push(line)
      continue
    }
    if (!inParagraph) {
      result.push("<p class=\"my-3 leading-relaxed\">")
      inParagraph = true
    }
    result.push(line)
  }
  if (inParagraph) result.push("</p>")

  return result.join("\n")
}

// ── Toolbar action ─────────────────────────────────────────────

type InsertFn = (before: string, after?: string, fallback?: string) => void

function useToolbar(textareaRef: React.RefObject<HTMLTextAreaElement | null>, content: string, onChange: (v: string) => void): InsertFn {
  return useCallback((before: string, after = "", fallback = "") => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.slice(start, end)
    const wrap = selected || fallback
    const newText = content.slice(0, start) + before + wrap + after + content.slice(end)
    onChange(newText)
    requestAnimationFrame(() => {
      ta.focus()
      const cursor = start + before.length + wrap.length + after.length
      ta.setSelectionRange(cursor, cursor)
    })
  }, [content, onChange, textareaRef])
}

// ── Main Component ────────────────────────────────────────────

export function MarkdownWorkspaceContent() {
  const [docs, setDocs] = useState<MDDocument[]>([])
  const [activeId, setActiveId] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [split, setSplit] = useState(50)
  const [dragging, setDragging] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState("")

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeDoc = docs.find((d) => d.id === activeId)
  const content = activeDoc?.content ?? ""
  const title = activeDoc?.title ?? ""

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const stored = loadDocs()
    setDocs(stored)
    setActiveId(stored[0]?.id ?? "default")
  }, [])

  // ── Auto-save (debounced) ────────────────────────────────────
  const scheduleSave = useCallback((updatedDocs: MDDocument[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveDocs(updatedDocs)
      toast.success("Saved", { duration: 1500 })
    }, SAVE_DELAY)
  }, [])

  // ── Update content ────────────────────────────────────────────
  const handleContentChange = useCallback((newContent: string) => {
    setDocs((prev) => {
      const updated = prev.map((d) =>
        d.id === activeId
          ? { ...d, content: newContent, updatedAt: new Date().toISOString() }
          : d
      )
      scheduleSave(updated)
      return updated
    })
  }, [activeId, scheduleSave])

  // ── File management ──────────────────────────────────────────
  const createFile = useCallback(() => {
    const newDoc: MDDocument = {
      id: uid(),
      title: "Untitled",
      content: "",
      updatedAt: new Date().toISOString(),
    }
    setDocs((prev) => {
      const updated = [...prev, newDoc]
      scheduleSave(updated)
      return updated
    })
    setActiveId(newDoc.id)
    toast.success("Created new file")
  }, [scheduleSave])

  const deleteFile = useCallback((id: string) => {
    setDocs((prev) => {
      const updated = prev.filter((d) => d.id !== id)
      if (updated.length === 0) {
        const fresh: MDDocument = { id: uid(), title: "Untitled", content: "", updatedAt: new Date().toISOString() }
        updated.push(fresh)
      }
      scheduleSave(updated)
      return updated
    })
    setActiveId((prev) => prev === id ? docs.find((d) => d.id !== id)?.id ?? docs[0]?.id ?? "" : prev)
    toast.success("Deleted")
  }, [docs, scheduleSave])

  const renameFile = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim() || "Untitled"
    setDocs((prev) => {
      const updated = prev.map((d) =>
        d.id === id ? { ...d, title: trimmed, updatedAt: new Date().toISOString() } : d
      )
      scheduleSave(updated)
      return updated
    })
  }, [scheduleSave])

  // ── Title editing ─────────────────────────────────────────────
  const startTitleEdit = useCallback(() => {
    setTitleDraft(title)
    setEditingTitle(true)
  }, [title])

  const commitTitle = useCallback(() => {
    if (titleDraft.trim()) renameFile(activeId, titleDraft)
    setEditingTitle(false)
  }, [activeId, titleDraft, renameFile])

  // ── Toolbar ───────────────────────────────────────────────────
  const insert = useToolbar(textareaRef, content, handleContentChange)

  const toolbarActions = [
    { icon: Bold, label: "Bold", action: () => insert("**", "**", "bold text") },
    { icon: Italic, label: "Italic", action: () => insert("*", "*", "italic text") },
    { icon: Heading, label: "Heading", action: () => insert("## ", "", "Heading") },
    { icon: Link2, label: "Link", action: () => insert("[", "](url)", "link text") },
    { icon: List, label: "List", action: () => insert("- ", "", "List item") },
    { icon: Code, label: "Code", action: () => insert("```\n", "\n```", "code block") },
  ]

  // ── Export ────────────────────────────────────────────────────
  const exportHTML = useCallback(() => {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{max-width:800px;margin:40px auto;padding:0 20px;font-family:system-ui,-apple-system,sans-serif;line-height:1.7;color:#1a1a2e;background:#fff}h1,h2,h3,h4{line-height:1.3}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.9em}pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;overflow-x:auto}blockquote{border-left:4px solid #94a3b8;padding-left:16px;color:#64748b;margin:16px 0}img{max-width:100%;border-radius:12px}hr{border:none;border-top:2px solid #e2e8f0;margin:32px 0}li{margin:4px 0}</style></head><body>${renderMarkdown(content)}</body></html>`
    const blob = new Blob([html], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Exported as HTML")
  }, [content, title])

  const exportText = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      toast.success("Copied as plain text")
    }).catch(() => toast.error("Failed to copy"))
  }, [content])

  const exportMD = useCallback(() => {
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Downloaded as .md")
  }, [content, title])

  // ── Resize split pane ────────────────────────────────────────
  const handleMouseDown = useCallback(() => setDragging(true), [])
  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const pct = Math.max(10, Math.min(90, (x / rect.width) * 100))
      setSplit(pct)
    }
    const handleMouseUp = () => setDragging(false)
    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragging])

  const wc = countWords(content)
  const cc = countChars(content)
  const rt = readingTime(content)

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <ToolHeader
        title="Markdown Workspace"
        icon={FileText}
        color="text-blue-500"
        badge="Editor"
      />

      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-200 border-r border-border/60 bg-muted/10 flex flex-col shrink-0 overflow-hidden`}
        >
          <div className="flex items-center justify-between px-4 h-12 border-b border-border/60 shrink-0">
            <span className="text-sm font-semibold text-foreground">Files</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {docs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setActiveId(doc.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  doc.id === activeId
                    ? "bg-blue-500/10 text-blue-500 font-medium"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <FileEdit className="w-4 h-4 shrink-0" />
                <span className="truncate flex-1">{doc.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteFile(doc.id) }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity shrink-0"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))}
          </div>

          <div className="p-3 border-t border-border/60">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={createFile}>
              <Plus className="w-4 h-4" /> New File
            </Button>
          </div>
        </aside>

        {/* ── Main area ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ── Toolbar row ─────────────────────────────────────── */}
          <div className="flex items-center gap-1 px-4 h-12 border-b border-border/60 bg-muted/5 shrink-0">
            <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)} className={sidebarOpen ? "hidden" : ""}>
              <Menu className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1 mr-2">
              {toolbarActions.map((btn) => (
                <Button key={btn.label} variant="ghost" size="icon-sm" onClick={btn.action} title={btn.label}>
                  <btn.icon className="w-4 h-4" />
                </Button>
              ))}
            </div>

            <div className="w-px h-5 bg-border/60 mx-1" />

            <Button variant="ghost" size="icon-sm" onClick={exportHTML} title="Export HTML">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={exportText} title="Copy as text">
              <FileText className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={exportMD} title="Download .md">
              <Download className="w-4 h-4" />
            </Button>

            {/* ── Title ─────────────────────────── */}
            <div className="flex-1 text-center">
              {editingTitle ? (
                <input
                  autoFocus
                  className="text-sm font-medium bg-muted/30 border border-border/60 rounded-lg px-3 py-1 text-center outline-none focus:ring-2 focus:ring-blue-500/30 w-64"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => { if (e.key === "Enter") commitTitle() }}
                />
              ) : (
                <button
                  onClick={startTitleEdit}
                  className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors inline-flex items-center gap-1.5"
                >
                  {title}
                  <Edit3 className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* ── Stats ─────────────────────────── */}
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {wc} words · {cc} chars
            </div>
          </div>

          {/* ── Split pane ──────────────────────────────────────── */}
          <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
            {/* Editor */}
            <div className="overflow-hidden" style={{ width: `${split}%` }}>
              <textarea
                ref={textareaRef}
                className="w-full h-full bg-background text-sm text-foreground font-mono leading-relaxed p-5 resize-none outline-none border-none"
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Start writing markdown..."
                spellCheck={false}
              />
            </div>

            {/* Resizer */}
            <div
              className={`w-1.5 shrink-0 cursor-col-resize relative transition-colors ${
                dragging ? "bg-blue-500/50" : "bg-border/30 hover:bg-border/60"
              }`}
              onMouseDown={handleMouseDown}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-y-auto bg-card" style={{ width: `${100 - split}%` }}>
              <div className="p-6 md:p-8 max-w-none">
                <div
                  className="prose-custom"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                />
              </div>
            </div>
          </div>

          {/* ── Status bar ──────────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 h-9 border-t border-border/60 bg-muted/5 text-xs text-muted-foreground shrink-0">
            <span>{rt}</span>
            <span>{wc} words · {cc} characters</span>
          </div>
        </div>
      </div>
    </>
  )
}
