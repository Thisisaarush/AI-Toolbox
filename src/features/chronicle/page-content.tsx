"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { BookOpen, Plus, Loader2, Sparkles, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import type { JournalEntry } from "./types"

function ChronicleContent() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [newContent, setNewContent] = useState("")
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0] ?? "")
  const [loading, setLoading] = useState(false)
  const [narrative, setNarrative] = useState<string | null>(null)
  const [showNarrative, setShowNarrative] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("chronicle_entries")
    if (stored) {
      try { setEntries(JSON.parse(stored)); return } catch {}
    }
  }, [])

  useEffect(() => {
    if (entries.length > 0) {
      localStorage.setItem("chronicle_entries", JSON.stringify(entries))
    }
  }, [entries])

  function addEntry() {
    if (!newContent.trim()) return
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      date: newDate,
      content: newContent.trim(),
      createdAt: new Date().toISOString(),
    }
    setEntries(prev => [entry, ...prev])
    setNewContent("")
    toast.success("Entry saved")
  }

  function deleteEntry(id: string) {
    setEntries(prev => prev.filter(e => e.id !== id))
    toast.success("Entry deleted")
  }

  async function generateNarrative() {
    if (entries.length === 0) {
      toast.error("Write at least one entry first")
      return
    }
    setLoading(true)
    setNarrative(null)
    setShowNarrative(true)

    try {
      const res = await fetch("/api/chronicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: entries.map(e => ({ date: e.date, content: e.content })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to generate")
      setNarrative(json.narrative)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate narrative")
      setShowNarrative(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="Chronicle" icon={BookOpen} color="text-indigo-500" badge="Creative" />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Chronicle</h1>
          <p className="text-muted-foreground">
            Write journal entries and let AI weave your story. Your personal historian.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New Entry</CardTitle>
                <CardDescription>Record a memory, thought, or reflection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Textarea
                  placeholder="Today I..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={5}
                />
                <Button onClick={addEntry} disabled={!newContent.trim()}>
                  <Plus className="w-4 h-4 mr-2" /> Add Entry
                </Button>
              </CardContent>
            </Card>

            <Button onClick={generateNarrative} disabled={loading || entries.length === 0} className="w-full">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Weaving your story...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Narrative</>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Entries ({entries.length})</h2>
            </div>

            {showNarrative && (
              <Card className="border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    Your Story
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded animate-pulse w-full" />
                      <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                      <div className="h-4 bg-muted rounded animate-pulse w-5/6" />
                    </div>
                  ) : narrative ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{narrative}</p>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No entries yet. Write your first one.</p>
            ) : (
              entries.map(entry => (
                <Card key={entry.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium">{entry.date}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteEntry(entry.id)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.content}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ChroniclePage() {
  return (
    <ErrorBoundary>
      <ChronicleContent />
    </ErrorBoundary>
  )
}
