export async function redirectToCheckout(options: { plan?: string; interval?: string; token?: string | null }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`

  const res = await fetch("/api/razorpay/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: options.plan, interval: options.interval }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to start checkout")
  }

  const { short_url } = await res.json()
  if (short_url) window.location.href = short_url
}

export async function cancelSubscription(token?: string | null) {
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch("/api/razorpay/cancel", { method: "POST", headers })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to cancel subscription")
  }

  return res.json()
}
