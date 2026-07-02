import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { DepInfo, ScanResult } from "./types"

const limiter = rateLimit({ max: 30, windowMs: 60000 })

// ── Levenshtein distance for typosquat detection ──────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) { dp[i]![0] = i }
  for (let j = 0; j <= n; j++) { dp[0]![j] = j }
  for (let i = 1; i <= m; i++) {
    const row = dp[i]!
    const prevRow = dp[i - 1]!
    for (let j = 1; j <= n; j++) {
      row[j] = a[i - 1] === b[j - 1] ? prevRow[j - 1]! : Math.min(prevRow[j]!, row[j - 1]!, prevRow[j - 1]!) + 1
    }
  }
  return dp[m]![n]!
}

const POPULAR_PACKAGES = new Set([
  "react", "react-dom", "next", "express", "lodash", "axios", "typescript", "eslint",
  "prettier", "webpack", "vite", "babel", "tailwindcss", "postcss", "autoprefixer",
  "uuid", "moment", "date-fns", "dayjs", "chalk", "commander", "yargs", "dotenv",
  "cors", "body-parser", "cookie-parser", "jsonwebtoken", "bcrypt", "passport",
  "mongoose", "prisma", "typeorm", "redis", "socket.io", "graphql", "apollo-server",
  "jest", "vitest", "mocha", "chai", "cypress", "playwright", "storybook",
  "styled-components", "emotion", "sass", "less", "stylus", "redux", "zustand",
  "jotai", "recoil", "react-router", "react-query", "swr", "trpc", "zod", "yup",
  "joi", "classnames", "clsx", "framer-motion", "react-hook-form", "formik",
  "i18next", "react-i18next", "helmet", "compression", "multer", "sharp",
  "puppeteer", "cheerio", "jsdom", "dompurify", "sanitize-html", "marked",
  "remark", "rehype", "unified", "mdx", "next-mdx-remote", "next-auth",
  "json5", "csv-parse", "papaparse", "xlsx", "pdfkit", "jspdf",
  "zustand", "immer", "valtio", "nanoid", "crypto-js", "node-fetch",
  "supabase", "firebase", "aws-sdk", "@aws-sdk/client-s3", "stripe",
  "nodemailer", "bull", "bullmq", "agenda", "winston", "pino", "morgan",
  "lodash-es", "ramda", "rxjs", "immer", "fuse.js", "match-sorter",
])

function detectTyposquat(name: string): { score: number; of: string | null } {
  const scope = name.startsWith("@") ? name.split("/")[1] : name
  if (!scope) return { score: 0, of: null }

  let bestScore = 0
  let bestMatch: string | null = null

  for (const popular of POPULAR_PACKAGES) {
    const dist = levenshtein(scope.toLowerCase(), popular.toLowerCase())
    if (dist === 0) return { score: 0, of: null } // exact match = not typosquatting
    if (dist <= 2 && scope.length >= 4) {
      const sim = 1 - dist / Math.max(scope.length, popular.length)
      if (sim > bestScore) {
        bestScore = sim
        bestMatch = popular
      }
    }
  }

  return {
    score: bestScore > 0 ? Math.round(bestScore * 100) : 0,
    of: bestMatch,
  }
}

function calculateHealth(dep: {
  latestVersion: string | null
  lastPublishDate: string | null
  hasVulnerabilities: boolean
  typosquatScore: number
  isDeprecated: boolean
  downloadCount: number | null
  isOutdated: boolean
}): number {
  let score = 80

  if (!dep.latestVersion) score -= 20
  if (dep.isOutdated) score -= 15
  if (dep.hasVulnerabilities) score -= dep.hasVulnerabilities ? 25 : 0
  if (dep.typosquatScore > 60) score -= 30
  else if (dep.typosquatScore > 30) score -= 15
  if (dep.isDeprecated) score -= 30
  if (dep.lastPublishDate) {
    const monthsSincePublish = (Date.now() - new Date(dep.lastPublishDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
    if (monthsSincePublish > 12) score -= 15
    else if (monthsSincePublish > 6) score -= 8
  }
  if (dep.downloadCount !== null && dep.downloadCount < 1000) score -= 10

  return Math.max(0, Math.min(100, score))
}

// ── NPM registry helpers ──────────────────────────────────────────────────────
interface NpmPackageResponse {
  name: string
  description?: string
  license?: string
  homepage?: string
  repository?: { url?: string; type?: string }
  "dist-tags"?: { latest?: string }
  time?: Record<string, string>
  versions?: Record<string, { deprecated?: string; dependencies?: Record<string, string> }>
}

async function fetchNpmPackage(name: string): Promise<NpmPackageResponse | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name).replace(/%2F/g, "/")}`, {
      headers: { Accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function fetchDownloadCount(name: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.downloads ?? null
  } catch {
    return null
  }
}

// ── Semver helpers ────────────────────────────────────────────────────────────
function isOutdated(current: string, latest: string | undefined): boolean {
  if (!latest) return false
  const cur = current.replace(/^[\^~]/, "").split(".").map(Number)
  const lat = latest.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if ((cur[i] ?? 0) < (lat[i] ?? 0)) return true
    if ((cur[i] ?? 0) > (lat[i] ?? 0)) return false
  }
  return false
}

function parseDeps(deps: Record<string, string> | undefined): { name: string; version: string }[] {
  if (!deps) return []
  return Object.entries(deps)
    .filter(([name]) => !name.startsWith("node:"))
    .map(([name, version]) => ({
      name,
      version: version.replace(/^[\^~]/, ""),
    }))
}

// ── Gemini bulk analysis (premium) ─────────────────────────────────────────────
async function aiBulkAnalysis(geminiKey: string, deps: DepInfo[]): Promise<string> {
  const genAI = new GoogleGenerativeAI(geminiKey)
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

  const depList = deps.map((d) =>
    `- ${d.name}@${d.currentVersion} (health: ${d.healthScore}/100, outdated: ${d.isOutdated}, vulns: ${d.vulnerabilityCount}, typosquat: ${d.typosquatScore}%)`
  ).join("\n")

  const prompt = `You are a dependency security expert. Analyze this project's dependencies:

${depList}

Provide:
1. **Overall assessment** — is this dependency set healthy or concerning?
2. **Biggest risks** — which packages need immediate attention and why
3. **Upgrade priorities** — which deps should be upgraded first
4. **Recommended alternatives** — if any packages are risky or unmaintained, suggest better options
5. **General advice** — best practices for this project's dependency management

Be concise and direct. Use bullet points.`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

// ── Action handlers ──────────────────────────────────────────────────────────

async function handleScanDeps(body: { packageJson: string; geminiKey?: string }) {
  if (!body.packageJson) throw new ApiError("packageJson is required", 400)

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(body.packageJson)
  } catch {
    throw new ApiError("Invalid JSON in package.json", 400)
  }

  const prodDeps = parseDeps(parsed.dependencies as Record<string, string>)
  const devDeps = parseDeps(parsed.devDependencies as Record<string, string>)
  const allDeps = [...prodDeps, ...devDeps]
  if (allDeps.length === 0) throw new ApiError("No dependencies found in package.json", 400)

  const results = await Promise.allSettled(
    allDeps.map(async ({ name, version }) => {
      const [pkg, downloads] = await Promise.all([fetchNpmPackage(name), fetchDownloadCount(name)])

      const latestVersion = pkg?.["dist-tags"]?.latest ?? null
      const latestPkg = latestVersion ? pkg?.versions?.[latestVersion] : undefined

      const scope = name.startsWith("@") ? (name.split("/")[0] ?? null) : null

      const depInfo: DepInfo = {
        name,
        scope,
        currentVersion: version,
        latestVersion,
        isOutdated: isOutdated(version, latestVersion ?? undefined),
        isDevDependency: devDeps.some((d) => d.name === name),
        description: pkg?.description ?? null,
        license: pkg?.license ?? null,
        homepage: pkg?.homepage ?? null,
        repository: pkg?.repository?.url ?? null,
        lastPublishDate: pkg?.time?.[latestVersion ?? ""] ?? null,
        downloadCount: downloads,
        hasVulnerabilities: false,
        vulnerabilityCount: 0,
        typosquatScore: 0,
        typosquatOf: null,
        suggestedAlternatives: [],
        aiRiskSummary: null,
        aiRecommendation: null,
        dependencyCount: latestPkg?.dependencies ? Object.keys(latestPkg.dependencies).length : 0,
        isDeprecated: !!latestPkg?.deprecated,
        deprecatedReason: latestPkg?.deprecated ?? null,
        healthScore: 0,
      }

      const typosquat = detectTyposquat(name)
      depInfo.typosquatScore = typosquat.score
      depInfo.typosquatOf = typosquat.of

      depInfo.healthScore = calculateHealth(depInfo)

      return depInfo
    })
  )

  const dependencies: DepInfo[] = []
  const devDependenciesInfo: DepInfo[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      const dep = result.value
      if (dep.isDevDependency) devDependenciesInfo.push(dep)
      else dependencies.push(dep)
    }
  }

  const all = [...dependencies, ...devDependenciesInfo]
  if (all.length === 0) throw new ApiError("Failed to analyze any dependencies", 502)

  const vulnerableCount = all.filter((d) => d.hasVulnerabilities).length
  const outdatedCount = all.filter((d) => d.isOutdated).length
  const deprecatedCount = all.filter((d) => d.isDeprecated).length
  const avgHealth = Math.round(all.reduce((s, d) => s + d.healthScore, 0) / all.length)

  let aiSummary: string | null = null
  if (body.geminiKey) {
    try {
      aiSummary = await aiBulkAnalysis(body.geminiKey, all)
    } catch {
      // AI analysis failure shouldn't break the whole scan
    }
  }

  const scanResult: ScanResult = {
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
    totalDeps: all.length,
    outdatedCount,
    vulnerableCount,
    deprecatedCount,
    averageHealthScore: avgHealth,
    dependencies,
    devDependencies: devDependenciesInfo,
    aiSummary,
  }

  return NextResponse.json(scanResult)
}

async function handleLookupPackage(body: { name: string }) {
  if (!body.name) throw new ApiError("package name is required", 400)

  const pkg = await fetchNpmPackage(body.name)
  if (!pkg) throw new ApiError(`Package "${body.name}" not found`, 404)

  const latestVersion = pkg["dist-tags"]?.latest ?? null
  const downloads = await fetchDownloadCount(body.name)

  const scope = body.name.startsWith("@") ? (body.name.split("/")[0] ?? null) : null

  return NextResponse.json({
    name: pkg.name,
    scope,
    description: pkg.description ?? null,
    license: pkg.license ?? null,
    homepage: pkg.homepage ?? null,
    repository: pkg.repository?.url ?? null,
    latestVersion,
    lastPublishDate: latestVersion ? pkg.time?.[latestVersion] ?? null : null,
    downloadCount: downloads,
    totalVersions: pkg.time ? Object.keys(pkg.time).length - 1 : 0,
  })
}

async function fetchMaintainers(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name).replace(/%2F/g, "/")}`,
      {
        headers: { Accept: "application/vnd.npm.pkg-v1+json" },
        signal: AbortSignal.timeout(3000),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const maintainers: { name: string }[] | undefined = data.maintainers
    if (Array.isArray(maintainers) && maintainers.length > 0) {
      return maintainers[0]?.name ?? null
    }
    return null
  } catch {
    return null
  }
}

async function handleSearchPackages(body: { query: string }) {
  if (!body.query || body.query.length < 2) throw new ApiError("Query must be at least 2 characters", 400)

  const res = await fetch(
    `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(body.query)}&size=20`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) throw new ApiError("Search failed", 502)

  const data = await res.json()
  const rawResults = (data.objects ?? []).map((obj: Record<string, unknown>) => {
    const pkg = obj.package as Record<string, unknown>
    const score = obj.score as Record<string, unknown> | undefined
    return {
      name: pkg.name as string,
      scope: (pkg.scope as string) ?? null,
      publisher: (pkg.publisher as Record<string, string>)?.username ?? null,
      version: pkg.version as string,
      description: pkg.description as string,
      lastPublishDate: pkg.date as string,
      keywords: (pkg.keywords as string[]) ?? [],
      healthScore: score?.final ? Math.round(Number(score.final) * 100) : null,
    }
  })

  const maintainers = await Promise.allSettled(
    rawResults.map((r: { name: string }) => fetchMaintainers(r.name))
  )

  const results = rawResults.map((r: Record<string, unknown>, i: number) => ({
    ...r,
    publisher: maintainers[i]?.status === "fulfilled" && maintainers[i].value
      ? maintainers[i].value
      : r.publisher,
  }))

  return NextResponse.json({ results, total: data.total ?? 0 })
}

async function handleAIAnalysis(body: { geminiKey: string; deps: DepInfo[] }) {
  if (!body.geminiKey) throw new ApiError("Gemini key required for AI analysis", 402)
  if (!body.deps?.length) throw new ApiError("Dependencies array required", 400)

  const summary = await aiBulkAnalysis(body.geminiKey, body.deps)
  return NextResponse.json({ summary })
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const { allowed } = limiter.check(`dependguard:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action, ...params } = body

    switch (action) {
      case "scan-deps":
        return handleScanDeps(params)
      case "lookup-package":
        return handleLookupPackage(params)
      case "search-packages":
        return handleSearchPackages(params)
      case "ai-analysis":
        return handleAIAnalysis(params)
      default:
        throw new ApiError(`Unknown action: ${action}`, 400)
    }
  } catch (err) {
    return handleApiError(err)
  }
}
