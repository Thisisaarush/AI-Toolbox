"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams } from "next/navigation"
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import type { Form, FormField } from "@/features/form-builder/types"

function evaluateCondition(field: FormField, answers: Record<string, unknown>): boolean {
  if (!field.conditions?.length) return true
  return field.conditions.every((c) => {
    const value = answers[c.fieldId]
    const match = String(value ?? "")
    switch (c.operator) {
      case "equals": return match === c.value
      case "not_equals": return match !== c.value
      case "contains": return match.toLowerCase().includes(c.value.toLowerCase())
      case "greater_than": return Number(match) > Number(c.value)
      case "less_than": return Number(match) < Number(c.value)
      default: return true
    }
  })
}

function getPageFields(fields: FormField[], page: number): FormField[] {
  const pages: FormField[][] = []
  let current: FormField[] = []
  for (const f of fields) {
    if (f.type === "page_break") { pages.push(current); current = [] }
    else current.push(f)
  }
  pages.push(current)
  return pages[page] ?? []
}

function isLayoutType(type: string) {
  return ["heading", "paragraph", "divider", "page_break"].includes(type)
}

function renderField(
  field: FormField,
  value: unknown,
  onChange: (val: unknown) => void,
  errors: Record<string, string>,
) {
  const error = errors[field.id]
  const errorClass = error ? "border-red-500 focus-visible:ring-red-500" : ""

  switch (field.type) {
    case "short_text":
    case "email":
    case "phone":
      return (
        <Input
          type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={errorClass}
        />
      )
    case "number":
      return (
        <Input
          type="number"
          placeholder={field.placeholder || "Enter number"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          className={errorClass}
        />
      )
    case "long_text":
      return (
        <Textarea
          placeholder={field.placeholder || "Enter your answer"}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={field.rows || 4}
          className={errorClass}
        />
      )
    case "date":
      return (
        <Input
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={errorClass}
        />
      )
    case "time":
      return (
        <Input
          type="time"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={errorClass}
        />
      )
    case "rating": {
      const max = field.max || 5
      return (
        <div className="flex gap-1.5">
          {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                Number(value) >= star
                  ? "bg-primary text-primary-foreground"
                  : "bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {star}
            </button>
          ))}
        </div>
      )
    }
    case "single_choice":
      return (
        <div className="space-y-2">
          {field.options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
              <input
                type="radio"
                name={field.id}
                checked={value === opt.label}
                onChange={() => onChange(opt.label)}
                className="text-primary"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      )
    case "multiple_choice": {
      const selected = (value as string[]) ?? []
      return (
        <div className="space-y-2">
          {field.options.map((opt) => {
            const isChecked = selected.includes(opt.label)
            return (
              <label key={opt.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selected.filter((s: string) => s !== opt.label)
                      : [...selected, opt.label]
                    onChange(next)
                  }}
                  className="rounded text-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            )
          })}
        </div>
      )
    }
    case "dropdown":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ${errorClass}`}
        >
          <option value="">Select...</option>
          {field.options.map((opt) => (
            <option key={opt.id} value={opt.label}>{opt.label}</option>
          ))}
        </select>
      )
    case "heading":
      return <h3 className="text-lg font-semibold">{field.label}</h3>
    case "paragraph":
      return <p className="text-sm text-muted-foreground">{field.label}</p>
    case "divider":
      return <hr className="border-gray-200 dark:border-gray-800" />
    default:
      return null
  }
}

export function PublicFormPage() {
  const params = useParams()
  const formId = params?.id as string

  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const startTime = useMemo(() => Date.now(), [])

  useEffect(() => {
    if (!formId) return
    fetch(`/api/form/${formId}`)
      .then((res) => {
        if (!res.ok) { setNotFound(true); return null }
        return res.json()
      })
      .then((data) => {
        if (data?.form) setForm(data.form as Form)
        else setNotFound(true)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [formId])

  const totalPages = useMemo(() => {
    if (!form) return 1
    return form.fields.filter((f) => f.type === "page_break").length + 1
  }, [form])

  const pageFields = useMemo(() => {
    if (!form) return []
    return getPageFields(form.fields, page).filter((f) => evaluateCondition(f, answers))
  }, [form, page, answers])

  function validatePage(): boolean {
    const newErrors: Record<string, string> = {}
    for (const field of pageFields) {
      if (field.required && field.type !== "heading" && field.type !== "paragraph" && field.type !== "divider") {
        const val = answers[field.id]
        if (val === undefined || val === null || val === "") {
          newErrors[field.id] = "This field is required"
        }
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleNext() {
    if (validatePage()) setPage(page + 1)
  }

  function handlePrev() { setPage(Math.max(0, page - 1)) }

  async function handleSubmit() {
    if (!validatePage()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/form/${formId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeSpent: Math.round((Date.now() - startTime) / 1000) }),
      })
      if (!res.ok) throw new Error("Submit failed")
      setSubmitted(true)
    } catch {
      toast.error("Failed to submit. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-lg font-semibold mb-2">Form Not Found</h2>
          <p className="text-sm text-muted-foreground">This form may have been unpublished or the link is incorrect.</p>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
          <h2 className="text-lg font-semibold mb-2">Form Submitted!</h2>
          <p className="text-sm text-muted-foreground mb-6">Your response has been recorded.</p>
          <Button onClick={() => window.location.reload()}>Submit Another</Button>
        </Card>
      </div>
    )
  }

  const theme = form.theme ?? {}
  const primaryColor = theme.primaryColor ?? "#3b82f6"
  const bgColor = theme.backgroundColor ?? "#ffffff"

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-8 px-4" style={{ backgroundColor: bgColor }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-xl font-semibold mb-1" style={{ color: primaryColor }}>{form.title}</h1>
          {form.description && <p className="text-sm text-muted-foreground">{form.description}</p>}

          {totalPages > 1 && (
            <div className="mt-4 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${((page + 1) / totalPages) * 100}%`, backgroundColor: primaryColor }}
              />
            </div>
          )}
        </Card>

        <Card className="p-6 space-y-6">
          {pageFields.map((field) => (
            <div key={field.id}>
              {!isLayoutType(field.type) && (
                <label className="block text-sm font-medium mb-1.5">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
              )}
              {field.description && (
                <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
              )}
              {renderField(
                field,
                answers[field.id] ?? "",
                (val) => {
                  setAnswers((a) => ({ ...a, [field.id]: val }))
                  setErrors((e) => { const { [field.id]: _, ...rest } = e; return rest })
                },
                errors,
              )}
              {errors[field.id] && (
                <p className="text-xs text-red-500 mt-1">{errors[field.id]}</p>
              )}
            </div>
          ))}
        </Card>

        <div className="flex items-center justify-between">
          <div>
            {page > 0 && (
              <Button variant="outline" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-1.5" /> Back
              </Button>
            )}
          </div>
          {page < totalPages - 1 ? (
            <Button onClick={handleNext}>
              Next <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
              Submit
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
