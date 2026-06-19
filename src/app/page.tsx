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
    status: "live",
  },
  {
    num: "08",
    name: "Env Manager",
    description: "Visual .env editor across all projects. Sync to Vercel, Railway, and Fly with one click. Share secrets securely. Never lose a credential.",
    icon: KeyRound,
    href: "/tools/env-manager",
    badge: "Dev Tool",
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 dark:bg-indigo-950",
    status: "live",
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
              Tools you'll actually use
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Eight deep tools built for developers and solo builders.
              Each one slots into something you already do — no new habits required.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tools.map((tool) => (
              tool.status === "live" ? (
                <Link key={tool.name} href={tool.href} className="group">
                  <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col">
                    <CardHeader className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-12 h-12 rounded-lg ${tool.bgColor} flex items-center justify-center`}>
                          <tool.icon className={`w-6 h-6 ${tool.color}`} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{tool.num}</span>
                      </div>
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <div className="px-(--card-spacing) pb-(--card-spacing)">
                      <Badge variant="secondary">{tool.badge}</Badge>
                    </div>
                  </Card>
                </Link>
              ) : (
                <div key={tool.name} className="opacity-60 cursor-not-allowed">
                  <Card className="h-full flex flex-col">
                    <CardHeader className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-12 h-12 rounded-lg ${tool.bgColor} flex items-center justify-center`}>
                          <tool.icon className={`w-6 h-6 ${tool.color}`} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{tool.num}</span>
                      </div>
                      <CardTitle className="text-lg">{tool.name}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </CardHeader>
                    <div className="flex gap-2 px-(--card-spacing) pb-(--card-spacing)">
                      <Badge variant="secondary">{tool.badge}</Badge>
                      <Badge variant="outline" className="text-muted-foreground">Coming soon</Badge>
                    </div>
                  </Card>
                </div>
              )
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Built for developers who ship.
        </div>
      </footer>
    </div>
  )
}
