import { NextResponse } from "next/server"
import { getCurrencyForCountry } from "@/lib/currency"

export async function GET(req: Request) {
  // Try Vercel's injected country header first (zero latency, no external call)
  const vercelCountry = req.headers.get("x-vercel-ip-country")
  // Try Cloudflare's header
  const cfCountry = req.headers.get("cf-ipcountry")
  // Try Fly.io header
  const flyCountry = req.headers.get("fly-client-ip") // Fly doesn't inject country, skip

  const country = vercelCountry ?? cfCountry

  if (country && country !== "XX" && country !== "T1") {
    // XX = unknown, T1 = Tor
    return NextResponse.json(getCurrencyForCountry(country), {
      headers: { "Cache-Control": "public, max-age=86400" }, // cache 24h per IP
    })
  }

  // Fallback: ipapi.co (free, 1000 req/day, no key needed)
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    if (ip && ip !== "127.0.0.1" && ip !== "::1") {
      const res = await fetch(`https://ipapi.co/${ip}/country/`, {
        headers: { "User-Agent": "toolbox-app/1.0" },
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        const countryCode = (await res.text()).trim().toUpperCase()
        if (countryCode.length === 2) {
          return NextResponse.json(getCurrencyForCountry(countryCode), {
            headers: { "Cache-Control": "public, max-age=86400" },
          })
        }
      }
    }
  } catch {
    // Silently fall through to default
  }

  // Ultimate fallback: USD
  return NextResponse.json(
    { code: "USD", symbol: "$", country: "US" },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  )
}
