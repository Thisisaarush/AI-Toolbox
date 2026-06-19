// Shared tool metadata — no "use client", safe to import in Server Components.
// The actual icon components live in tools-section.tsx (client-only).

export const CATEGORY_META = [
  { id: "dev-tools", label: "Dev Tools",  legendColor: "bg-blue-500",    count: 11 },
  { id: "personal",  label: "Personal",   legendColor: "bg-orange-500",  count: 8 },
  { id: "education", label: "Education",  legendColor: "bg-violet-500",  count: 3 },
  { id: "career",    label: "Career",     legendColor: "bg-blue-600",    count: 2 },
  { id: "creator",   label: "Creator",    legendColor: "bg-fuchsia-500", count: 4 },
  { id: "legal",     label: "Legal",      legendColor: "bg-rose-500",    count: 1 },
] as const

export const ALL_TOOL_COUNT = CATEGORY_META.reduce((sum, c) => sum + c.count, 0)
