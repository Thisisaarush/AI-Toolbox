"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

// Catches crashes in the ROOT layout itself (providers, fonts, etc.) — the
// regular error.tsx only catches errors below the root layout, so without
// this file a root-layout-level crash shows Next.js's unstyled default error
// page instead of anything on-brand. Must render its own <html>/<body> since
// it replaces the root layout entirely when triggered.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global-error-boundary]", error)
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            background: "#0a0a0a",
            color: "#fff",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: 420, padding: "0 16px" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: "1.5rem" }}>
              This is our fault. The error has been logged and we will look into it.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: "0.5rem",
                padding: "0.5rem 1.25rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
