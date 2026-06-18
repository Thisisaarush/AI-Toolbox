# Toolbox — Tool Studio

One domain, many mini-apps. Shared infra (auth, DB, AI, payments). Build fast, cross-pollinate users.

## Stack

- **Framework:** Next.js 16.2.9 (App Router)
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Auth:** Clerk
- **Database:** Prisma + PostgreSQL
- **Payments:** Stripe
- **AI:** OpenAI (GPT-4o, DALL-E, Whisper)
- **CLI:** oclif for CommitCraft
- **Hosting:** Vercel

## Tools Roadmap

### Week 1 — 3 Dev Tools + 1 Consumer (ship by Fri)

| Tool | Type | Route | Est. | Status |
|------|------|-------|------|--------|
| CommitCraft | Dev CLI | `/tools/commit-craft` | 1d | Pending |
| DreamScape | Consumer | `/tools/dream-scape` | 2d | Pending |
| VibeCheck | Consumer | `/tools/vibe-check` | 1d | Pending |
| PromptHub | Dev SaaS | `/tools/prompt-hub` | 2d | Pending |

### Week 2 — 2 Dev + 2 Consumer

| Tool | Type | Route | Est. | Status |
|------|------|-------|------|--------|
| SchemaViz | Dev | `/tools/schema-viz` | 1d | Pending |
| Cursive | Consumer | `/tools/cursive` | 2d | Pending |
| PR-Eloquence | Dev | `/tools/pr-eloquence` | 1d | Pending |
| Chronicle | Consumer | `/tools/chronicle` | 2d | Pending |

### Week 3 — 2 Consumer

| Tool | Type | Route | Est. | Status |
|------|------|-------|------|--------|
| Savor | Consumer | `/tools/savor` | 2d | Pending |
| Curl-to-Type | Dev | `/tools/curl-to-type` | 1d | Pending |

## Project Structure

```
toolbox/
├── src/
│   ├── app/
│   │   ├── (marketing)/     # Landing page
│   │   │   └── page.tsx
│   │   ├── (dashboard)/     # Auth-protected area
│   │   │   └── layout.tsx
│   │   ├── tools/
│   │   │   ├── commit-craft/page.tsx
│   │   │   ├── dream-scape/page.tsx
│   │   │   └── ...
│   │   ├── api/
│   │   │   ├── ai/route.ts
│   │   │   ├── stripe/route.ts
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/               # shadcn components
│   │   └── shared/           # App-specific components
│   ├── lib/
│   │   ├── ai.ts             # Shared AI pipeline
│   │   ├── db.ts             # Prisma client
│   │   └── stripe.ts         # Stripe helpers
│   └── types/
├── prisma/
│   └── schema.prisma
├── packages/
│   ├── cli/                  # CLI tools (CommitCraft)
│   └── ... (extracted as needed)
├── CONTEXT.md
├── AGENTS.md
└── CLAUDE.md
```

## Cross-Selling

Every tool shows "Related Tools" in sidebar/footer. Shared user DB means one login, access to all.

## Principles

- 1-3 days per tool max
- Shared auth, payments, AI pipeline across all tools
- Ship fast, see what sticks, double down
- Revenue stacking: multiple small streams > one big bet
