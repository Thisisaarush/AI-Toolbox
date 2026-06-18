"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Code2, ArrowRight, Link as LinkIcon, Table } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"

type Field = {
  name: string
  type: string
  isRequired: boolean
  isList: boolean
  isId: boolean
  isUnique: boolean
  hasDefault: boolean
  relation?: { field: string; references: string; model: string }
}

type Model = {
  name: string
  fields: Field[]
}

const sampleSchema = `model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
}

model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}`

const relationColor = (field: string) => {
  const colors = [
    "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    "border-green-400 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    "border-purple-400 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    "border-orange-400 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    "border-pink-400 bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  ]
  let hash = 0
  for (let i = 0; i < field.length; i++) {
    hash = ((hash << 5) - hash) + field.charCodeAt(i)
  }
  return colors[Math.abs(hash) % colors.length]
}

function parsePrismaSchema(text: string): Model[] {
  const models: Model[] = []
  const modelRegex = /model\s+(\w+)\s*{([^}]*)}/g
  let match

  while ((match = modelRegex.exec(text)) !== null) {
    const name = match[1] ?? ""
    const body = match[2] ?? ""
    const fields: Field[] = []

    const lines = body.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("@@"))
    for (const line of lines) {
      const parts = line.split(/\s+/)
      if (parts.length < 2) continue

      const fieldName = parts[0] ?? ""
      let fieldType = parts[1] ?? ""
      if (fieldType.endsWith("?")) {
        fieldType = fieldType.slice(0, -1)
      }

      const isList = fieldType.endsWith("[]")
      const cleanType = isList ? fieldType.slice(0, -2) : fieldType

      const isId = line.includes("@id")
      const isUnique = line.includes("@unique")
      const hasDefault = line.includes("@default")
      const isRequired = !line.includes("?")

      let relation: Field["relation"]
      const relMatch = line.match(/@relation\(fields:\s*\[?(\w+)\]?,\s*references:\s*\[?(\w+)\]?\)/)
      if (relMatch) {
        relation = { field: relMatch[1] ?? "", references: relMatch[2] ?? "", model: cleanType }
      }

      fields.push({ name: fieldName, type: cleanType, isRequired, isList, isId, isUnique, hasDefault, relation })
    }

    models.push({ name, fields })
  }

  return models
}

export function SchemaVizContent() {
  const [schema, setSchema] = useState("")
  const [showSample, setShowSample] = useState(false)

  const models = useMemo(() => {
    if (!schema.trim()) return []
    try {
      return parsePrismaSchema(schema)
    } catch {
      return []
    }
  }, [schema])

  const relations = useMemo(() => {
    const rels: { from: string; to: string; field: string; type: "one-to-many" | "many-to-one" | "one-to-one" }[] = []
    for (const model of models) {
      for (const field of model.fields) {
        if (field.relation) {
          rels.push({
            from: model.name,
            to: field.relation.model,
            field: field.name,
            type: field.isList ? "one-to-many" : "many-to-one",
          })
        }
      }
    }
    return rels
  }, [models])

  function loadSample() {
    setSchema(sampleSchema)
    setShowSample(true)
    toast.success("Sample schema loaded")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="SchemaViz" icon={Code2} color="text-orange-500" badge="Dev Tool" />
      <main className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">SchemaViz</h1>
            <p className="text-muted-foreground">Paste your Prisma schema and visualize model relationships.</p>
          </div>
          <Button variant="outline" onClick={loadSample}>
            <Table className="w-4 h-4 mr-2" /> Load Sample
          </Button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prisma Schema</CardTitle>
                <CardDescription>Paste your schema.generated.prisma or schema.prisma</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={`model User {\n  id        String   @id @default(cuid())\n  email     String   @unique\n  name      String?\n  posts     Post[]\n  createdAt DateTime @default(now())\n}`}
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                />
              </CardContent>
            </Card>
          </div>

          <div>
            {models.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Code2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No models detected</p>
                  <p className="text-sm">Paste a Prisma schema to visualize it.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {models.map(model => (
                  <Card key={model.name}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-mono">{model.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {model.fields.map(field => (
                          <div
                            key={field.name}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
                              field.relation
                                ? relationColor(field.name)
                                : field.isId
                                ? "border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "hover:bg-muted/50"
                            }`}
                          >
                            <span className="font-mono font-medium">{field.name}</span>
                            <span className="text-muted-foreground font-mono text-xs">
                              {field.type}{field.isList ? "[]" : ""}{!field.isRequired ? "?" : ""}
                            </span>
                            <div className="ml-auto flex gap-1">
                              {field.isId && <Badge variant="outline" className="text-[10px] h-4 px-1">PK</Badge>}
                              {field.isUnique && <Badge variant="outline" className="text-[10px] h-4 px-1">UQ</Badge>}
                              {field.hasDefault && <Badge variant="outline" className="text-[10px] h-4 px-1">DEF</Badge>}
                              {field.relation && <Badge variant="outline" className="text-[10px] h-4 px-1">FK</Badge>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {relations.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LinkIcon className="w-4 h-4" /> Relationships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {relations.map((rel, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm">
                    <span className="font-mono font-medium">{rel.from}</span>
                    <span className="text-xs text-muted-foreground">.{rel.field}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono font-medium">{rel.to}</span>
                    <Badge variant="secondary" className="text-[10px]">{rel.type}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
