"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  FileSignature, Plus, Trash2, Download, Sparkles, Search,
  ChevronRight, Loader2, AlertTriangle, Copy, Clock, History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { ContractRecord, ContractType, Jurisdiction, ContractVersion } from "./types"
import { CONTRACT_META, JURISDICTION_META } from "./types"
import { CONTRACT_FIELDS } from "./templates"

const STORAGE_KEY = "contract-gen-v1"

function loadContracts(): ContractRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") } catch { return [] }
}
function saveContracts(c: ContractRecord[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) }

type View = "library" | "new-contract" | "contract-detail"

export function ContractGenContent() {
  const [contracts, setContracts] = useState<ContractRecord[]>([])
  const [view, setView] = useState<View>("library")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // New contract form
  const [selectedType, setSelectedType] = useState<ContractType>("nda-mutual")
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction>("us")
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)

  // Editor
  const [editedContent, setEditedContent] = useState("")
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)

  useEffect(() => { setContracts(loadContracts()) }, [])
  useEffect(() => { saveContracts(contracts) }, [contracts])

  const selectedContract = useMemo(() =>
    contracts.find((c) => c.id === selectedId) ?? null,
    [contracts, selectedId]
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts
    const q = search.toLowerCase()
    return contracts.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      CONTRACT_META[c.type].label.toLowerCase().includes(q)
    )
  }, [contracts, search])

  function setField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }))
  }

  function resetForm() {
    setFieldValues({})
    setSelectedType("nda-mutual")
    setSelectedJurisdiction("us")
  }

  async function generateContract() {
    setGenerating(true)
    try {
      const res = await fetch("/api/contract-gen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-contract",
          contractType: selectedType,
          jurisdiction: selectedJurisdiction,
          fieldValues,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")

      const now = new Date().toISOString()
      const versionId = crypto.randomUUID()
      const version: ContractVersion = {
        id: versionId,
        content: data.contractText,
        editedContent: data.contractText,
        createdAt: now,
        label: "v1",
      }
      const title = [
        CONTRACT_META[selectedType].label,
        fieldValues["party1Name"] ?? fieldValues["clientName"] ?? fieldValues["companyName"] ?? "",
        fieldValues["party2Name"] ?? fieldValues["freelancerName"] ?? "",
      ].filter(Boolean).join(" — ").slice(0, 80)

      const record: ContractRecord = {
        id: crypto.randomUUID(),
        type: selectedType,
        jurisdiction: selectedJurisdiction,
        title: title || CONTRACT_META[selectedType].label,
        fieldValues,
        versions: [version],
        activeVersionId: versionId,
        createdAt: now,
        updatedAt: now,
      }

      setContracts((prev) => [record, ...prev])
      setSelectedId(record.id)
      setEditedContent(data.contractText)
      setActiveVersionId(versionId)
      resetForm()
      setView("contract-detail")
      toast.success("Contract generated!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed")
    }
    setGenerating(false)
  }

  function saveEdits() {
    if (!selectedContract || !activeVersionId) return
    setContracts((prev) => prev.map((c) =>
      c.id === selectedContract.id
        ? {
            ...c,
            versions: c.versions.map((v) =>
              v.id === activeVersionId ? { ...v, editedContent } : v
            ),
            updatedAt: new Date().toISOString(),
          }
        : c
    ))
    toast.success("Edits saved")
  }

  function addVersion() {
    if (!selectedContract) return
    const now = new Date().toISOString()
    const vId = crypto.randomUUID()
    const currentVersion = selectedContract.versions.find((v) => v.id === activeVersionId)
    const newVersion: ContractVersion = {
      id: vId,
      content: editedContent,
      editedContent,
      createdAt: now,
      label: `v${selectedContract.versions.length + 1}`,
    }
    setContracts((prev) => prev.map((c) =>
      c.id === selectedContract.id
        ? { ...c, versions: [...c.versions, newVersion], activeVersionId: vId, updatedAt: now }
        : c
    ))
    setActiveVersionId(vId)
    toast.success("New version saved")
  }

  function switchVersion(vId: string) {
    const version = selectedContract?.versions.find((v) => v.id === vId)
    if (version) {
      setEditedContent(version.editedContent)
      setActiveVersionId(vId)
    }
  }

  function deleteContract(id: string) {
    setContracts((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) { setSelectedId(null); setView("library") }
    toast.success("Contract deleted")
  }

  function exportTxt() {
    const blob = new Blob([editedContent], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${selectedContract?.title ?? "contract"}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click(); URL.revokeObjectURL(a.href)
    toast.success("Exported as .txt")
  }

  const fields = CONTRACT_FIELDS[selectedType] ?? []

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        @media print {
          body > *:not(.print-area) { display: none !important; }
          .print-area { display: block !important; }
        }
      `}</style>

      <ToolHeader
        title="Contract Generator"
        icon={FileSignature}
        color="text-rose-500"
        badge="Legal"
        actions={
          <div className="flex gap-2">
            {view !== "library" ? (
              <Button variant="outline" size="sm" onClick={() => setView("library")}>← Library</Button>
            ) : (
              <Button size="sm" onClick={() => setView("new-contract")}>
                <Plus className="w-3.5 h-3.5 mr-1" /> New Contract
              </Button>
            )}
          </div>
        }
      />

      {/* Disclaimer banner */}
      <div className="bg-amber-500/10 border-b border-amber-500/20 py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Legal Disclaimer:</strong> This tool generates template contracts for reference only. For binding legal agreements, consult a licensed attorney in your jurisdiction.
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── New Contract ── */}
        {view === "new-contract" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">New Contract</h1>

            <Card>
              <CardHeader><CardTitle className="text-sm">Contract Type</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(CONTRACT_META) as [ContractType, typeof CONTRACT_META[ContractType]][]).map(([type, meta]) => (
                    <button
                      key={type}
                      onClick={() => { setSelectedType(type); setFieldValues({}) }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedType === type
                          ? "border-rose-500 bg-rose-500/10"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <p className="text-sm font-medium">{meta.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Jurisdiction</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(JURISDICTION_META) as [Jurisdiction, string][]).map(([j, label]) => (
                    <button
                      key={j}
                      onClick={() => setSelectedJurisdiction(j)}
                      className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                        selectedJurisdiction === j
                          ? "bg-rose-500 text-white border-rose-500"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Contract Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="text-xs font-medium mb-1 block">
                      {field.label}{field.required && " *"}
                    </label>
                    {field.type === "textarea" ? (
                      <Textarea
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        rows={3}
                      />
                    ) : field.type === "select" ? (
                      <select
                        value={fieldValues[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Select...</option>
                        {(field.options ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={fieldValues[field.key] ?? ""}
                        onChange={(e) => setField(field.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
                <Button
                  className="w-full"
                  onClick={generateContract}
                  disabled={generating}
                >
                  {generating
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    : <><Sparkles className="w-4 h-4 mr-2" /> Generate Contract</>
                  }
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Library ── */}
        {view === "library" && (
          <div className="space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Contract Library</h1>
                <p className="text-muted-foreground text-sm">{contracts.length} contracts saved</p>
              </div>
            </div>

            {contracts.length > 0 && (
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contracts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {contracts.length === 0 ? (
              <Card className="max-w-md mx-auto mt-12">
                <CardContent className="py-16 text-center">
                  <FileSignature className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
                  <h2 className="text-xl font-semibold mb-2">No contracts yet</h2>
                  <p className="text-muted-foreground text-sm mb-6">Generate your first AI contract in minutes.</p>
                  <Button onClick={() => setView("new-contract")}>
                    <Plus className="w-4 h-4 mr-1" /> Create Contract
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((contract) => (
                  <Card
                    key={contract.id}
                    className="cursor-pointer hover:shadow-md transition-shadow group"
                    onClick={() => {
                      setSelectedId(contract.id)
                      const activeVersion = contract.versions.find((v) => v.id === contract.activeVersionId)
                      setEditedContent(activeVersion?.editedContent ?? "")
                      setActiveVersionId(contract.activeVersionId)
                      setView("contract-detail")
                    }}
                  >
                    <CardContent className="py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{contract.title}</p>
                          <Badge variant="secondary" className="text-[10px] shrink-0">{JURISDICTION_META[contract.jurisdiction]}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {CONTRACT_META[contract.type].label} · {contract.versions.length} version{contract.versions.length !== 1 ? "s" : ""}
                          · {new Date(contract.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Contract Detail ── */}
        {view === "contract-detail" && selectedContract && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold">{selectedContract.title}</h1>
                <p className="text-muted-foreground text-sm">
                  {CONTRACT_META[selectedContract.type].label} · {JURISDICTION_META[selectedContract.jurisdiction]}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addVersion}>
                  <History className="w-3.5 h-3.5 mr-1" /> Save Version
                </Button>
                <Button variant="outline" size="sm" onClick={saveEdits}>Save Edits</Button>
                <Button variant="outline" size="sm" onClick={exportTxt}>
                  <Download className="w-3.5 h-3.5 mr-1" /> .txt
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print PDF
                </Button>
                <Button variant="destructive" size="sm" onClick={() => deleteContract(selectedContract.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Version tabs */}
            {selectedContract.versions.length > 1 && (
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
                {selectedContract.versions.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => switchVersion(v.id)}
                    className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors flex items-center gap-1 ${
                      activeVersionId === v.id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clock className="w-3 h-3" />
                    {v.label ?? "Draft"} · {new Date(v.createdAt).toLocaleDateString()}
                  </button>
                ))}
              </div>
            )}

            {/* Split editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Edit</p>
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="font-mono text-xs h-[600px] resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(editedContent); toast.success("Copied") }}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                </div>
                <div className="print-area h-[600px] overflow-y-auto p-4 border rounded-lg bg-white dark:bg-background text-sm font-serif whitespace-pre-wrap leading-relaxed">
                  {editedContent}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
