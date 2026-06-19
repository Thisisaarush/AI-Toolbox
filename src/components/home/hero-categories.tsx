"use client"

import { CATEGORY_META, ALL_TOOL_COUNT } from "@/lib/tools-meta"

export function HeroCategories() {
  function handleClick(catId: string) {
    window.dispatchEvent(new CustomEvent("toolbox-filter", { detail: catId }))
    document.getElementById("tools-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button
        onClick={() => handleClick("all")}
        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors"
      >
        All
        <span className="text-[10px] opacity-50">{ALL_TOOL_COUNT}</span>
      </button>
      {CATEGORY_META.map((cat) => (
        <button
          key={cat.id}
          onClick={() => handleClick(cat.id)}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50 hover:text-black/80 dark:hover:text-white/80 transition-colors cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full ${cat.legendColor}`} />
          {cat.label}
        </button>
      ))}
    </div>
  )
}
