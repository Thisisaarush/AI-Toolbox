import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { parseEnvFile } from "./types"

const limiter = rateLimit({ max: 10, windowMs: 60000 })

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`env-manager:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "sync-vercel") {
      const { token, projectId, envVars, environment = "production" } = body
      if (!token) throw new ApiError("Vercel token required", 400)
      if (!projectId) throw new ApiError("Vercel project ID required", 400)
      if (!Array.isArray(envVars)) throw new ApiError("envVars array required", 400)

      const results: Array<{ key: string; status: string; error?: string }> = []

      for (const v of envVars) {
        try {
          const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              key: v.key,
              value: v.value,
              target: [environment],
              type: v.type === "secret" ? "encrypted" : "plain",
            }),
          })
          if (res.ok) {
            results.push({ key: v.key, status: "ok" })
          } else {
            const err = await res.json()
            results.push({ key: v.key, status: "error", error: err.error?.message ?? "Failed" })
          }
        } catch (err: unknown) {
          results.push({ key: v.key, status: "error", error: err instanceof Error ? err.message : "Unknown error" })
        }
      }

      const success = results.filter((r) => r.status === "ok").length
      return NextResponse.json({ ok: true, results, summary: `${success}/${envVars.length} synced` })
    }

    if (action === "sync-railway") {
      const { token, serviceId, envVars } = body
      if (!token) throw new ApiError("Railway token required", 400)
      if (!serviceId) throw new ApiError("Railway service ID required", 400)
      if (!Array.isArray(envVars)) throw new ApiError("envVars array required", 400)

      const variables: Record<string, string> = {}
      for (const v of envVars) {
        variables[v.key] = v.value
      }

      try {
        const res = await fetch("https://backboard.railway.app/graphql/v2", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `mutation UpsertVariables($serviceId: String!, $variables: EnvironmentVariables!) {
              variableCollectionUpsert(serviceId: $serviceId, variables: $variables)
            }`,
            variables: { serviceId, variables },
          }),
        })

        const data = await res.json()
        if (data.errors) {
          throw new ApiError(data.errors[0]?.message ?? "Railway API error", 422)
        }
        return NextResponse.json({ ok: true, summary: `${envVars.length} variables synced to Railway` })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        throw new ApiError("Railway sync failed: " + (err instanceof Error ? err.message : "Unknown"), 422)
      }
    }

    if (action === "sync-fly") {
      const { flyToken, flyAppName, envVars } = body
      if (!flyToken) throw new ApiError("Fly.io token required", 400)
      if (!flyAppName) throw new ApiError("Fly.io app name required", 400)
      if (!Array.isArray(envVars)) throw new ApiError("envVars array required", 400)

      const secrets: Record<string, string> = {}
      for (const v of envVars) {
        secrets[v.key] = v.value
      }

      try {
        const res = await fetch(`https://api.machines.dev/v1/apps/${flyAppName}/secrets`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${flyToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ secrets }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new ApiError((err as { message?: string })?.message ?? `Fly.io API error (${res.status})`, 422)
        }
        return NextResponse.json({ ok: true, summary: `${envVars.length} variables synced to Fly.io` })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        throw new ApiError("Fly.io sync failed: " + (err instanceof Error ? err.message : "Unknown"), 422)
      }
    }

    if (action === "import-url") {
      const { url } = body
      if (!url || typeof url !== "string") throw new ApiError("url required", 400)

      // Validate it's a real URL
      let parsedUrl: URL
      try {
        parsedUrl = new URL(url)
      } catch {
        throw new ApiError("Invalid URL", 400)
      }

      // Only allow http/https
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new ApiError("Only http/https URLs are supported", 400)
      }

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            "Accept": "text/plain, text/x-dotenv, */*",
            "User-Agent": "env-manager/1.0",
          },
        })
        clearTimeout(timeout)

        if (!res.ok) {
          throw new ApiError(`Remote URL responded with ${res.status}`, 422)
        }

        const contentType = res.headers.get("content-type") ?? ""
        // Sanity check: reject obvious non-text responses
        if (contentType.includes("application/json") || contentType.includes("text/html")) {
          throw new ApiError("URL does not appear to contain a .env file (got HTML/JSON)", 422)
        }

        const text = await res.text()
        if (text.length > 100_000) {
          throw new ApiError("File too large (max 100KB)", 422)
        }

        const vars = parseEnvFile(text)
        if (vars.length === 0) {
          throw new ApiError("No environment variables found in the remote file", 422)
        }

        return NextResponse.json({ ok: true, vars, count: vars.length })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        throw new ApiError(
          "Failed to fetch remote URL: " + (err instanceof Error ? err.message : "Unknown error"),
          422
        )
      }
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
