"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useUser } from "@clerk/nextjs"
import { Music, Loader2, Download, Share2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import type { VibeCheckResult } from "./types"

export function VibeCheckContent() {
  const { isSignedIn } = useUser()
  const [description, setDescription] = useState("")
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)

  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setPosterUrl(null)

    try {
      const res = await fetch("/api/vibe-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, playlistUrl }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to generate")
      setPosterUrl((json as VibeCheckResult).posterUrl)
      if (json.warning) {
        toast.info(json.warning)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate poster")
    } finally {
      setLoading(false)
    }
  }

  async function downloadPoster() {
    if (!posterUrl) return
    const a = document.createElement("a")
    a.href = posterUrl
    a.download = "vibe-poster.png"
    a.click()
  }

  async function sharePoster() {
    if (!posterUrl) return
    await navigator.clipboard.writeText(posterUrl)
    toast.success("Poster URL copied to clipboard")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="VibeCheck" icon={Music} color="text-pink-500" badge="Creative" />

      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">VibeCheck</h1>
          <p className="text-muted-foreground">
            Describe your aesthetic — mood, colors, music taste — and get a custom AI-generated poster.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Vibe</CardTitle>
              <CardDescription>What&apos;s the energy you want to capture?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Late night drives through the city, lo-fi hip hop, neon lights reflecting on wet pavement, a bit melancholic but peaceful..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
              />
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Spotify playlist URL (optional)</label>
                <Input
                  placeholder="https://open.spotify.com/playlist/..."
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading || !description.trim() || !isSignedIn}
                className="w-full"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate Poster</>
                )}
              </Button>
              {!isSignedIn && (
                <p className="text-sm text-muted-foreground text-center">Sign in to generate posters</p>
              )}
            </CardContent>
          </Card>

          <div>
            {loading && (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            )}
            {posterUrl && (
              <Card>
                <CardContent className="p-4">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={posterUrl}
                      alt="Vibe poster"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={downloadPoster}>
                      <Download className="w-4 h-4 mr-2" /> Download
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={sharePoster}>
                      <Share2 className="w-4 h-4 mr-2" /> Share
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
