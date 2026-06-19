import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import type { DNSRecord, PropagationResult, RecordType } from "./types"

const limiter = rateLimit({ max: 20, windowMs: 60000 })

const RESOLVERS = [
  { name: "Google", ip: "8.8.8.8", location: "Global" },
  { name: "Cloudflare", ip: "1.1.1.1", location: "Global" },
  { name: "OpenDNS", ip: "208.67.222.222", location: "US" },
  { name: "Quad9", ip: "9.9.9.9", location: "Global" },
]

interface DoHAnswer {
  name: string
  type: number
  TTL: number
  data: string
}

interface DoHResponse {
  Status: number
  Answer?: DoHAnswer[]
}

async function queryDoH(resolver: string, domain: string, type: string): Promise<string[]> {
  const typeMap: Record<string, string> = {
    A: "A", AAAA: "AAAA", CNAME: "CNAME", MX: "MX", TXT: "TXT", NS: "NS",
  }
  const dnsType = typeMap[type] ?? "A"

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${dnsType}`,
      {
        signal: controller.signal,
        headers: { "Accept": "application/dns-json" },
      }
    )
    clearTimeout(timeout)
    const data: DoHResponse = await res.json()
    if (data.Status !== 0 || !data.Answer) return []
    return data.Answer.map((a) => a.data)
  } catch {
    clearTimeout(timeout)
    return []
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`dns-desk:${uid}:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "check-propagation") {
      const { domain, type = "A" } = body
      if (!domain) throw new ApiError("domain required", 400)

      const results = await Promise.all(
        RESOLVERS.map(async (resolver): Promise<PropagationResult> => {
          const start = Date.now()
          try {
            const answers = await queryDoH(resolver.ip, domain, type)
            return {
              resolver: resolver.name,
              ip: resolver.ip,
              location: resolver.location,
              answer: answers,
              status: answers.length > 0 ? "ok" : "error",
              responseTime: Date.now() - start,
            }
          } catch {
            return {
              resolver: resolver.name,
              ip: resolver.ip,
              location: resolver.location,
              answer: [],
              status: "error",
              responseTime: Date.now() - start,
            }
          }
        })
      )
      return NextResponse.json({ ok: true, results })
    }

    if (action === "domain-health") {
      const { domain } = body
      if (!domain) throw new ApiError("domain required", 400)

      let cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")

      const [httpOk, wwwOk, aRecords, mxRecords] = await Promise.all([
        fetch(`https://${cleanDomain}`, { method: "HEAD" }).then((r) => ({ ok: r.ok, status: r.status })).catch(() => ({ ok: false, status: 0 })),
        fetch(`https://www.${cleanDomain}`, { method: "HEAD" }).then((r) => ({ ok: r.ok, status: r.status })).catch(() => ({ ok: false, status: 0 })),
        queryDoH("8.8.8.8", cleanDomain, "A"),
        queryDoH("8.8.8.8", cleanDomain, "MX"),
      ])

      return NextResponse.json({
        ok: true,
        health: {
          domain: cleanDomain,
          httpsReachable: httpOk.ok,
          httpsStatus: httpOk.status,
          wwwReachable: wwwOk.ok,
          wwwStatus: wwwOk.status,
          hasARecord: aRecords.length > 0,
          hasMXRecord: mxRecords.length > 0,
          aRecords,
          mxRecords,
        },
      })
    }

    if (action === "cloudflare-import") {
      const { apiToken, zoneId } = body
      if (!apiToken) throw new ApiError("Cloudflare API token required", 400)
      if (!zoneId) throw new ApiError("Zone ID required", 400)

      try {
        const [zoneRes, recordsRes] = await Promise.all([
          fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
          }),
          fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=500`, {
            headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
          }),
        ])

        const zoneData = await zoneRes.json()
        const recordsData = await recordsRes.json()

        if (!zoneData.success) throw new ApiError("Invalid Cloudflare credentials or zone ID", 401)

        const zone = zoneData.result
        const records: DNSRecord[] = (recordsData.result ?? []).map((r: {
          id: string; type: string; name: string; content: string; ttl: number; priority?: number
        }) => ({
          id: r.id ?? crypto.randomUUID(),
          type: r.type as RecordType,
          name: r.name,
          value: r.content,
          ttl: r.ttl,
          priority: r.priority,
        }))

        return NextResponse.json({
          ok: true,
          domain: {
            name: zone.name,
            nameservers: zone.name_servers ?? [],
            status: zone.status,
            records,
          },
        })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        throw new ApiError("Cloudflare API error: " + (err instanceof Error ? err.message : "Unknown"), 422)
      }
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
