"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import {
  Shield, Plus, Trash2, Eye, EyeOff, Copy, Bell, X,
  AlertTriangle, Printer, Upload, Cloud, ChevronRight, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import type { VaultDocument, DocumentType, EmergencyCard, VaultState } from "./types"
import {
  DOC_TYPE_META, xorCipher, xorDecipher, hashPin, expiryColor, daysToExpiry,
} from "./types"

const STORAGE_KEY = "id-vault-v1"

function loadState(): VaultState {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? { documents: [], pinHash: null, emergencyCard: null }
  } catch {
    return { documents: [], pinHash: null, emergencyCard: null }
  }
}
function saveState(s: VaultState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) }

type View = "vault" | "add-doc" | "doc-detail" | "emergency-card" | "setup-pin"

export function IdVaultContent() {
  const [vaultState, setVaultState] = useState<VaultState>({ documents: [], pinHash: null, emergencyCard: null })
  const [view, setView] = useState<View>("vault")
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [isPinUnlocked, setIsPinUnlocked] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pinError, setPinError] = useState("")
  const [revealedDocs, setRevealedDocs] = useState<Set<string>>(new Set())

  // Add form
  const [addType, setAddType] = useState<DocumentType>("passport")
  const [addName, setAddName] = useState("")
  const [addAuthority, setAddAuthority] = useState("")
  const [addCountry, setAddCountry] = useState("")
  const [addDocNum, setAddDocNum] = useState("")
  const [addIssueDate, setAddIssueDate] = useState("")
  const [addExpiryDate, setAddExpiryDate] = useState("")
  const [addNotes, setAddNotes] = useState("")
  const [addReminder, setAddReminder] = useState("")
  const [addPhoto, setAddPhoto] = useState<string | null>(null)

  // Pin setup
  const [newPin, setNewPin] = useState("")
  const [confirmPin, setConfirmPin] = useState("")

  // Emergency card
  const [ec, setEc] = useState<EmergencyCard>({
    name: "", bloodType: "", allergies: "",
    emergencyContacts: [{ name: "", phone: "", relationship: "" }],
    insuranceNumber: "", doctorContact: "",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setVaultState(loadState()) }, [])
  useEffect(() => { saveState(vaultState) }, [vaultState])

  const selectedDoc = useMemo(() => vaultState.documents.find((d) => d.id === selectedDocId) ?? null, [vaultState.documents, selectedDocId])

  const expiringSoon = useMemo(() =>
    vaultState.documents
      .filter((d) => d.expiryDate && daysToExpiry(d.expiryDate) < 90)
      .sort((a, b) => daysToExpiry(a.expiryDate!) - daysToExpiry(b.expiryDate!)),
    [vaultState.documents]
  )

  async function setupPin() {
    if (newPin.length < 4) { toast.error("PIN must be at least 4 digits"); return }
    if (newPin !== confirmPin) { toast.error("PINs don't match"); return }
    const hash = await hashPin(newPin)
    setVaultState((prev) => ({ ...prev, pinHash: hash }))
    setIsPinUnlocked(true)
    setNewPin(""); setConfirmPin("")
    toast.success("PIN set successfully")
    setView("vault")
  }

  async function verifyPin() {
    const hash = await hashPin(pinInput)
    if (hash === vaultState.pinHash) {
      setIsPinUnlocked(true)
      setPinInput(""); setPinError("")
    } else {
      setPinError("Incorrect PIN")
    }
  }

  async function addDocument() {
    if (!addName.trim()) { toast.error("Document name required"); return }
    if (addDocNum && !vaultState.pinHash) { toast.error("Set a PIN first to store document numbers securely"); return }

    let encryptedNum: string | undefined
    if (addDocNum && isPinUnlocked) {
      encryptedNum = xorCipher(addDocNum, vaultState.pinHash!)
    }

    const doc: VaultDocument = {
      id: crypto.randomUUID(),
      type: addType,
      name: addName.trim(),
      issuingAuthority: addAuthority.trim() || undefined,
      issuingCountry: addCountry.trim() || undefined,
      documentNumber: encryptedNum,
      issueDate: addIssueDate || undefined,
      expiryDate: addExpiryDate || undefined,
      notes: addNotes.trim() || undefined,
      photoBase64: addPhoto ?? undefined,
      reminderDate: addReminder || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setVaultState((prev) => ({ ...prev, documents: [...prev.documents, doc] }))
    setAddName(""); setAddAuthority(""); setAddCountry(""); setAddDocNum("")
    setAddIssueDate(""); setAddExpiryDate(""); setAddNotes(""); setAddReminder("")
    setAddPhoto(null); setAddType("passport")
    toast.success(`"${doc.name}" saved to vault`)
    setView("vault")
  }

  function deleteDoc(id: string) {
    setVaultState((prev) => ({ ...prev, documents: prev.documents.filter((d) => d.id !== id) }))
    if (selectedDocId === id) { setSelectedDocId(null); setView("vault") }
    toast.success("Document removed")
  }

  function revealDocNumber(docId: string) {
    if (!isPinUnlocked) { toast.error("Unlock vault with your PIN first"); return }
    setRevealedDocs((prev) => { const s = new Set(prev); s.add(docId); return s })
  }

  function getDocNumber(doc: VaultDocument): string {
    if (!doc.documentNumber) return ""
    if (!revealedDocs.has(doc.id)) return "••••••••"
    return xorDecipher(doc.documentNumber, vaultState.pinHash!)
  }

  async function copyDocNumber(doc: VaultDocument) {
    if (!isPinUnlocked) { toast.error("Unlock vault first"); return }
    if (!doc.documentNumber) { toast.error("No document number stored"); return }
    const num = xorDecipher(doc.documentNumber, vaultState.pinHash!)
    await navigator.clipboard.writeText(num)
    toast.success("Copied to clipboard")
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 500 * 1024) {
      toast.warning("File is large (>500KB). Storing in localStorage may slow the app.")
    }
    const reader = new FileReader()
    reader.onload = (ev) => setAddPhoto(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function saveEmergencyCard() {
    setVaultState((prev) => ({ ...prev, emergencyCard: ec }))
    toast.success("Emergency card saved")
  }

  function printEmergencyCard() {
    window.print()
  }

  // Locked state — need PIN
  const needsPin = vaultState.pinHash && !isPinUnlocked

  if (needsPin && view !== "setup-pin") {
    return (
      <div className="min-h-screen flex flex-col">
        <ToolHeader title="ID Vault" icon={Shield} color="text-sky-500" badge="Personal" />
        <main className="flex-1 flex items-center justify-center p-5">
          <Card className="w-full max-w-sm">
            <CardContent className="py-8 text-center space-y-5">
              <Lock className="w-10 h-10 mx-auto text-sky-500" />
              <h2 className="text-2xl font-bold">Vault Locked</h2>
              <p className="text-sm text-muted-foreground">Enter your PIN to access your documents.</p>
              <Input
                type="password"
                placeholder="Enter PIN"
                value={pinInput}
                onChange={(e) => { setPinInput(e.target.value); setPinError("") }}
                onKeyDown={(e) => e.key === "Enter" && verifyPin()}
                maxLength={8}
                className="text-center text-xl tracking-widest"
              />
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
              <Button className="w-full" onClick={verifyPin}>Unlock Vault</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="ID Vault"
        icon={Shield}
        color="text-sky-500"
        badge="Personal"
        actions={
          <div className="flex gap-3">
            {view !== "vault" ? (
              <Button variant="outline" size="sm" onClick={() => setView("vault")}>← Back</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setView("emergency-card")}>
                  <Printer className="w-4 h-4 mr-1" /> Emergency Card
                </Button>
                {!vaultState.pinHash && (
                  <Button variant="outline" size="sm" onClick={() => setView("setup-pin")}>
                    <Lock className="w-4 h-4 mr-1" /> Set PIN
                  </Button>
                )}
                <Button size="sm" onClick={() => setView("add-doc")}>
                  <Plus className="w-4 h-4 mr-1" /> Add Document
                </Button>
              </>
            )}
          </div>
        }
      />

      <main className="flex-1 max-w-7xl mx-auto px-4 py-6 w-full">

        {/* ── Setup PIN ── */}
        {view === "setup-pin" && (
          <div className="max-w-sm mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Set Vault PIN</h1>
            <Card>
              <CardContent className="pt-6 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Your PIN is used to encrypt document numbers. It&apos;s hashed with SHA-256 and stored locally — never sent to any server.
                </p>
                <div>
                  <label className="text-xs font-medium mb-1 block">PIN (4-8 digits)</label>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    maxLength={8}
                    className="text-center text-xl tracking-widest"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Confirm PIN</label>
                  <Input
                    type="password"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    maxLength={8}
                    className="text-center text-xl tracking-widest"
                  />
                </div>
                <Button className="w-full" onClick={setupPin}>
                  <Lock className="w-4 h-4 mr-2" /> Set PIN
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Add Document ── */}
        {view === "add-doc" && (
          <div className="max-w-lg mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Add Document</h1>
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div>
                  <label className="text-xs font-medium mb-1 block">Document Type</label>
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as DocumentType)}
                    className="w-full h-10 rounded-md border border-input bg-background px-4 text-sm"
                  >
                    {(Object.entries(DOC_TYPE_META) as [DocumentType, typeof DOC_TYPE_META[DocumentType]][]).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Document Name *</label>
                  <Input placeholder="My Passport, Travel Visa..." value={addName} onChange={(e) => setAddName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Issuing Authority</label>
                    <Input placeholder="US Dept of State" value={addAuthority} onChange={(e) => setAddAuthority(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Country</label>
                    <Input placeholder="USA" value={addCountry} onChange={(e) => setAddCountry(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">
                    Document Number
                    {!vaultState.pinHash && <span className="text-amber-500 ml-1">(requires PIN)</span>}
                  </label>
                  <Input
                    placeholder={vaultState.pinHash ? "Will be encrypted with your PIN" : "Set a PIN first to store doc numbers"}
                    value={addDocNum}
                    onChange={(e) => setAddDocNum(e.target.value)}
                    disabled={!vaultState.pinHash}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Issue Date</label>
                    <Input type="date" value={addIssueDate} onChange={(e) => setAddIssueDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Expiry Date</label>
                    <Input type="date" value={addExpiryDate} onChange={(e) => setAddExpiryDate(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Renewal Reminder</label>
                  <Input type="date" value={addReminder} onChange={(e) => setAddReminder(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Notes</label>
                  <Textarea rows={2} placeholder="Any additional notes..." value={addNotes} onChange={(e) => setAddNotes(e.target.value)} className="leading-relaxed" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Photo / Scan (optional)</label>
                  <div className="flex gap-3 items-center">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1" /> Upload
                    </Button>
                    {addPhoto && <span className="text-xs text-green-600">Photo attached</span>}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </div>
                  {addPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={addPhoto} alt="Document" className="mt-2 max-h-32 rounded object-contain" />
                  )}
                </div>
                <Button className="w-full" onClick={addDocument}>
                  <Shield className="w-4 h-4 mr-2" /> Save to Vault
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Vault Dashboard ── */}
        {view === "vault" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">ID Vault</h1>
                <p className="text-muted-foreground text-sm">{vaultState.documents.length} documents · {isPinUnlocked ? "Unlocked" : "Locked"}</p>
              </div>
              {!vaultState.pinHash && (
                <div className="flex items-center gap-3 text-amber-500 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Set a PIN to encrypt document numbers</span>
                </div>
              )}
            </div>

            {/* Expiry alerts */}
            {expiringSoon.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Documents expiring soon</p>
                  </div>
                  <div className="space-y-1">
                    {expiringSoon.map((doc) => {
                      const days = daysToExpiry(doc.expiryDate!)
                      return (
                        <div key={doc.id} className="flex items-center justify-between text-sm">
                          <span>{doc.name}</span>
                          <span className={expiryColor(doc.expiryDate!)}>
                            {days < 0 ? "Expired" : days === 0 ? "Today" : `${days} days`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {vaultState.documents.length === 0 ? (
              <Card className="max-w-md mx-auto mt-12">
                <CardContent className="py-16 text-center">
                  <Shield className="w-14 h-14 mx-auto mb-5 text-muted-foreground opacity-40" />
                  <h2 className="text-2xl font-semibold mb-3">Empty vault</h2>
                  <p className="text-muted-foreground text-sm mb-8">Add your IDs, passports, and important documents.</p>
                  <Button onClick={() => setView("add-doc")}>
                    <Plus className="w-4 h-4 mr-1" /> Add First Document
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {vaultState.documents.map((doc) => {
                  const meta = DOC_TYPE_META[doc.type]
                  const expColor = doc.expiryDate ? expiryColor(doc.expiryDate) : "text-muted-foreground"
                  const days = doc.expiryDate ? daysToExpiry(doc.expiryDate) : null
                  return (
                    <Card
                      key={doc.id}
                      className="cursor-pointer hover:shadow-md transition-shadow group"
                      onClick={() => { setSelectedDocId(doc.id); setView("doc-detail") }}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${meta.bg} ${meta.color}`}>
                            {meta.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        {doc.photoBase64 && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={doc.photoBase64} alt="" className="w-full h-20 object-cover rounded mb-3" />
                        )}
                        <p className="font-medium text-sm">{doc.name}</p>
                        {doc.issuingCountry && <p className="text-xs text-muted-foreground">{doc.issuingCountry}</p>}
                        {doc.expiryDate && (
                          <p className={`text-xs mt-2 font-medium ${expColor}`}>
                            {days !== null && days < 0 ? "Expired" : `Expires ${new Date(doc.expiryDate).toLocaleDateString()}`}
                            {days !== null && days >= 0 && days < 90 ? ` (${days}d)` : ""}
                          </p>
                        )}
                        {doc.reminderDate && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <Bell className="w-4 h-4" />
                            Reminder: {new Date(doc.reminderDate).toLocaleDateString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            {/* Google Drive Teaser */}
            <Card className="border-dashed">
              <CardContent className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5 text-sky-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium">Import from Google Drive</p>
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    OCR your ID photos stored in Google Drive and auto-fill document details.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Document Detail ── */}
        {view === "doc-detail" && selectedDoc && (
          <div className="max-w-lg mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{selectedDoc.name}</h1>
                <p className="text-muted-foreground text-sm">{DOC_TYPE_META[selectedDoc.type].label}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => deleteDoc(selectedDoc.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-4">
                {selectedDoc.photoBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedDoc.photoBase64} alt="Document" className="w-full max-h-48 object-contain rounded" />
                )}
                {[
                  { label: "Issuing Authority", value: selectedDoc.issuingAuthority },
                  { label: "Issuing Country", value: selectedDoc.issuingCountry },
                  { label: "Issue Date", value: selectedDoc.issueDate && new Date(selectedDoc.issueDate).toLocaleDateString() },
                  { label: "Expiry Date", value: selectedDoc.expiryDate && new Date(selectedDoc.expiryDate).toLocaleDateString() },
                ].filter((f) => f.value).map((f) => (
                  <div key={f.label} className="flex justify-between text-sm py-1.5 border-b last:border-0">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-medium">{f.value}</span>
                  </div>
                ))}

                {selectedDoc.documentNumber && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-muted-foreground">Document Number</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-medium">{getDocNumber(selectedDoc)}</span>
                      <button
                        onClick={() => revealedDocs.has(selectedDoc.id)
                          ? setRevealedDocs((prev) => { const s = new Set(prev); s.delete(selectedDoc.id); return s })
                          : revealDocNumber(selectedDoc.id)
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {revealedDocs.has(selectedDoc.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => copyDocNumber(selectedDoc)} className="text-muted-foreground hover:text-foreground">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {selectedDoc.notes && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{selectedDoc.notes}</p>
                  </div>
                )}

                {selectedDoc.reminderDate && (
                  <div className="flex items-center gap-3 text-sm">
                    <Bell className="w-4 h-4 text-sky-500" />
                    <span>Reminder set for {new Date(selectedDoc.reminderDate).toLocaleDateString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Emergency Card ── */}
        {view === "emergency-card" && (
          <div className="max-w-lg mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Emergency Card</h1>
              <Button variant="outline" size="sm" onClick={printEmergencyCard}>
                <Printer className="w-4 h-4 mr-1" /> Print
              </Button>
            </div>
            <Card>
              <CardContent className="pt-5 space-y-5">
                <Input placeholder="Full Name" value={ec.name} onChange={(e) => setEc({ ...ec, name: e.target.value })} />
                <div className="grid grid-cols-2 gap-4">
                  <Input placeholder="Blood Type (A+, O-...)" value={ec.bloodType ?? ""} onChange={(e) => setEc({ ...ec, bloodType: e.target.value })} />
                  <Input placeholder="Allergies" value={ec.allergies ?? ""} onChange={(e) => setEc({ ...ec, allergies: e.target.value })} />
                </div>
                {ec.emergencyContacts.map((contact, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3">
                    <Input placeholder="Contact Name" value={contact.name} onChange={(e) => {
                      const c = [...ec.emergencyContacts]; c[i] = { ...c[i]!, name: e.target.value }
                      setEc({ ...ec, emergencyContacts: c })
                    }} />
                    <Input placeholder="Phone" value={contact.phone} onChange={(e) => {
                      const c = [...ec.emergencyContacts]; c[i] = { ...c[i]!, phone: e.target.value }
                      setEc({ ...ec, emergencyContacts: c })
                    }} />
                    <div className="flex gap-1.5">
                      <Input placeholder="Relation" value={contact.relationship} onChange={(e) => {
                        const c = [...ec.emergencyContacts]; c[i] = { ...c[i]!, relationship: e.target.value }
                        setEc({ ...ec, emergencyContacts: c })
                      }} />
                      {i > 0 && (
                        <button onClick={() => setEc({ ...ec, emergencyContacts: ec.emergencyContacts.filter((_, j) => j !== i) })}>
                          <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setEc({ ...ec, emergencyContacts: [...ec.emergencyContacts, { name: "", phone: "", relationship: "" }] })}>
                  <Plus className="w-4 h-4 mr-1" /> Add Contact
                </Button>
                <Input placeholder="Insurance Card Number" value={ec.insuranceNumber ?? ""} onChange={(e) => setEc({ ...ec, insuranceNumber: e.target.value })} />
                <Input placeholder="Doctor Contact" value={ec.doctorContact ?? ""} onChange={(e) => setEc({ ...ec, doctorContact: e.target.value })} />
                <Button className="w-full" onClick={saveEmergencyCard}>Save Emergency Card</Button>
              </CardContent>
            </Card>

            {/* Print preview */}
            {vaultState.emergencyCard && (
              <div className="print:block">
                <Card className="border-2 border-red-500">
                  <CardHeader>
                    <CardTitle className="text-red-500 flex items-center gap-3">
                      🆘 IN CASE OF EMERGENCY — {vaultState.emergencyCard.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {vaultState.emergencyCard.bloodType && <p><strong>Blood Type:</strong> {vaultState.emergencyCard.bloodType}</p>}
                    {vaultState.emergencyCard.allergies && <p><strong>Allergies:</strong> {vaultState.emergencyCard.allergies}</p>}
                    <p><strong>Emergency Contacts:</strong></p>
                    {vaultState.emergencyCard.emergencyContacts.filter((c) => c.name).map((c, i) => (
                      <p key={i} className="ml-3">• {c.name} ({c.relationship}) — {c.phone}</p>
                    ))}
                    {vaultState.emergencyCard.insuranceNumber && (
                      <p><strong>Insurance:</strong> {vaultState.emergencyCard.insuranceNumber}</p>
                    )}
                    {vaultState.emergencyCard.doctorContact && (
                      <p><strong>Doctor:</strong> {vaultState.emergencyCard.doctorContact}</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
