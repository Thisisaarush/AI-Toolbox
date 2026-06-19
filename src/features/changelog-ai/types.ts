export type ChangeType = "feature" | "improvement" | "fix" | "breaking" | "deprecation"

export const CHANGE_TYPE_META: Record<ChangeType, { label: string; color: string; bg: string; emoji: string }> = {
  feature: { label: "New Features", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950", emoji: "✨" },
  improvement: { label: "Improvements", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950", emoji: "⚡" },
  fix: { label: "Bug Fixes", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950", emoji: "🐛" },
  breaking: { label: "Breaking Changes", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950", emoji: "⚠️" },
  deprecation: { label: "Deprecations", color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-900", emoji: "🗑️" },
}

export interface ChangelogEntry {
  id: string
  type: ChangeType
  title: string
  description: string
  technicalDetails?: string
  rawCommit?: string
}

export type ToneId = "friendly" | "professional" | "technical"
export type OutputFormat = "markdown" | "html" | "tweet" | "email" | "github"

export interface Release {
  id: string
  version: string
  releaseDate: string
  entries: ChangelogEntry[]
  tone: ToneId
  useEmojis: boolean
  createdAt: string
}

export function generateMarkdown(release: Release): string {
  const lines: string[] = []
  lines.push(`## ${release.useEmojis ? "🚀 " : ""}${release.version} — ${release.releaseDate}`)
  lines.push("")

  const byType = new Map<ChangeType, ChangelogEntry[]>()
  for (const entry of release.entries) {
    if (!byType.has(entry.type)) byType.set(entry.type, [])
    byType.get(entry.type)!.push(entry)
  }

  const order: ChangeType[] = ["feature", "improvement", "fix", "breaking", "deprecation"]
  for (const type of order) {
    const entries = byType.get(type)
    if (!entries || entries.length === 0) continue
    const meta = CHANGE_TYPE_META[type]
    lines.push(`### ${release.useEmojis ? meta.emoji + " " : ""}${meta.label}`)
    lines.push("")
    for (const entry of entries) {
      lines.push(`- **${entry.title}**: ${entry.description}`)
      if (entry.technicalDetails) {
        lines.push(`  <details><summary>Technical details</summary>${entry.technicalDetails}</details>`)
      }
    }
    lines.push("")
  }

  return lines.join("\n").trim()
}

export function generateHTML(release: Release): string {
  const md = generateMarkdown(release)
  return `<div class="changelog-release">
${md.split("\n").map((line) => {
  if (line.startsWith("## ")) return `  <h2 class="changelog-version">${line.slice(3)}</h2>`
  if (line.startsWith("### ")) return `  <h3 class="changelog-type">${line.slice(4)}</h3>`
  if (line.startsWith("- ")) return `  <li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}</li>`
  if (line === "") return ""
  return `  <p>${line}</p>`
}).filter((l) => l !== "").join("\n")}
</div>`
}

export function generateGitHubRelease(release: Release): string {
  return generateMarkdown(release)
}
