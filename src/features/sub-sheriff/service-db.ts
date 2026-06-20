import type { Category } from "./types"

// Curated database of 150+ common SaaS services with cancel URLs
export const SERVICE_DB: Record<string, {
  cancelUrl: string
  category: Category
  logoUrl?: string
}> = {
  // AI / LLM
  "openai":          { cancelUrl: "https://platform.openai.com/account/billing", category: "ai-llm" },
  "chatgpt":         { cancelUrl: "https://help.openai.com/en/articles/7232529", category: "ai-llm" },
  "anthropic":       { cancelUrl: "https://console.anthropic.com/settings/plans", category: "ai-llm" },
  "claude":          { cancelUrl: "https://claude.ai/settings", category: "ai-llm" },
  "gemini":          { cancelUrl: "https://one.google.com/about", category: "ai-llm" },
  "cursor":          { cancelUrl: "https://www.cursor.com/settings", category: "dev-tools" },
  "github copilot":  { cancelUrl: "https://github.com/settings/copilot", category: "dev-tools" },
  "perplexity":      { cancelUrl: "https://www.perplexity.ai/settings/account", category: "ai-llm" },
  "midjourney":      { cancelUrl: "https://www.midjourney.com/account", category: "design" },
  "runway":          { cancelUrl: "https://app.runwayml.com/settings", category: "design" },
  "jasper":          { cancelUrl: "https://app.jasper.ai/account/subscription", category: "ai-llm" },
  "copy.ai":         { cancelUrl: "https://app.copy.ai/account", category: "ai-llm" },
  "writesonic":      { cancelUrl: "https://app.writesonic.com/account/billing", category: "ai-llm" },

  // Dev Tools
  "github":          { cancelUrl: "https://github.com/settings/billing", category: "dev-tools" },
  "gitlab":          { cancelUrl: "https://gitlab.com/-/profile/billings", category: "dev-tools" },
  "linear":          { cancelUrl: "https://linear.app/settings/billing", category: "dev-tools" },
  "jira":            { cancelUrl: "https://admin.atlassian.com/billing", category: "dev-tools" },
  "confluence":      { cancelUrl: "https://admin.atlassian.com/billing", category: "dev-tools" },
  "atlassian":       { cancelUrl: "https://admin.atlassian.com/billing", category: "dev-tools" },
  "datadog":         { cancelUrl: "https://app.datadoghq.com/billing", category: "dev-tools" },
  "sentry":          { cancelUrl: "https://sentry.io/settings/billing", category: "dev-tools" },
  "postman":         { cancelUrl: "https://www.postman.com/billing", category: "dev-tools" },
  "insomnia":        { cancelUrl: "https://app.insomnia.rest/app/settings/billing", category: "dev-tools" },
  "tableplus":       { cancelUrl: "https://tableplus.com/blog/2018/04/tableplus-license.html", category: "dev-tools" },
  "retool":          { cancelUrl: "https://retool.com/pricing", category: "dev-tools" },
  "supabase":        { cancelUrl: "https://supabase.com/dashboard/account/billing", category: "cloud-hosting" },
  "planetscale":     { cancelUrl: "https://app.planetscale.com/settings/billing", category: "cloud-hosting" },
  "neon":            { cancelUrl: "https://console.neon.tech/app/settings/billing", category: "cloud-hosting" },
  "railway":         { cancelUrl: "https://railway.app/account/billing", category: "cloud-hosting" },
  "render":          { cancelUrl: "https://dashboard.render.com/billing", category: "cloud-hosting" },
  "heroku":          { cancelUrl: "https://dashboard.heroku.com/account/billing", category: "cloud-hosting" },
  "fly.io":          { cancelUrl: "https://fly.io/dashboard/billing", category: "cloud-hosting" },
  "clerk":           { cancelUrl: "https://dashboard.clerk.com/", category: "dev-tools" },
  "auth0":           { cancelUrl: "https://manage.auth0.com/#/billing", category: "security" },
  "resend":          { cancelUrl: "https://resend.com/settings/billing", category: "dev-tools" },
  "sendgrid":        { cancelUrl: "https://app.sendgrid.com/settings/billing", category: "marketing" },
  "mailchimp":       { cancelUrl: "https://mailchimp.com/account/billing", category: "marketing" },

  // Cloud / Hosting
  "aws":             { cancelUrl: "https://aws.amazon.com/contact-us/account-and-billing/", category: "cloud-hosting" },
  "google cloud":    { cancelUrl: "https://console.cloud.google.com/billing", category: "cloud-hosting" },
  "azure":           { cancelUrl: "https://portal.azure.com/#blade/Microsoft_Azure_Billing/", category: "cloud-hosting" },
  "vercel":          { cancelUrl: "https://vercel.com/account/billing", category: "cloud-hosting" },
  "netlify":         { cancelUrl: "https://app.netlify.com/teams/billing", category: "cloud-hosting" },
  "cloudflare":      { cancelUrl: "https://dash.cloudflare.com/profile/billing", category: "cloud-hosting" },
  "digitalocean":    { cancelUrl: "https://cloud.digitalocean.com/account/billing", category: "cloud-hosting" },
  "linode":          { cancelUrl: "https://cloud.linode.com/account/billing", category: "cloud-hosting" },
  "vultr":           { cancelUrl: "https://my.vultr.com/billing/", category: "cloud-hosting" },

  // Productivity
  "notion":          { cancelUrl: "https://www.notion.so/my-account", category: "productivity" },
  "obsidian":        { cancelUrl: "https://obsidian.md/account", category: "productivity" },
  "roam research":   { cancelUrl: "https://roamresearch.com/#/app/your-account", category: "productivity" },
  "cron":            { cancelUrl: "https://cron.com/settings/billing", category: "productivity" },
  "todoist":         { cancelUrl: "https://todoist.com/prefs/account", category: "productivity" },
  "things 3":        { cancelUrl: "https://culturedcode.com/things/", category: "productivity" },
  "airtable":        { cancelUrl: "https://airtable.com/account", category: "productivity" },
  "clickup":         { cancelUrl: "https://app.clickup.com/settings/billing", category: "productivity" },
  "asana":           { cancelUrl: "https://app.asana.com/admin", category: "productivity" },
  "monday":          { cancelUrl: "https://monday.com/settings/billing", category: "productivity" },
  "trello":          { cancelUrl: "https://trello.com/billing", category: "productivity" },
  "zoom":            { cancelUrl: "https://zoom.us/billing", category: "productivity" },
  "loom":            { cancelUrl: "https://www.loom.com/settings/billing", category: "productivity" },
  "slack":           { cancelUrl: "https://slack.com/intl/en-us/help/articles/203855069", category: "productivity" },
  "notion ai":       { cancelUrl: "https://www.notion.so/my-account", category: "ai-llm" },

  // Design
  "figma":           { cancelUrl: "https://www.figma.com/settings/billing", category: "design" },
  "framer":          { cancelUrl: "https://framer.com/account/billing", category: "design" },
  "webflow":         { cancelUrl: "https://webflow.com/dashboard/billing", category: "design" },
  "canva":           { cancelUrl: "https://www.canva.com/settings/billing", category: "design" },
  "adobe":           { cancelUrl: "https://account.adobe.com/plans", category: "design" },
  "sketch":          { cancelUrl: "https://www.sketch.com/account/", category: "design" },
  "affinity":        { cancelUrl: "https://affinity.serif.com/en-us/", category: "design" },
  "cleanshot":       { cancelUrl: "https://cleanshot.com/", category: "design" },

  // Media
  "spotify":         { cancelUrl: "https://www.spotify.com/account/subscription/", category: "media" },
  "netflix":         { cancelUrl: "https://www.netflix.com/cancel", category: "media" },
  "youtube premium": { cancelUrl: "https://www.youtube.com/paid_memberships", category: "media" },
  "apple tv":        { cancelUrl: "https://support.apple.com/en-us/HT202039", category: "media" },
  "disney+":         { cancelUrl: "https://www.disneyplus.com/account", category: "media" },
  "hulu":            { cancelUrl: "https://www.hulu.com/account", category: "media" },
  "audible":         { cancelUrl: "https://www.audible.com/account/memberships", category: "media" },
  "kindle unlimited":{ cancelUrl: "https://www.amazon.com/hz/mycd/myx#/home/payment", category: "media" },

  // Marketing / SEO
  "ahrefs":          { cancelUrl: "https://ahrefs.com/billing", category: "marketing" },
  "semrush":         { cancelUrl: "https://www.semrush.com/billing/", category: "marketing" },
  "hubspot":         { cancelUrl: "https://www.hubspot.com/billing", category: "marketing" },
  "buffer":          { cancelUrl: "https://buffer.com/billing", category: "marketing" },
  "hootsuite":       { cancelUrl: "https://hootsuite.com/dashboard#billing", category: "marketing" },
  "lemlist":         { cancelUrl: "https://app.lemlist.com/billing", category: "marketing" },
  "apollo":          { cancelUrl: "https://app.apollo.io/#/settings/plans", category: "marketing" },

  // Security
  "1password":       { cancelUrl: "https://start.1password.com/account/billing", category: "security" },
  "lastpass":        { cancelUrl: "https://lastpass.com/account.php", category: "security" },
  "bitwarden":       { cancelUrl: "https://vault.bitwarden.com/#/settings/subscription", category: "security" },
  "nordvpn":         { cancelUrl: "https://my.nordaccount.com/billing/", category: "security" },
  "expressvpn":      { cancelUrl: "https://www.expressvpn.com/subscriptions", category: "security" },

  // Finance
  "razorpay":        { cancelUrl: "https://dashboard.razorpay.com/app/settings", category: "finance" },
  "mercury":         { cancelUrl: "https://mercury.com/support", category: "finance" },
  "wise":            { cancelUrl: "https://wise.com/settings", category: "finance" },
  "quickbooks":      { cancelUrl: "https://quickbooks.intuit.com/learn-support/", category: "finance" },
  "freshbooks":      { cancelUrl: "https://my.freshbooks.com/#/account-info/subscription", category: "finance" },
  "wave":            { cancelUrl: "https://www.waveapps.com/accounting/", category: "finance" },
}

export function lookupService(name: string): typeof SERVICE_DB[string] | undefined {
  const key = name.toLowerCase().trim()
  // Exact match
  if (SERVICE_DB[key]) return SERVICE_DB[key]
  // Partial match
  for (const [k, v] of Object.entries(SERVICE_DB)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return undefined
}
