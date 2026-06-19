"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Lock, Plus, Trash2, Copy, Check, Eye, EyeOff, Search, Loader2,
  Download, Upload, ArrowRight, X, AlertCircle,
  Layers, GitCompare, Zap, Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  type Project, type Environment, type EnvVar, type VarType, type AuditEntry,
  VAR_TYPE_META, parseEnvFile, generateEnvFile, diffEnvironments, VAR_TEMPLATES,
  obfuscate, deobfuscate,
} from "./types"

const STORAGE_KEY = "env-manager-v1"
const AUDIT_KEY = "env-manager-audit-v1"

function load(): Project[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const projects: Project[] = JSON.parse(raw)
    // Deobfuscate secrets
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
  // Obfuscate secrets before saving
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

  // Import
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState("")

  // Missing vars detector
  const [exampleInput, setExampleInput] = useState("")
  const [missingVars, setMissingVars] = useState<string[]>([])

  // Diff
  const [diffEnvA, setDiffEnvA] = useState<string>("")
  const [diffEnvB, setDiffEnvB] = useState<string>("")

  // Sync
  const [syncPlatform, setSyncPlatform] = useState<"vercel" | "railway">("vercel")
  const [syncToken, setSyncToken] = useState("")
  const [syncProjectId, setSyncProjectId] = useState("")
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncEnvId, setSyncEnvId] = useState<string>("")

  // Share URL state removed (share generates from selected env directly)

  useEffect(() => {
    setProjects(load())
    setAudit(loadAudit())
  }, [])

  const selectedEnv = useMemo(
    () => selectedProject?.environments.find((e) => e.id === selectedEnvId) ?? null,
    [selectedProject, selectedEnvId]
  )

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

  function updateProjects(next: Project[]) {
    setProjects(next)
    saveProjects(next)
    if (selectedProject) {
      const updated = next.find((p) => p.id === selectedProject.id)
      if (updated) setSelectedProject(updated)
    }
  }

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

  function deleteProject(id: string) {
    updateProjects(projects.filter((p) => p.id !== id))
    if (selectedProject?.id === id) { setSelectedProject(null); setView("projects") }
    toast.success("Project deleted")
  }

  function addVar() {
    if (!selectedProject || !selectedEnvId) return
    if (!newVarKey.trim()) { toast.error("Key required"); return }
    const now = new Date().toISOString()
    const v: EnvVar = {
      id: crypto.randomUUID(),
      key: newVarKey.trim().toUpperCase().replace(/\s+/g, "_"),
      value: newVarValue,
      type: newVarType,
      description: newVarDesc,
      createdAt: now,
      updatedAt: now,
    }
    const next = projects.map((p) => p.id === selectedProject.id ? {
      ...p,
      environments: p.environments.map((env) => env.id === selectedEnvId ? { ...env, vars: [...env.vars, v] } : env),
      updatedAt: now,
    } : p)
    updateProjects(next)
    addAuditEntry(selectedProject.id, selectedEnvId, v.key, "created")
    setNewVarKey(""); setNewVarValue(""); setNewVarType("string"); setNewVarDesc("")
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
      id: crypto.randomUUID(),
      key: p.key,
      value: p.value,
      type: p.type,
      description: "",
      createdAt: now,
      updatedAt: now,
    }))
    const next = projects.map((proj) => proj.id === selectedProject.id ? {
      ...proj,
      environments: proj.environments.map((env) => env.id === selectedEnvId ? {
        ...env,
        vars: [...env.vars.filter((v) => !newVars.some((nv) => nv.key === v.key)), ...newVars],
      } : env),
      updatedAt: now,
    } : proj)
    updateProjects(next)
    setImportText("")
    setShowImport(false)
    toast.success(`Imported ${newVars.length} variables`)
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

  function downloadEnv(env: Environment, maskSecrets = false) {
    const content = generateEnvFile(env.vars, maskSecrets)
    const blob = new Blob([content], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `.env.${env.name}`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Downloaded .env.${env.name}`)
  }

  function generateShareURL(env: Environment) {
    if (!selectedProject) return
    const data = env.vars.map((v) => `${v.key}=${v.value}`).join("\n")
    const encoded = btoa(encodeURIComponent(data))
    const url = `${window.location.origin}#env=${encoded}`
    copyText(url, "share-url")
    toast.success("Share URL copied (vars are encoded in URL fragment, never sent to server)")
  }

  async function handleSync() {
    if (!selectedProject) return
    const env = selectedProject.environments.find((e) => e.id === syncEnvId)
    if (!env) { toast.error("Select an environment"); return }
    if (!syncToken.trim()) { toast.error("Token required"); return }
    if (!syncProjectId.trim()) { toast.error("Project/Service ID required"); return }

    setSyncLoading(true)
    try {
      const res = await fetch("/api/env-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: syncPlatform === "vercel" ? "sync-vercel" : "sync-railway",
          token: syncToken,
          [syncPlatform === "vercel" ? "projectId" : "serviceId"]: syncProjectId,
          envVars: env.vars.map((v) => ({ key: v.key, value: v.value, type: v.type })),
          environment: env.name,
        }),
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

  return (
    <div className="min-h-screen flex flex-col">
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
      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">

        {/* ── PROJECTS LIST ────────────────────────────────────────────────── */}
        {view === "projects" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Env Manager</h1>
              <p className="text-muted-foreground">Visual .env editor across all your projects and environments.</p>
            </div>

            {/* Global search */}
            {projects.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search variables across all projects..."
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {/* Global search results */}
            {globalSearch && globalSearchResults.length > 0 && (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Search Results ({globalSearchResults.length})</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {globalSearchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedProject(r.project)
                        setSelectedEnvId(r.env.id)
                        setGlobalSearch("")
                        setView("project")
                      }}
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
                <div className="space-y-3">
                  {projects.map((p) => {
                    const totalVars = p.environments.reduce((sum, env) => sum + env.vars.length, 0)
                    return (
                      <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedProject(p); setSelectedEnvId(p.environments[0]?.id ?? null); setView("project") }}>
                        <CardContent className="py-4 flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.description || `${p.environments.length} environments · ${totalVars} variables`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {p.environments.slice(0, 4).map((env) => (
                                <Badge key={env.id} variant="secondary" className="text-[10px]">
                                  {env.name} ({env.vars.length})
                                </Badge>
                              ))}
                            </div>
                            <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); deleteProject(p.id) }}>
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
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
              <p className="text-muted-foreground text-sm">{selectedProject.description}</p>
            </div>

            {/* Environment tabs */}
            <div className="flex gap-1 border-b overflow-x-auto">
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

            {selectedEnv && (
              <div className="space-y-4">
                {/* Env actions */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowAddVar(true)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Var</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowImport(true)}><Upload className="w-3.5 h-3.5 mr-1" /> Import .env</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadEnv(selectedEnv)}><Download className="w-3.5 h-3.5 mr-1" /> Export .env</Button>
                  <Button variant="outline" size="sm" onClick={() => downloadEnv(selectedEnv, true)}><Shield className="w-3.5 h-3.5 mr-1" /> Export .env.example</Button>
                  <Button variant="outline" size="sm" onClick={() => generateShareURL(selectedEnv)}><Copy className="w-3.5 h-3.5 mr-1" /> Share URL</Button>
                  {/* Copy to another env */}
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Copy to:</span>
                    {selectedProject.environments.filter((e) => e.id !== selectedEnvId).map((env) => (
                      <Button key={env.id} variant="ghost" size="sm" onClick={() => copyEnvToEnv(selectedEnvId!, env.id)}>
                        <ArrowRight className="w-3 h-3 mr-1" />{env.name}
                      </Button>
                    ))}
                  </div>
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
                          <Input
                            type={newVarType === "secret" ? "password" : "text"}
                            placeholder="..."
                            value={newVarValue}
                            onChange={(e) => setNewVarValue(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium mb-1 block">Description</label>
                          <Input placeholder="Optional description" value={newVarDesc} onChange={(e) => setNewVarDesc(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={addVar}><Plus className="w-3 h-3 mr-1" /> Add</Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowAddVar(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Import */}
                {showImport && (
                  <Card className="border-indigo-200 dark:border-indigo-800">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Import .env File</p>
                        <button onClick={() => setShowImport(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                      </div>
                      <Textarea
                        className="font-mono text-xs"
                        rows={8}
                        placeholder={"DATABASE_URL=postgresql://...\nNEXT_PUBLIC_URL=https://...\nSECRET_KEY=abc123"}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleImport}><Upload className="w-3 h-3 mr-1" /> Import</Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowImport(false)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

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
                        {missingVars.map((k) => (
                          <Badge key={k} variant="secondary" className="font-mono text-xs text-red-600">{k}</Badge>
                        ))}
                      </div>
                    )}
                    {missingVars.length === 0 && exampleInput && <p className="text-xs text-green-600">All variables present!</p>}
                  </CardContent>
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
                              id: crypto.randomUUID(),
                              key,
                              value: "",
                              type: key.toLowerCase().includes("secret") || key.toLowerCase().includes("key") ? "secret" as VarType : "string" as VarType,
                              description: "",
                              createdAt: now,
                              updatedAt: now,
                            }))
                            const next = projects.map((p) => p.id === selectedProject.id ? {
                              ...p,
                              environments: p.environments.map((env) => env.id === selectedEnvId ? {
                                ...env,
                                vars: [...env.vars.filter((v) => !newVars.some((nv) => nv.key === v.key)), ...newVars],
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
                    <CardTitle className="text-sm">{selectedEnv.name} Variables ({selectedEnv.vars.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedEnv.vars.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No variables yet. Add one or use a template.</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedEnv.vars.map((v) => {
                          const isRevealed = revealedSecrets.has(v.id)
                          const displayValue = v.type === "secret" && !isRevealed ? "••••••••" : v.value
                          return (
                            <div key={v.id} className="group grid grid-cols-12 gap-2 p-2 border rounded items-center hover:bg-muted/20">
                              <div className="col-span-4 flex items-center gap-2 min-w-0">
                                <span className={`text-[10px] font-medium ${VAR_TYPE_META[v.type].color} shrink-0`}>
                                  {VAR_TYPE_META[v.type].label}
                                </span>
                                <code className="text-xs font-semibold truncate">{v.key}</code>
                              </div>
                              <div className="col-span-6 flex items-center gap-1 min-w-0">
                                <Input
                                  type={v.type === "secret" && !isRevealed ? "password" : "text"}
                                  value={v.value}
                                  onChange={(e) => updateVar(v.id, { value: e.target.value })}
                                  className="h-7 text-xs font-mono"
                                />
                                {v.type === "secret" && (
                                  <button onClick={() => toggleSecret(v.id)} className="shrink-0">
                                    {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
                                  </button>
                                )}
                              </div>
                              <div className="col-span-2 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => copyText(v.value, v.id)}>
                                  {copiedKey === v.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                                </button>
                                <button onClick={() => deleteVar(v.id)}>
                                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Audit log */}
                {audit.filter((a) => a.projectId === selectedProject.id && a.environmentId === selectedEnvId).length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Audit Log</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {audit.filter((a) => a.projectId === selectedProject.id && a.environmentId === selectedEnvId).map((a) => (
                          <div key={a.id} className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{new Date(a.timestamp).toLocaleString()}</span>
                            <Badge variant="secondary" className="text-[10px]">{a.action}</Badge>
                            <code className="font-mono">{a.varKey}</code>
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

        {/* ── DIFF VIEW ───────────────────────────────────────────────────── */}
        {view === "diff" && selectedProject && (
          <div className="space-y-6">
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

        {/* ── SYNC VIEW ───────────────────────────────────────────────────── */}
        {view === "sync" && selectedProject && (
          <div className="space-y-6 max-w-lg mx-auto">
            <h1 className="text-2xl font-bold">Sync to Platform</h1>
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-xs font-medium mb-2 block">Platform</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSyncPlatform("vercel")}
                      className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${syncPlatform === "vercel" ? "bg-indigo-500 text-white border-indigo-500" : "border-border hover:bg-muted"}`}
                    >
                      Vercel
                    </button>
                    <button
                      onClick={() => setSyncPlatform("railway")}
                      className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${syncPlatform === "railway" ? "bg-indigo-500 text-white border-indigo-500" : "border-border hover:bg-muted"}`}
                    >
                      Railway
                    </button>
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
                  <label className="text-xs font-medium mb-1 block">{syncPlatform === "vercel" ? "Vercel Token" : "Railway Token"}</label>
                  <Input type="password" placeholder="Your API token" value={syncToken} onChange={(e) => setSyncToken(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">{syncPlatform === "vercel" ? "Vercel Project ID" : "Railway Service ID"}</label>
                  <Input placeholder={syncPlatform === "vercel" ? "prj_xxx" : "service-uuid"} value={syncProjectId} onChange={(e) => setSyncProjectId(e.target.value)} />
                </div>
                <Button className="w-full" onClick={handleSync} disabled={syncLoading}>
                  {syncLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Syncing...</> : <><Zap className="w-4 h-4 mr-2" /> Sync to {syncPlatform === "vercel" ? "Vercel" : "Railway"}</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

function DiffRow({ label, status }: { label: string; status: "only-a" | "only-b" }) {
  const color = status === "only-a" ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300" : "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
  return (
    <div className={`px-3 py-1.5 rounded font-mono text-xs ${color}`}>{label}</div>
  )
}
