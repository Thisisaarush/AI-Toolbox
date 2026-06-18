"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@clerk/nextjs"
import { GitCommit, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import type { CommitMessageResult } from "./types"

export function CommitCraftContent() {
  const { isSignedIn } = useUser()
  const [diff, setDiff] = useState("")
  const [result, setResult] = useState<CommitMessageResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    if (!diff.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/commit-craft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diff }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to generate")
      setResult(json as CommitMessageResult)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate commit message")
    } finally {
      setLoading(false)
    }
  }

  async function copyToClipboard() {
    if (!result) return
    await navigator.clipboard.writeText(result.message)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="CommitCraft" icon={GitCommit} color="text-blue-500" badge="Dev Tool" />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">CommitCraft</h1>
          <p className="text-muted-foreground">
            Paste your git diff and get a conventional commit message. Works best for staged or unstaged changes.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Git Diff</CardTitle>
            <CardDescription>
              Paste the output of <code className="text-sm bg-muted px-1 rounded">git diff</code> or your staged changes
            </CardDescription>
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
                <><GitCommit className="w-4 h-4 mr-2" /> Generate Commit Message</>
              )}
            </Button>
            {!isSignedIn && (
              <p className="text-sm text-muted-foreground text-center">Sign in to generate commit messages</p>
            )}
          </CardContent>
        </Card>

        {result && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Generated Message</span>
                <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg text-sm font-mono overflow-x-auto">
                {result.message}
              </pre>
              <div className="flex gap-2 mt-4">
                <Badge>{result.type}</Badge>
                {result.scope && <Badge variant="outline">{result.scope}</Badge>}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
