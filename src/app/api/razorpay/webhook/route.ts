import { NextResponse } from "next/server"
import { handleRazorpayWebhook } from "@/lib/razorpay/server"

export async function POST(req: Request) {
  try {
    const body = await req.text()
    const signature = req.headers.get("x-razorpay-signature")

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    const result = await handleRazorpayWebhook(body, signature)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error"
    if (message.includes("signature") || message.includes("secret")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
    console.error("[webhook]", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
