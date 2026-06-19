"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Lock, Plus, Trash2, Copy, Check, Eye, EyeOff, Search, Loader2,
  Download, Upload, ArrowRight, X, AlertCircle,
  Layers, GitCompare, Zap, Shield, AlertTriangle,
  Clock, RefreshCw, Code, Link as LinkIcon, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, RotateCcw, FileText, Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  type Project, type Environment, type EnvVar, type VarType, type AuditEntry,
  type VarValidation, type ValidationType,
  VAR_TYPE_META, parseEnvFile, generateEnvFile, diffEnvironments, VAR_TEMPLATES,
  obfuscate, deobfuscate, validateVarValue, isRotationDue,
} from "./types"

const STORAGE_KEY = "env-manager-v1"
const AUDIT_KEY = "env-manager-audit-v1"

// ── AES-GCM crypto helpers (Web Crypto API) ──────────────────────────────────
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  )
}

async function encryptEnvVars(vars: EnvVar[], passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array<ArrayBuffer>
  const iv = crypto.getRandomValues(new Uint8Array(12)) as Uint8Array<ArrayBuffer>
  const key = await deriveKey(passphrase, salt)
  const plaintext = new TextEncoder().encode(JSON.stringify(vars.map((v) => ({ key: v.key, value: v.value, type: v.type }))))
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)

  // Pack: salt(16) + iv(12) + ciphertext → base64
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length)
  return btoa(String.fromCharCode(...combined))
}

function generateEncryptedHTML(projectName: string, envName: string, encryptedB64: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Env Export: ${projectName} / ${envName}</title>
<style>
  body { font-family: monospace; max-width: 700px; margin: 60px auto; padding: 0 20px; background: #0f0f0f; color: #e1e1e1; }
  h1 { color: #a78bfa; font-size: 1.2rem; }
  input, button { padding: 8px 14px; border-radius: 6px; border: 1px solid #333; background: #1a1a1a; color: #e1e1e1; font-family: monospace; }
  button { background: #4f46e5; border-color: #4f46e5; color: white; cursor: pointer; margin-left: 8px; }
  pre { background: #1a1a1a; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; border: 1px solid #333; }
  .err { color: #f87171; margin-top: 8px; }
  .meta { color: #6b7280; font-size: 0.85rem; margin-bottom: 20px; }
</style>
</head>
<body>
<h1>Encrypted Env Export</h1>
<p class="meta">Project: <strong>${projectName}</strong> · Environment: <strong>${envName}</strong></p>
<p>Enter passphrase to decrypt:</p>
<input type="password" id="pw" placeholder="Passphrase" size="40" />
<button onclick="decrypt()">Decrypt</button>
<p class="err" id="err"></p>
<pre id="out" style="display:none"></pre>
<script>
const DATA = "${encryptedB64}";
async function decrypt() {
  const pw = document.getElementById('pw').value;
  if (!pw) { document.getElementById('err').textContent = 'Enter passphrase'; return; }
  try {
    const raw = Uint8Array.from(atob(DATA), c => c.charCodeAt(0));
    const salt = raw.slice(0, 16);
    const iv = raw.slice(16, 28);
    const ct = raw.slice(28);
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    const vars = JSON.parse(new TextDecoder().decode(plain));
    const lines = vars.map(v => v.key + '=' + v.value).join('\\n');
    document.getElementById('out').textContent = lines;
    document.getElementById('out').style.display = 'block';
    document.getElementById('err').textContent = '';
  } catch { document.getElementById('err').textContent = 'Wrong passphrase or corrupt data.'; }
}
</script>
</body>
</html>`
}

// ── Persistence ───────────────────────────────────────────────────────────────
function load(): Project[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const projects: Project[] = JSON.parse(raw)
    return projects.map((p) => ({
      ...p,
      environments: p.environments.map((env) => ({
        ...env,
        vars: env.vars.map((v) => ({
          ...v,
          value: v.type === "secret" ? deobfuscate(v.value) : v.value,
        })),
      })),
    }))
  } catch { return [] }
}

function saveProjects(projects: Project[]) {
  const toSave = projects.map((p) => ({
    ...p,
    environments: p.environments.map((env) => ({
      ...env,
      vars: env.vars.map((v) => ({
        ...v,
        value: v.type === "secret" ? obfuscate(v.value) : v.value,
      })),
    })),
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
}

function loadAudit(): AuditEntry[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "[]") } catch { return [] }
}
function saveAudit(entries: AuditEntry[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(entries.slice(0, 200)))
}

type View = "projects" | "project" | "diff" | "sync"
const ENV_NAMES = ["development", "staging", "production", "preview"]

const AUDIT_ICON_CLASSES: Record<AuditEntry["action"], string> = {
  created: "text-green-500",
  updated: "text-blue-500",
  deleted: "text-red-500",
  rotated: "text-amber-500",
}

function AuditIcon({ action }: { action: AuditEntry["action"] }) {
  const cls = `w-3 h-3 ${AUDIT_ICON_CLASSES[action]}`
  if (action === "created") return <Plus className={cls} />
  if (action === "updated") return <Pencil className={cls} />
  if (action === "deleted") return <Trash2 className={cls} />
  return <RotateCcw className={cls} />
}

// ── Validation indicator ──────────────────────────────────────────────────────
function ValidationIndicator({ v }: { v: EnvVar }) {
  const result = validateVarValue(v.value, v.validation)
  if (result === null) return null
  return result
    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
    : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
}

export function EnvManagerContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [view, setView] = useState<View>("projects")
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState("")
  const [copiedKey, setCopiedKey] = useState("")
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set())

  // Project form
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [newProjectDesc, setNewProjectDesc] = useState("")

  // Var form
  const [showAddVar, setShowAddVar] = useState(false)
  const [newVarKey, setNewVarKey] = useState("")
  const [newVarValue, setNewVarValue] = useState("")
  const [newVarType, setNewVarType] = useState<VarType>("string")
  const [newVarDesc, setNewVarDesc] = useState("")
  const [newVarRotationInterval, setNewVarRotationInterval] = useState<string>("")
  const [newVarValidationType, setNewVarValidationType] = useState<ValidationType>("none")
  const [newVarRequired, setNewVarRequired] = useState(false)

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")

  // Import from URL
  const [showImportUrl, setShowImportUrl] = useState(false)
  const [importUrl, setImportUrl] = useState("")
  const [importUrlLoading, setImportUrlLoading] = useState(false)

  // Missing vars detector
  const [exampleInput, setExampleInput] = useState("")
  const [missingVars, setMissingVars] = useState<string[]>([])

  // .env.example sync
  const [showExampleSync, setShowExampleSync] = useState(false)

  // Diff
  const [diffEnvA, setDiffEnvA] = useState<string>("")
  const [diffEnvB, setDiffEnvB] = useState<string>("")

  // Sync
  const [syncPlatform, setSyncPlatform] = useState<"vercel" | "railway" | "fly">("vercel")
  const [syncToken, setSyncToken] = useState("")
  const [syncProjectId, setSyncProjectId] = useState("")
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncEnvId, setSyncEnvId] = useState<string>("")

  // Variable search within project
  const [varSearch, setVarSearch] = useState("")

  // Editing state
  const [editingVarId, setEditingVarId] = useState<string | null>(null)
  const [editingVarValue, setEditingVarValue] = useState("")
  const [editingDescId, setEditingDescId] = useState<string | null>(null)
  const [editingDescValue, setEditingDescValue] = useState("")

  // Delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "project" | "env"
    id: string
    name: string
    varCount: number
    envCount: number
  } | null>(null)

  // Share / encrypted export
  const [showShareWarning, setShowShareWarning] = useState(false)
  const [pendingShareEnv, setPendingShareEnv] = useState<Environment | null>(null)
  const [showEncryptExport, setShowEncryptExport] = useState(false)
  const [encryptEnv, setEncryptEnv] = useState<Environment | null>(null)
  const [encryptPassphrase, setEncryptPassphrase] = useState("")
  const [encryptLoading, setEncryptLoading] = useState(false)

  // Unused variable detector
  const [showUnusedDetector, setShowUnusedDetector] = useState(false)
  const [unusedScanCode, setUnusedScanCode] = useState("")
  const [unusedResult, setUnusedResult] = useState<{ defined: string[]; unused: string[]; undeclared: string[] } | null>(null)

  // Rotation
  const [rotateVarId, setRotateVarId] = useState<string | null>(null)
  const [rotateNewValue, setRotateNewValue] = useState("")

  // Validation editor
  const [validationVarId, setValidationVarId] = useState<string | null>(null)

  useEffect(() => {
    setProjects(load())
    setAudit(loadAudit())
  }, [])

  useEffect(() => {
    setMissingVars([])
    setExampleInput("")
    setVarSearch("")
  }, [selectedEnvId])

  const selectedEnv = useMemo(
    () => selectedProject?.environments.find((e) => e.id === selectedEnvId) ?? null,
    [selectedProject, selectedEnvId]
  )

  // Inherited vars (from inheritsFrom env)
  const inheritedVars = useMemo(() => {
    if (!selectedEnv?.inheritsFrom || !selectedProject) return []
    const parentEnv = selectedProject.environments.find((e) => e.id === selectedEnv.inheritsFrom)
    if (!parentEnv) return []
    const ownKeys = new Set(selectedEnv.vars.map((v) => v.key))
    return parentEnv.vars.filter((v) => !ownKeys.has(v.key))
  }, [selectedEnv, selectedProject])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(""), 2000)
    toast.success("Copied!")
  }

  function addAuditEntry(projectId: string, environmentId: string, varKey: string, action: AuditEntry["action"]) {
    const entry: AuditEntry = { id: crypto.randomUUID(), projectId, environmentId, varKey, action, timestamp: new Date().toISOString() }
    setAudit((prev) => { const next = [entry, ...prev]; saveAudit(next); return next })
  }

  const updateProjects = useCallback((next: Project[]) => {
    setProjects(next)
    saveProjects(next)
    setSelectedProject((prev) => {
      if (!prev) return prev
      return next.find((p) => p.id === prev.id) ?? prev
    })
  }, [])

  function createProject() {
    if (!newProjectName.trim()) { toast.error("Project name required"); return }
    const now = new Date().toISOString()
    const project: Project = {
      id: crypto.randomUUID(),
      name: newProjectName.trim(),
      description: newProjectDesc,
      environments: ENV_NAMES.map((name) => ({ id: crypto.randomUUID(), name, vars: [] })),
      createdAt: now,
      updatedAt: now,
    }
    updateProjects([...projects, project])
    setNewProjectName(""); setNewProjectDesc("")
    setShowNewProject(false)
    toast.success("Project created")
  }

  function confirmDeleteProject(p: Project) {
    const totalVars = p.environments.reduce((sum, env) => sum + env.vars.length, 0)
    setDeleteConfirm({ type: "project", id: p.id, name: p.name, varCount: totalVars, envCount: p.environments.length })
  }

  function deleteProject(id: string) {
    updateProjects(projects.filter((p) => p.id !== id))
    if (selectedProject?.id === id) { setSelectedProject(null); setView("projects") }
    toast.success("Project deleted")
  }

  function addVar() {
    if (!selectedProject || !selectedEnvId) return
    if (!newVarKey.trim()) { toast.error("Key required"); return }
    const now = new Date().toISOString()
    const validation: VarValidation | null = newVarValidationType !== "none" || newVarRequired
      ? { type: newVarValidationType, required: newVarRequired }
      : null
    const v: EnvVar = {
      id: crypto.randomUUID(),
      key: newVarKey.trim().toUpperCase().replace(/\s+/g, "_"),
      value: newVarValue,
      type: newVarType,
      description: newVarDesc,
      createdAt: now,
      updatedAt: now,
      rotationInterval: newVarRotationInterval ? parseInt(newVarRotationInterval) : null,
      lastRotatedAt: null,
      validation,
    }
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, vars: [...env.vars, v] } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    addAuditEntry(selectedProject.id, selectedEnvId, v.key, "created")
    setNewVarKey(""); setNewVarValue(""); setNewVarType("string"); setNewVarDesc("")
    setNewVarRotationInterval(""); setNewVarValidationType("none"); setNewVarRequired(false)
    setShowAddVar(false)
    toast.success("Variable added")
  }

  function updateVar(varId: string, updates: Partial<EnvVar>) {
    if (!selectedProject || !selectedEnvId) return
    const now = new Date().toISOString()
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? {
        ...env,
        vars: env.vars.map((v) => v.id === varId ? { ...v, ...updates, updatedAt: now } : v),
      } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    const varKey = selectedEnv?.vars.find((v) => v.id === varId)?.key ?? ""
    if (varKey) addAuditEntry(selectedProject.id, selectedEnvId, varKey, "updated")
  }

  function deleteVar(varId: string) {
    if (!selectedProject || !selectedEnvId) return
    const varKey = selectedEnv?.vars.find((v) => v.id === varId)?.key ?? ""
    const now = new Date().toISOString()
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, vars: env.vars.filter((v) => v.id !== varId) } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    if (varKey) addAuditEntry(selectedProject.id, selectedEnvId, varKey, "deleted")
    toast.success("Variable deleted")
  }

  function rotateVar(varId: string, newValue: string) {
    if (!selectedProject || !selectedEnvId) return
    const now = new Date().toISOString()
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? {
        ...env,
        vars: env.vars.map((v) => v.id === varId ? { ...v, value: newValue, lastRotatedAt: now, updatedAt: now } : v),
      } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    const varKey = selectedEnv?.vars.find((v) => v.id === varId)?.key ?? ""
    if (varKey) addAuditEntry(selectedProject.id, selectedEnvId, varKey, "rotated")
    setRotateVarId(null); setRotateNewValue("")
    toast.success("Secret rotated")
  }

  function copyEnvToEnv(fromEnvId: string, toEnvId: string) {
    if (!selectedProject) return
    const fromEnv = selectedProject.environments.find((e) => e.id === fromEnvId)
    if (!fromEnv) return
    const now = new Date().toISOString()
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === toEnvId ? {
        ...env,
        vars: fromEnv.vars.map((v) => ({ ...v, id: crypto.randomUUID(), createdAt: now, updatedAt: now })),
      } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    toast.success(`Copied ${fromEnv.vars.length} vars to ${selectedProject.environments.find((e) => e.id === toEnvId)?.name}`)
  }

  function handleImport() {
    if (!selectedProject || !selectedEnvId || !importText.trim()) { toast.error("Paste .env content first"); return }
    const parsed = parseEnvFile(importText)
    if (parsed.length === 0) { toast.error("No variables found in .env content"); return }
    const now = new Date().toISOString()
    const newVars: EnvVar[] = parsed.map((p) => ({
      id: crypto.randomUUID(), key: p.key, value: p.value, type: p.type,
      description: "", createdAt: now, updatedAt: now,
    }))
    const next = projects.map((proj) => proj.id === selectedProject.id ? {
      ...proj,
      environments: proj.environments.map((env) => env.id === selectedEnvId ? {
        ...env, vars: [...env.vars.filter((v) => !newVars.some((nv) => nv.key === v.key)), ...newVars],
      } : env),
      updatedAt: now,
    } : proj)
    updateProjects(next)
    setImportText(""); setShowImport(false)
    toast.success(`Imported ${newVars.length} variables`)
  }

  async function handleImportFromUrl() {
    if (!selectedProject || !selectedEnvId || !importUrl.trim()) { toast.error("Enter a URL first"); return }
    setImportUrlLoading(true)
    try {
      const res = await fetch("/api/env-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import-url", url: importUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Import failed")
      const now = new Date().toISOString()
      const newVars: EnvVar[] = (data.vars as Array<{ key: string; value: string; type: VarType }>).map((p) => ({
        id: crypto.randomUUID(), key: p.key, value: p.value, type: p.type,
        description: "", createdAt: now, updatedAt: now,
      }))
      const next = projects.map((proj) => proj.id === selectedProject.id ? {
        ...proj,
        environments: proj.environments.map((env) => env.id === selectedEnvId ? {
          ...env, vars: [...env.vars.filter((v) => !newVars.some((nv) => nv.key === v.key)), ...newVars],
        } : env),
        updatedAt: now,
      } : proj)
      updateProjects(next)
      setImportUrl(""); setShowImportUrl(false)
      toast.success(`Imported ${newVars.length} variables from URL`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed")
    }
    setImportUrlLoading(false)
  }

  function checkMissingVars() {
    if (!selectedEnv || !exampleInput.trim()) { toast.error("Paste .env.example content and select an environment"); return }
    const parsed = parseEnvFile(exampleInput)
    const existingKeys = new Set(selectedEnv.vars.map((v) => v.key))
    const missing = parsed.map((p) => p.key).filter((k) => !existingKeys.has(k))
    setMissingVars(missing)
    if (missing.length === 0) toast.success("All variables present!")
    else toast.warning(`${missing.length} variables missing`)
  }

  function syncExampleFile() {
    if (!selectedProject || !selectedEnvId || !selectedEnv) return
    const varKeys = selectedEnv.vars.map((v) => v.key)
    const existingExampleKeys = selectedEnv.exampleContent
      ? parseEnvFile(selectedEnv.exampleContent).map((p) => p.key)
      : []
    const existingSet = new Set(existingExampleKeys)
    const toAdd = varKeys.filter((k) => !existingSet.has(k))
    const varKeySet = new Set(varKeys)
    const toKeep = existingExampleKeys.filter((k) => varKeySet.has(k))
    const allKeys = [...toKeep, ...toAdd]
    const newContent = allKeys.map((k) => `${k}=`).join("\n")

    const now = new Date().toISOString()
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, exampleContent: newContent } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    toast.success(".env.example synced")
  }

  function downloadEnv(env: Environment, maskSecrets = false) {
    const content = generateEnvFile(env.vars, maskSecrets)
    const blob = new Blob([content], { type: "text/plain" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `.env.${env.name}`; a.click(); URL.revokeObjectURL(a.href)
    toast.success(`Downloaded .env.${env.name}`)
  }

  async function handleEncryptExport() {
    if (!encryptEnv || !encryptPassphrase.trim() || !selectedProject) return
    setEncryptLoading(true)
    try {
      const encrypted = await encryptEnvVars(encryptEnv.vars, encryptPassphrase)
      const html = generateEncryptedHTML(selectedProject.name, encryptEnv.name, encrypted)
      const blob = new Blob([html], { type: "text/html" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      const dateStr = new Date().toISOString().slice(0, 10)
      a.download = `env-export-${selectedProject.name.toLowerCase().replace(/\s+/g, "-")}-${dateStr}.html`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success("Encrypted export downloaded")
      setShowEncryptExport(false); setEncryptPassphrase(""); setEncryptEnv(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Encryption failed")
    }
    setEncryptLoading(false)
  }

  function scanUnusedVars() {
    if (!selectedEnv || !unusedScanCode.trim()) { toast.error("Paste source code and select an environment"); return }
    const processEnvPattern = /process\.env\.([A-Z_][A-Z0-9_]*)/g
    const usedInCode = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = processEnvPattern.exec(unusedScanCode)) !== null) {
      usedInCode.add(match[1] ?? "")
    }
    const defined = selectedEnv.vars.map((v) => v.key)
    const definedSet = new Set(defined)
    const unused = defined.filter((k) => !usedInCode.has(k))
    const undeclared = Array.from(usedInCode).filter((k) => !definedSet.has(k))
    setUnusedResult({ defined, unused, undeclared })
  }

  function requestShareURL(env: Environment) {
    setPendingShareEnv(env)
    setShowShareWarning(true)
  }

  function doGenerateShareURL(env: Environment) {
    if (!selectedProject) return
    const data = env.vars.map((v) => `${v.key}=${v.value}`).join("\n")
    const encoded = btoa(encodeURIComponent(data))
    const url = `${window.location.origin}#env=${encoded}`
    copyText(url, "share-url")
    toast.success("Share URL copied (vars encoded in URL fragment, never sent to server)")
  }

  async function handleSync() {
    if (!selectedProject) return
    const env = selectedProject.environments.find((e) => e.id === syncEnvId)
    if (!env) { toast.error("Select an environment"); return }
    if (!syncToken.trim()) { toast.error("Token required"); return }
    if (!syncProjectId.trim()) { toast.error("Project/Service/App ID required"); return }

    setSyncLoading(true)
    try {
      let action: string
      let body: Record<string, unknown>
      if (syncPlatform === "vercel") {
        action = "sync-vercel"
        body = { action, token: syncToken, projectId: syncProjectId, envVars: env.vars.map((v) => ({ key: v.key, value: v.value, type: v.type })), environment: env.name }
      } else if (syncPlatform === "railway") {
        action = "sync-railway"
        body = { action, token: syncToken, serviceId: syncProjectId, envVars: env.vars.map((v) => ({ key: v.key, value: v.value, type: v.type })), environment: env.name }
      } else {
        action = "sync-fly"
        body = { action, flyToken: syncToken, flyAppName: syncProjectId, envVars: env.vars.map((v) => ({ key: v.key, value: v.value })) }
      }
      const res = await fetch("/api/env-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Sync failed")
      toast.success(data.summary ?? "Synced successfully")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed")
    }
    setSyncLoading(false)
  }

  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim()) return []
    const q = globalSearch.toLowerCase()
    const results: Array<{ project: Project; env: Environment; var: EnvVar }> = []
    for (const project of projects) {
      for (const env of project.environments) {
        for (const v of env.vars) {
          if (v.key.toLowerCase().includes(q) || v.description?.toLowerCase().includes(q)) {
            results.push({ project, env, var: v })
          }
        }
      }
    }
    return results.slice(0, 20)
  }, [globalSearch, projects])

  const diffResult = useMemo(() => {
    if (!selectedProject || !diffEnvA || !diffEnvB) return null
    const envA = selectedProject.environments.find((e) => e.id === diffEnvA)
    const envB = selectedProject.environments.find((e) => e.id === diffEnvB)
    if (!envA || !envB) return null
    return diffEnvironments(envA, envB)
  }, [selectedProject, diffEnvA, diffEnvB])

  function toggleSecret(id: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredVars = useMemo(() => {
    if (!selectedEnv) return []
    if (!varSearch.trim()) return selectedEnv.vars
    const q = varSearch.toLowerCase()
    return selectedEnv.vars.filter((v) =>
      v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
    )
  }, [selectedEnv, varSearch])

  // .env.example diff: keys in env but not in example, and vice versa
  const exampleDiff = useMemo(() => {
    if (!selectedEnv) return null
    const envKeys = new Set(selectedEnv.vars.map((v) => v.key))
    const exampleKeys = selectedEnv.exampleContent
      ? new Set(parseEnvFile(selectedEnv.exampleContent).map((p) => p.key))
      : new Set<string>()
    const notInExample = selectedEnv.vars.map((v) => v.key).filter((k) => !exampleKeys.has(k))
    const notInEnv = Array.from(exampleKeys).filter((k) => !envKeys.has(k))
    return { notInExample, notInEnv }
  }, [selectedEnv])

  const syncPlatformLabel = syncPlatform === "vercel" ? "Vercel" : syncPlatform === "railway" ? "Railway" : "Fly.io"

  const rotationDueVars = useMemo(() => {
    if (!selectedEnv) return []
    return selectedEnv.vars.filter(isRotationDue)
  }, [selectedEnv])

  const envAudit = useMemo(() => {
    if (!selectedProject || !selectedEnvId) return []
    return audit.filter((a) => a.projectId === selectedProject.id && a.environmentId === selectedEnvId)
  }, [audit, selectedProject, selectedEnvId])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteConfirm?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete all{" "}
            <strong>{deleteConfirm?.varCount} variable{deleteConfirm?.varCount !== 1 ? "s" : ""}</strong>{" "}
            across <strong>{deleteConfirm?.envCount} environment{deleteConfirm?.envCount !== 1 ? "s" : ""}</strong>.{" "}
            This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="destructive" onClick={() => { if (deleteConfirm) deleteProject(deleteConfirm.id); setDeleteConfirm(null) }}>Delete</Button>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share URL warning */}
      <Dialog open={showShareWarning} onOpenChange={(open) => { if (!open) { setShowShareWarning(false); setPendingShareEnv(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Security Warning
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 dark:border-amber-700 p-4 text-sm text-amber-800 dark:text-amber-200">
            This URL contains your secret values in encoded form. Anyone with this link can decode them. Consider using the encrypted HTML export instead.
          </div>
          <DialogFooter>
            <Button onClick={() => { if (pendingShareEnv) doGenerateShareURL(pendingShareEnv); setShowShareWarning(false); setPendingShareEnv(null) }}>
              I understand, generate link
            </Button>
            <Button variant="outline" onClick={() => { setShowShareWarning(false); setPendingShareEnv(null) }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Encrypted export dialog */}
      <Dialog open={showEncryptExport} onOpenChange={(open) => { if (!open) { setShowEncryptExport(false); setEncryptPassphrase(""); setEncryptEnv(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" /> Encrypted Export
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Encrypts all variable values with AES-GCM (Web Crypto API). Generates a self-contained HTML file that decrypts in-browser when given the passphrase.
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">Passphrase</label>
            <Input type="password" placeholder="Enter a strong passphrase..." value={encryptPassphrase} onChange={(e) => setEncryptPassphrase(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleEncryptExport()} />
          </div>
          <DialogFooter>
            <Button onClick={handleEncryptExport} disabled={encryptLoading || !encryptPassphrase.trim()}>
              {encryptLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              Download encrypted HTML
            </Button>
            <Button variant="outline" onClick={() => { setShowEncryptExport(false); setEncryptPassphrase(""); setEncryptEnv(null) }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate secret dialog */}
      <Dialog open={!!rotateVarId} onOpenChange={(open) => { if (!open) { setRotateVarId(null); setRotateNewValue("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" /> Rotate Secret
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter the new value. The old value will be replaced and the rotation timestamp recorded in the audit log.
          </p>
          <div>
            <label className="text-xs font-medium mb-1 block">New value</label>
            <Input type="password" placeholder="New secret value..." value={rotateNewValue} onChange={(e) => setRotateNewValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={() => { if (rotateVarId) rotateVar(rotateVarId, rotateNewValue) }} disabled={!rotateNewValue.trim()}>
              Rotate
            </Button>
            <Button variant="outline" onClick={() => { setRotateVarId(null); setRotateNewValue("") }}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToolHeader
        title="Env Manager"
        icon={Lock}
        color="text-indigo-500"
        badge="Dev Tools"
        actions={
          <div className="flex gap-2">
            {view !== "projects" && <Button variant="outline" size="sm" onClick={() => { setView("projects"); setSelectedProject(null) }}>← Projects</Button>}
            {view === "project" && selectedProject && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setView("diff")}><GitCompare className="w-3.5 h-3.5 mr-1" /> Diff</Button>
                <Button variant="ghost" size="sm" onClick={() => setView("sync")}><Zap className="w-3.5 h-3.5 mr-1" /> Sync</Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-1">
        {/* ── Sidebar (project + env selector) ──────────────────────────── */}
        {view === "project" && selectedProject && (
          <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-muted/20 py-4 px-3 gap-1 sticky top-14 self-start max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">{selectedProject.name}</p>
            {selectedProject.environments.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${selectedEnvId === env.id ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
              >
                <span>{env.name}</span>
                <Badge variant="secondary" className="text-[10px] ml-1">{env.vars.length}</Badge>
              </button>
            ))}
          </aside>
        )}

        <main className={`flex-1 px-4 py-6 ${view === "project" && selectedProject ? "lg:max-w-4xl" : "max-w-5xl mx-auto w-full"}`}>

          {/* ── PROJECTS LIST ──────────────────────────────────────────────── */}
          {view === "projects" && (
            <div className="space-y-5">
              <div>
                <h1 className="text-3xl font-bold mb-1">Env Manager</h1>
                <p className="text-muted-foreground text-sm">Visual .env editor across all your projects. Sync to Vercel, Railway, and Fly.io.</p>
              </div>

              {projects.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search variables across all projects..." value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} className="pl-9" />
                </div>
              )}

              {globalSearch && globalSearchResults.length > 0 && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Search Results ({globalSearchResults.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {globalSearchResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => { setSelectedProject(r.project); setSelectedEnvId(r.env.id); setGlobalSearch(""); setView("project") }}
                        className="w-full flex items-center gap-3 p-2 rounded border hover:bg-muted/50 text-left"
                      >
                        <code className="text-xs font-mono font-semibold">{r.var.key}</code>
                        <span className="text-xs text-muted-foreground">{r.project.name} / {r.env.name}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">{r.var.type}</Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}

              {showNewProject && (
                <Card className="border-indigo-200 dark:border-indigo-800">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">New Project</p>
                      <button onClick={() => setShowNewProject(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Project name *</label>
                        <Input placeholder="my-saas-app" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createProject()} />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">Description</label>
                        <Input placeholder="Optional description" value={newProjectDesc} onChange={(e) => setNewProjectDesc(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={createProject}><Plus className="w-3 h-3 mr-1" /> Create</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowNewProject(false)}>Cancel</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {projects.length === 0 && !showNewProject ? (
                <Card className="max-w-lg mx-auto mt-16">
                  <CardContent className="py-16 text-center">
                    <Lock className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                    <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
                    <p className="text-muted-foreground text-sm mb-6">Create a project to start managing your environment variables.</p>
                    <Button onClick={() => setShowNewProject(true)}><Plus className="w-4 h-4 mr-1" /> Create Project</Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Button onClick={() => setShowNewProject(true)} variant="outline"><Plus className="w-4 h-4 mr-1" /> New Project</Button>
                  <div className="space-y-2">
                    {projects.map((p) => {
                      const totalVars = p.environments.reduce((sum, env) => sum + env.vars.length, 0)
                      return (
                        <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedProject(p); setSelectedEnvId(p.environments[0]?.id ?? null); setView("project") }}>
                          <CardContent className="py-3.5 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.description || `${p.environments.length} envs · ${totalVars} vars`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="hidden sm:flex gap-1">
                                {p.environments.slice(0, 4).map((env) => (
                                  <Badge key={env.id} variant="secondary" className="text-[10px]">
                                    {env.name} ({env.vars.length})
                                  </Badge>
                                ))}
                              </div>
                              <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); confirmDeleteProject(p) }}>
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── PROJECT VIEW ─────────────────────────────────────────────────── */}
          {view === "project" && selectedProject && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
                {selectedProject.description && <p className="text-muted-foreground text-sm">{selectedProject.description}</p>}
              </div>

              {/* Environment tabs (mobile — sidebar handles desktop) */}
              <div className="flex gap-1 border-b overflow-x-auto lg:hidden">
                {selectedProject.environments.map((env) => (
                  <button
                    key={env.id}
                    onClick={() => setSelectedEnvId(env.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${selectedEnvId === env.id ? "border-indigo-500 text-indigo-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    {env.name} <span className="text-xs opacity-60">({env.vars.length})</span>
                  </button>
                ))}
              </div>

              {/* Rotation due banner */}
              {rotationDueVars.length > 0 && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                  <span><strong>{rotationDueVars.length}</strong> secret{rotationDueVars.length !== 1 ? "s" : ""} due for rotation: {rotationDueVars.map((v) => v.key).join(", ")}</span>
                </div>
              )}

              {selectedEnv && (
                <div className="space-y-4">
                  {/* Env actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowAddVar(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Var</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5 mr-1" /> Import .env</Button>
                    <Button variant="outline" size="sm" onClick={() => setShowImportUrl(true)}><LinkIcon className="w-3.5 h-3.5 mr-1" /> Import URL</Button>
                    <Button variant="outline" size="sm" onClick={() => downloadEnv(selectedEnv)}><Download className="w-3.5 h-3.5 mr-1" /> Export .env</Button>
                    <Button variant="outline" size="sm" onClick={() => { setEncryptEnv(selectedEnv); setShowEncryptExport(true) }}><Shield className="w-3.5 h-3.5 mr-1" /> Encrypted Export</Button>
                    <Button variant="outline" size="sm" onClick={() => requestShareURL(selectedEnv)}><Copy className="w-3.5 h-3.5 mr-1" /> Share URL</Button>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Copy to:</span>
                      {selectedProject.environments.filter((e) => e.id !== selectedEnvId).map((env) => (
                        <Button key={env.id} variant="ghost" size="sm" onClick={() => copyEnvToEnv(selectedEnvId!, env.id)}>
                          <ArrowRight className="w-3 h-3 mr-1" />{env.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Environment inheritance selector */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Inherits from:</span>
                    <select
                      value={selectedEnv.inheritsFrom ?? ""}
                      onChange={(e) => {
                        const now = new Date().toISOString()
                        const next = projects.map((p) => p.id === selectedProject.id ? {
                          ...p,
                          environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, inheritsFrom: e.target.value || null } : env),
                          updatedAt: now,
                        } : p)
                        updateProjects(next)
                      }}
                      className="h-7 text-xs rounded border border-input bg-background px-2"
                    >
                      <option value="">None</option>
                      {selectedProject.environments.filter((e) => e.id !== selectedEnvId).map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                    {selectedEnv.inheritsFrom && (
                      <span className="text-indigo-500">
                        {inheritedVars.length} inherited var{inheritedVars.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Add var form */}
                  {showAddVar && (
                    <Card className="border-indigo-200 dark:border-indigo-800">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Add Variable</p>
                          <button onClick={() => setShowAddVar(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-medium mb-1 block">Key *</label>
                            <Input placeholder="DATABASE_URL" value={newVarKey} onChange={(e) => setNewVarKey(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Type</label>
                            <select value={newVarType} onChange={(e) => setNewVarType(e.target.value as VarType)} className="w-full h-8 rounded border border-input bg-background px-2 text-sm">
                              {(Object.entries(VAR_TYPE_META) as [VarType, typeof VAR_TYPE_META[VarType]][]).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Value</label>
                            <Input type={newVarType === "secret" ? "password" : "text"} placeholder="..." value={newVarValue} onChange={(e) => setNewVarValue(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Description</label>
                            <Input placeholder="Optional description" value={newVarDesc} onChange={(e) => setNewVarDesc(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Rotation interval (days)</label>
                            <Input type="number" placeholder="90" value={newVarRotationInterval} onChange={(e) => setNewVarRotationInterval(e.target.value)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium mb-1 block">Validation</label>
                            <div className="flex gap-2">
                              <select value={newVarValidationType} onChange={(e) => setNewVarValidationType(e.target.value as ValidationType)} className="flex-1 h-8 rounded border border-input bg-background px-2 text-xs">
                                {(["none", "url", "email", "uuid", "jwt"] as ValidationType[]).map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1 text-xs">
                                <input type="checkbox" checked={newVarRequired} onChange={(e) => setNewVarRequired(e.target.checked)} />
                                Required
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={addVar}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowAddVar(false)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Import .env */}
                  {showImport && (
                    <Card className="border-indigo-200 dark:border-indigo-800">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Import .env File</p>
                          <button onClick={() => setShowImport(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <Textarea className="font-mono text-xs" rows={8} placeholder={"DATABASE_URL=postgresql://...\nNEXT_PUBLIC_URL=https://...\nSECRET_KEY=abc123"} value={importText} onChange={(e) => setImportText(e.target.value)} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleImport}><Upload className="w-3 h-3 mr-1" /> Import</Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Import from URL */}
                  {showImportUrl && (
                    <Card className="border-indigo-200 dark:border-indigo-800">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Import from URL</p>
                          <button onClick={() => setShowImportUrl(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                        </div>
                        <p className="text-xs text-muted-foreground">Fetch a .env file from a URL (fetched server-side to avoid CORS). Use a private S3 URL, secure Gist, etc.</p>
                        <Input placeholder="https://..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleImportFromUrl()} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleImportFromUrl} disabled={importUrlLoading}>
                            {importUrlLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <LinkIcon className="w-3 h-3 mr-1" />}
                            Import
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setShowImportUrl(false)}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* .env.example sync section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-500" /> .env.example
                        </CardTitle>
                        <button onClick={() => setShowExampleSync((v) => !v)} className="text-muted-foreground hover:text-foreground">
                          {showExampleSync ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </CardHeader>
                    {showExampleSync && (
                      <CardContent className="space-y-3">
                        {exampleDiff && (exampleDiff.notInExample.length > 0 || exampleDiff.notInEnv.length > 0) && (
                          <div className="space-y-1">
                            {exampleDiff.notInExample.length > 0 && (
                              <p className="text-xs text-amber-600">{exampleDiff.notInExample.length} var{exampleDiff.notInExample.length !== 1 ? "s" : ""} not in .env.example: {exampleDiff.notInExample.join(", ")}</p>
                            )}
                            {exampleDiff.notInEnv.length > 0 && (
                              <p className="text-xs text-muted-foreground">{exampleDiff.notInEnv.length} key{exampleDiff.notInEnv.length !== 1 ? "s" : ""} in example but not in env: {exampleDiff.notInEnv.join(", ")}</p>
                            )}
                          </div>
                        )}
                        <Textarea
                          className="font-mono text-xs"
                          rows={5}
                          placeholder={"DATABASE_URL=\nSECRET_KEY=\nNEXT_PUBLIC_URL="}
                          value={selectedEnv.exampleContent ?? ""}
                          onChange={(e) => {
                            const now = new Date().toISOString()
                            const next = projects.map((p) => p.id === selectedProject.id ? {
                              ...p,
                              environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, exampleContent: e.target.value } : env),
                              updatedAt: now,
                            } : p)
                            updateProjects(next)
                          }}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={syncExampleFile}><RefreshCw className="w-3 h-3 mr-1" /> Sync .env.example</Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (selectedEnv.exampleContent) {
                              const blob = new Blob([selectedEnv.exampleContent], { type: "text/plain" })
                              const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = ".env.example"; a.click(); URL.revokeObjectURL(a.href)
                            }
                          }}><Download className="w-3 h-3 mr-1" /> Download</Button>
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Variable templates */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-500" /> Quick Templates</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {VAR_TEMPLATES.map((t) => (
                          <Button
                            key={t.category}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const now = new Date().toISOString()
                              const newVars: EnvVar[] = t.vars.map((key) => ({
                                id: crypto.randomUUID(), key, value: "",
                                type: key.toLowerCase().includes("secret") || key.toLowerCase().includes("key") ? "secret" as VarType : "string" as VarType,
                                description: "", createdAt: now, updatedAt: now,
                              }))
                              const next = projects.map((p) => p.id === selectedProject.id ? {
                                ...p,
                                environments: p.environments.map((env) => env.id === selectedEnvId ? {
                                  ...env, vars: [...env.vars.filter((v) => !newVars.some((nv) => nv.key === v.key)), ...newVars],
                                } : env),
                                updatedAt: now,
                              } : p)
                              updateProjects(next)
                              toast.success(`Added ${t.vars.length} ${t.category} template vars`)
                            }}
                          >
                            + {t.category}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Variables table */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-sm">{selectedEnv.name} Variables ({selectedEnv.vars.length})</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedEnv.vars.length > 0 && (
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <Input placeholder="Filter by key or value..." value={varSearch} onChange={(e) => setVarSearch(e.target.value)} className="pl-8 h-8 text-xs" />
                        </div>
                      )}
                      {selectedEnv.vars.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No variables yet. Add one or use a template.</p>
                      ) : filteredVars.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No variables match your search.</p>
                      ) : (
                        <div className="rounded-lg border overflow-hidden">
                          {filteredVars.map((v, idx) => {
                            const isRevealed = revealedSecrets.has(v.id)
                            const isEditingValue = editingVarId === v.id
                            const isEditingDesc = editingDescId === v.id
                            const rotationDue = isRotationDue(v)
                            const isValidationEditing = validationVarId === v.id
                            return (
                              <div key={v.id} className={`${idx % 2 === 0 ? "" : "bg-muted/20"} border-b last:border-0 px-3 py-2 hover:bg-muted/30 transition-colors`}>
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-4 flex items-center gap-2 min-w-0">
                                    <span className={`text-[10px] font-medium shrink-0 ${VAR_TYPE_META[v.type].color}`}>
                                      {VAR_TYPE_META[v.type].label}
                                    </span>
                                    <code className="text-xs font-semibold truncate">{v.key}</code>
                                    {rotationDue && <span title="Rotation due"><Clock className="w-3 h-3 text-amber-500 shrink-0" /></span>}
                                    <ValidationIndicator v={v} />
                                  </div>
                                  <div className="col-span-6 flex items-center gap-1 min-w-0">
                                    <Input
                                      type={v.type === "secret" && !isRevealed ? "password" : "text"}
                                      value={isEditingValue ? editingVarValue : v.value}
                                      onChange={(e) => {
                                        if (!isEditingValue) { setEditingVarId(v.id); setEditingVarValue(e.target.value) }
                                        else { setEditingVarValue(e.target.value) }
                                      }}
                                      onFocus={() => { setEditingVarId(v.id); setEditingVarValue(v.value) }}
                                      onBlur={() => {
                                        if (isEditingValue) { updateVar(v.id, { value: editingVarValue }); setEditingVarId(null); setEditingVarValue("") }
                                      }}
                                      className="h-7 text-xs font-mono"
                                      placeholder="••••••••"
                                    />
                                    {v.type === "secret" && (
                                      <button onClick={() => toggleSecret(v.id)} className="shrink-0">
                                        {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                                      </button>
                                    )}
                                  </div>
                                  <div className="col-span-2 flex items-center justify-end gap-1">
                                    {(v.type === "secret" || v.rotationInterval) && (
                                      <button onClick={() => setRotateVarId(v.id)} title="Rotate secret" className="p-0.5 text-muted-foreground hover:text-amber-500">
                                        <RotateCcw className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button onClick={() => setValidationVarId(isValidationEditing ? null : v.id)} title="Validation settings" className="p-0.5 text-muted-foreground hover:text-indigo-500">
                                      <Shield className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => copyText(v.value, v.id)}>
                                      {copiedKey === v.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => deleteVar(v.id)}>
                                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                    </button>
                                  </div>
                                </div>
                                {/* Description */}
                                <div className="mt-0.5 pl-1">
                                  {isEditingDesc ? (
                                    <Input
                                      value={editingDescValue}
                                      onChange={(e) => setEditingDescValue(e.target.value)}
                                      onBlur={() => { updateVar(v.id, { description: editingDescValue }); setEditingDescId(null); setEditingDescValue("") }}
                                      autoFocus
                                      className="h-6 text-[11px] text-muted-foreground"
                                      placeholder="Add description..."
                                    />
                                  ) : (
                                    <button
                                      onClick={() => { setEditingDescId(v.id); setEditingDescValue(v.description ?? "") }}
                                      className="text-[11px] text-muted-foreground hover:text-foreground text-left truncate max-w-full"
                                    >
                                      {v.description || <span className="opacity-40 italic">Add description</span>}
                                    </button>
                                  )}
                                </div>
                                {/* Rotation info */}
                                {v.rotationInterval && (
                                  <div className="mt-0.5 pl-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>Rotate every {v.rotationInterval}d{v.lastRotatedAt ? ` · last rotated ${new Date(v.lastRotatedAt).toLocaleDateString()}` : " · never rotated"}</span>
                                  </div>
                                )}
                                {/* Inline validation editor */}
                                {isValidationEditing && (
                                  <div className="mt-2 pl-1 flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-muted-foreground">Validation:</span>
                                    <select
                                      value={v.validation?.type ?? "none"}
                                      onChange={(e) => updateVar(v.id, { validation: { type: e.target.value as ValidationType, required: v.validation?.required ?? false } })}
                                      className="h-6 text-xs rounded border border-input bg-background px-1.5"
                                    >
                                      {(["none", "url", "email", "uuid", "jwt"] as ValidationType[]).map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                      ))}
                                    </select>
                                    <label className="flex items-center gap-1 text-xs">
                                      <input type="checkbox" checked={v.validation?.required ?? false} onChange={(e) => updateVar(v.id, { validation: { type: v.validation?.type ?? "none", required: e.target.checked } })} />
                                      Required
                                    </label>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Inherited vars */}
                      {inheritedVars.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            Inherited from {selectedProject.environments.find((e) => e.id === selectedEnv.inheritsFrom)?.name}
                          </p>
                          <div className="rounded-lg border border-dashed overflow-hidden opacity-60">
                            {inheritedVars.map((v) => (
                              <div key={v.id} className="px-3 py-2 border-b last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-medium shrink-0 ${VAR_TYPE_META[v.type].color}`}>{VAR_TYPE_META[v.type].label}</span>
                                  <code className="text-xs font-semibold">{v.key}</code>
                                  <span className="text-xs text-muted-foreground font-mono truncate">{v.type === "secret" ? "••••••••" : v.value}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Unused variable detector */}
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2"><Code className="w-4 h-4 text-indigo-500" /> Unused Variable Detector</CardTitle>
                        <button onClick={() => setShowUnusedDetector((v) => !v)} className="text-muted-foreground hover:text-foreground">
                          {showUnusedDetector ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </CardHeader>
                    {showUnusedDetector && (
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground">Paste source code to scan for <code className="font-mono">process.env.KEY</code> patterns.</p>
                        <Textarea
                          className="font-mono text-xs"
                          rows={6}
                          placeholder={"const db = process.env.DATABASE_URL\nconst secret = process.env.SECRET_KEY"}
                          value={unusedScanCode}
                          onChange={(e) => setUnusedScanCode(e.target.value)}
                        />
                        <Button size="sm" variant="outline" onClick={scanUnusedVars}><Search className="w-3.5 h-3.5 mr-1" /> Scan</Button>
                        {unusedResult && (
                          <div className="space-y-2 text-xs">
                            {unusedResult.unused.length > 0 && (
                              <div>
                                <p className="font-semibold text-amber-600 mb-1">Defined but not used in code ({unusedResult.unused.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {unusedResult.unused.map((k) => <Badge key={k} variant="secondary" className="font-mono text-amber-600">{k}</Badge>)}
                                </div>
                              </div>
                            )}
                            {unusedResult.undeclared.length > 0 && (
                              <div>
                                <p className="font-semibold text-red-600 mb-1">Referenced in code but not defined ({unusedResult.undeclared.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {unusedResult.undeclared.map((k) => <Badge key={k} variant="secondary" className="font-mono text-red-600">{k}</Badge>)}
                                </div>
                              </div>
                            )}
                            {unusedResult.unused.length === 0 && unusedResult.undeclared.length === 0 && (
                              <p className="text-green-600">All variables are used and accounted for.</p>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Missing vars detector */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4 text-indigo-500" /> Missing Vars Detector</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        className="font-mono text-xs"
                        rows={4}
                        placeholder={"# Paste your .env.example:\nDATABASE_URL=\nSECRET_KEY=\nNEXT_PUBLIC_URL="}
                        value={exampleInput}
                        onChange={(e) => setExampleInput(e.target.value)}
                      />
                      <Button size="sm" variant="outline" onClick={checkMissingVars}><Search className="w-3.5 h-3.5 mr-1" /> Check Missing</Button>
                      {missingVars.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {missingVars.map((k) => <Badge key={k} variant="secondary" className="font-mono text-xs text-red-600">{k}</Badge>)}
                        </div>
                      )}
                      {missingVars.length === 0 && exampleInput && <p className="text-xs text-green-600">All variables present!</p>}
                    </CardContent>
                  </Card>

                  {/* Audit log */}
                  {envAudit.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-sm">Audit Log</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {envAudit.map((a) => (
                            <div key={a.id} className="flex items-center gap-3 text-xs">
                              <span className="shrink-0"><AuditIcon action={a.action} /></span>
                              <code className="font-mono font-medium shrink-0">{a.varKey}</code>
                              <Badge variant="secondary" className="text-[10px] shrink-0">{a.action}</Badge>
                              <span className="text-muted-foreground ml-auto shrink-0">{new Date(a.timestamp).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── DIFF VIEW ─────────────────────────────────────────────────────── */}
          {view === "diff" && selectedProject && (
            <div className="space-y-5">
              <h1 className="text-2xl font-bold">Environment Diff</h1>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block">Environment A</label>
                  <select value={diffEnvA} onChange={(e) => setDiffEnvA(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select...</option>
                    {selectedProject.environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Environment B</label>
                  <select value={diffEnvB} onChange={(e) => setDiffEnvB(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Select...</option>
                    {selectedProject.environments.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              {diffResult && (
                <div className="space-y-4">
                  {diffResult.onlyInA.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-600">Only in {selectedProject.environments.find((e) => e.id === diffEnvA)?.name} ({diffResult.onlyInA.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {diffResult.onlyInA.map((v) => <DiffRow key={v.id} label={v.key} status="only-a" />)}
                      </CardContent>
                    </Card>
                  )}
                  {diffResult.onlyInB.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-green-600">Only in {selectedProject.environments.find((e) => e.id === diffEnvB)?.name} ({diffResult.onlyInB.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        {diffResult.onlyInB.map((v) => <DiffRow key={v.id} label={v.key} status="only-b" />)}
                      </CardContent>
                    </Card>
                  )}
                  {diffResult.changed.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-sm text-amber-600">Different values ({diffResult.changed.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {diffResult.changed.map((c) => (
                          <div key={c.key} className="text-xs">
                            <code className="font-mono font-semibold">{c.key}</code>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div className="bg-blue-50 dark:bg-blue-950 p-2 rounded font-mono truncate">{c.valueA}</div>
                              <div className="bg-green-50 dark:bg-green-950 p-2 rounded font-mono truncate">{c.valueB}</div>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                  <p className="text-sm text-muted-foreground">{diffResult.same.length} variables are identical across both environments.</p>
                </div>
              )}
            </div>
          )}

          {/* ── SYNC VIEW ─────────────────────────────────────────────────────── */}
          {view === "sync" && selectedProject && (
            <div className="space-y-5 max-w-lg mx-auto">
              <h1 className="text-2xl font-bold">Sync to Platform</h1>
              <Card>
                <CardContent className="pt-5 space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-2 block">Platform</label>
                    <div className="flex gap-2">
                      {(["vercel", "railway", "fly"] as const).map((platform) => (
                        <button
                          key={platform}
                          onClick={() => setSyncPlatform(platform)}
                          className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${syncPlatform === platform ? "bg-indigo-500 text-white border-indigo-500" : "border-border hover:bg-muted"}`}
                        >
                          {platform === "fly" ? "Fly.io" : platform.charAt(0).toUpperCase() + platform.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Environment</label>
                    <select value={syncEnvId} onChange={(e) => setSyncEnvId(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select environment...</option>
                      {selectedProject.environments.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.vars.length} vars)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      {syncPlatform === "vercel" ? "Vercel Token" : syncPlatform === "railway" ? "Railway Token" : "Fly.io Token"}
                    </label>
                    <Input type="password" placeholder="Your API token" value={syncToken} onChange={(e) => setSyncToken(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">
                      {syncPlatform === "vercel" ? "Vercel Project ID" : syncPlatform === "railway" ? "Railway Service ID" : "Fly App Name"}
                    </label>
                    <Input
                      placeholder={syncPlatform === "vercel" ? "prj_xxx" : syncPlatform === "railway" ? "service-uuid" : "my-fly-app"}
                      value={syncProjectId}
                      onChange={(e) => setSyncProjectId(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleSync} disabled={syncLoading}>
                    {syncLoading
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</>
                      : <><Zap className="w-4 h-4 mr-2" /> Sync to {syncPlatformLabel}</>
                    }
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function DiffRow({ label, status }: { label: string; status: "only-a" | "only-b" }) {
  const color = status === "only-a" ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
  return (
    <div className={`px-3 py-1.5 rounded font-mono text-xs ${color}`}>{label}</div>
  )
}
