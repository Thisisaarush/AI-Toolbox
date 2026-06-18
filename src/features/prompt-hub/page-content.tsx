"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Puzzle, Plus, Search, Copy, Check, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"

type Prompt = {
  id: string
  name: string
  content: string
  category: string
  tags: string[]
  createdAt: string
}

const CATEGORIES = ["Writing", "Coding", "Creative", "Business", "Productivity"] as const

const defaultPrompts: Prompt[] = [
  {
    id: "default-1",
    name: "Blog Post Outline",
    content: "Write a blog post outline about [topic]. Include an introduction, 3 main sections with subpoints, and a conclusion. Target audience: [audience]. Tone: [professional/casual].",
    category: "Writing",
    tags: ["blog", "outline"],
    createdAt: new Date().toISOString(),
  },
  {
    id: "default-2",
    name: "React Component Generator",
    content: "Generate a React component for [purpose]. Use TypeScript, include proper types for props, handle loading and error states, and follow best practices for accessibility.",
    category: "Coding",
    tags: ["react", "typescript", "component"],
    createdAt: new Date().toISOString(),
  },
]

export function PromptHubContent() {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState<string>("All")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [newPrompt, setNewPrompt] = useState({ name: "", content: "", category: "Coding", tags: "", open: false })

  useEffect(() => {
    const stored = localStorage.getItem("prompthub_prompts")
    if (stored) {
      try { setPrompts(JSON.parse(stored)); return } catch {}
    }
    setPrompts(defaultPrompts)
  }, [])

  useEffect(() => {
    if (prompts.length > 0) {
      localStorage.setItem("prompthub_prompts", JSON.stringify(prompts))
    }
  }, [prompts])

  function addPrompt() {
    if (!newPrompt.name.trim() || !newPrompt.content.trim()) {
      toast.error("Name and content are required")
      return
    }
    const prompt: Prompt = {
      id: crypto.randomUUID(),
      name: newPrompt.name.trim(),
      content: newPrompt.content.trim(),
      category: newPrompt.category,
      tags: newPrompt.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    }
    setPrompts(prev => [prompt, ...prev])
    setNewPrompt({ name: "", content: "", category: "Coding", tags: "", open: false })
    toast.success("Prompt saved")
  }

  function deletePrompt(id: string) {
    setPrompts(prev => prev.filter(p => p.id !== id))
    toast.success("Prompt deleted")
  }

  async function copyPrompt(id: string, content: string) {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filtered = prompts.filter(p => {
    const matchesSearch = search === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.content.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = filterCategory === "All" || p.category === filterCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="PromptHub" icon={Puzzle} color="text-green-500" badge="Dev Tool" />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">PromptHub</h1>
            <p className="text-muted-foreground">Save, organize, and copy your AI prompts.</p>
          </div>
          <Dialog open={newPrompt.open} onOpenChange={(open) => setNewPrompt(prev => ({ ...prev, open }))}>
            <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" /> New Prompt</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Prompt</DialogTitle>
                <DialogDescription>Save a prompt template for reuse.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    placeholder="e.g. Blog Post Generator"
                    value={newPrompt.name}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={newPrompt.category}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
                  <Input
                    placeholder="e.g. react, typescript, component"
                    value={newPrompt.tags}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, tags: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Prompt Content</label>
                  <Textarea
                    placeholder="Write your prompt template here..."
                    rows={6}
                    value={newPrompt.content}
                    onChange={(e) => setNewPrompt(prev => ({ ...prev, content: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewPrompt(prev => ({ ...prev, open: false }))}>Cancel</Button>
                <Button onClick={addPrompt}>Save Prompt</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No prompts found</p>
            <p className="text-sm">Create your first prompt to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(prompt => (
              <Card key={prompt.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{prompt.name}</CardTitle>
                      <CardDescription className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">{prompt.category}</Badge>
                        {prompt.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => copyPrompt(prompt.id, prompt.content)}>
                        {copiedId === prompt.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deletePrompt(prompt.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{prompt.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
