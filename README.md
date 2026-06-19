# Toolbox

A growing collection of focused, purpose-built tools for developers, builders, and makers. Each tool does one thing well — no bloat, no subscriptions, no noise.

**20+ tools · 6 categories · Dark mode default · OAuth integrations · Auto currency detection**

---

## Overview

Toolbox is a Next.js app that packages standalone tools under one roof. Every tool is self-contained (its own `page-content.tsx` + `api-handler.ts`), persists state locally in `localStorage`, and — where relevant — integrates with real third-party APIs via proper OAuth (no manual token pasting).

**Key design decisions:**
- **Dark mode by default** via `next-themes`, toggleable in every header
- **Currency auto-detection** from user's IP country on first visit (stored in localStorage for subsequent visits)
- **OAuth flows** for GitHub and Strava — "Connect" buttons redirect to provider login, no API keys copied by hand
- **API token services** (Readwise) use a clean connect panel — password input, stored in localStorage, never transmitted except to the relevant API



## Tools

### Dev Tools

#### Sub Sheriff
Track and audit your subscriptions.
- Parses email forwarding to detect recurring charges
- Groups subscriptions by category and price
- Highlights duplicates and forgotten charges
- Shows monthly and annual cost breakdown
- Suggests what to cancel based on usage patterns

#### Invoice Zero
Lightweight invoicing for freelancers and consultants.
- Create, edit, and preview invoices in seconds
- Manage clients and line items
- Download PDF invoices with one click
- Track paid/unpaid status
- Stores all data locally — no account required

#### OG Craft
Open Graph image designer and social share previewer.
- Live preview how your URL looks on Twitter, LinkedIn, Discord, WhatsApp, iMessage
- Design custom OG images with text, background, and branding
- Copy or download the final image
- Test any public URL's existing OG tags

#### Launch Pad
AI-powered launch content generator.
- Input your product description once
- Generates Product Hunt listing, HN "Show HN" post, tweet thread, Reddit post, LinkedIn post, and cold outreach email
- Multiple tones: founder, professional, casual
- Copy each format individually

#### Idea Sniper
Startup idea validator with real market research.
- Pain score (1–10) with reasoning
- AI-synthesized community signals + real HN data (via Algolia API)
- Persona breakdown: who has this pain, how often, current workarounds, WTP
- Competitor landscape with competition strength meter
- TAM estimate (rough, AI-computed)
- Pivot suggestions (always 3, regardless of verdict)
- Search queries to run yourself
- Copy-paste outreach message for community DMs
- Validation checklist with progress tracking
- Idea history with pain score trend chart

#### Changelog AI
AI changelog writer from git commits or GitHub.
- Paste raw git log or fetch commits directly from GitHub (PAT + repo + date range)
- AI categorizes and rewrites commits into user-facing language
- Visual entry editor with grouped preview
- Export as Markdown, HTML, GitHub Release, Tweet Thread, or Email HTML
- Semver bumper with MAJOR/MINOR/PATCH shortcuts
- Release history with timeline view
- Public changelog page preview
- Append to existing `CHANGELOG.md` with merge preview

#### DNS Desk
DNS management dashboard.
- Import zones from Cloudflare API
- Visual DNS record editor
- Domain expiry alerts
- Propagation checker
- Health monitoring across records

#### Env Manager
Environment variable manager across cloud providers.
- Manage variables across dev/staging/production environments
- One-click sync to Vercel, Railway, and Fly.io
- Diff view to spot missing or mismatched variables
- Export as `.env` file

---

### Personal

#### Workout Log
Fitness tracking with import support.
- Log workouts with exercise, sets, reps, and weight
- Track personal records automatically
- Import activities from Strava API
- Progress charts per exercise
- Supports custom workout templates

#### Habit Tracker
Daily habit tracking with streak visualization.
- Define habits with custom frequency (daily, weekdays, etc.)
- GitHub-style contribution heatmap
- Streak tracking with longest/current
- Completion percentage by week/month
- Simple check-off interface

#### Net Worth
Personal balance sheet tracker.
- Add assets (cash, investments, property, crypto) and liabilities (loans, credit cards)
- Multi-currency support with live exchange rates (Open Exchange Rates API)
- Net worth over time chart
- Category breakdown
- Manual entry — no bank linking required

#### ID Vault
Document and identity record store.
- Store passport numbers, driver's license IDs, SSN (masked), visa details
- Expiry date tracking with alerts
- All data encrypted and stored client-side only — never leaves the device
- Emergency info card view

#### Expense Splitter
Group expense tracking and settlement calculator.
- Add group members and log shared expenses
- Multi-currency with live conversion (Open Exchange Rates API)
- Settlement summary: who owes who and how much
- Split equally or by custom amounts
- Export settlement breakdown

#### Travel Docs
Trip document organizer.
- Create trips and attach documents (visa, insurance, hotel confirmations, flight info)
- Packing list generator
- Visa requirement lookup by destination
- Expiry reminders for travel documents
- Offline-friendly local storage

---

### Education

#### Book Notes
Read-it-and-remember system for books.
- Search and add books via Open Library API
- Log highlights, summaries, key ideas, and action items
- Import highlights from Readwise API
- Filter notes by book, tag, or date
- Export notes as Markdown

#### Reading List
Book queue and reading tracker.
- Add books to to-read, reading, and completed lists
- Track reading start/finish dates and time spent
- Sync highlights from Readwise
- Reading pace stats
- Recommendations based on reading history

#### Interview Prep
Technical and behavioral interview practice.
- Library of common behavioral and technical questions
- STAR method template for behavioral answers
- Self-score each answer attempt
- Track which questions you've practiced
- Export answer bank as a study guide

---

### Career

#### Job Tracker
Job search pipeline manager.
- Kanban board: Applied → Phone Screen → Interview → Offer → Rejected
- Per-application notes, contacts, and documents
- Follow-up reminder dates
- Company research notes
- Stats: application rate, response rate, conversion by stage

---

### Creator

#### Content Calendar
Content planning and publishing tool.
- Week and month view calendar
- Draft, schedule, and publish posts
- Direct publish to Ghost via Ghost Admin API
- Multi-channel: blog, Twitter, newsletter
- Content status tracking (draft → scheduled → published)

---

### Legal

#### Contract Generator
Freelance contract and legal document generator.
- Templates: freelance service agreement, NDA, consulting contract, IP assignment
- Fill-in-the-blanks form interface
- Preview rendered contract before downloading
- Download as PDF or plain text
- Clause library for customization

---

## Third-Party Integrations

| Integration | Used By | Purpose |
|---|---|---|
| GitHub API (`api.github.com`) | Changelog AI | Fetch commits by repo, date range, and PAT |
| Strava API | Workout Log | Import workout activities |
| Open Library API | Book Notes | Search and fetch book metadata |
| Readwise API | Book Notes, Reading List | Import reader highlights |
| Open Exchange Rates API | Net Worth, Expense Splitter | Live multi-currency conversion |
| Hacker News Algolia API | Idea Sniper | Real community search (comments + stories) |
| Ghost Admin API | Content Calendar | Publish posts directly to Ghost |
| Cloudflare API | DNS Desk | Import DNS zones |
| Vercel API | Env Manager | Sync environment secrets |
| Railway API | Env Manager | Sync environment secrets |
| Fly.io API | Env Manager | Sync environment secrets |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| UI Components | Base UI + shadcn-style components |
| AI | Google Gemini 2.5 Flash |
| Auth | Clerk |
| Fonts | Geist Sans + Geist Mono |
| Theme | next-themes (dark mode default) |
| Storage | localStorage (client-side persistence) |
| Deployment | Vercel-ready |

---

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Clone and install

```bash
git clone <repo-url>
cd toolbox
npm install
```

### Environment variables

Copy the example file and fill in the required values:

```bash
cp .env.example .env.local
```

See the [Environment Variables](#environment-variables) table below.

### Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key — powers all AI features |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key for auth |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key for server-side auth |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the app (e.g. `https://yourdomain.com`) |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth app client ID — enables "Connect GitHub" in Changelog AI |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth app client secret |
| `STRAVA_CLIENT_ID` | No | Strava OAuth app client ID — enables "Connect Strava" in Workout Log |
| `STRAVA_CLIENT_SECRET` | No | Strava OAuth app client secret |
| `DATABASE_URL` | No | Database connection string (for future DB persistence — not currently used) |

### Setting up GitHub OAuth
1. Go to [github.com/settings/developers](https://github.com/settings/developers) → **New OAuth App**
2. Set **Authorization callback URL** to `{NEXT_PUBLIC_APP_URL}/api/oauth/github/callback`
3. Copy Client ID and Client Secret to `.env.local`

### Setting up Strava OAuth
1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) → create an app
2. Set **Authorization Callback Domain** to your domain (e.g. `localhost:3000` for dev)
3. Copy Client ID and Client Secret to `.env.local`

### Currency Auto-detection
No setup required. The app detects the user's country from:
1. `x-vercel-ip-country` header (when deployed on Vercel — zero latency)
2. `cf-ipcountry` header (when behind Cloudflare)
3. `ipapi.co` fallback for other hosts

The detected currency is stored in `localStorage` and used across all finance tools. Users can also override it manually.

---

## Architecture

Each tool lives in `src/features/{tool-name}/`:

```
src/features/
  changelog-ai/
    page-content.tsx   # "use client" — all UI and state
    api-handler.ts     # Server-side logic, exported as POST handler
    types.ts           # Shared TypeScript types
  idea-sniper/
    page-content.tsx
    api-handler.ts
    types.ts
  ...
```

The Next.js API route at `src/app/api/{tool-name}/route.ts` simply re-exports the handler:

```ts
export { POST } from "@/features/{tool-name}/api-handler"
```

This keeps all tool logic colocated. Adding a new tool means:
1. Create `src/features/{tool-name}/`
2. Add the route at `src/app/api/{tool-name}/route.ts`
3. Add the tool page at `src/app/tools/{tool-name}/page.tsx`
4. Register it in `src/app/page.tsx`

State is persisted in `localStorage` under a versioned key (e.g. `changelog-ai-v1`). There is no database currently — all data stays in the user's browser. This makes the app functional with zero backend infrastructure beyond the API routes for AI calls.

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feature/my-tool`
2. Follow the architecture pattern above — one feature folder per tool
3. Keep `page-content.tsx` as a `"use client"` component; keep `api-handler.ts` server-only
4. Don't import server-only code (env vars, Node APIs) into `page-content.tsx`
5. TypeScript strict mode is enforced — no `any` without a comment explaining why
6. Run `npm run build` before submitting a PR to catch type errors
7. Open a PR with a description of what the tool does and any third-party APIs it uses
