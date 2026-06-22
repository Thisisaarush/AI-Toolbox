import { NextResponse } from "next/server"
import { createCheckoutSession } from "@/lib/razorpay/server"

function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
    }

    const payload = decodeToken(token)
    const userId = (payload?.sub as string) ?? null
    if (!userId) {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
    }

    const { plan, interval } = await req.json()

    if (!plan || !interval) {
      return NextResponse.json({ error: "Missing plan or interval" }, { status: 400 })
    }

    if (!["pro"].includes(plan) || !["monthly", "yearly"].includes(interval)) {
      return NextResponse.json({ error: "Invalid plan or interval" }, { status: 400 })
    }

    const result = await createCheckoutSession(userId, plan, interval)
    return NextResponse.json({ short_url: result.short_url })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    if (message === "Not authenticated") {
      return NextResponse.json({ error: "Please sign in first" }, { status: 401 })
    }
    if (message === "Razorpay not configured" || message === "Database not configured") {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error("[checkout]", error, typeof error)
    return NextResponse.json({ error: error instanceof Error ? error.message : JSON.stringify(error) }, { status: 500 })
  }
}
