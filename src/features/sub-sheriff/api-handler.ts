import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { handleApiError, ApiError } from "@/lib/api-error"
import { rateLimit } from "@/lib/rate-limit"
import { toMonthly } from "./types"
import type { Subscription, UsageStatus } from "./types"

const limiter = rateLimit({ max: 120, windowMs: 60000 })

// In-memory store per user (localStorage is the source of truth client-side)
const store = new Map<string, Subscription[]>()

function getStore(userId: string) {
  if (!store.has(userId)) store.set(userId, [])
  return store.get(userId)!
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`sub-sheriff:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const subs = getStore(uid)
    return NextResponse.json({ subscriptions: subs })
  } catch (err) {
    return handleApiError(err)
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    const ip = req.headers.get("x-forwarded-for") ?? "unknown"
    const uid = userId ?? ip
    const { allowed } = limiter.check(`sub-sheriff:${ip}`)
    if (!allowed) throw new ApiError("Too many requests", 429)

    const body = await req.json()
    const { action } = body

    if (action === "bulk-import") {
      // Accept array of parsed subscriptions from client
      const { subscriptions } = body
      if (!Array.isArray(subscriptions)) throw new ApiError("subscriptions array required", 400)

      const userStore = getStore(uid)
      const now = new Date().toISOString()
      const created: Subscription[] = []

      for (const s of subscriptions) {
        if (!s.name || typeof s.rawAmount !== "number") continue
        const sub: Subscription = {
          id: crypto.randomUUID(),
          name: s.name,
          url: s.url,
          amount: toMonthly(s.rawAmount, s.billingCycle ?? "monthly"),
          rawAmount: s.rawAmount,
          billingCycle: s.billingCycle ?? "monthly",
          category: s.category ?? "other",
          usageStatus: "active",
          renewalDate: s.renewalDate,
          cancelUrl: s.cancelUrl,
          createdAt: now,
          updatedAt: now,
        }
        userStore.push(sub)
        created.push(sub)
      }

      return NextResponse.json({ created: created.length, subscriptions: getStore(uid) })
    }

    if (action === "create") {
      const { name, rawAmount, billingCycle, category, renewalDate, url, cancelUrl, notes } = body
      if (!name) throw new ApiError("name required", 400)
      if (typeof rawAmount !== "number") throw new ApiError("rawAmount must be number", 400)

      const now = new Date().toISOString()
      const sub: Subscription = {
        id: crypto.randomUUID(),
        name,
        url,
        amount: toMonthly(rawAmount, billingCycle ?? "monthly"),
        rawAmount,
        billingCycle: billingCycle ?? "monthly",
        category: category ?? "other",
        usageStatus: "active",
        renewalDate,
        cancelUrl,
        notes,
        createdAt: now,
        updatedAt: now,
      }
      getStore(uid).push(sub)
      return NextResponse.json(sub)
    }

    if (action === "update-usage") {
      const { id, usageStatus } = body
      if (!id) throw new ApiError("id required", 400)
      const subs = getStore(uid)
      const sub = subs.find((s) => s.id === id)
      if (!sub) throw new ApiError("Not found", 404)
      sub.usageStatus = usageStatus as UsageStatus
      sub.updatedAt = new Date().toISOString()
      return NextResponse.json(sub)
    }

    if (action === "delete") {
      const { id } = body
      if (!id) throw new ApiError("id required", 400)
      const subs = getStore(uid)
      const idx = subs.findIndex((s) => s.id === id)
      if (idx === -1) throw new ApiError("Not found", 404)
      subs.splice(idx, 1)
      return NextResponse.json({ success: true })
    }

    throw new ApiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    return handleApiError(err)
  }
}
