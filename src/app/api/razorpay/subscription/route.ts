import { NextResponse } from "next/server"
import { db } from "@/lib/db"

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

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

    let userId: string | null = null
    if (token) {
      const payload = decodeToken(token)
      userId = (payload?.sub as string) ?? null
    }
    if (!userId) {
      return NextResponse.json({ plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    }

    const prisma = db()
    if (!prisma) {
      return NextResponse.json({ plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: { subscription: true },
    })

    if (!user?.subscription) {
      return NextResponse.json({ plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
    }

    const sub = user.subscription
    return NextResponse.json({
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    })
  } catch {
    return NextResponse.json({ plan: "free", status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false })
  }
}
