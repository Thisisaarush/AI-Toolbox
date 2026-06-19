import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"

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

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
