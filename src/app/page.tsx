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
  Dumbbell,
  CheckCircle2,
  TrendingUp,
  Shield,
  Users,
  Plane,
  BookOpen,
  List,
  MessageSquare,
  Briefcase,
  Calendar,
  FileSignature,
} from "lucide-react"

type Tool = {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge: string
  color: string
  bgColor: string
  borderColor: string
  status: "live"
}

type Category = {
  id: string
  label: string
  badgeColor: string
  legendColor: string
  tools: Tool[]
}

const categories: Category[] = [
  {
    id: "dev-tools",
    label: "Dev Tools",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    legendColor: "bg-blue-500",
    tools: [
      {
        name: "Sub Sheriff",
        description: "Scan your email for every subscription you're paying for. Find forgotten charges, duplicates, and what to cancel.",
        icon: CreditCard,
        href: "/tools/sub-sheriff",
        badge: "Finance",
        color: "text-red-500",
        bgColor: "bg-red-50 dark:bg-red-950",
        borderColor: "border-t-red-500",
        status: "live",
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
        status: "live",
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
        status: "live",
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
        status: "live",
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
        status: "live",
      },
      {
        name: "Changelog AI",
        description: "Paste your git log or fetch from GitHub. AI writes user-facing release notes grouped by type.",
        icon: GitBranch,
        href: "/tools/changelog-ai",
        badge: "Dev Tool",
        color: "text-cyan-500",
        bgColor: "bg-cyan-50 dark:bg-cyan-950",
        borderColor: "border-t-cyan-500",
        status: "live",
      },
      {
        name: "DNS Desk",
        description: "All your domains in one dashboard. Visual DNS editor, expiry alerts, propagation checker, health monitor.",
        icon: Globe,
        href: "/tools/dns-desk",
        badge: "Dev Tool",
        color: "text-sky-500",
        bgColor: "bg-sky-50 dark:bg-sky-950",
        borderColor: "border-t-sky-500",
        status: "live",
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
        status: "live",
      },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    badgeColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    legendColor: "bg-orange-500",
    tools: [
      {
        name: "Workout Log",
        description: "Log workouts, track PRs, and visualize progress. Import activities from Strava or add manually.",
        icon: Dumbbell,
        href: "/tools/workout-log",
        badge: "Personal",
        color: "text-orange-500",
        bgColor: "bg-orange-50 dark:bg-orange-950",
        borderColor: "border-t-orange-500",
        status: "live",
      },
      {
        name: "Habit Tracker",
        description: "Build streaks, track daily habits, and visualize consistency with a clean heatmap calendar.",
        icon: CheckCircle2,
        href: "/tools/habit-tracker",
        badge: "Personal",
        color: "text-teal-500",
        bgColor: "bg-teal-50 dark:bg-teal-950",
        borderColor: "border-t-teal-500",
        status: "live",
      },
      {
        name: "Net Worth",
        description: "Track assets, liabilities, and net worth over time. Multi-currency support via live exchange rates.",
        icon: TrendingUp,
        href: "/tools/net-worth",
        badge: "Finance",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50 dark:bg-emerald-950",
        borderColor: "border-t-emerald-500",
        status: "live",
      },
      {
        name: "ID Vault",
        description: "Store passport numbers, license IDs, and document expiry dates. Encrypted client-side, never leaves your device.",
        icon: Shield,
        href: "/tools/id-vault",
        badge: "Personal",
        color: "text-sky-500",
        bgColor: "bg-sky-50 dark:bg-sky-950",
        borderColor: "border-t-sky-500",
        status: "live",
      },
      {
        name: "Expense Splitter",
        description: "Split bills between friends and groups. Multi-currency, tracks who owes what, and generates settlement summaries.",
        icon: Users,
        href: "/tools/expense-splitter",
        badge: "Finance",
        color: "text-lime-600",
        bgColor: "bg-lime-50 dark:bg-lime-950",
        borderColor: "border-t-lime-500",
        status: "live",
      },
      {
        name: "Travel Docs",
        description: "Organize travel documents, visa requirements, and packing lists. Never miss a document for any trip.",
        icon: Plane,
        href: "/tools/travel-docs",
        badge: "Personal",
        color: "text-cyan-600",
        bgColor: "bg-cyan-50 dark:bg-cyan-950",
        borderColor: "border-t-cyan-500",
        status: "live",
      },
    ],
  },
  {
    id: "education",
    label: "Education",
    badgeColor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    legendColor: "bg-violet-500",
    tools: [
      {
        name: "Book Notes",
        description: "Capture highlights, summaries, and key takeaways from books. Search by title via Open Library. Import from Readwise.",
        icon: BookOpen,
        href: "/tools/book-notes",
        badge: "Education",
        color: "text-violet-500",
        bgColor: "bg-violet-50 dark:bg-violet-950",
        borderColor: "border-t-violet-500",
        status: "live",
      },
      {
        name: "Reading List",
        description: "Manage your to-read list, track reading status, and log reading time. Sync highlights from Readwise.",
        icon: List,
        href: "/tools/reading-list",
        badge: "Education",
        color: "text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950",
        borderColor: "border-t-indigo-400",
        status: "live",
      },
      {
        name: "Interview Prep",
        description: "Practice behavioral and technical interview questions. Track answers with the STAR method, score yourself.",
        icon: MessageSquare,
        href: "/tools/interview-prep",
        badge: "Career",
        color: "text-amber-500",
        bgColor: "bg-amber-50 dark:bg-amber-950",
        borderColor: "border-t-amber-500",
        status: "live",
      },
    ],
  },
  {
    id: "career",
    label: "Career",
    badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    legendColor: "bg-blue-600",
    tools: [
      {
        name: "Job Tracker",
        description: "Track job applications through every stage. Notes, contacts, follow-up reminders, and a Kanban-style pipeline.",
        icon: Briefcase,
        href: "/tools/job-tracker",
        badge: "Career",
        color: "text-blue-500",
        bgColor: "bg-blue-50 dark:bg-blue-950",
        borderColor: "border-t-blue-500",
        status: "live",
      },
    ],
  },
  {
    id: "creator",
    label: "Creator",
    badgeColor: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    legendColor: "bg-fuchsia-500",
    tools: [
      {
        name: "Content Calendar",
        description: "Plan and schedule content across channels. Publish directly to Ghost. Visual week and month views.",
        icon: Calendar,
        href: "/tools/content-calendar",
        badge: "Creator",
        color: "text-fuchsia-500",
        bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950",
        borderColor: "border-t-fuchsia-500",
        status: "live",
      },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    legendColor: "bg-rose-500",
    tools: [
      {
        name: "Contract Generator",
        description: "Generate freelance contracts, NDAs, and service agreements from templates. Download as PDF or plain text.",
        icon: FileSignature,
        href: "/tools/contract-gen",
        badge: "Legal",
        color: "text-rose-500",
        bgColor: "bg-rose-50 dark:bg-rose-950",
        borderColor: "border-t-rose-500",
        status: "live",
      },
    ],
  },
]

const allToolCount = categories.reduce((sum, cat) => sum + cat.tools.length, 0)

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-white dark:bg-[#0a0a0a] overflow-hidden border-b border-border">
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.04] dark:opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
              backgroundSize: "72px 72px",
            }}
          />
          <div
            className="absolute inset-0 hidden dark:block opacity-[0.04]"
            style={{
              backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
              backgroundSize: "72px 72px",
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-40 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Tools that slot into your workflow
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.05] text-black dark:text-white">
              Every tool you need.{" "}
              <span className="text-black/25 dark:text-white/30">Nothing you don&rsquo;t.</span>
            </h1>

            <p className="text-base md:text-lg text-black/50 dark:text-white/40 max-w-xl mx-auto mb-10 leading-relaxed">
              Purpose-built tools for developers, builders, and makers. Subscriptions, invoices, fitness, documents, learning, and more.
            </p>

            <p className="text-sm font-medium text-black/30 dark:text-white/30 mb-8 tracking-wider">
              {allToolCount}+ tools across {categories.length} categories
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-3 py-1 text-xs font-medium text-black/50 dark:text-white/50"
                >
                  <span className={`w-2 h-2 rounded-full ${cat.legendColor}`} />
                  {cat.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Tool grid — grouped by category */}
        <section className="bg-background">
          <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 space-y-16">
            {categories.map((cat) => (
              <div key={cat.id}>
                {/* Category header */}
                <div className="flex items-end justify-between mb-8">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${cat.legendColor}`} />
                      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">{cat.label}</p>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight">{cat.label}</h2>
                  </div>
                  <span className="text-sm text-muted-foreground">{cat.tools.length} tool{cat.tools.length !== 1 ? "s" : ""}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {cat.tools.map((tool) => (
                    <Link key={tool.name} href={tool.href} className="group">
                      <Card
                        className={`h-full transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col border-t-2 ${tool.borderColor}`}
                      >
                        <CardHeader className="flex-1">
                          <div className="mb-4">
                            <div className={`w-10 h-10 rounded-lg ${tool.bgColor} flex items-center justify-center`}>
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
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-background">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">Toolbox</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Tools for everyone who builds</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs">{allToolCount} tools · More coming</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
