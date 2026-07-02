import { NextResponse } from "next/server"

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY ?? ""
const RC_API_HOST = process.env.RC_API_HOST ?? "rto-vehicle-details5.p.rapidapi.com"
const RC_API_URL = process.env.RC_API_URL ?? "https://rto-vehicle-details5.p.rapidapi.com/address"

export async function POST(req: Request) {
  try {
    const { vehicleNumber } = await req.json()
    if (!vehicleNumber) {
      return NextResponse.json({ error: "vehicleNumber required" }, { status: 400 })
    }

    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: "RAPIDAPI_KEY not configured. Add it to .env.local" }, { status: 503 })
    }

    const url = new URL(RC_API_URL)
    url.searchParams.set("registration", vehicleNumber.replace(/\s+/g, ""))

    const res = await fetch(url.toString(), {
      headers: {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RC_API_HOST,
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error("RapidAPI error:", res.status, text)
      return NextResponse.json({ error: "Failed to fetch vehicle data" }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("RC lookup error:", err)
    return NextResponse.json({ error: "Failed to lookup vehicle" }, { status: 500 })
  }
}
