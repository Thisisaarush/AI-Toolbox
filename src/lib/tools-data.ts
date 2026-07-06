import {
  CreditCard, FileText, Image, Rocket, Target, GitBranch, Globe, KeyRound,
  Dumbbell, CheckCircle2, TrendingUp, Shield, Users, Plane,
  BookOpen, List, MessageSquare, Briefcase, Calendar, FileSignature,
  Scroll, Palette, Layout, Eye, Hammer, Sparkles, Brain, UserCheck,
  Braces, FilePlus, MessageCircle, Dices, Flame, Printer, Database,
} from "lucide-react"

export type Tool = {
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  badge: string
  color: string
  bgColor: string
  borderColor: string
  popular?: boolean
  isNew?: boolean
}

export type Category = {
  id: string
  label: string
  legendColor: string
  tools: Tool[]
}

export const categories: Category[] = [
  {
    id: "development",
    label: "Development",
    legendColor: "bg-blue-500",
    tools: [
      { name: "DependGuard", description: "Scan package.json for outdated, vulnerable, or typosquatted dependencies. AI-powered analysis and health scoring.", icon: Shield, href: "/tools/dependguard", badge: "Dev Tool", color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950", borderColor: "border-t-emerald-500", popular: true, isNew: true },
      { name: "DNS Desk", description: "All your domains in one dashboard. Visual DNS editor, expiry alerts, propagation checker, health monitor.", icon: Globe, href: "/tools/dns-desk", badge: "Dev Tool", color: "text-sky-500", bgColor: "bg-sky-50 dark:bg-sky-950", borderColor: "border-t-sky-500" },
      { name: "Env Manager", description: "Manage environment variables across projects and environments. Sync to Vercel, Railway, and Fly.io in one click.", icon: KeyRound, href: "/tools/env-manager", badge: "Dev Tool", color: "text-indigo-500", bgColor: "bg-indigo-50 dark:bg-indigo-950", borderColor: "border-t-indigo-500" },
      { name: "Changelog AI", description: "Paste your git log or fetch from GitHub. AI writes user-facing release notes grouped by type.", icon: GitBranch, href: "/tools/changelog-ai", badge: "Dev Tool", color: "text-cyan-500", bgColor: "bg-cyan-50 dark:bg-cyan-950", borderColor: "border-t-cyan-500" },
      { name: "JSON Studio", description: "Full-featured JSON editor with tree view, diff checker, schema generator, CSV converter, and deep search.", icon: Braces, href: "/tools/json-studio", badge: "Dev Tool", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", borderColor: "border-t-blue-500", isNew: true },
      { name: "Color & Design Studio", description: "Color palette generator, contrast checker, gradient builder, and CSS export. Create harmonious color schemes in seconds.", icon: Palette, href: "/tools/color-studio", badge: "Dev Tool", color: "text-fuchsia-500", bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950", borderColor: "border-t-fuchsia-500", isNew: true },
      { name: "Markdown Workspace", description: "Full-featured markdown editor with live preview, file management, toolbar, and export to HTML/markdown.", icon: FileText, href: "/tools/markdown-workspace", badge: "Dev Tool", color: "text-cyan-500", bgColor: "bg-cyan-50 dark:bg-cyan-950", borderColor: "border-t-cyan-500" },
      { name: "Fake It", description: "Generate realistic mock data for testing. Names, emails, phones, addresses, and more. Export as JSON or CSV.", icon: Database, href: "/tools/fake-it", badge: "Dev Tool", color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-t-amber-500" },
      { name: "Form Builder", description: "Drag-and-drop form builder with 15+ field types, multi-step forms, themes, conditional logic, and response analytics.", icon: FilePlus, href: "/tools/form-builder", badge: "Dev Tool", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", borderColor: "border-t-blue-500", isNew: true },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    legendColor: "bg-green-500",
    tools: [
      { name: "Sub Sheriff", description: "Scan your email for every subscription you're paying for. Find forgotten charges, duplicates, and what to cancel.", icon: CreditCard, href: "/tools/sub-sheriff", badge: "Finance", color: "text-red-500", bgColor: "bg-red-50 dark:bg-red-950", borderColor: "border-t-red-500", popular: true },
      { name: "Invoice Zero", description: "Create and send professional invoices in under 60 seconds. Track payments, manage clients, download PDFs.", icon: FileText, href: "/tools/invoice-zero", badge: "Finance", color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-950", borderColor: "border-t-green-500" },
      { name: "Net Worth", description: "Track assets, liabilities, and net worth over time. Multi-currency support via live exchange rates.", icon: TrendingUp, href: "/tools/net-worth", badge: "Finance", color: "text-emerald-600", bgColor: "bg-emerald-50 dark:bg-emerald-950", borderColor: "border-t-emerald-500" },
      { name: "Expense Splitter", description: "Split bills between friends and groups. Multi-currency, tracks who owes what, and generates settlement summaries.", icon: Users, href: "/tools/expense-splitter", badge: "Finance", color: "text-lime-600", bgColor: "bg-lime-50 dark:bg-lime-950", borderColor: "border-t-lime-500" },
    ],
  },
  {
    id: "launch-marketing",
    label: "Launch & Marketing",
    legendColor: "bg-orange-500",
    tools: [
      { name: "Launch Pad", description: "Describe your product once. Get a PH listing, HN post, tweet thread, Reddit post, LinkedIn post, and cold email.", icon: Rocket, href: "/tools/launch-pad", badge: "Launch", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", borderColor: "border-t-orange-500" },
      { name: "OG Craft", description: "Design OG images and preview how any URL looks when shared on Twitter, LinkedIn, Discord, WhatsApp, and more.", icon: Image, href: "/tools/og-craft", badge: "Launch", color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-950", borderColor: "border-t-purple-500" },
      { name: "Idea Sniper", description: "Validate your idea before building. Find real people with your problem, score market pain, map competitors.", icon: Target, href: "/tools/idea-sniper", badge: "Research", color: "text-yellow-500", bgColor: "bg-yellow-50 dark:bg-yellow-950", borderColor: "border-t-yellow-500" },
      { name: "Stalkr", description: "Research any brand or company. Score their name, sentiment, SEO keywords, HN mentions, and get actionable improvements.", icon: Eye, href: "/tools/stalkr", badge: "Research", color: "text-teal-500", bgColor: "bg-teal-50 dark:bg-teal-950", borderColor: "border-t-teal-500" },
      { name: "Build or Skip", description: "Pitch your idea and get a brutally honest verdict. For, against, risks, prediction, and pivot suggestions.", icon: Hammer, href: "/tools/build-or-skip", badge: "Research", color: "text-rose-500", bgColor: "bg-rose-50 dark:bg-rose-950", borderColor: "border-t-rose-500" },
      { name: "User Voice", description: "Simulate fake user interviews. Get 5 personas with honest reactions, feature requests, and willingness to pay.", icon: UserCheck, href: "/tools/user-voice", badge: "Research", color: "text-violet-500", bgColor: "bg-violet-50 dark:bg-violet-950", borderColor: "border-t-violet-500" },
      { name: "Landing Page Builder", description: "Generate complete landing page copy with hero, features, pricing, FAQ, and SEO. Export as HTML or regenerate individual sections.", icon: Layout, href: "/tools/landing-builder", badge: "Launch", color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-950", borderColor: "border-t-purple-500" },
    ],
  },
  {
    id: "content-creative",
    label: "Content & Creative",
    legendColor: "bg-purple-500",
    tools: [
      { name: "Viral Post Studio", description: "Generate platform-optimized viral posts in 8 formats. Engagement scoring, hook alternatives, and thread versions.", icon: Sparkles, href: "/tools/viral-post", badge: "Creator", color: "text-yellow-500", bgColor: "bg-yellow-50 dark:bg-yellow-950", borderColor: "border-t-yellow-500" },
      { name: "Content Calendar", description: "Plan and schedule content across channels. Publish directly to Ghost. Visual week and month views.", icon: Calendar, href: "/tools/content-calendar", badge: "Creator", color: "text-fuchsia-500", bgColor: "bg-fuchsia-50 dark:bg-fuchsia-950", borderColor: "border-t-fuchsia-500" },
      { name: "Logo Maker", description: "Design app logos with icon picker, color presets, shape options, and SVG/PNG download. AI suggests matching icons.", icon: Palette, href: "/tools/logo-maker", badge: "Creative", color: "text-pink-500", bgColor: "bg-pink-50 dark:bg-pink-950", borderColor: "border-t-pink-500" },
    ],
  },
  {
    id: "career-learning",
    label: "Career & Learning",
    legendColor: "bg-indigo-500",
    tools: [
      { name: "Interview Prep", description: "Practice behavioral and technical interview questions. Track answers with the STAR method, score yourself.", icon: MessageSquare, href: "/tools/interview-prep", badge: "Career", color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-t-amber-500" },
      { name: "Resume Builder", description: "Build, preview, and score resumes. ATS analysis, job tailoring, cover letter generation, and bullet rewriting powered by AI.", icon: Scroll, href: "/tools/resume-builder", badge: "Career", color: "text-sky-600", bgColor: "bg-sky-50 dark:bg-sky-950", borderColor: "border-t-sky-500", popular: true },
      { name: "Job Tracker", description: "Track job applications through every stage. Notes, contacts, follow-up reminders, and a Kanban-style pipeline.", icon: Briefcase, href: "/tools/job-tracker", badge: "Career", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950", borderColor: "border-t-blue-500" },
      { name: "Book Notes", description: "Capture highlights, summaries, and key takeaways from books. Search by title via Open Library. Import from Readwise.", icon: BookOpen, href: "/tools/book-notes", badge: "Education", color: "text-violet-500", bgColor: "bg-violet-50 dark:bg-violet-950", borderColor: "border-t-violet-500" },
      { name: "Reading List", description: "Manage your to-read list, track reading status, and log reading time. Sync highlights from Readwise.", icon: List, href: "/tools/reading-list", badge: "Education", color: "text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-950", borderColor: "border-t-indigo-400" },
      { name: "Decision Game", description: "Magic 8-ball, spin-the-wheel picker, and pros/cons analyzer. Make decisions fun and interactive.", icon: Dices, href: "/tools/decision-game", badge: "Education", color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-950", borderColor: "border-t-purple-500" },
      { name: "WorkbookPDF", description: "Create printable worksheets, quizzes, lined paper, and checklists. Print directly or save as PDF.", icon: Printer, href: "/tools/workbook-pdf", badge: "Education", color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-950", borderColor: "border-t-green-500" },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    legendColor: "bg-amber-500",
    tools: [
      { name: "Workout Log", description: "Log workouts, track PRs, and visualize progress. Import activities from Strava or add manually.", icon: Dumbbell, href: "/tools/workout-log", badge: "Personal", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", borderColor: "border-t-orange-500" },
      { name: "Habit Tracker", description: "Build streaks, track daily habits, and visualize consistency with a clean heatmap calendar.", icon: CheckCircle2, href: "/tools/habit-tracker", badge: "Personal", color: "text-teal-500", bgColor: "bg-teal-50 dark:bg-teal-950", borderColor: "border-t-teal-500", popular: true },
      { name: "ID Vault", description: "Store passport numbers, license IDs, and document expiry dates. Encrypted client-side, never leaves your device.", icon: Shield, href: "/tools/id-vault", badge: "Personal", color: "text-sky-500", bgColor: "bg-sky-50 dark:bg-sky-950", borderColor: "border-t-sky-500" },
      { name: "Dev Health", description: "Pomodoro timer, daily health log, streak tracker, and weekly heatmap. Monitor sleep, energy, mood, and exercise.", icon: Brain, href: "/tools/dev-health", badge: "Personal", color: "text-indigo-400", bgColor: "bg-indigo-50 dark:bg-indigo-950", borderColor: "border-t-indigo-400" },
      { name: "Ship Tracker", description: "Create challenges, track daily progress, build streaks, and hold yourself accountable. With shame cards for missed days.", icon: Rocket, href: "/tools/ship-tracker", badge: "Personal", color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950", borderColor: "border-t-amber-500" },
      { name: "Personal CRM", description: "Track contacts, log interactions, set follow-ups, and never forget a birthday. Your personal relationship manager.", icon: Users, href: "/tools/personal-crm", badge: "Personal", color: "text-sky-500", bgColor: "bg-sky-50 dark:bg-sky-950", borderColor: "border-t-sky-500" },
      { name: "Travel Docs", description: "Organize travel documents, visa requirements, and packing lists. Never miss a document for any trip.", icon: Plane, href: "/tools/travel-docs", badge: "Personal", color: "text-cyan-600", bgColor: "bg-cyan-50 dark:bg-cyan-950", borderColor: "border-t-cyan-500" },
      { name: "Visualize Habit", description: "Track habits with a GitHub-style heatmap, monthly calendar, weekly view, and detailed stats with streaks.", icon: Flame, href: "/tools/visualize-habit", badge: "Personal", color: "text-orange-500", bgColor: "bg-orange-50 dark:bg-orange-950", borderColor: "border-t-orange-500" },
      { name: "IndiePage", description: "Build a personal landing page with bio, links, social icons, and custom themes. Export as standalone HTML.", icon: Globe, href: "/tools/indiepage", badge: "Personal", color: "text-emerald-500", bgColor: "bg-emerald-50 dark:bg-emerald-950", borderColor: "border-t-emerald-500" },
    ],
  },
  {
    id: "social",
    label: "Social",
    legendColor: "bg-pink-500",
    tools: [
      { name: "Chat with Anyone", description: "Simulate conversations with 7 different personas. Practice interviews, vent to a friend, or get career advice.", icon: MessageCircle, href: "/tools/chat-anyone", badge: "Personal", color: "text-pink-500", bgColor: "bg-pink-50 dark:bg-pink-950", borderColor: "border-t-pink-500" },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    legendColor: "bg-rose-500",
    tools: [
      { name: "Contract Generator", description: "Generate freelance contracts, NDAs, and service agreements from templates. Download as PDF or plain text.", icon: FileSignature, href: "/tools/contract-gen", badge: "Legal", color: "text-rose-500", bgColor: "bg-rose-50 dark:bg-rose-950", borderColor: "border-t-rose-500" },
    ],
  },
]
