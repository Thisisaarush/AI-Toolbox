export type FieldType =
  | "short_text" | "long_text" | "email" | "number" | "phone"
  | "date" | "time" | "rating" | "single_choice" | "multiple_choice"
  | "dropdown" | "file_upload" | "heading" | "paragraph" | "divider"
  | "page_break"

export type View = "edit" | "preview" | "responses" | "share"

export type Operator = "equals" | "not_equals" | "contains" | "greater_than" | "less_than"

export interface FieldOption {
  id: string
  label: string
}

export interface Condition {
  fieldId: string
  operator: Operator
  value: string
  action: "show" | "hide"
}

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder: string
  description: string
  required: boolean
  options: FieldOption[]
  conditions: Condition[]
  min: number
  max: number
  rows: number
}

export interface FormTheme {
  primaryColor: string
  backgroundColor: string
  fontFamily: string
  borderRadius: string
  showProgressBar: boolean
}

export interface Form {
  id: string
  title: string
  description: string
  fields: FormField[]
  theme: FormTheme
  createdAt: string
  updatedAt: string
  views: number
}

export interface FormResponse {
  id: string
  formId: string
  answers: Record<string, unknown>
  submittedAt: string
  timeSpent: number
}

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  email: "Email",
  number: "Number",
  phone: "Phone",
  date: "Date",
  time: "Time",
  rating: "Rating",
  single_choice: "Single Choice",
  multiple_choice: "Multiple Choice",
  dropdown: "Dropdown",
  file_upload: "File Upload",
  heading: "Heading",
  paragraph: "Paragraph",
  divider: "Divider",
  page_break: "Page Break",
}

export const FIELD_ICONS: Record<FieldType, string> = {
  short_text: "Type",
  long_text: "AlignLeft",
  email: "Mail",
  number: "Hash",
  phone: "Phone",
  date: "Calendar",
  time: "Clock",
  rating: "Star",
  single_choice: "Circle",
  multiple_choice: "CheckSquare",
  dropdown: "ChevronDown",
  file_upload: "Upload",
  heading: "Heading",
  paragraph: "Text",
  divider: "Minus",
  page_break: "FilePlus",
}

export const DEFAULT_THEME: FormTheme = {
  primaryColor: "#3b82f6",
  backgroundColor: "#ffffff",
  fontFamily: "Inter, sans-serif",
  borderRadius: "8px",
  showProgressBar: true,
}

export const STORAGE_KEY = "toolbox-form-builder-v1"
export const RESPONSES_KEY = "toolbox-form-responses-v1"
