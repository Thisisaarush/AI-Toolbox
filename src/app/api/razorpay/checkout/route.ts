import { NextResponse } from "next/server"
import { createCheckoutSession } from "@/lib/razorpay/server"

export async function POST(req: Request) {
  try {
    const { plan, interval } = await req.json()

    if (!plan || !interval) {
      return NextResponse.json({ error: "Missing plan or interval" }, { status: 400 })
    }

    if (!["pro"].includes(plan) || !["monthly", "yearly"].includes(interval)) {
      return NextResponse.json({ error: "Invalid plan or interval" }, { status: 400 })
    }

    const result = await createCheckoutSession(plan, interval)
    return NextResponse.json({ short_url: result.short_url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
    }
    if (message === "Razorpay not configured" || message === "Database not configured") {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error("[checkout]", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
}
