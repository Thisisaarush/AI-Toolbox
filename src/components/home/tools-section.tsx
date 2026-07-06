"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import {
  ArrowRight, Star, Search, Flame, Sparkles,
  ChevronDown, ChevronRight, LayoutGrid, List,
} from "lucide-react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { categories, type Tool } from "@/lib/tools-data"

const FAVORITES_KEY = "toolbox-favorites"
const VIEW_MODE_KEY = "toolbox-view-mode"
const EXPANDED_KEY = "toolbox-expanded-categories"

export function ToolsSection() {
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const [favorites, setFavorites] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const sectionRef = useRef<HTMLDivElement>(null)

  const allToolCount = categories.reduce((sum, c) => sum + c.tools.length, 0)

  // ── Favorites ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]")
      if (Array.isArray(saved)) setFavorites(saved)
    } catch {}
  }, [])

  function toggleFavorite(href: string) {
    setFavorites((prev) => {
      const next = prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
      return next
    })
  }

  // ── View mode (grid/list) ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    if (saved === "grid" || saved === "list") setViewMode(saved)
  }, [])

  function handleViewModeChange(mode: "grid" | "list") {
    setViewMode(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  // ── Collapsible categories ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]")
      if (Array.isArray(saved)) setExpandedCategories(new Set(saved))
    } catch {}
  }, [])

  function toggleCategoryExpanded(catId: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId)
      else next.add(catId)
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // A category renders fully expanded if the user toggled it open, or if
  // it's the only category shown because of an active filter.
  function isCategoryExpanded(catId: string): boolean {
    if (activeFilter === catId) return true
    return expandedCategories.has(catId)
  }

  // ── Scroll into view on filter change ─────────────────────────────────
  useEffect(() => {
    if (sectionRef.current && activeFilter !== "all") {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [activeFilter])

  // Build a reverse-lookup from href → Tool
  const toolByHref = new Map<string, Tool>()
  const allTools: Tool[] = []
  for (const cat of categories) {
    for (const t of cat.tools) {
      toolByHref.set(t.href, t)
      allTools.push(t)
    }
  }

  // Favorited tools (for the top section)
  const favoriteTools = favorites
    .map((href) => toolByHref.get(href))
    .filter((t): t is Tool => t !== undefined)

  // Curated rows — only shown on the unfiltered "All" view
  const popularTools = allTools.filter((t) => t.popular)
  const newTools = allTools.filter((t) => t.isNew)

  // Categories filtered by the active category pill
  const baseCategories = activeFilter === "all"
    ? categories
    : categories.filter((c) => c.id === activeFilter)

  const visibleCategories = baseCategories.filter((c) => c.tools.length > 0)

  const showFavorites = activeFilter === "all" && favoriteTools.length > 0
  const showPopular = activeFilter === "all" && popularTools.length > 0
  const showNew = activeFilter === "all" && newTools.length > 0
  const hasAnyResults = showFavorites || showPopular || showNew || visibleCategories.length > 0

  return (
    <section
      id="tools-section"
      ref={sectionRef}
      className="bg-background"
    >
      <div className="max-w-7xl mx-auto px-4 pt-10 pb-16 md:pb-20">

        {/* ── View toggle ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-0.5 border border-input rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => handleViewModeChange("grid")}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                viewMode === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleViewModeChange("list")}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                viewMode === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 mb-12">
          <button
            onClick={() => setActiveFilter("all")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
              activeFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent"
            }`}
          >
            All
            <span className={`text-[10px] tabular-nums ${activeFilter === "all" ? "opacity-70" : "opacity-50"}`}>
              {allToolCount}
            </span>
          </button>

          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id === activeFilter ? "all" : cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all ${
                activeFilter === cat.id
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cat.legendColor} ${activeFilter === cat.id ? "opacity-100" : "opacity-70"}`} />
              {cat.label}
              <span className={`text-[10px] tabular-nums ${activeFilter === cat.id ? "opacity-70" : "opacity-50"}`}>
                {cat.tools.length}
              </span>
            </button>
          ))}
        </div>

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!hasAnyResults && (
          <div className="text-center py-20">
            <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">No tools found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              No tools in this category yet.
            </p>
          </div>
        )}

        {/* ── Category sections ───────────────────────────────────────── */}
        {hasAnyResults && (
          <div className="space-y-16">

            {/* ⭐ Favorites Section */}
            {showFavorites && (
              <div>
                <div className="flex items-center gap-2.5 mb-7">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <h2 className="text-xl font-bold tracking-tight">Favorites</h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {favoriteTools.length} tool{favoriteTools.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <ToolGrid tools={favoriteTools} viewMode={viewMode} favorites={favorites} onToggleFavorite={toggleFavorite} />
              </div>
            )}

            {/* 🔥 Most Popular Section */}
            {showPopular && (
              <div>
                <div className="flex items-center gap-2.5 mb-7">
                  <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <h2 className="text-xl font-bold tracking-tight">Most Popular</h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {popularTools.length} tool{popularTools.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <ToolGrid tools={popularTools} viewMode={viewMode} favorites={favorites} onToggleFavorite={toggleFavorite} />
              </div>
            )}

            {/* ✨ Newly Added Section */}
            {showNew && (
              <div>
                <div className="flex items-center gap-2.5 mb-7">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  <h2 className="text-xl font-bold tracking-tight">Newly Added</h2>
                  <span className="text-xs text-muted-foreground font-mono">
                    {newTools.length} tool{newTools.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <ToolGrid tools={newTools} viewMode={viewMode} favorites={favorites} onToggleFavorite={toggleFavorite} />
              </div>
            )}

            {/* Regular categories — collapsible */}
            {visibleCategories.map((cat) => {
              const expanded = isCategoryExpanded(cat.id)
              return (
                <div key={cat.id}>
                  <button
                    onClick={() => toggleCategoryExpanded(cat.id)}
                    className="flex items-center gap-2.5 mb-7 w-full text-left group/catheader"
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={`w-2.5 h-2.5 rounded-full ${cat.legendColor} shrink-0`} />
                    <h2 className="text-xl font-bold tracking-tight group-hover/catheader:text-foreground/80 transition-colors">{cat.label}</h2>
                    <span className="text-xs text-muted-foreground font-mono">
                      {cat.tools.length} tool{cat.tools.length !== 1 ? "s" : ""}
                    </span>
                  </button>

                  {expanded && (
                    <ToolGrid tools={cat.tools} viewMode={viewMode} favorites={favorites} onToggleFavorite={toggleFavorite} />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

// ── Tool Grid (renders either card grid or list rows) ─────────────────────────
function ToolGrid({
  tools,
  viewMode,
  favorites,
  onToggleFavorite,
}: {
  tools: Tool[]
  viewMode: "grid" | "list"
  favorites: string[]
  onToggleFavorite: (href: string) => void
}) {
  if (viewMode === "list") {
    return (
      <div className="border border-border/60 rounded-xl divide-y divide-border/60 overflow-hidden">
        {tools.map((tool) => (
          <ToolListItem
            key={tool.name}
            tool={tool}
            isFavorited={favorites.includes(tool.href)}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {tools.map((tool) => (
        <ToolCard
          key={tool.name}
          tool={tool}
          isFavorited={favorites.includes(tool.href)}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
}

// ── Tool List Item (compact row for list view) ────────────────────────────────
function ToolListItem({
  tool,
  isFavorited,
  onToggleFavorite,
}: {
  tool: Tool
  isFavorited: boolean
  onToggleFavorite: (href: string) => void
}) {
  return (
    <Link
      href={tool.href}
      className="group flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent/50 transition-colors"
    >
      <div className={`w-8 h-8 rounded-lg ${tool.bgColor} flex items-center justify-center shrink-0`}>
        <tool.icon className={`w-4 h-4 ${tool.color}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{tool.name}</span>
          {tool.isNew && (
            <span className="shrink-0 inline-flex items-center rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
              New
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
      </div>
      <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">{tool.badge}</Badge>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleFavorite(tool.href)
        }}
        className={`shrink-0 transition-colors ${isFavorited ? "text-yellow-500" : "text-muted-foreground/40 hover:text-muted-foreground/70"}`}
        aria-label={isFavorited ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
      >
        <Star className={`w-4 h-4 ${isFavorited ? "fill-yellow-500" : ""}`} />
      </button>
      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
    </Link>
  )
}

// ── Tool Card ────────────────────────────────────────────────────────────────
function ToolCard({
  tool,
  isFavorited,
  onToggleFavorite,
}: {
  tool: Tool
  isFavorited: boolean
  onToggleFavorite: (href: string) => void
}) {
  return (
    <Link
      href={tool.href}
      className="group"
    >
      <Card className={`relative h-full flex flex-col border-t-2 ${tool.borderColor} overflow-visible`}>
        {tool.isNew && (
          <span className="absolute -top-2 left-3 inline-flex items-center rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
            New
          </span>
        )}
        <CardHeader className="flex-1">
          <div className="mb-4 flex items-start justify-between">
            <div className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center`}>
              <tool.icon className={`w-5 h-5 ${tool.color}`} />
            </div>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onToggleFavorite(tool.href)
              }}
              className={`transition-colors ${isFavorited ? "text-yellow-500" : "text-muted-foreground/40 hover:text-muted-foreground/70"}`}
              aria-label={isFavorited ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
            >
              <Star className={`w-4 h-4 ${isFavorited ? "fill-yellow-500" : ""}`} />
            </button>
          </div>
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            {tool.name}
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed mt-1">
            {tool.description}
          </CardDescription>
        </CardHeader>
        <div className="px-(--card-spacing) pb-(--card-spacing)">
          <Badge variant="secondary" className="text-xs">{tool.badge}</Badge>
        </div>
      </Card>
    </Link>
  )
}
