"use client"

import { useCurrency } from "@/lib/currency-context"
import { getPrice } from "@/lib/prices"
import { redirectToCheckout } from "@/lib/razorpay/client"

export default function PricingPage() {
  const { currency: curr, format, vpnLikely } = useCurrency()
  const code = curr.code

  const monthlyPrice = getPrice("pro_monthly", code)
  const yearlyPrice = getPrice("pro_yearly", code)

  const handleCheckout = async (interval: "monthly" | "yearly") => {
    await redirectToCheckout({ plan: "pro", interval })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {vpnLikely
            ? "Pricing shown in USD (your region could not be verified)"
            : `Pricing in ${code}`}
        </p>
      </div>

      <div className="mt-16 grid gap-8 md:grid-cols-2">
        {/* Free */}
        <div className="rounded-xl border p-8">
          <h2 className="text-2xl font-bold">Free</h2>
          <p className="mt-2 text-muted-foreground">For getting started</p>
          <p className="mt-8">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </p>
          <ul className="mt-8 space-y-3">
            <li className="flex items-center gap-2">3 tools</li>
            <li className="flex items-center gap-2">Basic features</li>
            <li className="flex items-center gap-2">Community support</li>
          </ul>
          <button
            disabled
            className="mt-8 w-full rounded-lg border px-4 py-2 text-sm font-medium opacity-50"
          >
            Current plan
          </button>
        </div>

        {/* Pro */}
        <div className="rounded-xl border border-primary p-8">
          <h2 className="text-2xl font-bold">Pro</h2>
          <p className="mt-2 text-muted-foreground">For power users</p>
          <div className="mt-8 space-y-2">
            <p>
              <span className="text-4xl font-bold">{format(monthlyPrice)}</span>
              <span className="text-muted-foreground">/month</span>
            </p>
            <p className="text-sm text-muted-foreground">
              or {format(yearlyPrice)}/year (save ~{Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)}%)
            </p>
          </div>
          <ul className="mt-8 space-y-3">
            <li className="flex items-center gap-2">All tools</li>
            <li className="flex items-center gap-2">Advanced features</li>
            <li className="flex items-center gap-2">Priority support</li>
            <li className="flex items-center gap-2">Early access to new tools</li>
          </ul>
          <div className="mt-8 space-y-3">
            <button
              onClick={() => handleCheckout("monthly")}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              Subscribe monthly — {format(monthlyPrice)}/mo
            </button>
            <button
              onClick={() => handleCheckout("yearly")}
              className="w-full rounded-lg border border-primary px-4 py-2 text-sm font-medium"
            >
              Subscribe yearly — {format(yearlyPrice)}/yr
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
