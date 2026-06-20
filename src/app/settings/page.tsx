"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { ArrowLeft, Sun, Moon, Globe, Shield, Trash2, Code2, Activity, BookOpen, CheckCircle2, Info, ExternalLink, Sparkles, CreditCard, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ConnectButton, TokenConnect } from "@/components/shared/connect-button"
import { useCurrency } from "@/lib/currency-context"
import { CURRENCY_SYMBOLS } from "@/lib/currency"
import { toast } from "sonner"
import { useSubscription } from "@/components/shared/subscription-context"
import { cancelSubscription } from "@/lib/razorpay/client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const CURRENCIES = [
  "USD","EUR","GBP","INR","JPY","CAD","AUD","CHF","SGD","HKD",
  "KRW","CNY","BRL","MXN","SEK","NOK","DKK","PLN","TRY","ZAR",
  "AED","SAR","NZD","MYR","THB","IDR","PHP","PKR","NGN","KES",
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { currency, setCurrency } = useCurrency()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [githubUser, setGithubUser] = useState<string | null>(null)
  const [stravaUser, setStravaUser] = useState<string | null>(null)
  const [readwiseConnected, setReadwiseConnected] = useState(false)
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const [localDataSize, setLocalDataSize] = useState("0 KB")
  const [geminiKey, setGeminiKey] = useState<string | null>(null)
  const [geminiDraft, setGeminiDraft] = useState("")
  const [showGeminiInput, setShowGeminiInput] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const { subscription } = useSubscription()

  useEffect(() => {
    setMounted(true)

    // Load Gemini API key
    const gk = localStorage.getItem("toolbox-gemini-key")
    if (gk) setGeminiKey(gk)

    // Check existing connections
    const ghToken = localStorage.getItem("changelog-ai-github-token")
    if (ghToken) {
      fetch("https://api.github.com/user", { headers: { Authorization: `token ${ghToken}` } })
        .then(r => r.json())
        .then((d: { login?: string }) => { if (d.login) setGithubUser(d.login) })
        .catch(() => {})
    }

    const stravaMeta = localStorage.getItem("workout-strava-token_meta")
    if (stravaMeta) {
      try {
        const parsed = JSON.parse(stravaMeta) as { athlete?: { firstname?: string; lastname?: string } }
        if (parsed.athlete?.firstname) {
          setStravaUser(`${parsed.athlete.firstname} ${parsed.athlete.lastname ?? ""}`.trim())
        }
      } catch {}
    }

    if (localStorage.getItem("readwise-token")) setReadwiseConnected(true)

    // Calculate localStorage usage
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) total += (localStorage.getItem(key) ?? "").length
    }
    setLocalDataSize(`${(total / 1024).toFixed(1)} KB`)
  }, [])

  async function handleCancelSubscription() {
    setPortalLoading(true)
    try {
      await cancelSubscription()
      toast.success("Subscription will cancel at period end")
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error("Failed to cancel subscription")
    } finally {
      setPortalLoading(false)
    }
  }

  function handleClearAll() {
    localStorage.clear()
    setClearDialogOpen(false)
    setGithubUser(null)
    setStravaUser(null)
    setReadwiseConnected(false)
    setGeminiKey(null)
    setGeminiDraft("")
    setLocalDataSize("0 KB")
    toast.success("All local data cleared")
  }

  function handleSaveGeminiKey() {
    if (!geminiDraft.trim()) { toast.error("Paste your API key first"); return }
    localStorage.setItem("toolbox-gemini-key", geminiDraft.trim())
    setGeminiKey(geminiDraft.trim())
    setGeminiDraft("")
    setShowGeminiInput(false)
    toast.success("API key saved")
  }

  function handleRemoveGeminiKey() {
    localStorage.removeItem("toolbox-gemini-key")
    setGeminiKey(null)
    toast.success("API key removed")
  }

  const onGithubConnect = useCallback((token: string) => {
    fetch("https://api.github.com/user", { headers: { Authorization: `token ${token}` } })
      .then(r => r.json())
      .then((d: { login?: string }) => { if (d.login) setGithubUser(d.login) })
      .catch(() => {})
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-sm">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold mb-1">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your connected accounts, appearance, and preferences.
          </p>
        </div>

        {/* ── AI Provider ─────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">AI Provider</h2>
            <p className="text-xs text-muted-foreground">
              Configure your Gemini API key to unlock AI features.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-500" />
                <CardTitle className="text-sm">AI Provider</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Add your Gemini API key to unlock all AI features. Your key is stored locally in your browser and sent directly to Google&apos;s API — never stored on our servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status banner */}
              {geminiKey ? (
                <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-xs font-medium text-green-700 dark:text-green-400">AI features active</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    ⚠ AI features disabled — add your Gemini API key below
                  </span>
                </div>
              )}

              {/* Key configured state */}
              {geminiKey ? (
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Gemini API key configured
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleRemoveGeminiKey}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="password"
                      placeholder="Paste your Gemini API key"
                      value={geminiDraft}
                      onChange={(e) => setGeminiDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveGeminiKey() }}
                    />
                    <Button onClick={handleSaveGeminiKey} disabled={!geminiDraft.trim()}>
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    ⚠ Without an API key, all AI features across Toolbox are disabled.
                  </p>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Get a free Gemini API key at aistudio.google.com/app/apikey
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Connected Accounts ──────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Connected Accounts</h2>
            <p className="text-xs text-muted-foreground">
              Connect third-party services to pull your data automatically — no copy-pasting required.
            </p>
          </div>

          {/* How OAuth works */}
          <div className="flex gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">How it works: </span>
              Clicking "Connect" redirects you to that service's login page. You sign in to
              <span className="font-medium text-foreground"> your own account</span> and grant
              Toolbox read access. Your credentials stay on that service — Toolbox only receives
              a token scoped to your account, stored in your browser.
            </div>
          </div>

          <div className="space-y-3">
            {/* GitHub */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">GitHub</span>
                      {githubUser && (
                        <Badge variant="secondary" className="text-xs">@{githubUser}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Used by <span className="font-medium">Changelog AI</span> to fetch your commit history directly from any repository — no need to copy-paste git log output.
                    </p>
                    <ConnectButton
                      provider="github"
                      returnTo="/settings"
                      storageKey="changelog-ai-github-token"
                      onConnected={onGithubConnect}
                      onDisconnected={() => setGithubUser(null)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Strava */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">Strava</span>
                      {stravaUser && (
                        <Badge variant="secondary" className="text-xs">{stravaUser}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Used by <span className="font-medium">Workout Log</span> to import your runs, rides, swims, and other activities automatically.
                    </p>
                    <ConnectButton
                      provider="strava"
                      returnTo="/settings"
                      storageKey="workout-strava-token"
                      onConnected={() => {
                        const meta = localStorage.getItem("workout-strava-token_meta")
                        if (meta) {
                          try {
                            const p = JSON.parse(meta) as { athlete?: { firstname?: string; lastname?: string } }
                            if (p.athlete?.firstname) setStravaUser(`${p.athlete.firstname} ${p.athlete.lastname ?? ""}`.trim())
                          } catch {}
                        }
                      }}
                      onDisconnected={() => setStravaUser(null)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Readwise */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 dark:bg-orange-950 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold">Readwise</span>
                      {readwiseConnected && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />
                          Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Used by <span className="font-medium">Book Notes</span> and <span className="font-medium">Reading List</span> to sync your highlights.
                      Readwise uses API tokens instead of OAuth — your token never leaves your browser.
                    </p>
                    <a
                      href="https://readwise.io/access_token"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mb-3"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Get your Readwise access token
                    </a>
                    <div className="mt-2">
                      <TokenConnect
                        serviceName="Readwise"
                        storageKey="readwise-token"
                        placeholder="Paste your Readwise access token"
                        helpUrl="https://readwise.io/access_token"
                        helpText="Get access token"
                        onConnected={() => setReadwiseConnected(true)}
                        onDisconnected={() => setReadwiseConnected(false)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold">Appearance</h2>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Theme</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose between light and dark mode</p>
                </div>
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setTheme("light")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      theme === "light"
                        ? "bg-foreground text-background"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" />
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                      theme === "dark"
                        ? "bg-foreground text-background"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Currency ────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Currency</h2>
            <p className="text-xs text-muted-foreground">
              Auto-detected from your location. Override manually if needed.
            </p>
          </div>
          <Card>
            <CardContent className="py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Display currency</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Used across all finance tools (Sub Sheriff, Invoice Zero, Net Worth, Expense Splitter)
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <select
                    value={currency.code}
                    onChange={(e) => {
                      const code = e.target.value
                      const symbol = CURRENCY_SYMBOLS[code] ?? code
                      setCurrency({ code, symbol, country: currency.country })
                      toast.success(`Currency set to ${code}`)
                    }}
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm font-medium min-w-28"
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code} {CURRENCY_SYMBOLS[code] ? `(${CURRENCY_SYMBOLS[code]})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Data & Privacy ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Data & Privacy</h2>
            <p className="text-xs text-muted-foreground">
              All your data is stored locally in your browser. Nothing is sent to Toolbox servers.
            </p>
          </div>
          <Card>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
                <Shield className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
                  <p><span className="font-medium text-foreground">Your data stays in your browser.</span> Toolbox uses localStorage for all tool data — invoices, habits, workouts, notes, env vars, IDs, and everything else.</p>
                  <p><span className="font-medium text-foreground">OAuth tokens are scoped.</span> When you connect GitHub or Strava, the token is stored in your browser and only sent to the respective service's API (github.com, strava.com) — never to Toolbox servers.</p>
                  <p><span className="font-medium text-foreground">AI features send only what you submit.</span> When you use an AI feature, the text you enter is sent to Google Gemini. No background syncing.</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm font-medium">Local storage used</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{localDataSize} across all tools</p>
                </div>
                <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                  <DialogTrigger render={<span />}>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear all data
                    </Button>
                  </DialogTrigger>
                  <DialogContent showCloseButton={false}>
                    <DialogHeader>
                      <DialogTitle>Clear all local data?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete all your tool data — invoices, workouts, habits, notes, connected account tokens, and all other stored data. This cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="destructive" onClick={handleClearAll}>
                        Yes, clear everything
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Subscription ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Subscription</h2>
            <p className="text-xs text-muted-foreground">
              {subscription.plan === "pro" ? "You're on the Pro plan." : "Free plan — upgrade for cloud sync, AI, and premium tools."}
            </p>
          </div>
          <Card>
            <CardContent className="py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    subscription.plan === "pro" ? "bg-foreground text-background" : "bg-muted"
                  )}>
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {subscription.plan === "pro" ? "Pro Plan" : "Free Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {subscription.plan === "pro"
                        ? subscription.cancelAtPeriodEnd
                          ? "Cancels at period end"
                          : `Active — ${subscription.currentPeriodEnd ? `renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}` : ""}`
                        : "All tools free with localStorage"}
                    </p>
                  </div>
                </div>
                {subscription.plan === "pro" ? (
                  <Button variant="outline" size="sm" onClick={handleCancelSubscription} disabled={portalLoading}>
                    {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => router.push("/pricing")}>
                    Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

      </main>
    </div>
  )
}
