import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Code2, Moon, Music, Puzzle, GitCommit, Terminal } from "lucide-react"
import { Header } from "@/components/shared/header"

const tools = [
  {
    name: "CommitCraft",
    description: "Generate conventional commit messages from git diffs using AI.",
    icon: GitCommit,
    href: "/tools/commit-craft",
    badge: "Dev Tool",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
  },
  {
    name: "DreamScape",
    description: "Voice-log your dreams and get AI-powered analysis with generated visuals.",
    icon: Moon,
    href: "/tools/dream-scape",
    badge: "Creative",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
  },
  {
    name: "VibeCheck",
    description: "Describe your aesthetic and get a custom AI-generated vibe poster.",
    icon: Music,
    href: "/tools/vibe-check",
    badge: "Creative",
    color: "text-pink-500",
    bgColor: "bg-pink-50 dark:bg-pink-950",
  },
  {
    name: "PromptHub",
    description: "Save, organize, and copy your AI prompts.",
    icon: Puzzle,
    href: "/tools/prompt-hub",
    badge: "Dev Tool",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
  },
  {
    name: "SchemaViz",
    description: "Drop your Prisma schema and get a beautiful ER diagram.",
    icon: Code2,
    href: "/tools/schema-viz",
    badge: "Dev Tool",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
  },
  {
    name: "Curl-to-Type",
    description: "Paste a cURL command and get TypeScript fetch code instantly.",
    icon: Terminal,
    href: "/tools/curl-to-type",
    badge: "Dev Tool",
    color: "text-cyan-500",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
  },
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Dev Tools & Creative Apps
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A growing collection of AI-powered tools. One account, access to all.
              Dev tools for your workflow, creative apps for your imagination.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              <Link key={tool.name} href={tool.href} className="group">
                <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-0.5">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${tool.bgColor} flex items-center justify-center mb-2`}>
                      <tool.icon className={`w-6 h-6 ${tool.color}`} />
                    </div>
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Badge variant="secondary">{tool.badge}</Badge>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Toolbox — Built with Next.js, AI, and curiosity.
        </div>
      </footer>
    </div>
  )
}
