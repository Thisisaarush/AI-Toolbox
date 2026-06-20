import { NextRequest, NextResponse } from "next/server"
import { getCurrencyForCountry } from "@/lib/currency"

const VPN_INDICATORS = ["T1", "XX", "A1", "A2", "O1", "EU"]

const COUNTRY_TZ_MAP: Record<string, string[]> = {
  US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "US/"],
  GB: ["Europe/London", "GB", "Europe/Belfast"],
  IN: ["Asia/Kolkata", "Asia/Calcutta"],
  JP: ["Asia/Tokyo"],
  AU: ["Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Australia/Brisbane", "Australia/Adelaide"],
  BR: ["America/Sao_Paulo", "America/Rio_de_Janeiro", "America/Fortaleza", "America/Manaus"],
  AE: ["Asia/Dubai"],
  SA: ["Asia/Riyadh"],
  SG: ["Asia/Singapore"],
  HK: ["Asia/Hong_Kong"],
  KR: ["Asia/Seoul"],
  CN: ["Asia/Shanghai", "Asia/Beijing"],
  DE: ["Europe/Berlin", "Europe/Frankfurt"],
  FR: ["Europe/Paris"],
  IT: ["Europe/Rome"],
  ES: ["Europe/Madrid"],
  NL: ["Europe/Amsterdam"],
  RU: ["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Krasnoyarsk", "Asia/Vladivostok"],
}

function tzMatchesCountry(tz: string, country: string): boolean {
  const patterns = COUNTRY_TZ_MAP[country]
  if (!patterns) return true
  return patterns.some((p) => tz.startsWith(p) || tz.includes(p))
}

export async function GET(req: NextRequest) {
  const tz = req.nextUrl.searchParams.get("tz") || ""
  const lang = req.nextUrl.searchParams.get("lang") || ""

  const vercelCountry = req.headers.get("x-vercel-ip-country") || ""
  const cfCountry = req.headers.get("cf-ipcountry") || ""
  const acceptLang = req.headers.get("accept-language") || ""

  const ipCountry = vercelCountry || cfCountry

  let vpnLikely = false
  let vpnReasons: string[] = []

  if (ipCountry && VPN_INDICATORS.includes(ipCountry)) {
    vpnLikely = true
    vpnReasons.push("proxy_or_tor")
  }

  if (tz && ipCountry && !VPN_INDICATORS.includes(ipCountry) && !tzMatchesCountry(tz, ipCountry)) {
    vpnLikely = true
    vpnReasons.push("tz_country_mismatch")
  }

  if (lang && ipCountry && !VPN_INDICATORS.includes(ipCountry)) {
    const langRegion = lang.split(",")[0]?.split("-")[1]?.toUpperCase()
    if (langRegion && langRegion !== ipCountry && langRegion.length === 2) {
      const langCountry = lang.split("-")[1]?.toUpperCase()
      if (langCountry && langCountry !== ipCountry) {
        vpnLikely = true
        if (!vpnReasons.includes("tz_country_mismatch")) {
          vpnReasons.push("lang_country_mismatch")
        }
      }
    }
  }

  const displayCountry = vpnLikely ? "US" : (ipCountry && !VPN_INDICATORS.includes(ipCountry) ? ipCountry : "US")

  return NextResponse.json({
    ...getCurrencyForCountry(displayCountry),
    vpnLikely,
    vpnReasons: vpnReasons.length > 0 ? vpnReasons : undefined,
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  })
}
