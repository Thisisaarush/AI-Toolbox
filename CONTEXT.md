# Toolbox — AI Tool Studio

One domain, many mini-apps. Shared infra (auth, DB, AI, payments). Build fast, cross-pollinate users.

## Stack

- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript (strict, noUncheckedIndexedAccess)
- **Styling:** Tailwind CSS v4 + shadcn/ui (Radix primitives)
- **Font:** Geist (variable) — `display: swap`, `adjustFontFallback: true`
- **Auth:** Clerk (keyless mode for dev)
- **Database:** Prisma 7 + PostgreSQL (@prisma/adapter-pg)
- **AI:** OpenAI (GPT-4o, DALL-E 3, Whisper) + Google Gemini 2.0 Flash (fallback)
- **Payments:** Stripe (optional, not wired yet)
- **Rate limiting:** In-memory sliding window (30/10 req/min)
- **Logging:** Structured JSON (stdout/stderr)
- **Security:** CSP, HSTS, Permissions-Policy, XSS/clickjack headers
- **Hosting:** Vercel (target)

## Enterprise Features

- `server-only` guards on DB, AI, Stripe modules — prevents client bundle leaks
- Zod env validation — typed, fails fast in prod, warns in dev
- Global error boundary (`error.tsx`) + custom 404 (`not-found.tsx`)
- `ApiError` class + `handleApiError()` for all API routes
- Rate-limited API routes (per-IP, per-user)
- CSP headers (script-src, img-src, connect-src locked)
- HSTS preload (2 years)

## Tools Roadmap

### Week 1 — Shipped

| Tool | Type | Route | Status |
|------|------|-------|--------|
| CommitCraft | Dev | `/tools/commit-craft` | ✅ Live |
| DreamScape | Consumer | `/tools/dream-scape` | ✅ Live |
| VibeCheck | Consumer | `/tools/vibe-check` | ✅ Live |
| Landing page | — | `/` | ✅ Live |

### Week 2 — Shipped

| Tool | Type | Route | Status |
|------|------|-------|--------|
| PromptHub | Dev | `/tools/prompt-hub` | ✅ Live |
| SchemaViz | Dev | `/tools/schema-viz` | ✅ Live |
| Curl-to-Type | Dev | `/tools/curl-to-type` | ✅ Live |

### Future

| Tool | Type | Route | Priority |
|------|------|-------|----------|
| Cursive | Consumer | `/tools/cursive` | Low |
| PR-Eloquence | Dev | `/tools/pr-eloquence` | Low |
| Chronicle | Consumer | `/tools/chronicle` | Low |
| Savor | Consumer | `/tools/savor` | Low |

## Project Structure

```
src/
├── app/                          # Thin routing layer
│   ├── page.tsx                  # Landing
│   ├── error.tsx                 # Global error boundary
│   ├── not-found.tsx             # 404
│   ├── layout.tsx
│   ├── globals.css
│   ├── proxy.ts                  # Clerk auth middleware (Next.js 16)
│   ├── tools/<tool>/page.tsx     # Re-exports from features/
│   └── api/<tool>/route.ts       # Re-exports from features/
├── features/                     # Co-located feature modules
│   ├── commit-craft/
│   │   ├── page-content.tsx      # UI (client component)
│   │   ├── api-handler.ts        # Server-side route handler
│   │   └── types.ts              # Tool-specific types
│   ├── dream-scape/
│   │   ├── page-content.tsx
│   │   ├── api-handler.ts
│   │   └── types.ts
│   ├── vibe-check/
│   │   ├── page-content.tsx
│   │   ├── api-handler.ts
│   │   └── types.ts
│   ├── prompt-hub/
│   │   └── page-content.tsx
│   ├── schema-viz/
│   │   └── page-content.tsx
│   └── curl-to-type/
│       └── page-content.tsx
├── components/
│   ├── ui/                       # shadcn primitives
│   └── shared/                   # App-wide (header, tool-header, error-boundary)
├── lib/                          # Shared infra
│   ├── ai.ts                     # Multi-provider AI (OpenAI + Gemini)
│   ├── api-error.ts              # ApiError class + handler
│   ├── db.ts                     # Prisma client (lazy, server-only, env)
│   ├── env.ts                    # Zod env validation
│   ├── logger.ts                 # Structured JSON logger
│   ├── rate-limit.ts             # In-memory rate limiter
│   ├── stripe.ts                 # Stripe client (lazy, server-only)
│   └── utils.ts                  # shadcn cn() helper
└── proxy.ts                     # Clerk auth middleware (Next.js 16)
```

## AI Provider Strategy

OpenAI is primary (GPT-4o, DALL-E 3, Whisper). Google Gemini 2.0 Flash is fallback for text completions. **Neither is required** — tools degrade gracefully with user-visible messages if no AI provider is configured.

- Text generation: tries OpenAI → fails → tries Gemini → fails → returns empty string
- Image generation: OpenAI only (DALL-E 3) → returns null if unavailable
- Audio transcription: OpenAI only (Whisper-1) → returns empty string if unavailable
- Env vars: `OPENAI_API_KEY` and `GEMINI_API_KEY` both optional in Zod schema
- At dev startup: warning logged if neither is set, no crash

## Payments (Stripe — optional)

Stripe is wired as lazy client (`src/lib/stripe.ts`) but **not connected anywhere yet**. The env vars (`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) are fully optional in the Zod schema. No UI, no checkout flow, no subscription gating exists.

You can safely ignore these until you're ready to monetize. When that time comes, you'll need:
- A Stripe account + secret key
- A price ID from Stripe Dashboard
- The redirect URLs in `createCheckoutSession()` point to `/dashboard`

## Principles

- 1-3 days per tool max
- Shared auth, payments, AI across all tools
- Every API route: auth + rate limit + error handling + structured log
- Server/client boundaries enforced at build time via `server-only`
- Ship fast, see what sticks, double down
