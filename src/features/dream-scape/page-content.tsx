"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@clerk/nextjs"
import { Moon, Mic, MicOff, Loader2, ImageIcon, History } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { ToolHeader } from "@/components/shared/tool-header"
import type { DreamAnalysisResult, DreamHistoryItem } from "./types"

export function DreamScapeContent() {
  const { isSignedIn } = useUser()
  const [content, setContent] = useState("")
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DreamAnalysisResult | null>(null)
  const [history, setHistory] = useState<DreamHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const startRecording = useCallback(() => {
    chunks.current = []
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.current.push(e.data)
        recorder.onstop = () => {
          const blob = new Blob(chunks.current, { type: "audio/webm" })
          const reader = new FileReader()
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              const parts = reader.result.split(",")
              const base64 = parts[1]
              if (base64) transcribeAudio(base64)
            }
          }
          reader.readAsDataURL(blob)
          stream.getTracks().forEach((t) => t.stop())
        }
        recorder.start()
        mediaRecorder.current = recorder
        setRecording(true)
      })
      .catch(() => {
        toast.error("Microphone access denied")
      })
  }, [])

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop()
    setRecording(false)
  }, [])

  async function transcribeAudio(audioBase64: string) {
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64 }),
      })
      const json = await res.json()
      if (res.ok && json.text) {
        setContent(json.text)
      }
    } catch {
      toast.error("Failed to transcribe audio")
    }
  }

  async function handleAnalyze() {
    if (!content.trim()) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch("/api/dream-scape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to analyze")
      setResult(json as DreamAnalysisResult)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to analyze dream")
    } finally {
      setLoading(false)
    }
  }

  async function loadHistory() {
    setShowHistory(!showHistory)
    if (history.length === 0) {
      try {
        const res = await fetch("/api/dream-scape")
        const json = await res.json()
        if (res.ok && json.dreams) {
          setHistory(json.dreams as DreamHistoryItem[])
        }
      } catch {
        toast.error("Failed to load history")
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader
        title="DreamScape"
        icon={Moon}
        color="text-purple-500"
        badge="Creative"
        actions={
          <Button variant="ghost" size="sm" onClick={loadHistory}>
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
        }
      />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">DreamScape</h1>
          <p className="text-muted-foreground">
            Record your dream as a voice note or write it down. AI analyzes symbols and themes, then generates a visual dreamscape.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Describe Your Dream</CardTitle>
            <CardDescription>Use voice recording or type it out</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="I was flying over a city made of crystal, and the sky was purple..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
            <div className="flex gap-2">
              <Button
                variant={recording ? "destructive" : "outline"}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? (
                  <><MicOff className="w-4 h-4 mr-2" /> Stop Recording</>
                ) : (
                  <><Mic className="w-4 h-4 mr-2" /> Record Dream</>
                )}
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={loading || !content.trim() || !isSignedIn}
                className="flex-1"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                ) : (
                  <><Moon className="w-4 h-4 mr-2" /> Analyze Dream</>
                )}
              </Button>
            </div>
            {!isSignedIn && (
              <p className="text-sm text-muted-foreground text-center">Sign in to analyze dreams</p>
            )}
          </CardContent>
        </Card>

        {loading && (
          <Card className="mt-6">
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Dream Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                  {result.analysis}
                </div>
              </CardContent>
            </Card>

            {result.imageUrl && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Dreamscape Visualization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.imageUrl}
                      alt="Dream visualization"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {showHistory && history.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold">Past Dreams</h2>
            {history.map((dream) => (
              <Card key={dream.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {new Date(dream.createdAt).toLocaleDateString()}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{dream.content}</p>
                  {dream.imageUrl && (
                    <div className="mt-2 w-32 h-32 rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={dream.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
