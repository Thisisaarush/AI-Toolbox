import "server-only"
import { env } from "@/lib/env"
import { db } from "@/lib/db"
import { auth } from "@clerk/nextjs/server"
import crypto from "crypto"

let razorpayInstance: any | null = null

async function getRazorpay() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null
  if (razorpayInstance) return razorpayInstance
  const { default: Razorpay } = await import("razorpay")
  razorpayInstance = new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  })
  return razorpayInstance
}

function resolvePlanId(plan: string, interval: string): string {
  if (plan === "pro" && interval === "monthly") return env.RAZORPAY_PLAN_ID_PRO_MONTHLY ?? ""
  if (plan === "pro" && interval === "yearly") return env.RAZORPAY_PLAN_ID_PRO_YEARLY ?? ""
  throw new Error("Invalid plan or interval")
}

export async function createCheckoutSession(plan: string, interval: string) {
  const razorpay = await getRazorpay()
  if (!razorpay) throw new Error("Razorpay not configured")

  const { userId } = await auth()
  if (!userId) throw new Error("Not authenticated")

  const prisma = db()
  if (!prisma) throw new Error("Database not configured")

  let user = await prisma.user.findUnique({ where: { clerkId: userId } })

  if (!user) {
    const session = await auth()
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: ((session?.sessionClaims as any)?.email as string) ?? "",
        name: ((session?.sessionClaims as any)?.name as string) ?? "",
      },
    })
  }

  const planId = resolvePlanId(plan, interval)

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    total_count: 0,
    quantity: 1,
    customer_notify: 1,
    notes: {
      clerkId: userId,
      dbUserId: user.id,
    },
  })

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: planId,
      status: "created",
      plan: "pro",
    },
    update: {
      razorpaySubscriptionId: subscription.id,
      razorpayPlanId: planId,
      status: "created",
      plan: "pro",
    },
  })

  return { id: subscription.id, short_url: subscription.short_url }
}

export async function cancelSubscription(cancelAtCycleEnd = true) {
  const razorpay = await getRazorpay()
  if (!razorpay) throw new Error("Razorpay not configured")

  const { userId } = await auth()
  if (!userId) throw new Error("Not authenticated")

  const prisma = db()
  if (!prisma) throw new Error("Database not configured")

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  })

  if (!user?.subscription?.razorpaySubscriptionId) {
    throw new Error("No active subscription")
  }

  await razorpay.subscriptions.cancel(
    user.subscription.razorpaySubscriptionId,
    cancelAtCycleEnd
  )

  if (cancelAtCycleEnd) {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { cancelAtPeriodEnd: true },
    })
  } else {
    await prisma.subscription.update({
      where: { userId: user.id },
      data: { status: "cancelled", plan: "free" },
    })
  }

  return { success: true }
}

export async function handleRazorpayWebhook(body: string, signature: string) {
  if (!env.RAZORPAY_WEBHOOK_SECRET) throw new Error("Webhook secret not configured")

  const expectedSignature = crypto
    .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex")

  if (expectedSignature !== signature) {
    throw new Error("Invalid webhook signature")
  }

  const event = JSON.parse(body)
  const prisma = db()
  if (!prisma) throw new Error("Database not configured")

  if (event.event === "subscription.activated" || event.event === "subscription.charged") {
    const sub = event.payload.subscription?.entity
    if (!sub) return { received: true }

    const clerkId = sub.notes?.clerkId
    const dbUserId = sub.notes?.dbUserId

    const user = dbUserId
      ? await prisma.user.findUnique({ where: { id: dbUserId } })
      : clerkId
        ? await prisma.user.findUnique({ where: { clerkId } })
        : null

    if (!user) return { received: true }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        razorpaySubscriptionId: sub.id,
        razorpayPlanId: sub.plan_id,
        status: sub.status,
        plan: "pro",
        currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      },
      update: {
        status: sub.status,
        plan: "pro",
        razorpayPlanId: sub.plan_id,
        currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      },
    })
  }

  if (event.event === "subscription.cancelled") {
    const sub = event.payload.subscription?.entity
    if (!sub) return { received: true }

    const clerkId = sub.notes?.clerkId
    const dbUserId = sub.notes?.dbUserId

    const user = dbUserId
      ? await prisma.user.findUnique({ where: { id: dbUserId } })
      : clerkId
        ? await prisma.user.findUnique({ where: { clerkId } })
        : null

    if (!user) return { received: true }

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        razorpaySubscriptionId: sub.id,
        status: "cancelled",
        plan: "free",
      },
      update: {
        status: "cancelled",
        plan: "free",
      },
    })
  }

  if (event.event === "subscription.updated") {
    const sub = event.payload.subscription?.entity
    if (!sub) return { received: true }

    const clerkId = sub.notes?.clerkId
    const dbUserId = sub.notes?.dbUserId

    const user = dbUserId
      ? await prisma.user.findUnique({ where: { id: dbUserId } })
      : clerkId
        ? await prisma.user.findUnique({ where: { clerkId } })
        : null

    if (!user) return { received: true }

    const plan = sub.status === "active" ? "pro" : "free"

    await prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        razorpaySubscriptionId: sub.id,
        razorpayPlanId: sub.plan_id,
        status: sub.status,
        plan,
        currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      },
      update: {
        status: sub.status,
        plan,
        razorpayPlanId: sub.plan_id,
        currentPeriodStart: sub.current_start ? new Date(sub.current_start * 1000) : null,
        currentPeriodEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
      },
    })
  }

  return { received: true }
}

export async function getUserSubscription(userId: string) {
  const prisma = db()
  if (!prisma) return null

  const sub = await prisma.subscription.findUnique({ where: { userId } })
  return sub
}
