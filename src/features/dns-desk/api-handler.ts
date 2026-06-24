import { NextResponse } from "next/server"
import { getUserId } from "@/lib/auth"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import type { DNSRecord, PropagationResult, RecordType, SSLInfo, WhoisInfo } from "./types"

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

// crt.sh certificate transparency response type
interface CrtShEntry {
  issuer_ca_id?: number
  issuer_name?: string
  common_name?: string
  name_value?: string
  not_before?: string
  not_after?: string
  entry_timestamp?: string
}

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
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

      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")

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

    if (action === "check-ssl") {
      const { domain } = body
      if (!domain) throw new ApiError("domain required", 400)

      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(
          `https://crt.sh/?q=${encodeURIComponent(cleanDomain)}&output=json`,
          {
            signal: controller.signal,
            headers: { "Accept": "application/json" },
          }
        )
        clearTimeout(timeout)

        if (!res.ok) {
          throw new Error(`crt.sh responded with ${res.status}`)
        }

        const certs: CrtShEntry[] = await res.json()

        // Find the most recent non-wildcard/non-precert cert for this exact domain
        const now = new Date()
        const relevant = certs
          .filter((c) => {
            const cn = (c.common_name ?? "").toLowerCase()
            const nameVal = (c.name_value ?? "").toLowerCase()
            const domainLower = cleanDomain.toLowerCase()
            return cn === domainLower || nameVal.includes(domainLower)
          })
          .filter((c) => c.not_after)
          .sort((a, b) => {
            const dateA = a.not_after ? new Date(a.not_after).getTime() : 0
            const dateB = b.not_after ? new Date(b.not_after).getTime() : 0
            return dateB - dateA
          })

        if (relevant.length === 0) {
          return NextResponse.json({
            ok: true,
            ssl: null,
            message: "No certificates found in transparency logs",
          })
        }

        const latest = relevant[0]
        if (!latest) {
          return NextResponse.json({ error: true, message: "No certificates found in transparency logs" })
        }
        const validTo = latest.not_after ? new Date(latest.not_after) : null
        const validFrom = latest.not_before ? new Date(latest.not_before) : null
        const daysUntilExpiry = validTo
          ? Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0

        const sslInfo: SSLInfo = {
          issuer: latest.issuer_name ?? "Unknown",
          validFrom: validFrom ? validFrom.toISOString() : "",
          validTo: validTo ? validTo.toISOString() : "",
          daysUntilExpiry,
          isValid: validTo ? validTo > now : false,
          certName: latest.common_name ?? cleanDomain,
        }

        return NextResponse.json({ ok: true, ssl: sslInfo })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        return NextResponse.json({
          ok: true,
          ssl: null,
          message: "Could not retrieve certificate data: " + (err instanceof Error ? err.message : "Unknown error"),
        })
      }
    }

    if (action === "whois") {
      const { domain } = body
      if (!domain) throw new ApiError("domain required", 400)

      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
      const whoisUrl = `https://who.is/whois/${encodeURIComponent(cleanDomain)}`

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)

        const res = await fetch(
          `https://jsonwhois.com/api/whois?domain=${encodeURIComponent(cleanDomain)}`,
          {
            signal: controller.signal,
            headers: { "Accept": "application/json" },
          }
        )
        clearTimeout(timeout)

        if (!res.ok) {
          // Fallback: return link to who.is
          const info: WhoisInfo = { whoisUrl }
          return NextResponse.json({ ok: true, whois: info })
        }

        const data = await res.json()

        const nameServers: string[] = []
        if (Array.isArray(data.nameservers)) {
          for (const ns of data.nameservers) {
            if (typeof ns === "string") nameServers.push(ns)
            else if (ns?.name) nameServers.push(ns.name as string)
          }
        }

        const info: WhoisInfo = {
          registrar: (data.registrar?.name as string | undefined) ?? (data.registrar as string | undefined),
          creationDate: (data.created_on as string | undefined) ?? (data.creation_date as string | undefined),
          expiryDate: (data.expires_on as string | undefined) ?? (data.expiration_date as string | undefined),
          nameServers: nameServers.length > 0 ? nameServers : undefined,
          whoisUrl,
          raw: typeof data.raw === "string" ? (data.raw as string).slice(0, 2000) : undefined,
        }

        return NextResponse.json({ ok: true, whois: info })
      } catch {
        // Always return at minimum a link to who.is
        const info: WhoisInfo = { whoisUrl }
        return NextResponse.json({ ok: true, whois: info })
      }
    }

    if (action === "reverse-dns") {
      const { ip: ipAddress } = body
      if (!ipAddress) throw new ApiError("ip required", 400)

      const parts = String(ipAddress).split(".")
      if (parts.length !== 4) throw new ApiError("Invalid IPv4 address", 400)
      const reversed = parts.reverse().join(".")
      const ptrDomain = `${reversed}.in-addr.arpa`

      try {
        const answers = await queryDoH("8.8.8.8", ptrDomain, "PTR")
        return NextResponse.json({ ok: true, ptr: answers[0] ?? null, ptrDomain })
      } catch {
        return NextResponse.json({ ok: true, ptr: null, ptrDomain })
      }
    }

    if (action === "cloudflare-list-zones") {
      const { apiToken } = body
      if (!apiToken) throw new ApiError("Cloudflare API token required", 400)
      try {
        const res = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=100", {
          headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
        })
        const data = await res.json()
        if (!data.success) throw new ApiError("Invalid Cloudflare credentials", 401)
        const zones = (data.result ?? []).map((z: { id: string; name: string }) => ({
          id: z.id, name: z.name,
        }))
        return NextResponse.json({ ok: true, zones })
      } catch (err: unknown) {
        if (err instanceof ApiError) throw err
        throw new ApiError("Cloudflare API error: " + (err instanceof Error ? err.message : "Unknown"), 422)
      }
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
