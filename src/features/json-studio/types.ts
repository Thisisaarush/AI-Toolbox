export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonTab = "edit" | "tree" | "diff" | "schema" | "csv" | "search"

export interface JsonPathEntry {
  key: string
  type: "object" | "array" | "primitive"
}

export interface SearchResult {
  path: string
  key: string
  value: string
  type: string
}

export type DiffLineType = "unchanged" | "added" | "removed"

export interface DiffLine {
  type: DiffLineType
  text: string
  lineNumA: number | null
  lineNumB: number | null
}

export interface SchemaProperty {
  type: string
  description?: string
  properties?: Record<string, SchemaProperty>
  items?: SchemaProperty
  required?: string[]
}
