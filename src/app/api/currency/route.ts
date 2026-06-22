import { NextRequest, NextResponse } from "next/server"
import { getCurrencyForCountry } from "@/lib/currency"
import { detectCountry } from "@/lib/country-detection"

export async function GET(req: NextRequest) {
  const { country, vpnLikely, vpnReasons } = detectCountry(req)

  return NextResponse.json({
    ...getCurrencyForCountry(country),
    vpnLikely,
    vpnReasons,
  }, {
    headers: { "Cache-Control": "public, max-age=86400" },
  })
}
