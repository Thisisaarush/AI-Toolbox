"use client"

import { useState, useEffect, useMemo } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  Users, Plus, Search, Phone, Mail, Calendar, MessageSquare,
  MoreHorizontal, Trash2, Edit3, X, Check, Download, UserPlus,
  Clock, Heart, Building2, Tag, ChevronRight, ArrowLeft, Star,
  AlertCircle, MessageCircle, Video, type LucideIcon,
} from "lucide-react"

// ── Types ─────────────────────────────────────────────────────

type InteractionType = "call" | "email" | "meeting" | "message" | "other"

type Interaction = {
  id: string
  type: InteractionType
  date: string
  notes: string
  followUpDate: string | null
}

type Contact = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  birthday: string
  notes: string
  tags: string[]
  interactions: Interaction[]
  createdAt: string
  updatedAt: string
}

type View = "list" | "detail" | "dashboard"

const STORAGE_KEY = "personal-crm-v1"

const INTERACTION_ICONS: Record<InteractionType, LucideIcon> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  message: MessageSquare,
  other: MessageCircle,
}

const INTERACTION_COLORS: Record<InteractionType, string> = {
  call: "text-blue-500",
  email: "text-amber-500",
  meeting: "text-purple-500",
  message: "text-emerald-500",
  other: "text-muted-foreground",
}

const INTERACTION_LABELS: Record<InteractionType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  message: "Message",
  other: "Other",
}

const TAG_COLORS = [
  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-pink-500/15 text-pink-600 dark:text-pink-400",
]

// ── Helpers ───────────────────────────────────────────────────

let _idCounter = 0
function uid(): string {
  _idCounter++
  return `${Date.now()}-${_idCounter}-${Math.random().toString(36).slice(2, 6)}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysUntil(target: string): number {
  const now = new Date()
  const t = new Date(target + "T00:00:00")
  const diff = t.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function upcomingBirthdays(contacts: Contact[]): Contact[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  return contacts
    .filter((c) => c.birthday)
    .map((c) => {
      const bd = new Date(c.birthday + "T00:00:00")
      const thisYear = new Date(currentYear, bd.getMonth(), bd.getDate())
      if (thisYear < now) thisYear.setFullYear(currentYear + 1)
      return { contact: c, nextDate: thisYear }
    })
    .filter(({ nextDate }) => {
      const diff = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return diff >= 0 && diff <= 30
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime())
    .slice(0, 5)
    .map(({ contact }) => contact)
}

function overdueFollowUps(contacts: Contact[]): { contact: Contact; interaction: Interaction }[] {
  const today = todayStr()
  const result: { contact: Contact; interaction: Interaction }[] = []
  for (const c of contacts) {
    for (const ix of c.interactions) {
      if (ix.followUpDate && ix.followUpDate < today) {
        result.push({ contact: c, interaction: ix })
      }
    }
  }
  return result.sort((a, b) => a.interaction.followUpDate!.localeCompare(b.interaction.followUpDate!))
}

function interactionsThisWeek(contacts: Contact[]): number {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const startStr = formatDateISO(startOfWeek)
  let count = 0
  for (const c of contacts) {
    for (const ix of c.interactions) {
      if (ix.date >= startStr) count++
    }
  }
  return count
}

function tagColorIndex(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % TAG_COLORS.length
}

function contactsToCSV(contacts: Contact[]): string {
  const header = "Name,Email,Phone,Company,Birthday,Notes,Tags,Last Interaction,Created"
  const rows = contacts.map((c) => {
    const lastIx = c.interactions.sort((a, b) => b.date.localeCompare(a.date))[0]
    const lastDate = lastIx ? lastIx.date : ""
    const tags = c.tags.join("; ")
    return `"${c.name}","${c.email}","${c.phone}","${c.company}","${c.birthday}","${c.notes}","${tags}","${lastDate}","${c.createdAt}"`
  })
  return [header, ...rows].join("\n")
}

// ── localStorage ──────────────────────────────────────────────

function loadContacts(): Contact[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? []
  } catch {
    return []
  }
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts))
}

// ── Contact Form ──────────────────────────────────────────────

type ContactFormProps = {
  initial?: Contact
  onSave: (c: Contact) => void
  onCancel: () => void
}

function ContactForm({ initial, onSave, onCancel }: ContactFormProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [email, setEmail] = useState(initial?.email ?? "")
  const [phone, setPhone] = useState(initial?.phone ?? "")
  const [company, setCompany] = useState(initial?.company ?? "")
  const [birthday, setBirthday] = useState(initial?.birthday ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "")

  function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    const contact: Contact = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim(),
      birthday,
      notes: notes.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      interactions: initial?.interactions ?? [],
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onSave(contact)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{initial ? "Edit Contact" : "New Contact"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1">Name *</label>
          <Input placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1">Email</label>
            <Input placeholder="jane@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Phone</label>
            <Input placeholder="+1 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1">Company</label>
            <Input placeholder="Acme Corp" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">Birthday</label>
            <Input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Tags</label>
          <Input placeholder="friend, work, design" value={tags} onChange={(e) => setTags(e.target.value)} />
          <p className="text-[11px] text-muted-foreground mt-1">Comma-separated</p>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Notes</label>
          <Textarea placeholder="Notes about this contact..." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex gap-3 pt-1">
          <Button size="sm" onClick={handleSave}>{initial ? "Update" : "Add Contact"}</Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Interaction Form ──────────────────────────────────────────

type InteractionFormProps = {
  onSave: (ix: Interaction) => void
  onCancel: () => void
}

function InteractionForm({ onSave, onCancel }: InteractionFormProps) {
  const [type, setType] = useState<InteractionType>("call")
  const [date, setDate] = useState(todayStr())
  const [notes, setNotes] = useState("")
  const [followUpDate, setFollowUpDate] = useState("")

  function handleSave() {
    if (!notes.trim()) {
      toast.error("Please add some notes")
      return
    }
    const interaction: Interaction = {
      id: uid(),
      type,
      date,
      notes: notes.trim(),
      followUpDate: followUpDate || null,
    }
    onSave(interaction)
  }

  const types: InteractionType[] = ["call", "email", "meeting", "message", "other"]

  return (
    <div className="p-4 rounded-xl border border-border bg-card space-y-4">
      <div className="flex gap-2">
        {types.map((t) => {
          const Icon = INTERACTION_ICONS[t]
          const active = type === t
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {INTERACTION_LABELS[t]}
            </button>
          )
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium block mb-1">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Follow-up date (optional)</label>
          <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium block mb-1">Notes</label>
        <Textarea
          placeholder="What happened? Any key details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>
      <div className="flex gap-3">
        <Button size="sm" onClick={handleSave}>Log Interaction</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

// ── Contact Card ──────────────────────────────────────────────

function ContactCard({
  contact,
  onClick,
}: {
  contact: Contact
  onClick: () => void
}) {
  const lastIx = contact.interactions.length > 0
    ? [...contact.interactions].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null

  const avatarLetter = contact.name.charAt(0).toUpperCase()

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
          {avatarLetter}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{contact.name}</p>
          {contact.company && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Building2 className="w-3 h-3" />
              <span className="truncate">{contact.company}</span>
            </div>
          )}
          {contact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${TAG_COLORS[tagColorIndex(tag)]}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1 shrink-0" />
      </div>
      {lastIx && (
        <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground border-t border-border/40 pt-3">
          <Calendar className="w-3 h-3" />
          <span>Last: {formatDate(lastIx.date)}</span>
        </div>
      )}
    </button>
  )
}

// ── Stat Card ─────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="p-4 rounded-xl border border-border/60 bg-card">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color} bg-opacity-15`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ── Interaction Timeline Item ─────────────────────────────────

function InteractionTimelineItem({
  interaction,
  contactName,
}: {
  interaction: Interaction
  contactName?: string
}) {
  const Icon = INTERACTION_ICONS[interaction.type]
  const color = INTERACTION_COLORS[interaction.type]
  const days = interaction.followUpDate ? daysUntil(interaction.followUpDate) : null

  return (
    <div className="flex gap-4 p-4 rounded-xl border border-border/60 bg-card">
      <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{INTERACTION_LABELS[interaction.type]}</span>
          <span className="text-xs text-muted-foreground">{formatDate(interaction.date)}</span>
        </div>
        {interaction.notes && (
          <p className="text-sm mt-1 text-foreground/90 whitespace-pre-wrap">{interaction.notes}</p>
        )}
        {interaction.followUpDate && (
          <div className={`flex items-center gap-1.5 mt-2 text-xs ${days !== null && days <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock className="w-3 h-3" />
            <span>
              Follow-up: {formatDate(interaction.followUpDate)}
              {days !== null && days > 0 && ` (in ${days}d)`}
              {days !== null && days === 0 && " (today)"}
              {days !== null && days < 0 && ` (${Math.abs(days)}d overdue)`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function PersonalCRMContent() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [view, setView] = useState<View>("list")
  const [search, setSearch] = useState("")
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [showInteractionForm, setShowInteractionForm] = useState(false)

  useEffect(() => {
    setContacts(loadContacts())
  }, [])

  function updateContacts(fn: (prev: Contact[]) => Contact[]) {
    setContacts((prev) => {
      const next = fn(prev)
      saveContacts(next)
      return next
    })
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    for (const c of contacts) {
      for (const t of c.tags) tagSet.add(t)
    }
    return Array.from(tagSet).sort()
  }, [contacts])

  const filteredContacts = useMemo(() => {
    let result = contacts
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    }
    if (selectedTag) {
      result = result.filter((c) => c.tags.includes(selectedTag))
    }
    return result
  }, [contacts, search, selectedTag])

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId) ?? null,
    [contacts, selectedContactId]
  )

  // ── Contact CRUD ──

  function saveContact(contact: Contact) {
    updateContacts((prev) => {
      const exists = prev.find((c) => c.id === contact.id)
      if (exists) {
        return prev.map((c) => (c.id === contact.id ? { ...contact, updatedAt: new Date().toISOString() } : c))
      }
      return [...prev, contact]
    })
    setShowAddForm(false)
    setEditingContact(null)
    toast.success(editingContact ? "Contact updated" : "Contact added")
  }

  function deleteContact(id: string) {
    updateContacts((prev) => prev.filter((c) => c.id !== id))
    if (selectedContactId === id) {
      setSelectedContactId(null)
      setView("list")
    }
    toast.success("Contact deleted")
  }

  // ── Interaction ──

  function addInteraction(contactId: string, ix: Interaction) {
    updateContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? { ...c, interactions: [...c.interactions, ix], updatedAt: new Date().toISOString() }
          : c
      )
    )
    setShowInteractionForm(false)
    toast.success("Interaction logged")
  }

  function deleteInteraction(contactId: string, interactionId: string) {
    updateContacts((prev) =>
      prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              interactions: c.interactions.filter((ix) => ix.id !== interactionId),
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    )
    toast.success("Interaction removed")
  }

  // ── Export ──

  function exportJSON() {
    const blob = new Blob([JSON.stringify(contacts, null, 2)], { type: "application/json" })
    downloadBlob(blob, "contacts-export.json")
    toast.success("Contacts exported as JSON")
  }

  function exportCSV() {
    const csv = contactsToCSV(contacts)
    const blob = new Blob([csv], { type: "text/csv" })
    downloadBlob(blob, "contacts-export.csv")
    toast.success("Contacts exported as CSV")
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Dashboard Data ──

  const totalContacts = contacts.length
  const weeklyInteractions = interactionsThisWeek(contacts)
  const overdue = overdueFollowUps(contacts)
  const birthdays = upcomingBirthdays(contacts)

  // ── Render ──

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="Personal CRM"
        icon={Users}
        color="text-rose-500"
        badge="Relationships"
        actions={
          <Button size="sm" onClick={() => { setShowAddForm(true); setEditingContact(null) }}>
            <Plus className="w-4 h-4 mr-1" /> Add Contact
          </Button>
        }
      />

      <main className="flex-1 max-w-5xl mx-auto px-4 py-6 w-full space-y-6">
        {/* View Tabs */}
        <div className="flex gap-1.5 p-1 bg-muted/50 rounded-xl w-fit">
          {([
            { key: "list" as View, label: "Contacts", icon: <Users className="w-4 h-4" /> },
            { key: "dashboard" as View, label: "Dashboard", icon: <BarChart3 className="w-4 h-4" /> },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm rounded-md font-medium transition-colors ${
                view === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── DASHBOARD VIEW ── */}
        {view === "dashboard" && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Dashboard</h2>

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total Contacts" value={totalContacts} color="text-rose-500" />
              <StatCard icon={MessageSquare} label="Interactions/Week" value={weeklyInteractions} color="text-blue-500" />
              <StatCard icon={AlertCircle} label="Overdue Follow-ups" value={overdue.length} color="text-amber-500" />
              <StatCard icon={Heart} label="Birthdays (30d)" value={birthdays.length} color="text-emerald-500" />
            </div>

            {/* Overdue follow-ups */}
            {overdue.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Overdue Follow-ups
                </h3>
                <div className="space-y-2">
                  {overdue.map(({ contact, interaction }) => (
                    <button
                      key={interaction.id}
                      onClick={() => { setSelectedContactId(contact.id); setView("detail") }}
                      className="w-full text-left p-3 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center gap-3 hover:bg-destructive/10 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {contact.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {INTERACTION_LABELS[interaction.type]} — follow-up was {formatDate(interaction.followUpDate!)}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming birthdays */}
            {birthdays.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  Upcoming Birthdays
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {birthdays.map((c) => {
                    const bd = new Date(c.birthday + "T00:00:00")
                    const now = new Date()
                    const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate())
                    if (next < now) next.setFullYear(now.getFullYear() + 1)
                    const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setSelectedContactId(c.id); setView("detail") }}
                        className="w-full text-left p-4 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors flex items-center gap-4"
                      >
                        <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-sm font-bold text-rose-500 shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {bd.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
                            {diff === 0 ? " — Today!" : ` — in ${diff}d`}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {totalContacts === 0 && (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">No data yet</p>
                <p className="text-sm mt-1">Add your first contact to see dashboard stats</p>
              </div>
            )}
          </div>
        )}

        {/* ── CONTACT LIST VIEW ── */}
        {view === "list" && (
          <>
            {/* Add form */}
            {(showAddForm || editingContact) && (
              <ContactForm
                initial={editingContact ?? undefined}
                onSave={saveContact}
                onCancel={() => { setShowAddForm(false); setEditingContact(null) }}
              />
            )}

            {/* Search + tag filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, company, or tag..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={exportJSON}>
                  <Download className="w-4 h-4 mr-1" /> JSON
                </Button>
                <Button size="sm" variant="outline" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
              </div>
            </div>

            {/* Tag pills */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear filter
                  </button>
                )}
                {allTags.map((tag) => {
                  const active = selectedTag === tag
                  const color = TAG_COLORS[tagColorIndex(tag)]
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(active ? null : tag)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        active ? `${color} ring-1 ring-foreground/20` : `${color} opacity-70 hover:opacity-100`
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Contact grid */}
            {filteredContacts.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium">
                  {contacts.length === 0 ? "No contacts yet" : "No contacts match your search"}
                </p>
                <p className="text-sm mt-1">
                  {contacts.length === 0 ? "Add your first contact to get started" : "Try a different search term"}
                </p>
                {contacts.length === 0 && (
                  <Button className="mt-4" size="sm" onClick={() => setShowAddForm(true)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Add Contact
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onClick={() => { setSelectedContactId(contact.id); setView("detail") }}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DETAIL VIEW ── */}
        {view === "detail" && selectedContact && (
          <div className="space-y-6">
            {/* Back button + actions */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSelectedContactId(null); setView("list") }}
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingContact(selectedContact)
                  setShowAddForm(true)
                  setView("list")
                }}
              >
                <Edit3 className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  if (confirm("Delete this contact?")) deleteContact(selectedContact.id)
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>

            {/* Contact info */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <h2 className="text-lg font-bold">{selectedContact.name}</h2>
                      {selectedContact.company && (
                        <p className="text-sm text-muted-foreground">{selectedContact.company}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedContact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                          <a href={`mailto:${selectedContact.email}`} className="text-primary hover:underline truncate">
                            {selectedContact.email}
                          </a>
                        </div>
                      )}
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                          <a href={`tel:${selectedContact.phone}`} className="hover:underline truncate">
                            {selectedContact.phone}
                          </a>
                        </div>
                      )}
                      {selectedContact.birthday && (
                        <div className="flex items-center gap-2 text-sm">
                          <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>{formatDate(selectedContact.birthday)}</span>
                          <span className="text-xs text-muted-foreground">
                            (turns {new Date().getFullYear() - new Date(selectedContact.birthday + "T00:00:00").getFullYear()})
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-muted-foreground">
                          Added {new Date(selectedContact.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {selectedContact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedContact.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${TAG_COLORS[tagColorIndex(tag)]}`}
                          >
                            <Tag className="w-3 h-3 mr-1" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {selectedContact.notes && (
                      <div className="pt-2 border-t border-border/40">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{selectedContact.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Interactions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Interaction History</h3>
                <Button size="sm" onClick={() => setShowInteractionForm(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Log Interaction
                </Button>
              </div>

              {showInteractionForm && (
                <InteractionForm
                  onSave={(ix) => addInteraction(selectedContact.id, ix)}
                  onCancel={() => setShowInteractionForm(false)}
                />
              )}

              {selectedContact.interactions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">No interactions logged yet</p>
                  <p className="text-xs mt-1">Log your first interaction with this contact</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...selectedContact.interactions]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((ix) => (
                      <div key={ix.id} className="group relative">
                        <InteractionTimelineItem interaction={ix} />
                        <button
                          onClick={() => deleteInteraction(selectedContact.id, ix.id)}
                          className="absolute top-3 right-3 w-6 h-6 rounded bg-background/80 border border-border/40 items-center justify-center hidden group-hover:flex hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback when no contact selected in detail view */}
        {view === "detail" && !selectedContact && (
          <div className="py-16 text-center text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Contact not found</p>
            <Button className="mt-4" size="sm" onClick={() => { setSelectedContactId(null); setView("list") }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to contacts
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}

function BarChart3(props: React.ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  )
}
