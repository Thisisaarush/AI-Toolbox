export type VarType = "string" | "secret" | "url" | "number" | "boolean"

export type ValidationType = "url" | "email" | "uuid" | "jwt" | "none"

export interface VarValidation {
  type: ValidationType
  required: boolean
}

export interface EnvVar {
  id: string
  key: string
  value: string
  type: VarType
  description: string
  createdAt: string
  updatedAt: string
  rotationInterval?: number | null   // days
  lastRotatedAt?: string | null
  validation?: VarValidation | null
}

export type EnvironmentName = "development" | "staging" | "production" | "preview" | string

export interface Environment {
  id: string
  name: EnvironmentName
  vars: EnvVar[]
  inheritsFrom?: string | null   // envId
  exampleContent?: string        // stored .env.example text
}

export interface Project {
  id: string
  name: string
  description: string
  environments: Environment[]
  createdAt: string
  updatedAt: string
}

export type AuditAction = "created" | "updated" | "deleted" | "rotated"

export interface AuditEntry {
  id: string
  projectId: string
  environmentId: string
  varKey: string
  action: AuditAction
  timestamp: string
}

export const VAR_TYPE_META: Record<VarType, { label: string; color: string; masked: boolean }> = {
  string: { label: "String", color: "text-blue-500", masked: false },
  secret: { label: "Secret", color: "text-red-500", masked: true },
  url: { label: "URL", color: "text-green-500", masked: false },
  number: { label: "Number", color: "text-purple-500", masked: false },
  boolean: { label: "Boolean", color: "text-orange-500", masked: false },
}

// XOR "obfuscation" for localStorage (not real security — just obfuscation)
const XOR_KEY = 0x42
export function obfuscate(value: string): string {
  return Array.from(value)
    .map((c) => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY))
    .join("")
}
export function deobfuscate(value: string): string {
  return obfuscate(value) // XOR is symmetric
}

export function parseEnvFile(content: string): Pick<EnvVar, "key" | "value" | "type">[] {
  const lines = content.split("\n")
  const vars: Pick<EnvVar, "key" | "value" | "type">[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eqIdx = trimmed.indexOf("=")
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!key) continue
    const type = inferType(key, value)
    vars.push({ key, value, type })
  }
  return vars
}

function inferType(key: string, value: string): VarType {
  const lk = key.toLowerCase()
  if (lk.includes("secret") || lk.includes("password") || lk.includes("token") || lk.includes("key") || lk.includes("private")) {
    return "secret"
  }
  if (lk.includes("url") || lk.includes("uri") || lk.includes("endpoint") || value.startsWith("http")) {
    return "url"
  }
  if (value === "true" || value === "false") return "boolean"
  if (!isNaN(Number(value)) && value !== "") return "number"
  return "string"
}

export function generateEnvFile(vars: EnvVar[], maskSecrets = false): string {
  return vars.map((v) => {
    const val = maskSecrets && v.type === "secret" ? "" : v.value
    const needsQuotes = val.includes(" ") || val.includes("#") || val.includes("$")
    const quoted = needsQuotes ? `"${val}"` : val
    const comment = v.description ? `# ${v.description}\n` : ""
    return `${comment}${v.key}=${quoted}`
  }).join("\n")
}

export function diffEnvironments(envA: Environment, envB: Environment): {
  onlyInA: EnvVar[]
  onlyInB: EnvVar[]
  changed: Array<{ key: string; valueA: string; valueB: string }>
  same: EnvVar[]
} {
  const mapA = new Map(envA.vars.map((v) => [v.key, v]))
  const mapB = new Map(envB.vars.map((v) => [v.key, v]))
  const allKeys = new Set([...mapA.keys(), ...mapB.keys()])

  const onlyInA: EnvVar[] = []
  const onlyInB: EnvVar[] = []
  const changed: Array<{ key: string; valueA: string; valueB: string }> = []
  const same: EnvVar[] = []

  for (const key of allKeys) {
    const a = mapA.get(key)
    const b = mapB.get(key)
    if (a && !b) onlyInA.push(a)
    else if (!a && b) onlyInB.push(b)
    else if (a && b) {
      if (a.value !== b.value) changed.push({ key, valueA: a.value, valueB: b.value })
      else same.push(a)
    }
  }
  return { onlyInA, onlyInB, changed, same }
}

// Validation helpers
export function validateVarValue(value: string, validation: VarValidation | null | undefined): boolean | null {
  if (!validation || validation.type === "none") return null
  if (validation.required && !value.trim()) return false

  switch (validation.type) {
    case "url":
      try { new URL(value); return true } catch { return false }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    case "uuid":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    case "jwt": {
      const parts = value.split(".")
      return parts.length === 3 && parts.every((p) => p.length > 0)
    }
    default:
      return null
  }
}

// Check rotation due
export function isRotationDue(v: EnvVar): boolean {
  if (!v.rotationInterval || !v.lastRotatedAt) return false
  const lastRotated = new Date(v.lastRotatedAt)
  const dueDate = new Date(lastRotated.getTime() + v.rotationInterval * 24 * 60 * 60 * 1000)
  return dueDate <= new Date()
}

export const VAR_TEMPLATES: Array<{ category: string; vars: string[] }> = [
  {
    category: "Database",
    vars: ["DATABASE_URL", "DATABASE_HOST", "DATABASE_PORT", "DATABASE_NAME", "DATABASE_USER", "DATABASE_PASSWORD"],
  },
  {
    category: "Auth",
    vars: ["NEXTAUTH_SECRET", "NEXTAUTH_URL", "AUTH_SECRET", "CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
  },
  {
    category: "AI / LLMs",
    vars: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"],
  },
  {
    category: "Storage",
    vars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET_NAME"],
  },
  {
    category: "Stripe",
    vars: ["STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
  },
]
