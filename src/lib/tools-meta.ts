// Shared tool metadata — no "use client", safe to import in Server Components.
// The actual icon components live in tools-section.tsx (client-only).

export const CATEGORY_META = [
  { id: "development",      label: "Development",         legendColor: "bg-blue-500",   count: 8  },
  { id: "finance",           label: "Finance",             legendColor: "bg-green-500",  count: 4  },
  { id: "launch-marketing",  label: "Launch & Marketing",  legendColor: "bg-orange-500", count: 7  },
  { id: "content-creative",  label: "Content & Creative",  legendColor: "bg-purple-500", count: 3  },
  { id: "career-learning",   label: "Career & Learning",   legendColor: "bg-indigo-500", count: 7  },
  { id: "personal",          label: "Personal",            legendColor: "bg-amber-500",  count: 9  },
  { id: "social",            label: "Social",              legendColor: "bg-pink-500",   count: 1  },
  { id: "legal",             label: "Legal",               legendColor: "bg-rose-500",   count: 1  },
] as const

export const ALL_TOOL_COUNT = CATEGORY_META.reduce((sum, c) => sum + c.count, 0)
