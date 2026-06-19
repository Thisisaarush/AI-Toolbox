export type ChangeType = "feature" | "improvement" | "fix" | "breaking" | "deprecation"

export const CHANGE_TYPE_META: Record<ChangeType, { label: string; color: string; bg: string; emoji: string; icon: string }> = {
  feature:     { label: "New Features",     color: "text-green-600",  bg: "bg-green-50 dark:bg-green-950",   emoji: "✨", icon: "✨" },
  improvement: { label: "Improvements",     color: "text-blue-600",   bg: "bg-blue-50 dark:bg-blue-950",     emoji: "⚡", icon: "⚡" },
  fix:         { label: "Bug Fixes",        color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950", emoji: "🐛", icon: "🐛" },
  breaking:    { label: "Breaking Changes", color: "text-red-600",    bg: "bg-red-50 dark:bg-red-950",       emoji: "⚠️", icon: "⚠️" },
  deprecation: { label: "Deprecations",     color: "text-gray-600",   bg: "bg-gray-50 dark:bg-gray-900",     emoji: "🗑️", icon: "🗑️" },
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
export type OutputFormat = "markdown" | "html" | "github" | "tweet" | "email"

export interface Release {
  id: string
  version: string
  releaseDate: string
  entries: ChangelogEntry[]
  tone: ToneId
  useEmojis: boolean
  createdAt: string
}

export interface ReleaseStats {
  total: number
  byType: Partial<Record<ChangeType, number>>
  biggestType: ChangeType | null
  sizeLabel: "Minor release" | "Feature release" | "Breaking release"
}

export function computeReleaseStats(entries: ChangelogEntry[]): ReleaseStats {
  const byType: Partial<Record<ChangeType, number>> = {}
  for (const e of entries) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
  }

  let biggestType: ChangeType | null = null
  let biggestCount = 0
  for (const [type, count] of Object.entries(byType) as [ChangeType, number][]) {
    if (count > biggestCount) { biggestCount = count; biggestType = type }
  }

  let sizeLabel: ReleaseStats["sizeLabel"] = "Minor release"
  if (byType.breaking && byType.breaking > 0) sizeLabel = "Breaking release"
  else if (byType.feature && byType.feature > 0) sizeLabel = "Feature release"

  return { total: entries.length, byType, biggestType, sizeLabel }
}

/**
 * Parse a semver string (with or without leading "v") and bump the requested component.
 * Falls back gracefully for non-semver strings.
 */
export function bumpVersion(version: string, type: "major" | "minor" | "patch"): string {
  const stripped = version.trim().replace(/^v/i, "")
  const match = stripped.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match) {
    // Non-semver: append a suffix indicating the bump type
    return `${version}-${type}-bump`
  }
  const [, majorStr, minorStr, patchStr, rest] = match
  let major = parseInt(majorStr ?? "0", 10)
  let minor = parseInt(minorStr ?? "0", 10)
  let patch = parseInt(patchStr ?? "0", 10)

  if (type === "major") { major += 1; minor = 0; patch = 0 }
  else if (type === "minor") { minor += 1; patch = 0 }
  else { patch += 1 }

  // Preserve leading "v" if original had it
  const prefix = version.trim().match(/^v/i) ? "v" : ""
  return `${prefix}${major}.${minor}.${patch}${rest}`
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

export function generateEmailHtml(release: Release): string {
  const features = release.entries.filter((e) => e.type === "feature")
  const improvements = release.entries.filter((e) => e.type === "improvement")
  const fixes = release.entries.filter((e) => e.type === "fix")
  const breaking = release.entries.filter((e) => e.type === "breaking")

  const sectionHtml = (title: string, icon: string, color: string, items: ChangelogEntry[]) => {
    if (items.length === 0) return ""
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding-bottom:8px;border-bottom:2px solid ${color};">
          <span style="font-size:16px;font-weight:700;color:#111;">${icon} ${title}</span>
        </td>
      </tr>
      ${items.map((e) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <strong style="color:#111;">${e.title}</strong><br/>
          <span style="color:#555;font-size:14px;">${e.description}</span>
        </td>
      </tr>`).join("")}
    </table>`
  }

  const words = release.entries.map((e) => `${e.title} ${e.description}`).join(" ").split(/\s+/).length
  const readTime = Math.max(1, Math.round(words / 200))

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0ea5e9;padding:32px 40px;">
            <p style="margin:0;color:rgba(255,255,255,.8);font-size:12px;text-transform:uppercase;letter-spacing:.1em;">Release Notes</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:32px;font-weight:800;font-family:monospace;">${release.version}</h1>
            <p style="margin:6px 0 0;color:rgba(255,255,255,.7);font-size:14px;">${release.releaseDate} · ~${readTime} min read · ${release.entries.length} changes</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            ${sectionHtml("New Features", "✨", "#16a34a", features)}
            ${sectionHtml("Improvements", "⚡", "#2563eb", improvements)}
            ${sectionHtml("Bug Fixes", "🐛", "#ea580c", fixes)}
            ${sectionHtml("Breaking Changes", "⚠️", "#dc2626", breaking)}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              You're receiving this because you subscribed to release notes.<br/>
              <a href="#" style="color:#9ca3af;">Unsubscribe</a> · <a href="#" style="color:#9ca3af;">View in browser</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
