"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@clerk/nextjs"
import { GitPullRequest, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import type { PrDescriptionResult } from "./types"

export function PrEloquenceContent() {
  const { isSignedIn } = useUser()
  const [diff, setDiff] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PrDescriptionResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!diff.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/pr-eloquence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to generate")
      setResult(json as PrDescriptionResult)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate PR description")
    } finally {
      setLoading(false)
    }
  }

  async function copyDescription() {
    if (!result) return
    const text = `## ${result.title}\n\n${result.description}`
    await navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="PR-Eloquence" icon={GitPullRequest} color="text-indigo-500" badge="Dev Tool" />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">PR-Eloquence</h1>
          <p className="text-muted-foreground">
            Paste your diff and get a well-written PR description. Title, summary, changes, and testing notes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Git Diff</CardTitle>
            <CardDescription>Paste the output of <code className="text-sm bg-muted px-1 rounded">git diff main...HEAD</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={`diff --git a/src/app/page.tsx b/src/app/page.tsx\nindex abc123..def456 100644\n--- a/src/app/page.tsx\n+++ b/src/app/page.tsx\n@@ -10,6 +10,8 @@\n+console.log("hello")`}
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <Button
              onClick={handleGenerate}
              disabled={loading || !diff.trim() || !isSignedIn}
              className="w-full"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><GitPullRequest className="w-4 h-4 mr-2" /> Generate PR Description</>
              )}
            </Button>
            {!isSignedIn && (
              <p className="text-sm text-muted-foreground text-center">Sign in to generate PR descriptions</p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="truncate mr-2">{result.title}</span>
                <Button variant="ghost" size="sm" onClick={copyDescription}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap font-sans">
                {result.description}
              </pre>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
