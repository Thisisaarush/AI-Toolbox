import { NextResponse } from "next/server"

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? ""
const CHALLAN_API_HOST = process.env.CHALLAN_API_HOST ?? "rto-challan-api.p.rapidapi.com"
const CHALLAN_API_URL = process.env.CHALLAN_API_URL ?? "https://rto-challan-api.p.rapidapi.com/"

export async function POST(req: Request) {
  try {
    const { vehicleNumber } = await req.json()
    if (!vehicleNumber) {
      return NextResponse.json({ error: "vehicleNumber required" }, { status: 400 })
    }

    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: "RAPIDAPI_KEY not configured" }, { status: 503 })
    }

    const cleaned = vehicleNumber.replace(/\s+/g, "")
    const url = new URL(CHALLAN_API_URL)
    url.searchParams.set("vehicle", cleaned)

    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": CHALLAN_API_HOST,
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("Challan API error:", res.status, text)
      return NextResponse.json({ error: "Failed to fetch challans" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("Challan lookup error:", err)
    return NextResponse.json({ error: "Failed to lookup challans" }, { status: 500 })
  }
}
