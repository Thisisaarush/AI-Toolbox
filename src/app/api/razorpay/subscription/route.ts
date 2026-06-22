import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserId } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const userId = await getUserId(req)
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
