"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Terminal, Copy, Check, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"

type ParsedCurl = {
  method: string
  url: string
  headers: [string, string][]
  body: string | null
}

function parseCurl(input: string): ParsedCurl | null {
  input = input.trim()
  if (!input.startsWith("curl")) return null

  let method = "GET"
  let url = ""
  const headers: [string, string][] = []
  let body: string | null = null

  const tokens = tokenize(input)

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === "-X" || token === "--request") {
      method = tokens[++i]?.toUpperCase() ?? "GET"
    } else if (token === "-H" || token === "--header") {
      const header = tokens[++i]
      if (header) {
        const colonIdx = header.indexOf(":")
        if (colonIdx > 0) {
          headers.push([header.slice(0, colonIdx).trim(), header.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "")])
        }
      }
    } else if (token === "-d" || token === "--data" || token === "--data-raw") {
      body = tokens[++i] ?? null
    } else if (token?.startsWith("http") || token?.startsWith("https")) {
      url = token
    }
  }

  if (!url) return null
  if (!method && body) method = "POST"

  return { method, url, headers, body }
}

function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ""
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
    if (ch === " " && !inSingle && !inDouble) {
      if (current) { tokens.push(current); current = "" }
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

function generateFetch(parsed: ParsedCurl): string {
  const lines: string[] = []
  lines.push(`const response = await fetch("${parsed.url}", {`)

  if (parsed.method !== "GET") {
    lines.push(`  method: "${parsed.method}",`)
  }

  if (parsed.headers.length > 0) {
    lines.push(`  headers: {`)
    for (const [key, val] of parsed.headers) {
      lines.push(`    "${key}": "${val}",`)
    }
    lines.push(`  },`)
  }

  if (parsed.body) {
    lines.push(`  body: JSON.stringify(${tryParseBody(parsed.body)}),`)
  }

  lines.push("})")
  lines.push("")
  lines.push("const data = await response.json()")

  return lines.join("\n")
}

function tryParseBody(body: string): string {
  try {
    const parsed = JSON.parse(body)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return `"${body}"`
  }
}

const examples = [
  { name: "GET", curl: "curl https://api.example.com/users" },
  {
    name: "POST JSON",
    curl: `curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"name":"John","email":"john@example.com"}'`,
  },
  {
    name: "DELETE",
    curl: `curl -X DELETE https://api.example.com/users/123 \\
  -H "Authorization: Bearer token123"`,
  },
]

export function CurlToTypeContent() {
  const [input, setInput] = useState("")

  const parsed = useMemo(() => parseCurl(input), [input])
  const output = useMemo(() => parsed ? generateFetch(parsed) : "", [parsed])

  const [copied, setCopied] = useState(false)

  async function copyOutput() {
    if (!output) return
    await navigator.clipboard.writeText(output)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="Curl-to-Type" icon={Terminal} color="text-cyan-500" badge="Dev Tool" />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Curl-to-Type</h1>
          <p className="text-muted-foreground">Convert cURL commands to TypeScript fetch calls instantly.</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {examples.map(ex => (
            <Button key={ex.name} variant="outline" size="sm" onClick={() => setInput(ex.curl)}>
              {ex.name}
            </Button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">cURL Command</CardTitle>
              <CardDescription>Paste any cURL command</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={`curl -X POST https://api.example.com/users \\
  -H "Content-Type: application/json" \\
  -d '{"name":"John"}'`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={10}
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>TypeScript Fetch</span>
                {output && (
                  <Button variant="ghost" size="sm" onClick={copyOutput}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                )}
              </CardTitle>
              <CardDescription>
                {parsed ? (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{parsed.method}</Badge>
                    <ArrowRight className="w-3 h-3" />
                    <span className="font-mono text-xs truncate max-w-[300px]">{parsed.url}</span>
                  </span>
                ) : "Generated code"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {output ? (
                <pre className="p-4 bg-muted rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {output}
                </pre>
              ) : (
                <div className="py-16 text-center text-muted-foreground">
                  <Terminal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No output yet</p>
                  <p className="text-sm">Paste a cURL command to generate TypeScript.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
