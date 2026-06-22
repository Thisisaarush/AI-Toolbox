import { NextResponse } from "next/server"
import { cancelSubscription } from "@/lib/razorpay/server"

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
      return NextResponse.json({ error: "Not authenticated" }, { status: 400 })
    }

    const payload = decodeToken(token)
    const userId = (payload?.sub as string) ?? null
    if (!userId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 400 })
    }
    const result = await cancelSubscription(userId, true)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    if (message === "Not authenticated" || message === "No active subscription") {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (message === "Razorpay not configured" || message === "Database not configured") {
      return NextResponse.json({ error: message }, { status: 503 })
    }
    console.error("[cancel]", error)
    return NextResponse.json({ error: "Failed to cancel subscription" }, { status: 500 })
  }
}
