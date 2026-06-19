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
} from "lucide-react"

const tools = [
  {
    num: "01",
    name: "Sub Sheriff",
    description: "Scan your email for every subscription you're paying for. Find forgotten charges, duplicates, and what to cancel. One screen, full picture.",
    icon: CreditCard,
    href: "/tools/sub-sheriff",
    badge: "Finance",
    color: "text-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
    borderColor: "border-t-red-500",
    status: "live",
  },
  {
    num: "02",
    name: "Invoice Zero",
    description: "Freelance invoice in 60 seconds. Quote → PDF → Stripe payment link → paid. No accounting bloat.",
    icon: FileText,
    href: "/tools/invoice-zero",
    badge: "Finance",
    color: "text-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    borderColor: "border-t-green-500",
    status: "live",
  },
  {
    num: "03",
    name: "OG Craft",
    description: "Design OG images and preview exactly how any URL looks when shared on Twitter, LinkedIn, Discord, WhatsApp, and iMessage.",
    icon: Image,
    href: "/tools/og-craft",
    badge: "Launch",
    color: "text-purple-500",
    bgColor: "bg-purple-50 dark:bg-purple-950",
    borderColor: "border-t-purple-500",
    status: "live",
  },
  {
    num: "04",
    name: "Launch Pad",
    description: "Describe your product once. Get a PH listing, HN post, tweet thread, Reddit post, and cold email — all ready to copy-paste.",
    icon: Rocket,
    href: "/tools/launch-pad",
    badge: "Launch",
    color: "text-orange-500",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    borderColor: "border-t-orange-500",
    status: "live",
  },
  {
    num: "05",
    name: "Idea Sniper",
    description: "Find real Reddit posts, HN threads, and tweets of people actively complaining about your problem before you build anything.",
    icon: Target,
    href: "/tools/idea-sniper",
    badge: "Research",
    color: "text-yellow-500",
    bgColor: "bg-yellow-50 dark:bg-yellow-950",
    borderColor: "border-t-yellow-500",
    status: "live",
  },
  {
    num: "06",
    name: "Changelog AI",
    description: "Connect GitHub → AI writes user-facing release notes from commits → publish to GitHub Releases, email list, and embeddable widget.",
    icon: GitBranch,
    href: "/tools/changelog-ai",
    badge: "Dev Tool",
    color: "text-blue-500",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-t-blue-500",
    status: "live",
  },
  {
    num: "07",
    name: "DNS Desk",
    description: "All your domains from Cloudflare, Namecheap, GoDaddy, and Vercel in one dashboard. Visual DNS editor, expiry alerts, subdomain map.",
    icon: Globe,
    href: "/tools/dns-desk",
    badge: "Dev Tool",
    color: "text-cyan-500",
    bgColor: "bg-cyan-50 dark:bg-cyan-950",
    borderColor: "border-t-cyan-500",
    status: "live",
  },
  {
    num: "08",
    name: "Env Manager",
    description: "Visual .env editor across all projects. Sync to Vercel, Railway, and Fly.io with one click. Share secrets securely. Never lose a credential.",
    icon: KeyRound,
    href: "/tools/env-manager",
    badge: "Dev Tool",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
    borderColor: "border-t-indigo-500",
    status: "live",
  },
]

const heroPills = [
  "Sub Sheriff",
  "Invoice Zero",
  "OG Craft",
  "Launch Pad",
  "Idea Sniper",
  "Changelog AI",
  "DNS Desk",
  "Env Manager",
]

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero — dark section */}
        <section className="bg-[#0a0a0a] text-white">
          <div className="max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
            <p className="text-xs font-mono tracking-widest uppercase text-white/40 mb-6">
              TOOLBOX
            </p>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.08]">
              8 tools you'll actually use.
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-xl mx-auto mb-10 leading-relaxed">
              Built for developers and solo builders. Each one slots into something you already do.
            </p>
            {/* Pill badges */}
            <div className="flex flex-wrap justify-center gap-2">
              {heroPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60 backdrop-blur-sm"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tool grid — light section */}
        <section className="bg-background">
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {tools.map((tool) =>
                tool.status === "live" ? (
                  <Link key={tool.name} href={tool.href} className="group">
                    <Card
                      className={`h-full transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col border-t-2 ${tool.borderColor}`}
                    >
                      <CardHeader className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`relative w-11 h-11 rounded-lg ${tool.bgColor} flex items-center justify-center`}
                          >
                            <tool.icon className={`w-5 h-5 ${tool.color}`} />
                            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-mono text-muted-foreground bg-background border border-border rounded px-0.5 leading-tight">
                              {tool.num}
                            </span>
                          </div>
                        </div>
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {tool.description}
                        </CardDescription>
                      </CardHeader>
                      <div className="px-(--card-spacing) pb-(--card-spacing)">
                        <Badge variant="secondary">{tool.badge}</Badge>
                      </div>
                    </Card>
                  </Link>
                ) : (
                  <div key={tool.name} className="cursor-not-allowed">
                    <Card
                      className={`h-full flex flex-col border-t-2 ${tool.borderColor} opacity-50 grayscale`}
                    >
                      <CardHeader className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`relative w-11 h-11 rounded-lg ${tool.bgColor} flex items-center justify-center`}
                          >
                            <tool.icon className={`w-5 h-5 ${tool.color}`} />
                            <span className="absolute -top-1.5 -right-1.5 text-[9px] font-mono text-muted-foreground bg-background border border-border rounded px-0.5 leading-tight">
                              {tool.num}
                            </span>
                          </div>
                        </div>
                        <CardTitle className="text-base">{tool.name}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
                          {tool.description}
                        </CardDescription>
                      </CardHeader>
                      <div className="flex gap-2 px-(--card-spacing) pb-(--card-spacing)">
                        <Badge variant="secondary">{tool.badge}</Badge>
                        <Badge variant="outline" className="text-muted-foreground">
                          Coming soon
                        </Badge>
                      </div>
                    </Card>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Toolbox</span>
          <span>8 tools for developers who ship.</span>
        </div>
      </footer>
    </div>
  )
}
