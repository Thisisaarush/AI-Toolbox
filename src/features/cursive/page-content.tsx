"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ImageIcon, Download } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import { ErrorBoundary } from "@/components/shared/error-boundary"

function CursiveContent() {
  const [text, setText] = useState("Hello, this is my handwriting!")
  const [fontSize, setFontSize] = useState(36)
  const [color, setColor] = useState("#1a1a1a")
  const [bgColor, setBgColor] = useState("#fef9ef")
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&display=swap"
    link.rel = "stylesheet"
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  useEffect(() => {
    renderCanvas()
  }, [text, fontSize, color, bgColor])

  function renderCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const padding = 60
    const lineHeight = fontSize * 1.6
    const maxWidth = canvas.width - padding * 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.font = `${fontSize}px "Caveat", cursive`
    ctx.fillStyle = color
    ctx.textBaseline = "top"

    const words = text.split(" ")
    let line = ""
    let y = padding

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word
      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, padding, y)
        line = word
        y += lineHeight
      } else {
        line = testLine
      }
    }
    if (line) {
      ctx.fillText(line, padding, y)
    }

    const height = Math.max(y + lineHeight + padding, 400)
    if (canvas.height !== height) {
      canvas.height = height
      renderCanvas()
    }
  }

  function download() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement("a")
    link.download = "handwriting.png"
    link.href = canvas.toDataURL()
    link.click()
    toast.success("Downloaded")
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="Cursive" icon={ImageIcon} color="text-amber-500" badge="Creative" />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Cursive</h1>
          <p className="text-muted-foreground">Type text and render it in a handwriting-style font. Download as PNG.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your Text</CardTitle>
                <CardDescription>Write or paste what you want in handwriting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Type something..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Style</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1 block">Font Size: {fontSize}px</label>
                  <Input
                    type="range"
                    min={18}
                    max={72}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-1 block">Ink Color</label>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm text-muted-foreground mb-1 block">Paper Color</label>
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-10 rounded cursor-pointer" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button onClick={download} className="w-full">
              <Download className="w-4 h-4 mr-2" /> Download as PNG
            </Button>
          </div>

          <div>
            <Card>
              <CardContent className="p-4">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={400}
                  className="w-full rounded-lg border shadow-sm"
                  style={{ minHeight: 300 }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CursivePage() {
  return (
    <ErrorBoundary>
      <CursiveContent />
    </ErrorBoundary>
  )
}
