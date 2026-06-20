export const PLAN_PRICES: Record<string, Record<string, number>> = {
  pro_monthly: {
    USD: 9,
    INR: 299,
    EUR: 9,
    GBP: 7,
    AUD: 14,
    CAD: 12,
    SGD: 12,
    AED: 33,
    SAR: 34,
    JPY: 1300,
    KRW: 12000,
    BRL: 45,
    MXN: 150,
    ZAR: 160,
    PLN: 35,
    SEK: 90,
    NOK: 90,
    DKK: 60,
    NZD: 15,
    CHF: 8,
    TRY: 290,
    ILS: 33,
  },
  pro_yearly: {
    USD: 84,
    INR: 2899,
    EUR: 79,
    GBP: 69,
    AUD: 119,
    CAD: 109,
    SGD: 99,
    AED: 299,
    SAR: 299,
    JPY: 11999,
    KRW: 109999,
    BRL: 449,
    MXN: 1499,
    ZAR: 1599,
    PLN: 349,
    SEK: 899,
    NOK: 899,
    DKK: 599,
    NZD: 139,
    CHF: 79,
    TRY: 2899,
    ILS: 329,
  },
}

export function getPrice(plan: "pro_monthly" | "pro_yearly", currencyCode: string): number {
  const planPrices = PLAN_PRICES[plan]
  if (!planPrices) return 0

  const price = planPrices[currencyCode]
  if (price !== undefined) return price

  const usdPrice = planPrices["USD"]
  if (!usdPrice) return 0

  const rate = FALLBACK_RATES[currencyCode] ?? 1
  return Math.round(usdPrice * rate)
}

const FALLBACK_RATES: Record<string, number> = {
  HKD: 7.8, TWD: 32, THB: 35, MYR: 4.5, IDR: 15500,
  PHP: 56, VND: 24500, PKR: 280, BDT: 110, LKR: 300,
  NPR: 130, EGP: 45, NGN: 1500, KES: 140, GHS: 12,
  ARS: 800, CLP: 850, COP: 3800, PEN: 3.7,
  RON: 4.5, BGN: 1.8, CZK: 22, HUF: 350,
}
