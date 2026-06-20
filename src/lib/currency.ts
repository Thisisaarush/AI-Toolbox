export const COUNTRY_TO_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", MX: "MXN",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", PT: "EUR", NL: "EUR",
  BE: "EUR", AT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", LU: "EUR",
  SK: "EUR", SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", CY: "EUR",
  MT: "EUR", HR: "EUR",
  GB: "GBP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN",
  IN: "INR", JP: "JPY", CN: "CNY", AU: "AUD", NZ: "NZD",
  SG: "SGD", HK: "HKD", KR: "KRW", TW: "TWD", TH: "THB",
  MY: "MYR", ID: "IDR", PH: "PHP", VN: "VND", PK: "PKR",
  BD: "BDT", LK: "LKR", NP: "NPR",
  AE: "AED", SA: "SAR", IL: "ILS", TR: "TRY", EG: "EGP",
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS",
  BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN",
  _: "USD",
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", JPY: "¥", CNY: "¥",
  CAD: "CA$", AUD: "A$", NZD: "NZ$", CHF: "CHF", SEK: "SEK",
  NOK: "NOK", DKK: "DKK", SGD: "S$", HKD: "HK$", KRW: "₩",
  TWD: "NT$", THB: "฿", MYR: "RM", IDR: "Rp", PHP: "₱",
  VND: "₫", PKR: "₨", BDT: "৳", LKR: "Rs", NPR: "Rs",
  AED: "د.إ", SAR: "﷼", ILS: "₪", TRY: "₺", EGP: "£",
  ZAR: "R", NGN: "₦", KES: "KSh", GHS: "₵", BRL: "R$",
  ARS: "$", CLP: "$", COP: "$", PEN: "S/", MXN: "$",
  PLN: "zł", CZK: "Kč", HUF: "Ft", RON: "lei", BGN: "лв",
}

export type CurrencyInfo = {
  code: string
  symbol: string
  country: string
  vpnLikely?: boolean
  vpnReasons?: string[]
}

export function getCurrencyForCountry(countryCode: string): CurrencyInfo {
  const code = COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] ?? "USD"
  return {
    code,
    symbol: CURRENCY_SYMBOLS[code] ?? code,
    country: countryCode,
  }
}

export function formatAmount(amount: number, currencyCode: string, compact = false): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: currencyCode,
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: currencyCode === "JPY" || currencyCode === "KRW" || currencyCode === "VND" ? 0 : 2,
    }).format(amount)
  } catch {
    const sym = CURRENCY_SYMBOLS[currencyCode] ?? currencyCode
    return `${sym}${amount.toFixed(2)}`
  }
}
