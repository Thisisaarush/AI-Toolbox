"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@clerk/nextjs"
import { Moon, Mic, MicOff, Loader2, ImageIcon, History } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export default function DreamScapePage() {
  const { isSignedIn } = useUser()
  const [content, setContent] = useState("")
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ analysis: string; imageUrl: string | null } | null>(null)
  const [history, setHistory] = useState<{ id: string; content: string; imageUrl: string | null; createdAt: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  function startRecording() {
    chunks.current = []
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => chunks.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" })
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1]
          transcribeAudio(base64)
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorder.current = recorder
      setRecording(true)
    }).catch(() => {
      toast.error("Microphone access denied")
    })
  }

  function stopRecording() {
    mediaRecorder.current?.stop()
    setRecording(false)
  }

  async function transcribeAudio(audioBase64: string) {
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: audioBase64 }),
      })
      const data = await res.json()
      if (data.text) setContent(data.text)
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data)
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
        const data = await res.json()
        setHistory(data.dreams ?? [])
      } catch {
        toast.error("Failed to load history")
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Moon className="w-5 h-5 text-purple-500" />
          <span className="font-semibold">DreamScape</span>
          <Badge variant="secondary">Creative</Badge>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={loadHistory}>
            <History className="w-4 h-4 mr-2" />
            History
          </Button>
        </div>
      </header>

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
                    <img src={dream.imageUrl} alt="" className="mt-2 rounded-lg w-32 h-32 object-cover" />
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
