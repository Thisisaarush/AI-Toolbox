import { NextRequest, NextResponse } from "next/server"
import { getCurrencyForCountry } from "@/lib/currency"

const VPN_INDICATORS = ["T1", "XX", "A1", "A2", "O1", "EU"]

const COUNTRY_TZ_MAP: Record<string, string[]> = {
  US: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "Pacific/Pago_Pago", "Pacific/Guam", "US/"],
  GB: ["Europe/London", "Europe/Belfast"],
  IN: ["Asia/Kolkata", "Asia/Calcutta"],
  JP: ["Asia/Tokyo"],
  AU: ["Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Australia/Brisbane", "Australia/Adelaide", "Australia/Darwin", "Australia/Hobart"],
  BR: ["America/Sao_Paulo", "America/Rio_de_Janeiro", "America/Fortaleza", "America/Manaus", "America/Belem", "America/Recife"],
  AE: ["Asia/Dubai"],
  SA: ["Asia/Riyadh"],
  SG: ["Asia/Singapore"],
  HK: ["Asia/Hong_Kong"],
  KR: ["Asia/Seoul"],
  CN: ["Asia/Shanghai", "Asia/Beijing", "Asia/Chongqing", "Asia/Harbin"],
  DE: ["Europe/Berlin", "Europe/Frankfurt"],
  FR: ["Europe/Paris"],
  IT: ["Europe/Rome"],
  ES: ["Europe/Madrid", "Europe/Barcelona"],
  NL: ["Europe/Amsterdam"],
  RU: ["Europe/Moscow", "Asia/Yekaterinburg", "Asia/Krasnoyarsk", "Asia/Vladivostok", "Asia/Novosibirsk", "Asia/Irkutsk"],
  CA: ["America/Toronto", "America/Vancouver", "America/Montreal", "America/Edmonton", "America/Winnipeg", "America/Halifax", "Canada/"],
  MX: ["America/Mexico_City", "America/Cancun", "America/Mazatlan", "America/Tijuana"],
  SE: ["Europe/Stockholm"],
  NO: ["Europe/Oslo"],
  DK: ["Europe/Copenhagen"],
  CH: ["Europe/Zurich"],
  PL: ["Europe/Warsaw"],
  CZ: ["Europe/Prague"],
  HU: ["Europe/Budapest"],
  RO: ["Europe/Bucharest"],
  BG: ["Europe/Sofia"],
  TR: ["Europe/Istanbul", "Asia/Istanbul"],
  IL: ["Asia/Jerusalem", "Asia/Tel_Aviv"],
  ZA: ["Africa/Johannesburg", "Africa/Cape_Town"],
  NG: ["Africa/Lagos"],
  KE: ["Africa/Nairobi"],
  EG: ["Africa/Cairo"],
  AR: ["America/Argentina/Buenos_Aires", "America/Cordoba"],
  CL: ["America/Santiago"],
  CO: ["America/Bogota"],
  PE: ["America/Lima"],
  NZ: ["Pacific/Auckland", "Pacific/Chatham"],
  TH: ["Asia/Bangkok"],
  VN: ["Asia/Ho_Chi_Minh", "Asia/Saigon"],
  ID: ["Asia/Jakarta"],
  PH: ["Asia/Manila"],
  MY: ["Asia/Kuala_Lumpur"],
  TW: ["Asia/Taipei"],
  PK: ["Asia/Karachi"],
  BD: ["Asia/Dhaka"],
  LK: ["Asia/Colombo"],
  NP: ["Asia/Kathmandu"],
  KW: ["Asia/Kuwait"],
  QA: ["Asia/Qatar"],
  OM: ["Asia/Muscat"],
  BH: ["Asia/Bahrain"],
  IE: ["Europe/Dublin"],
  PT: ["Europe/Lisbon"],
  BE: ["Europe/Brussels"],
  AT: ["Europe/Vienna"],
  FI: ["Europe/Helsinki"],
  GR: ["Europe/Athens"],
  UA: ["Europe/Kiev", "Europe/Kyiv"],
}

const LANG_COUNTRY: Record<string, string> = {
  en: "US",
  "en-US": "US", "en-GB": "GB", "en-IN": "IN", "en-AU": "AU", "en-CA": "CA",
  "en-NZ": "NZ", "en-ZA": "ZA", "en-IE": "IE", "en-SG": "SG", "en-PH": "PH",
  "en-NG": "NG", "en-KE": "KE", "en-GH": "GH", "en-PK": "PK", "en-BD": "BD",
  "en-LK": "LK", "en-NP": "NP", "en-MY": "MY", "en-HK": "HK",
  hi: "IN",
  ja: "JP", "ja-JP": "JP",
  zh: "CN", "zh-CN": "CN", "zh-TW": "TW", "zh-HK": "HK",
  ko: "KR", "ko-KR": "KR",
  fr: "FR", "fr-FR": "FR", "fr-CA": "CA", "fr-BE": "BE", "fr-CH": "CH",
  de: "DE", "de-DE": "DE", "de-AT": "AT", "de-CH": "CH",
  pt: "BR", "pt-BR": "BR", "pt-PT": "PT",
  es: "ES", "es-ES": "ES", "es-MX": "MX", "es-AR": "AR", "es-CL": "CL",
  "es-CO": "CO", "es-PE": "PE",
  it: "IT", "it-IT": "IT", "it-CH": "CH",
  ru: "RU", "ru-RU": "RU",
  ar: "SA", "ar-SA": "SA", "ar-AE": "AE", "ar-EG": "EG",
  nl: "NL", "nl-NL": "NL", "nl-BE": "BE",
  sv: "SE", "sv-SE": "SE",
  no: "NO", "nb-NO": "NO",
  da: "DK", "da-DK": "DK",
  fi: "FI", "fi-FI": "FI",
  pl: "PL", "pl-PL": "PL",
  cs: "CZ", "cs-CZ": "CZ",
  hu: "HU", "hu-HU": "HU",
  ro: "RO", "ro-RO": "RO",
  bg: "BG", "bg-BG": "BG",
  tr: "TR", "tr-TR": "TR",
  he: "IL", "he-IL": "IL",
  th: "TH", "th-TH": "TH",
  vi: "VN", "vi-VN": "VN",
  id: "ID", "id-ID": "ID",
  ms: "MY", "ms-MY": "MY",
  ta: "IN", "ta-IN": "IN", "ta-LK": "LK",
  te: "IN", "mr:IN": "IN", "gu:IN": "IN", "bn:IN": "IN", "bn-BD": "BD",
}

const LANGUAGE_BASE_COUNTRY: Record<string, string> = {
  en: "US", hi: "IN", ja: "JP", zh: "CN", ko: "KR",
  fr: "FR", de: "DE", pt: "BR", es: "ES", it: "IT",
  ru: "RU", ar: "SA", nl: "NL", sv: "SE", no: "NO",
  da: "DK", fi: "FI", pl: "PL", cs: "CZ", hu: "HU",
  ro: "RO", bg: "BG", tr: "TR", he: "IL", th: "TH",
  vi: "VN", id: "ID", ms: "MY", ta: "IN", te: "IN",
}

function tzMatchesCountry(tz: string, country: string): boolean {
  const patterns = COUNTRY_TZ_MAP[country]
  if (!patterns) return true
  return patterns.some((p) => tz.startsWith(p) || tz.includes(p))
}

function guessCountryFromTz(tz: string): string | null {
  for (const [country, patterns] of Object.entries(COUNTRY_TZ_MAP)) {
    if (patterns.some((p) => tz.startsWith(p) || tz.includes(p))) {
      return country
    }
  }
  return null
}

function guessCountryFromLang(lang: string): string | null {
  const locale = lang.split(",")[0]?.trim() || lang
  if (LANG_COUNTRY[locale]) return LANG_COUNTRY[locale]
  const withRegion = LANG_COUNTRY[locale.slice(0, 5)]
  if (withRegion) return withRegion
  const base = locale.split("-")[0]?.split("_")[0] || ""
  if (locale.length > 2) {
    const region = locale.split("-")[1]?.toUpperCase()
    if (region && region.length === 2) {
      const match = LANG_COUNTRY[`${base}-${region}`]
      if (match) return match
      return region
    }
  }
  return LANGUAGE_BASE_COUNTRY[base] || null
}

function guessCountryFromAcceptLang(acceptLang: string): string | null {
  const langs = acceptLang.split(",").map((l) => l.split(";")[0]?.trim()).filter(Boolean) as string[]
  for (const lang of langs) {
    const region = lang.split("-")[1]?.toUpperCase()
    if (region && region.length === 2) return region
  }
  return null
}

export async function GET(req: NextRequest) {
  const tz = req.nextUrl.searchParams.get("tz") || ""
  const lang = req.nextUrl.searchParams.get("lang") || ""
  const vercelCountry = req.headers.get("x-vercel-ip-country") || ""
  const cfCountry = req.headers.get("cf-ipcountry") || ""
  const acceptLang = req.headers.get("accept-language") || ""
  const ipCountry = vercelCountry || cfCountry

  let vpnLikely = false
  const vpnReasons: string[] = []

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

  let displayCountry: string

  if (vpnLikely) {
    displayCountry = "US"
  } else if (ipCountry && !VPN_INDICATORS.includes(ipCountry)) {
    displayCountry = ipCountry
  } else {
    displayCountry = guessCountryFromTz(tz)
      || guessCountryFromLang(lang)
      || guessCountryFromAcceptLang(acceptLang)
      || "US"
  }

  return NextResponse.json({
    ...getCurrencyForCountry(displayCountry),
    vpnLikely,
    vpnReasons: vpnReasons.length > 0 ? vpnReasons : undefined,
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  })
}
