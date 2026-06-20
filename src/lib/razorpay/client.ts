export async function redirectToCheckout(options: { plan?: string; interval?: string }) {
  const res = await fetch("/api/razorpay/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to start checkout")
  }

  const { short_url } = await res.json()
  if (short_url) window.location.href = short_url
}

export async function cancelSubscription() {
  const res = await fetch("/api/razorpay/cancel", { method: "POST" })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? "Failed to cancel subscription")
  }

  return res.json()
}
