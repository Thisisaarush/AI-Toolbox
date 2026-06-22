import { NextResponse } from "next/server"
import { cancelSubscription } from "@/lib/razorpay/server"
import { getUserId } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const userId = await getUserId(req)
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
