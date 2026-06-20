"use client"

import { useState, useEffect } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Check, Minus, Loader2, ArrowLeft, Sparkles, Shield, Infinity, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useSubscription } from "@/components/shared/subscription-context"
import { redirectToCheckout, cancelSubscription } from "@/lib/razorpay/client"
import { useCurrency } from "@/lib/currency-context"
import { getPrice } from "@/lib/prices"

type Interval = "monthly" | "yearly"

function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

export default function PricingPage() {
  const [interval, setInterval] = useState<Interval>("monthly")
  const [loading, setLoading] = useState<string | null>(null)
  const { isSignedIn } = useUser()
  const router = useRouter()
  const { subscription } = useSubscription()
  const { format, currency, vpnLikely } = useCurrency()
  const mounted = useMounted()

  const monthlyPrice = getPrice("pro_monthly", currency.code)
  const yearlyPrice = getPrice("pro_yearly", currency.code)
  const yearlyMonthly = Math.round(yearlyPrice / 12)
  const monthlyEffective = interval === "yearly" ? yearlyMonthly : monthlyPrice

  const PLANS = [
    {
      id: "free",
      name: "Free",
      price: { monthly: 0, yearly: 0 },
      displayPrice: { monthly: "Free", yearly: "Free" },
      period: null,
      description: "Get started with all tools locally.",
      features: [
        { text: "All 75+ tools", included: true },
        { text: "Browser localStorage", included: true },
        { text: "Basic tools", included: true },
        { text: "Cloud sync", included: false },
        { text: "AI features (Gemini)", included: false },
        { text: "Premium tools", included: false },
        { text: "Priority support", included: false },
      ],
      cta: "Current plan",
      highlighted: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: { monthly: monthlyPrice, yearly: yearlyPrice },
      displayPrice: {
        monthly: mounted ? format(monthlyPrice, true) : `$${monthlyPrice}`,
        yearly: mounted ? `${format(monthlyEffective, true)}` : `$${monthlyEffective}`,
      },
      period: interval === "yearly" ? `/mo` : `/mo`,
      description: "Unlock sync, AI, and premium tools.",
      features: [
        { text: "All 75+ tools", included: true },
        { text: "Cloud sync across devices", included: true },
        { text: "All AI features (Gemini)", included: true },
        { text: "Premium tools", included: true },
        { text: "Priority support", included: true },
        { text: "Early access to new tools", included: true },
        { text: "Cancel anytime", included: true },
      ],
      cta: "Subscribe",
      highlighted: true,
    },
    {
      id: "lifetime",
      name: "Lifetime",
      price: {
        monthly: Math.round(monthlyPrice * 16.5),
        yearly: Math.round(yearlyPrice * 1.7),
      },
      displayPrice: {
        monthly: mounted ? format(Math.round(monthlyPrice * 16.5), true) : `$${Math.round(monthlyPrice * 16.5)}`,
        yearly: mounted ? format(Math.round(yearlyPrice * 1.7), true) : `$${Math.round(yearlyPrice * 1.7)}`,
      },
      period: "one-time",
      description: "One payment. Forever.",
      features: [
        { text: "All 75+ tools", included: true },
        { text: "Cloud sync across devices", included: true },
        { text: "All AI features (Gemini)", included: true },
        { text: "Premium tools", included: true },
        { text: "Priority support", included: true },
        { text: "Early access to new tools", included: true },
        { text: "No recurring payments", included: true },
      ],
      cta: "Buy Lifetime",
      highlighted: false,
    },
  ]

  async function handleSubscribe(planId: string) {
    if (!isSignedIn) {
      router.push("/sign-in?redirect=/pricing")
      return
    }

    if (planId === "free") return

    setLoading(planId)

    try {
      if (planId === "pro") {
        await redirectToCheckout({ plan: "pro", interval })
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(null)
    }
  }

  function isCurrentPlan(planId: string) {
    if (planId === "free" && subscription.plan === "free") return true
    if (planId === "pro" && subscription.plan === "pro") return true
    return false
  }

  const usdMonthly = getPrice("pro_monthly", "USD")
  const usdYearly = getPrice("pro_yearly", "USD")
  const yearlySavings = usdYearly >= usdMonthly * 12 ? 0 : usdMonthly * 12 - usdYearly

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Tools
          </Link>
          {isSignedIn && subscription.plan === "pro" && (
            <Button variant="outline" size="sm" onClick={async () => {
              try { await cancelSubscription(); window.location.reload() }
              catch (e) { console.error(e) }
            }}>
              Cancel Subscription
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        {vpnLikely && (
          <div className="max-w-2xl mx-auto mb-8 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Prices may be inaccurate.</span> We detected you may be using a VPN or proxy. Prices shown are based on your detected location. Disable your VPN for accurate local pricing.
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-4 text-xs px-3 py-1">
            <Sparkles className="w-3 h-3 mr-1" />
            Simple Pricing
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Upgrade your toolbox
          </h1>
          <p className="text-muted-foreground mt-3 max-w-md mx-auto text-sm">
            All tools are free to use locally. Upgrade for cloud sync, AI features, and premium tools.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-10">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-all font-medium",
              interval === "monthly"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={cn(
              "px-4 py-2 text-sm rounded-lg transition-all font-medium flex items-center gap-2",
              interval === "yearly"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Yearly
            <span className="text-[10px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full font-medium">
              Save up to {yearlySavings > 0 ? `${Math.round((yearlySavings / (usdMonthly * 12)) * 100)}%` : "17%"}
            </span>
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {PLANS.map((plan) => {
            const isFree = plan.id === "free"
            const isPro = plan.id === "pro"
            const isLifetime = plan.id === "lifetime"
            const current = isCurrentPlan(plan.id)

            const IconComponent = isFree ? Shield : isPro ? Sparkles : Infinity

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative flex flex-col p-6 transition-all duration-200",
                  plan.highlighted
                    ? "border-foreground/20 shadow-lg shadow-foreground/5 scale-[1.02]"
                    : "border-border/60",
                  "hover:border-foreground/20"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-foreground text-background text-xs px-3 py-0.5">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isFree && "bg-muted",
                    isPro && "bg-foreground text-background",
                    isLifetime && "bg-amber-500/10 text-amber-500"
                  )}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{plan.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    {plan.displayPrice[interval]}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm ml-1">
                      {plan.period}
                    </span>
                  )}
                  {isPro && interval === "yearly" && mounted && (
                    <div className="text-xs text-green-500 mt-0.5">
                      {format(yearlyPrice)} billed annually
                    </div>
                  )}
                  {isLifetime && (
                    <span className="text-muted-foreground text-xs ml-1 block mt-0.5">
                      {plan.period}
                    </span>
                  )}
                </div>

                <div className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <div key={feature.text} className="flex items-start gap-2.5">
                      {feature.included ? (
                        <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <Minus className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
                      )}
                      <span className={cn(
                        "text-xs",
                        feature.included ? "text-foreground" : "text-muted-foreground/50"
                      )}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>

                {current ? (
                  <Button disabled className="w-full">
                    {subscription.plan === "pro" && plan.id === "pro" && subscription.cancelAtPeriodEnd
                      ? "Re-activate"
                      : "Current Plan"}
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={loading === plan.id}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      plan.cta
                    )}
                  </Button>
                )}
              </Card>
            )
          })}
        </div>

        <div className="max-w-2xl mx-auto mt-20">
          <h2 className="text-lg font-semibold text-center mb-6">Frequently asked questions</h2>
          <div className="space-y-4">
            {[
              { q: "Can I try Pro before paying?", a: "Yes. All tools are fully functional for free with localStorage. Upgrade only when you need sync or AI features." },
              { q: "What payment methods do you accept?", a: "All major credit cards, debit cards, UPI, and local payment methods supported by Razorpay. Prices are shown in your local currency." },
              { q: "Can I cancel anytime?", a: "Yes. Cancel from your settings and your subscription stays active until the end of the billing period." },
              { q: "Is my data safe?", a: "All payment processing is handled by Razorpay (PCI DSS Level 1). We never see or store your card details. Tool data is encrypted in transit and at rest." },
            ].map((faq) => (
              <div key={faq.q} className="rounded-lg border border-border/60 p-4">
                <h3 className="text-sm font-medium mb-1">{faq.q}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
