import Link from "next/link"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/shared/header"
import {
  CreditCard,
  FileText,
  Image,
  Rocket,
  Target,
  GitBranch,
  Globe,
  KeyRound,
  ArrowRight,
} from "lucide-react"

const tools = [
  {
    name: "Sub Sheriff",
    description: "Scan your email for every subscription you're paying for. Find forgotten charges, duplicates, and what to cancel.",
    icon: CreditCard,
    href: "/tools/sub-sheriff",
    badge: "Finance",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-t-red-500",
  },
  {
    name: "Invoice Zero",
    description: "Create and send professional invoices in under 60 seconds. Track payments, manage clients, download PDFs.",
    icon: FileText,
    href: "/tools/invoice-zero",
    badge: "Finance",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-t-green-500",
  },
  {
    name: "OG Craft",
    description: "Design OG images and preview how any URL looks when shared on Twitter, LinkedIn, Discord, WhatsApp, and more.",
    icon: Image,
    href: "/tools/og-craft",
    badge: "Launch",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-t-purple-500",
  },
  {
    name: "Launch Pad",
    description: "Describe your product once. Get a PH listing, HN post, tweet thread, Reddit post, LinkedIn post, and cold email.",
    icon: Rocket,
    href: "/tools/launch-pad",
    badge: "Launch",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-t-orange-500",
  },
  {
    name: "Idea Sniper",
    description: "Validate your idea before building. Find real people with your problem, score market pain, map competitors.",
    icon: Target,
    href: "/tools/idea-sniper",
    badge: "Research",
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    borderColor: "border-t-yellow-500",
  },
  {
    name: "Changelog AI",
    description: "Paste your git log. AI writes user-facing release notes grouped by type. Publish to Markdown, email, or GitHub.",
    icon: GitBranch,
    href: "/tools/changelog-ai",
    badge: "Dev Tool",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-t-blue-500",
  },
  {
    name: "DNS Desk",
    description: "All your domains in one dashboard. Visual DNS editor, expiry alerts, propagation checker, health monitor.",
    icon: Globe,
    href: "/tools/dns-desk",
    badge: "Dev Tool",
    color: "text-cyan-500",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    borderColor: "border-t-cyan-500",
  },
  {
    name: "Env Manager",
    description: "Manage environment variables across projects and environments. Sync to Vercel, Railway, and Fly.io in one click.",
    icon: KeyRound,
    href: "/tools/env-manager",
    badge: "Dev Tool",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
    borderColor: "border-t-indigo-500",
  },
]

const categories = [
  { label: "Finance", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  { label: "Launch", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  { label: "Research", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  { label: "Dev Tools", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-[#0a0a0a] text-white overflow-hidden">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "72px 72px",
            }}
          />
          {/* Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-white/[0.03] rounded-full blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-40 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Tools that slot into your workflow
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05]">
              The developer{" "}
              <span className="text-white/30">toolkit</span>
              <br />
              that actually ships.
            </h1>

            <p className="text-base md:text-lg text-white/40 max-w-lg mx-auto mb-12 leading-relaxed">
              Purpose-built tools for the things you do every week — invoicing, launching, validating, shipping.
            </p>

            {/* Category pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {categories.map((cat) => (
                <span
                  key={cat.label}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50"
                >
                  {cat.label}
                </span>
              ))}
            </div>

            <p className="text-xs text-white/20 tracking-wider">
              More tools added regularly
            </p>
          </div>
        </section>

        {/* Tool grid */}
        <section className="bg-background">
          <div className="max-w-7xl mx-auto px-4 py-16 md:py-20">
            <div className="flex items-end justify-between mb-10">
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Tools</p>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Built for what you already do</h2>
              </div>
              <p className="hidden sm:block text-sm text-muted-foreground">
                {tools.length} tools available
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {tools.map((tool) => (
                <Link key={tool.name} href={tool.href} className="group">
                  <Card
                    className={`h-full transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col border-t-2 ${tool.borderColor}`}
                  >
                    <CardHeader className="flex-1">
                      <div className="mb-4">
                        <div
                          className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center`}
                        >
                          <tool.icon className={`w-5 h-5 ${tool.color}`} />
                        </div>
                      </div>
                      <CardTitle className="text-base font-semibold flex items-center justify-between">
                        {tool.name}
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </CardTitle>
                      <CardDescription className="text-sm leading-relaxed mt-1">
                        {tool.description}
                      </CardDescription>
                    </CardHeader>
                    <div className="px-(--card-spacing) pb-(--card-spacing)">
                      <Badge variant="secondary" className="text-xs">{tool.badge}</Badge>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Toolbox</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Built for developers who ship</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs">{tools.length} tools · More coming</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
