"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, ExternalLink, LogOut, Loader2, AlertCircle } from "lucide-react"

export type OAuthProvider = "github" | "strava"

interface ConnectButtonProps {
  provider: OAuthProvider
  /** The current tool route — used as returnTo after OAuth */
  returnTo: string
  /** localStorage key to store/read the token */
  storageKey: string
  /** Called when a token becomes available (from OAuth redirect or existing storage) */
  onConnected?: (token: string, metadata?: Record<string, unknown>) => void
  /** Called when disconnected */
  onDisconnected?: () => void
  /** Override the button label */
  label?: string
  /** Extra description shown below the button */
  description?: string
}

const PROVIDER_META: Record<OAuthProvider, {
  name: string
  icon: string
  color: string
  scope: string
}> = {
  github: {
    name: "GitHub",
    icon: "github",
    color: "bg-gray-900 hover:bg-gray-800 text-white dark:bg-gray-700 dark:hover:bg-gray-600",
    scope: "repo",
  },
  strava: {
    name: "Strava",
    icon: "strava",
    color: "bg-[#FC4C02] hover:bg-[#e04300] text-white",
    scope: "activity:read_all",
  },
}

export function ConnectButton({
  provider,
  returnTo,
  storageKey,
  onConnected,
  onDisconnected,
  label,
  description,
}: ConnectButtonProps) {
  const [token, setToken] = useState<string | null>(null)
  const [connectedUser, setConnectedUser] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  const meta = PROVIDER_META[provider]

  // On mount: check localStorage for existing token + handle OAuth redirect fragment
  useEffect(() => {
    setMounted(true)

    // Handle OAuth redirect — token arrives in URL fragment
    if (typeof window !== "undefined" && window.location.hash) {
      const hash = window.location.hash.slice(1)
      const params = new URLSearchParams(hash)

      const tokenKey = `${provider}_token`
      const rawToken = params.get(tokenKey)

      if (rawToken) {
        const decodedToken = rawToken.startsWith("{")
          ? rawToken
          : (() => {
              try { return decodeURIComponent(rawToken) } catch { return rawToken }
            })()

        let actualToken = decodedToken
        let metadata: Record<string, unknown> | undefined

        // Strava sends a JSON payload
        try {
          const parsed = JSON.parse(decodedToken) as { access_token?: string } & Record<string, unknown>
          if (parsed.access_token) {
            actualToken = parsed.access_token
            metadata = parsed
          }
        } catch { /* not JSON, it's a plain token */ }

        // Store in localStorage
        localStorage.setItem(storageKey, actualToken)
        if (metadata) {
          localStorage.setItem(`${storageKey}_meta`, JSON.stringify(metadata))
        }

        setToken(actualToken)
        onConnected?.(actualToken, metadata)

        // Clean the URL fragment
        window.history.replaceState(null, "", window.location.pathname + window.location.search)
        return
      }
    }

    // Load existing token from localStorage
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      setToken(stored)
      onConnected?.(stored)
    }
  }, [provider, storageKey, onConnected])

  // Fetch connected user info for display
  useEffect(() => {
    if (!token || !mounted) return
    if (provider === "github") {
      fetch("https://api.github.com/user", {
        headers: { Authorization: `token ${token}` },
      })
        .then((r) => r.json())
        .then((data: { login?: string }) => {
          if (data.login) setConnectedUser(data.login)
        })
        .catch(() => { /* silently fail */ })
    } else if (provider === "strava") {
      const meta = localStorage.getItem(`${storageKey}_meta`)
      if (meta) {
        try {
          const parsed = JSON.parse(meta) as { athlete?: { firstname?: string; lastname?: string } }
          if (parsed.athlete?.firstname) {
            setConnectedUser(`${parsed.athlete.firstname} ${parsed.athlete.lastname ?? ""}`.trim())
          }
        } catch { /* ignore */ }
      }
    }
  }, [token, provider, storageKey, mounted])

  function handleConnect() {
    setLoading(true)
    // Redirect to our OAuth redirect endpoint
    window.location.href = `/api/oauth/${provider}/redirect?returnTo=${encodeURIComponent(returnTo)}`
  }

  function handleDisconnect() {
    localStorage.removeItem(storageKey)
    localStorage.removeItem(`${storageKey}_meta`)
    setToken(null)
    setConnectedUser(null)
    onDisconnected?.()
  }

  if (!mounted) return <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />

  if (token) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {meta.name} connected{connectedUser ? ` · ${connectedUser}` : ""}
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-3 h-3 mr-1" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleConnect}
        disabled={loading}
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${meta.color} disabled:opacity-60`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ExternalLink className="w-3.5 h-3.5" />
        )}
        {label ?? `Connect ${meta.name}`}
      </button>
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}

/** For API-key based services like Readwise that don't use OAuth */
interface TokenConnectProps {
  serviceName: string
  storageKey: string
  placeholder?: string
  helpUrl?: string
  helpText?: string
  onConnected?: (token: string) => void
  onDisconnected?: () => void
  description?: string
}

export function TokenConnect({
  serviceName,
  storageKey,
  placeholder,
  helpUrl,
  helpText,
  onConnected,
  onDisconnected,
  description,
}: TokenConnectProps) {
  const [token, setToken] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [mounted, setMounted] = useState(false)
  const [showInput, setShowInput] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      setToken(stored)
      onConnected?.(stored)
    }
  }, [storageKey, onConnected])

  function handleSave() {
    if (!draft.trim()) return
    localStorage.setItem(storageKey, draft.trim())
    setToken(draft.trim())
    setDraft("")
    setShowInput(false)
    onConnected?.(draft.trim())
  }

  function handleDisconnect() {
    localStorage.removeItem(storageKey)
    setToken(null)
    onDisconnected?.()
  }

  if (!mounted) return <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />

  if (token) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {serviceName} connected
        </div>
        <Button
          variant="ghost"
          size="xs"
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-3 h-3 mr-1" />
          Disconnect
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={placeholder ?? "Paste your API token"}
            className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <Button size="xs" onClick={handleSave} disabled={!draft.trim()}>
            Save
          </Button>
          <Button size="xs" variant="ghost" onClick={() => { setShowInput(false); setDraft("") }}>
            Cancel
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-muted px-3 py-2 text-sm font-medium transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Connect {serviceName}
        </button>
      )}

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {helpUrl && (
        <a
          href={helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
        >
          <AlertCircle className="w-3 h-3" />
          {helpText ?? "Get your API token"}
        </a>
      )}
    </div>
  )
}
