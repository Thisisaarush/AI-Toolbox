"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { Search, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { categories, type Tool } from "@/lib/tools-data"

const RECENT_KEY = "toolbox-recent-tools"
const MAX_RECENT = 5

const allTools: Tool[] = categories.flatMap((c) => c.tools)
const toolByHref = new Map(allTools.map((t) => [t.href, t]))

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentHrefs, setRecentHrefs] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // ── Global keyboard shortcut (⌘K / Ctrl+K) + external open trigger ──────
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    function handleExternalOpen() { setOpen(true) }
    window.addEventListener("keydown", handleKeydown)
    window.addEventListener("open-command-palette", handleExternalOpen)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
      window.removeEventListener("open-command-palette", handleExternalOpen)
    }
  }, [])

  // ── Track recently visited tool pages (works regardless of entry point) ─
  useEffect(() => {
    if (!pathname?.startsWith("/tools/")) return
    try {
      const saved: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
      const next = [pathname, ...saved.filter((h) => h !== pathname)].slice(0, MAX_RECENT)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {}
  }, [pathname])

  // ── Reset + load recent when opened ──────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setQuery("")
    setActiveIndex(0)
    try {
      setRecentHrefs(JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"))
    } catch {
      setRecentHrefs([])
    }
    const t = setTimeout(() => inputRef.current?.focus(), 10)
    return () => clearTimeout(t)
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) {
      return recentHrefs
        .map((href) => toolByHref.get(href))
        .filter((t): t is Tool => t !== undefined)
    }
    const q = query.toLowerCase()
    return allTools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.badge.toLowerCase().includes(q),
    )
  }, [query, recentHrefs])

  const showingRecent = !query.trim() && results.length > 0

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const tool = results[activeIndex]
      if (tool) navigate(tool.href)
    }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Popup className="fixed top-[12%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl mx-4 rounded-xl bg-popover ring-1 ring-foreground/10 shadow-2xl outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0) }}
              onKeyDown={handleKeyDown}
              placeholder="Search tools..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              aria-label="Search tools"
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
              Esc
            </kbd>
          </div>

          <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2">
            {showingRecent && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="w-3 h-3" /> Recent
              </div>
            )}

            {results.length === 0 && (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No tools match &ldquo;{query}&rdquo;</p>
              </div>
            )}

            {results.map((tool, i) => (
              <button
                key={tool.href}
                data-index={i}
                onClick={() => navigate(tool.href)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                  i === activeIndex ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <div className={`w-8 h-8 rounded-lg ${tool.bgColor} flex items-center justify-center shrink-0`}>
                  <tool.icon className={`w-4 h-4 ${tool.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{tool.description}</div>
                </div>
              </button>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
