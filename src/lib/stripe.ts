import "server-only"
import Stripe from "stripe"

let stripeInstance: Stripe | null = null

export function getStripe() {
  if (stripeInstance) return stripeInstance

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null

  stripeInstance = new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  })
  return stripeInstance
}

export async function createCheckoutSession(customerId?: string) {
  const stripe = getStripe()
  if (!stripe) throw new Error("Stripe not configured")

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID ?? "", quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/dashboard?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pricing?canceled=true`,
  })
}
