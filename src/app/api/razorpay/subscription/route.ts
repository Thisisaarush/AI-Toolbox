import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const { userId } = await auth()
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
