"use client"

import { useState, useEffect } from "react"
import { ToolHeader } from "@/components/shared/tool-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Type, AlignLeft, Mail, Hash, Phone, Calendar, Clock, Star,
  Circle, CheckSquare, ChevronDown, Upload, Heading, Text, Minus,
  FilePlus, GripVertical, Plus, Trash2, Copy, Eye, Share2, BarChart3,
  Settings, Palette, ArrowLeft, ArrowRight, Check, X, ChevronRight,
  ChevronUp, AlertCircle, ExternalLink, Download, Save, Undo2,
  Sparkles, Bold, Link2, Code,
} from "lucide-react"
import type {
  Form, FormField, FormResponse, FieldType, FieldOption, Condition,
  Operator, View, FormTheme,
} from "./types"
import {
  FIELD_TYPE_LABELS, FIELD_ICONS, DEFAULT_THEME, STORAGE_KEY, RESPONSES_KEY,
} from "./types"

// ── Helpers ──────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Failed to copy"),
  )
}

function loadForms(): Form[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Form[]
  } catch {
    return []
  }
}

function saveForms(forms: Form[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(forms))
}

function loadResponses(): FormResponse[] {
  try {
    const raw = localStorage.getItem(RESPONSES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as FormResponse[]
  } catch {
    return []
  }
}

function saveResponses(responses: FormResponse[]) {
  localStorage.setItem(RESPONSES_KEY, JSON.stringify(responses))
}

function defaultField(type: FieldType): FormField {
  return {
    id: uid(),
    type,
    label: FIELD_TYPE_LABELS[type],
    placeholder: "",
    description: "",
    required: false,
    options: type === "single_choice" || type === "multiple_choice" || type === "dropdown"
      ? [{ id: uid(), label: "Option 1" }]
      : [],
    conditions: [],
    min: type === "number" ? 0 : 0,
    max: type === "number" ? 100 : type === "rating" ? 5 : 0,
    rows: type === "long_text" ? 4 : 0,
  }
}

function defaultForm(): Form {
  return {
    id: uid(),
    title: "Untitled Form",
    description: "",
    fields: [],
    theme: { ...DEFAULT_THEME },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    views: 0,
  }
}

// ── Field type groups ────────────────────────────────────────────────────

const INPUT_FIELDS: FieldType[] = ["short_text", "long_text", "email", "number", "phone", "date", "time", "rating"]
const CHOICE_FIELDS: FieldType[] = ["single_choice", "multiple_choice", "dropdown", "file_upload"]
const LAYOUT_FIELDS: FieldType[] = ["heading", "paragraph", "divider", "page_break"]

const FIELD_GROUPS: { label: string; types: FieldType[] }[] = [
  { label: "Input Fields", types: INPUT_FIELDS },
  { label: "Choice Fields", types: CHOICE_FIELDS },
  { label: "Layout Elements", types: LAYOUT_FIELDS },
]

function getFieldIcon(type: FieldType): React.ReactNode {
  const iconMap: Record<string, React.ReactNode> = {
    Type: <Type className="w-4 h-4" />,
    AlignLeft: <AlignLeft className="w-4 h-4" />,
    Mail: <Mail className="w-4 h-4" />,
    Hash: <Hash className="w-4 h-4" />,
    Phone: <Phone className="w-4 h-4" />,
    Calendar: <Calendar className="w-4 h-4" />,
    Clock: <Clock className="w-4 h-4" />,
    Star: <Star className="w-4 h-4" />,
    Circle: <Circle className="w-4 h-4" />,
    CheckSquare: <CheckSquare className="w-4 h-4" />,
    ChevronDown: <ChevronDown className="w-4 h-4" />,
    Upload: <Upload className="w-4 h-4" />,
    Heading: <Heading className="w-4 h-4" />,
    Text: <Text className="w-4 h-4" />,
    Minus: <Minus className="w-4 h-4" />,
    FilePlus: <FilePlus className="w-4 h-4" />,
  }
  return iconMap[FIELD_ICONS[type]] ?? <Type className="w-4 h-4" />
}

// ── renderField ──────────────────────────────────────────────────────────

const INPUT_CLASS =
  "w-full bg-background border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed transition-colors"
const INPUT_CLASS_ERROR =
  "w-full bg-background border border-destructive rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-destructive/30 leading-relaxed transition-colors"

function renderField(
  field: FormField,
  value: unknown,
  onChange: (val: unknown) => void,
  errors: Record<string, string>,
): React.ReactNode {
  const hasError = !!errors[field.id]
  const cls = hasError ? INPUT_CLASS_ERROR : `${INPUT_CLASS} border-input`

  function handle(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    onChange(e.target.value)
  }

  switch (field.type) {
    case "short_text":
      return (
        <input
          type="text"
          className={cls}
          placeholder={field.placeholder || "Enter text..."}
          value={String(value ?? "")}
          onChange={handle}
        />
      )

    case "email":
      return (
        <input
          type="email"
          className={cls}
          placeholder={field.placeholder || "Enter email..."}
          value={String(value ?? "")}
          onChange={handle}
        />
      )

    case "phone":
      return (
        <input
          type="tel"
          className={cls}
          placeholder={field.placeholder || "Enter phone..."}
          value={String(value ?? "")}
          onChange={handle}
        />
      )

    case "number":
      return (
        <input
          type="number"
          className={cls}
          placeholder={field.placeholder || "Enter number..."}
          value={String(value ?? "")}
          min={field.min}
          max={field.max}
          onChange={handle}
        />
      )

    case "long_text":
      return (
        <textarea
          className={`${cls} resize-none`}
          placeholder={field.placeholder || "Enter text..."}
          value={String(value ?? "")}
          rows={field.rows || 4}
          onChange={handle}
        />
      )

    case "date":
      return (
        <input
          type="date"
          className={cls}
          value={String(value ?? "")}
          onChange={handle}
        />
      )

    case "time":
      return (
        <input
          type="time"
          className={cls}
          value={String(value ?? "")}
          onChange={handle}
        />
      )

    case "rating": {
      const max = field.max || 5
      const current = Number(value ?? 0)
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star === current ? 0 : star)}
              className={`p-1 rounded-lg transition-colors ${
                star <= current
                  ? "text-amber-400 hover:text-amber-500"
                  : "text-muted-foreground/30 hover:text-muted-foreground/50"
              }`}
            >
              <Star className="w-6 h-6" fill={star <= current ? "currentColor" : "none"} />
            </button>
          ))}
        </div>
      )
    }

    case "single_choice":
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = value === opt.id
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-input hover:border-foreground/30"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checked ? "border-blue-500" : "border-muted-foreground/40"
                  }`}
                >
                  {checked && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                </div>
                <span className="text-sm">{opt.label}</span>
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.id}
                  checked={checked}
                  onChange={() => onChange(opt.id)}
                  className="sr-only"
                />
              </label>
            )
          })}
        </div>
      )

    case "multiple_choice": {
      const selected: string[] = Array.isArray(value) ? value : []
      return (
        <div className="space-y-2">
          {(field.options ?? []).map((opt) => {
            const checked = selected.includes(opt.id)
            return (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  checked
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-input hover:border-foreground/30"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    checked ? "border-blue-500 bg-blue-500" : "border-muted-foreground/40"
                  }`}
                >
                  {checked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
                <span className="text-sm">{opt.label}</span>
                <input
                  type="checkbox"
                  value={opt.id}
                  checked={checked}
                  onChange={() => {
                    const next = checked
                      ? selected.filter((s) => s !== opt.id)
                      : [...selected, opt.id]
                    onChange(next)
                  }}
                  className="sr-only"
                />
              </label>
            )
          })}
        </div>
      )
    }

    case "dropdown":
      return (
        <select className={cls} value={String(value ?? "")} onChange={handle}>
          <option value="">{field.placeholder || "Select an option..."}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      )

    case "file_upload":
      return (
        <div className="border-2 border-dashed border-input rounded-xl p-6 text-center transition-colors hover:border-muted-foreground/40">
          <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">
            {value ? String(value) : "Click or drag to upload a file"}
          </div>
          <input
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onChange(file.name)
            }}
          />
        </div>
      )

    case "heading":
      return <h3 className="text-lg font-bold text-foreground">{field.label || "Heading"}</h3>

    case "paragraph":
      return <p className="text-sm text-muted-foreground leading-relaxed">{field.label || "Paragraph text"}</p>

    case "divider":
      return <hr className="border-t border-border/60 my-2" />

    case "page_break":
      return null

    default:
      return <div className="text-sm text-muted-foreground">Unsupported field type</div>
  }
}

// ── Field Icon Component ─────────────────────────────────────────────────

function FieldIcon({ type }: { type: FieldType }) {
  return <>{getFieldIcon(type)}</>
}

// ── Condition Row ────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  fields,
  onChange,
  onRemove,
}: {
  condition: Condition
  fields: FormField[]
  onChange: (c: Condition) => void
  onRemove: () => void
}) {
  const otherFields = fields.filter((f) => f.id !== condition.fieldId && f.type !== "heading" && f.type !== "paragraph" && f.type !== "divider" && f.type !== "page_break")
  return (
    <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex-1 space-y-2">
        <select
          className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          value={condition.fieldId}
          onChange={(e) => onChange({ ...condition, fieldId: e.target.value })}
        >
          <option value="">Select field...</option>
          {otherFields.map((f) => (
            <option key={f.id} value={f.id}>{f.label || FIELD_TYPE_LABELS[f.type]}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <select
            className="flex-1 bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={condition.operator}
            onChange={(e) => onChange({ ...condition, operator: e.target.value as Operator })}
          >
            <option value="equals">Equals</option>
            <option value="not_equals">Not equals</option>
            <option value="contains">Contains</option>
            <option value="greater_than">Greater than</option>
            <option value="less_than">Less than</option>
          </select>
          <input
            type="text"
            className="flex-1 bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Value..."
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          />
        </div>
        <select
          className="w-full bg-background border border-input rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          value={condition.action}
          onChange={(e) => onChange({ ...condition, action: e.target.value as "show" | "hide" })}
        >
          <option value="show">Show this field</option>
          <option value="hide">Hide this field</option>
        </select>
      </div>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive">
        <X className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

// ── Palette Field Item ────────────────────────────────────────────────────

function PaletteField({ type, onAdd }: { type: FieldType; onAdd: (type: FieldType) => void }) {

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/field-type", type)
        e.dataTransfer.effectAllowed = "copy"
      }}
      onClick={() => onAdd(type)}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-input bg-background hover:border-blue-500/50 hover:bg-blue-500/5 cursor-pointer transition-colors"
    >
      <span className="text-muted-foreground shrink-0">
        <FieldIcon type={type} />
      </span>
      <span className="text-sm font-medium">{FIELD_TYPE_LABELS[type]}</span>
    </div>
  )
}

// ── Settings Panel ───────────────────────────────────────────────────────

function FieldSettingsPanel({
  field,
  allFields,
  onChange,
  onDelete,
}: {
  field: FormField
  allFields: FormField[]
  onChange: (f: FormField) => void
  onDelete: () => void
}) {
  const isLayout = ["heading", "paragraph", "divider", "page_break"].includes(field.type)
  const isChoice = ["single_choice", "multiple_choice", "dropdown"].includes(field.type)
  const isInput = ["short_text", "long_text", "email", "number", "phone", "date", "time"].includes(field.type)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground"><FieldIcon type={field.type} /></span>
          <span className="font-medium text-sm">{FIELD_TYPE_LABELS[field.type]}</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {!["divider", "page_break"].includes(field.type) && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Label</label>
          <input
            type="text"
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            placeholder="Field label..."
          />
        </div>
      )}

      {!["divider", "page_break", "heading", "paragraph"].includes(field.type) && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description</label>
          <textarea
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={field.description}
            onChange={(e) => onChange({ ...field, description: e.target.value })}
            placeholder="Field description..."
            rows={2}
          />
        </div>
      )}

      {isInput && field.type !== "long_text" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Placeholder</label>
          <input
            type="text"
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={field.placeholder}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
            placeholder="Placeholder text..."
          />
        </div>
      )}

      {isChoice && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Options</label>
          <div className="space-y-1.5">
            {field.options.map((opt, i) => (
              <div key={opt.id} className="flex items-center gap-1.5">
                <input
                  type="text"
                  className="flex-1 bg-background border border-input rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={opt.label}
                  onChange={(e) => {
                    const newOptions = [...field.options]
                    newOptions[i] = { ...opt, label: e.target.value }
                    onChange({ ...field, options: newOptions })
                  }}
                  placeholder="Option label..."
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    const newOptions = field.options.filter((_, j) => j !== i)
                    onChange({ ...field, options: newOptions })
                  }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                const newOptions = [...field.options, { id: uid(), label: `Option ${field.options.length + 1}` }]
                onChange({ ...field, options: newOptions })
              }}
              className="w-full"
            >
              <Plus className="w-3.5 h-3.5" /> Add Option
            </Button>
            </div>
          </div>
        )}

      {field.type === "rating" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Max Stars</label>
          <input
            type="number"
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={field.max}
            min={1}
            max={10}
            onChange={(e) => onChange({ ...field, max: Math.max(1, Math.min(10, Number(e.target.value))) })}
          />
        </div>
      )}

      {field.type === "long_text" && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rows</label>
          <input
            type="number"
            className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={field.rows}
            min={1}
            max={20}
            onChange={(e) => onChange({ ...field, rows: Math.max(1, Math.min(20, Number(e.target.value))) })}
          />
        </div>
      )}

      {!isLayout && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`required-${field.id}`}
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="rounded border-input accent-blue-500 h-4 w-4 cursor-pointer"
          />
          <label htmlFor={`required-${field.id}`} className="text-sm cursor-pointer">Required</label>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-muted-foreground">Conditional Logic</label>
          {field.conditions.length > 0 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onChange({ ...field, conditions: [] })}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {field.conditions.map((cond, i) => (
            <ConditionRow
              key={i}
              condition={cond}
              fields={allFields}
              onChange={(c) => {
                const newConditions = [...field.conditions]
                newConditions[i] = c
                onChange({ ...field, conditions: newConditions })
              }}
              onRemove={() => {
                const newConditions = field.conditions.filter((_, j) => j !== i)
                onChange({ ...field, conditions: newConditions })
              }}
            />
          ))}
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              const newConditions = [...field.conditions, { fieldId: "", operator: "equals" as Operator, value: "", action: "show" as const }]
              onChange({ ...field, conditions: newConditions })
            }}
            className="w-full"
          >
            <Plus className="w-3.5 h-3.5" /> Add Condition
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────

export function FormBuilderContent() {
  const [forms, setForms] = useState<Form[]>([])
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [view, setView] = useState<View>("edit")
  const [currentFormId, setCurrentFormId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [showFormList, setShowFormList] = useState(true)
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null)
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({})
  const [previewErrors, setPreviewErrors] = useState<Record<string, string>>({})
  const [previewStep, setPreviewStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  // Load from localStorage
  useEffect(() => {
    setForms(loadForms())
    setResponses(loadResponses())
  }, [])

  // Persist forms
  useEffect(() => {
    if (forms.length > 0) saveForms(forms)
  }, [forms])

  // Persist responses
  useEffect(() => {
    if (responses.length > 0) saveResponses(responses)
  }, [responses])

  const currentForm = forms.find((f) => f.id === currentFormId) ?? null

  // ── Form list actions ────────────────────────────────────────────────

  function handleNewForm() {
    const form = defaultForm()
    setForms((prev) => [form, ...prev])
    setCurrentFormId(form.id)
    setShowFormList(false)
    setSelectedFieldId(null)
    setView("edit")
  }

  function handleSelectForm(id: string) {
    setCurrentFormId(id)
    setShowFormList(false)
    setSelectedFieldId(null)
    setView("edit")
  }

  function handleDeleteForm(id: string) {
    setForms((prev) => prev.filter((f) => f.id !== id))
    if (currentFormId === id) {
      setCurrentFormId(null)
      setShowFormList(true)
    }
    toast.success("Form deleted")
  }

  function handleDuplicateForm(id: string) {
    const form = forms.find((f) => f.id === id)
    if (!form) return
    const newForm: Form = {
      ...form,
      id: uid(),
      title: `${form.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0,
    }
    setForms((prev) => [newForm, ...prev])
    toast.success("Form duplicated")
  }

  // ── Form editor actions ──────────────────────────────────────────────

  function updateForm(updates: Partial<Form>) {
    if (!currentFormId) return
    setForms((prev) =>
      prev.map((f) =>
        f.id === currentFormId
          ? { ...f, ...updates, updatedAt: new Date().toISOString() }
          : f,
      ),
    )
  }

  function addField(type: FieldType) {
    if (!currentFormId) return
    const field = defaultField(type)
    updateForm({ fields: [...(currentForm?.fields ?? []), field] })
    setSelectedFieldId(field.id)

    const el = document.getElementById(`field-${field.id}`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  function removeField(id: string) {
    if (!currentForm) return
    updateForm({ fields: currentForm.fields.filter((f) => f.id !== id) })
    if (selectedFieldId === id) setSelectedFieldId(null)
  }

  function duplicateField(id: string) {
    if (!currentForm) return
    const field = currentForm.fields.find((f) => f.id === id)
    if (!field) return
    const newField: FormField = { ...field, id: uid(), label: `${field.label} (Copy)` }
    const idx = currentForm.fields.findIndex((f) => f.id === id)
    const newFields = [...currentForm.fields]
    newFields.splice(idx + 1, 0, newField)
    updateForm({ fields: newFields })
    setSelectedFieldId(newField.id)
  }

  function moveField(fromIndex: number, toIndex: number) {
    if (!currentForm) return
    const newFields = [...currentForm.fields]
    const [moved] = newFields.splice(fromIndex, 1)
    if (!moved) return
    newFields.splice(toIndex, 0, moved)
    updateForm({ fields: newFields })
  }

  function updateField(id: string, updates: Partial<FormField>) {
    if (!currentForm) return
    updateForm({
      fields: currentForm.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    })
  }

  // ── Drag & drop ──────────────────────────────────────────────────────

  function handleFieldDragStart(e: React.DragEvent, index: number) {
    e.dataTransfer.setData("application/reorder", String(index))
    e.dataTransfer.effectAllowed = "move"
  }

  function handleFieldDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = "move"
    setDragOverFieldId(String(index))
  }

  function handleFieldDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFieldId(null)
    const raw = e.dataTransfer.getData("application/reorder")
    const fromIndex = Number(raw)
    if (!isNaN(fromIndex) && fromIndex !== targetIndex) {
      moveField(fromIndex, targetIndex)
    }
  }

  function handlePaletteDragStart(e: React.DragEvent, type: FieldType) {
    e.dataTransfer.setData("application/field-type", type)
    e.dataTransfer.effectAllowed = "copy"
  }

  function handleCanvasDropZoneDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }

  function handleCanvasDropZoneDrop(e: React.DragEvent) {
    e.preventDefault()
    const type = e.dataTransfer.getData("application/field-type") as FieldType
    if (type && FIELD_TYPE_LABELS[type]) {
      addField(type)
    }
  }

  // ── Preview ──────────────────────────────────────────────────────────

  function getPageFields(): FormField[][] {
    if (!currentForm) return []
    const pages: FormField[][] = []
    let currentPage: FormField[] = []
    for (const field of currentForm.fields) {
      if (field.type === "page_break") {
        pages.push(currentPage)
        currentPage = []
      } else {
        currentPage.push(field)
      }
    }
    if (currentPage.length > 0) pages.push(currentPage)
    return pages
  }

  function isFieldVisible(field: FormField): boolean {
    if (field.conditions.length === 0) return true
    return field.conditions.every((cond) => {
      const sourceValue = previewValues[cond.fieldId]
      const sv = String(sourceValue ?? "")
      switch (cond.operator) {
        case "equals": return sv === cond.value
        case "not_equals": return sv !== cond.value
        case "contains": return sv.includes(cond.value)
        case "greater_than": return Number(sv) > Number(cond.value)
        case "less_than": return Number(sv) < Number(cond.value)
        default: return true
      }
    })
  }

  function validatePage(fields: FormField[]): boolean {
    const errors: Record<string, string> = {}
    for (const field of fields) {
      if (!isFieldVisible(field)) continue
      if (field.required) {
        const val = previewValues[field.id]
        if (val === undefined || val === null || val === "") {
          errors[field.id] = "This field is required"
        }
      }
    }
    setPreviewErrors(errors)
    return Object.keys(errors).length === 0
  }

  function handleSubmit() {
    if (!currentForm) return
    const allFields = getPageFields().flat()
    if (!validatePage(allFields)) return

    const response: FormResponse = {
      id: uid(),
      formId: currentForm.id,
      answers: { ...previewValues },
      submittedAt: new Date().toISOString(),
      timeSpent: 0,
    }
    setResponses((prev) => [response, ...prev])
    updateForm({ views: currentForm.views + 1 })
    setSubmitted(true)
    toast.success("Form submitted!")
  }

  function handlePreviewNext() {
    const pages = getPageFields()
    if (!validatePage(pages[previewStep] ?? [])) return
    setPreviewStep((s) => Math.min(s + 1, pages.length - 1))
  }

  function handlePreviewPrev() {
    setPreviewStep((s) => Math.max(s - 1, 0))
  }

  function resetPreview() {
    setPreviewValues({})
    setPreviewErrors({})
    setPreviewStep(0)
    setSubmitted(false)
  }

  // ── Responses ────────────────────────────────────────────────────────

  function exportCSV() {
    if (!currentForm) return
    const formResponses = responses.filter((r) => r.formId === currentForm.id)
    if (formResponses.length === 0) {
      toast.error("No responses to export")
      return
    }
    const fields = currentForm.fields.filter(
      (f) => !["heading", "paragraph", "divider", "page_break"].includes(f.type),
    )
    const header = fields.map((f) => f.label || FIELD_TYPE_LABELS[f.type]).join(",")
    const rows = formResponses.map((r) =>
      fields.map((f) => `"${String(r.answers[f.id] ?? "").replace(/"/g, '""')}"`).join(","),
    )
    const csv = [header, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${currentForm.title.replace(/\s+/g, "-").toLowerCase()}-responses.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("CSV exported")
  }

  // ── Share ────────────────────────────────────────────────────────────

  const shareUrl = currentForm
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/form/${currentForm.id}`
    : ""
  const embedCode = currentForm
    ? `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0"></iframe>`
    : ""

  // ── Derived data ─────────────────────────────────────────────────────

  const formResponses = currentForm
    ? responses.filter((r) => r.formId === currentForm.id)
    : []
  const completionRate = currentForm && currentForm.views > 0
    ? Math.round((formResponses.length / currentForm.views) * 100)
    : 0

  const selectedField = currentForm && selectedFieldId
    ? currentForm.fields.find((f) => f.id === selectedFieldId) ?? null
    : null

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <>
      <ToolHeader
        title="Form Builder"
        icon={FilePlus}
        color="text-purple-500"
        badge="Forms"
        actions={
          !showFormList && currentForm ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowFormList(true)}
                className="text-muted-foreground"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                variant={view === "edit" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("edit")}
              >
                <Settings className="w-4 h-4" /> Edit
              </Button>
              <Button
                variant={view === "preview" ? "default" : "ghost"}
                size="sm"
                onClick={() => { resetPreview(); setView("preview") }}
              >
                <Eye className="w-4 h-4" /> Preview
              </Button>
              <Button
                variant={view === "responses" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("responses")}
              >
                <BarChart3 className="w-4 h-4" /> Responses
              </Button>
              <Button
                variant={view === "share" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("share")}
              >
                <Share2 className="w-4 h-4" /> Share
              </Button>
            </>
          ) : null
        }
      />

      <div className="px-6 py-8">
        {/* ── Form List ─────────────────────────────────────────────── */}
        {showFormList && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">My Forms</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {forms.length} form{forms.length !== 1 ? "s" : ""} created
                </p>
              </div>
              <Button size="sm" onClick={handleNewForm}>
                <Plus className="w-4 h-4" /> New Form
              </Button>
            </div>

            {forms.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <FilePlus className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No forms yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                  Create your first form to start collecting responses
                </p>
                <Button onClick={handleNewForm}>
                  <Plus className="w-4 h-4" /> Create Form
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {forms.map((form) => {
                  const fieldCount = form.fields.filter(
                    (f) => f.type !== "page_break",
                  ).length
                  const responseCount = responses.filter(
                    (r) => r.formId === form.id,
                  ).length
                  return (
                    <div
                      key={form.id}
                      onClick={() => handleSelectForm(form.id)}
                      className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-blue-500/30 cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-500">
                        <FilePlus className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{form.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {fieldCount} field{fieldCount !== 1 ? "s" : ""} · {responseCount} response{responseCount !== 1 ? "s" : ""} · {new Date(form.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => { e.stopPropagation(); handleDuplicateForm(form.id) }}
                          className="text-muted-foreground"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => { e.stopPropagation(); handleDeleteForm(form.id) }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Edit View ─────────────────────────────────────────────── */}
        {!showFormList && currentForm && view === "edit" && (
          <div className="flex gap-6 h-[calc(100vh-220px)] overflow-hidden">
            {/* Left: Field Palette */}
            <div className="w-60 shrink-0 overflow-y-auto">
              <div className="sticky top-0 space-y-4">
                {FIELD_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                      {group.label}
                    </div>
                    <div className="space-y-1.5">
                      {group.types.map((type) => (
                        <PaletteField key={type} type={type} onAdd={addField} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Center: Form Canvas */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="flex items-center gap-3 mb-4 shrink-0">
                <input
                  type="text"
                  className="flex-1 bg-transparent border-none text-xl font-bold focus:outline-none placeholder:text-muted-foreground/40"
                  value={currentForm.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  placeholder="Form Title"
                />
              </div>
              <textarea
                className="w-full bg-transparent border-none text-sm text-muted-foreground resize-none focus:outline-none placeholder:text-muted-foreground/40 mb-4 shrink-0"
                value={currentForm.description}
                onChange={(e) => updateForm({ description: e.target.value })}
                placeholder="Form description (optional)..."
                rows={2}
              />

              <div className="flex-1 overflow-y-auto pr-1">
                {currentForm.fields.length === 0 ? (
                  <div className="border-2 border-dashed border-border/60 rounded-xl p-12 text-center transition-colors hover:border-blue-500/30">
                    <FilePlus className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-base font-semibold mb-1">Add your first field</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                      Drag fields from the palette or click on any field type to add it to your form
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentForm.fields.map((field, index) => {
                      const isSelected = selectedFieldId === field.id
                      const isDragOver = dragOverFieldId === String(index)
                      const isFirst = index === 0
                      const isLast = index === currentForm.fields.length - 1
                      return (
                        <div
                          key={field.id}
                          id={`field-${field.id}`}
                          draggable
                          onDragStart={(e) => handleFieldDragStart(e, index)}
                          onDragOver={(e) => handleFieldDragOver(e, index)}
                          onDragLeave={() => setDragOverFieldId(null)}
                          onDrop={(e) => handleFieldDrop(e, index)}
                          onClick={() => setSelectedFieldId(field.id)}
                          className={`group relative flex items-start gap-4 p-5 rounded-xl border transition-all cursor-pointer ${
                            isDragOver
                              ? "border-blue-500 bg-blue-500/10 shadow-md"
                              : isSelected
                                ? "border-blue-500 bg-blue-500/5 shadow-sm"
                                : "border-border/60 bg-card hover:border-foreground/20 hover:bg-muted/30"
                          }`}
                        >
                          {/* Drag Handle */}
                          <div className="mt-0.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5" />
                          </div>

                          {/* Reorder Buttons */}
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); if (!isFirst) moveField(index, index - 1) }}
                              disabled={isFirst}
                              className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); if (!isLast) moveField(index, index + 1) }}
                              disabled={isLast}
                              className="p-0.5 rounded text-muted-foreground/30 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Field Content */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                <FieldIcon type={field.type} />
                              </span>
                              {field.type === "heading" || field.type === "paragraph" ? (
                                <input
                                  type="text"
                                  className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-0 p-0 placeholder:text-muted-foreground/40 flex-1"
                                  value={field.label}
                                  onChange={(e) => updateField(field.id, { label: e.target.value })}
                                  placeholder={field.type === "heading" ? "Heading text..." : "Paragraph text..."}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className="text-sm font-medium truncate">
                                  {field.label || FIELD_TYPE_LABELS[field.type]}
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 shrink-0">
                                {FIELD_TYPE_LABELS[field.type]}
                              </Badge>
                              <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); duplicateField(field.id) }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={(e) => { e.stopPropagation(); removeField(field.id) }}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            {field.description && (
                              <p className="text-xs text-muted-foreground leading-relaxed">{field.description}</p>
                            )}

                            {/* Ghost Preview */}
                            <div className="pointer-events-none opacity-60">
                              {renderField(field, field.type === "rating" ? 3 : undefined, () => {}, {})}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {/* Drop zone for palette drag */}
                    <div
                      onDragOver={handleCanvasDropZoneDragOver}
                      onDrop={handleCanvasDropZoneDrop}
                      className="border-2 border-dashed border-border/30 rounded-xl py-8 text-center transition-colors hover:border-blue-500/40 hover:bg-blue-500/5"
                    >
                      <p className="text-xs text-muted-foreground">
                        Drop a field here or use the palette above
                      </p>
                    </div>
                  </div>
                )}

                {currentForm.fields.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addField("short_text")}
                    className="w-full mt-3 border-dashed border-border/60 text-muted-foreground hover:text-foreground hover:border-blue-500/50"
                  >
                    <Plus className="w-4 h-4" /> Add Field
                  </Button>
                )}
              </div>
            </div>

            {/* Right: Field Settings */}
            <div className="w-80 shrink-0 overflow-y-auto">
              <div className="sticky top-0">
                {selectedField ? (
                  <div className="border border-border/60 rounded-xl p-5 bg-card">
                    <FieldSettingsPanel
                      field={selectedField}
                      allFields={currentForm.fields}
                      onChange={(f) => updateField(f.id, f)}
                      onDelete={() => removeField(selectedField.id)}
                    />
                  </div>
                ) : (
                  <div className="border border-dashed border-border/60 rounded-xl p-6 text-center">
                    <Palette className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Select a field to edit its settings
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Preview View ───────────────────────────────────────────── */}
        {!showFormList && currentForm && view === "preview" && (
          <div className="max-w-3xl mx-auto">
            {!submitted ? (
              <div className="space-y-6">
                {/* Progress Bar */}
                {currentForm.theme.showProgressBar && getPageFields().length > 1 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Step {previewStep + 1} of {getPageFields().length}</span>
                      <span>{Math.round(((previewStep + 1) / getPageFields().length) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${((previewStep + 1) / getPageFields().length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Form Header */}
                <div>
                  <h1 className="text-2xl font-bold">{currentForm.title}</h1>
                  {currentForm.description && (
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{currentForm.description}</p>
                  )}
                </div>

                {/* Fields */}
                <div className="space-y-5">
                  {(getPageFields()[previewStep] ?? []).map((field) => {
                    if (!isFieldVisible(field)) return null
                    return (
                      <div key={field.id}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-sm font-medium">
                            {field.label || FIELD_TYPE_LABELS[field.type]}
                          </span>
                          {field.required && <span className="text-destructive text-sm">*</span>}
                        </div>
                        {field.description && (
                          <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{field.description}</p>
                        )}
                        {renderField(field, previewValues[field.id], (val) => {
                          setPreviewValues((prev) => ({ ...prev, [field.id]: val }))
                          setPreviewErrors((prev) => {
                            const next = { ...prev }
                            delete next[field.id]
                            return next
                          })
                        }, previewErrors)}
                        {previewErrors[field.id] && (
                          <div className="flex items-center gap-1 mt-1.5 text-xs text-destructive">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {previewErrors[field.id]}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {previewStep > 0 && (
                      <Button variant="outline" size="sm" onClick={handlePreviewPrev}>
                        <ArrowLeft className="w-4 h-4" /> Previous
                      </Button>
                    )}
                  </div>
                  <div>
                    {previewStep < getPageFields().length - 1 ? (
                      <Button size="sm" onClick={handlePreviewNext}>
                        Next <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={handleSubmit}>
                        <Check className="w-4 h-4" /> Submit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Success State */
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-bold mb-1">Form Submitted!</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto leading-relaxed">
                  Your response has been recorded. Thank you!
                </p>
                <Button onClick={() => { resetPreview() }}>
                  <Undo2 className="w-4 h-4" /> Submit Another
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── Responses View ─────────────────────────────────────────── */}
        {!showFormList && currentForm && view === "responses" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Responses</h2>
                <p className="text-sm text-muted-foreground">
                  {formResponses.length} submission{formResponses.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-1">Total Views</div>
                <div className="text-2xl font-bold">{currentForm.views}</div>
              </div>
              <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-1">Submissions</div>
                <div className="text-2xl font-bold">{formResponses.length}</div>
              </div>
              <div className="border border-border/60 rounded-xl p-4 bg-muted/20">
                <div className="text-xs text-muted-foreground mb-1">Completion Rate</div>
                <div className="text-2xl font-bold">{completionRate}%</div>
              </div>
            </div>

            {/* Response List */}
            {formResponses.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-base font-semibold mb-1">No responses yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Share your form and wait for responses to appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {formResponses.map((r) => (
                  <ResponseCard key={r.id} response={r} form={currentForm} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Share View ─────────────────────────────────────────────── */}
        {!showFormList && currentForm && view === "share" && (
          <div className="max-w-5xl mx-auto">
            <div className="max-w-xl space-y-6">
            <div>
              <h2 className="text-lg font-bold">Share Form</h2>
              <p className="text-sm text-muted-foreground">Share your form with others to start collecting responses</p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Shareable URL</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 bg-background border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={shareUrl}
                  readOnly
                />
                <Button variant="outline" size="sm" onClick={() => copy(shareUrl)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Form ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="flex-1 bg-background border border-input rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono text-xs"
                  value={currentForm.id}
                  readOnly
                />
                <Button variant="outline" size="sm" onClick={() => copy(currentForm.id)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground">Embed Code</label>
              <div className="relative">
                <textarea
                  className="w-full bg-muted/30 border border-input rounded-xl px-4 py-3 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                  value={embedCode}
                  readOnly
                  rows={4}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(embedCode)}
                  className="absolute top-3 right-3"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Paste this code into any HTML page to embed your form as an iframe
              </p>
            </div>

            <div className="border border-border/60 rounded-xl p-5 bg-muted/20">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Quick Preview</span>
              </div>
              <div className="border-2 border-dashed border-border/40 rounded-lg p-8 text-center">
                <Eye className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Form will render here when embedded
                </p>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Response Card ─────────────────────────────────────────────────────────

function ResponseCard({ response, form }: { response: FormResponse; form: Form }) {
  const [expanded, setExpanded] = useState(false)

  const answerFields = form.fields.filter(
    (f) => !["heading", "paragraph", "divider", "page_break"].includes(f.type),
  )

  return (
    <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-500">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium">
              Submission #{response.id.slice(0, 6)}
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(response.submittedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {Object.keys(response.answers).length} fields
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 px-4 py-3 space-y-3">
          {answerFields.map((field) => (
            <div key={field.id}>
              <div className="text-xs font-medium text-muted-foreground mb-0.5">
                {field.label || FIELD_TYPE_LABELS[field.type]}
              </div>
              <div className="text-sm">
                {response.answers[field.id] != null ? String(response.answers[field.id]) : <span className="text-muted-foreground italic">(empty)</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
