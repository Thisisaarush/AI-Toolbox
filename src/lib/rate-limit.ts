const rateMap = new Map<string, { count: number; reset: number }>()

// Extracts the client's real IP from the x-forwarded-for header.
//
// x-forwarded-for is a comma-separated list of IPs, each proxy in the chain
// appending the address it saw the request arrive from. A client can send
// their own fake x-forwarded-for header — but the platform's edge (Vercel)
// appends the *real* connecting IP as the LAST entry when it forwards the
// request, so anything before that last entry is attacker-controlled and
// must not be trusted. Naively taking the first entry (a common mistake)
// makes rate limiting trivially bypassable.
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const ips = forwardedFor.split(",").map((ip) => ip.trim())
    const lastIp = ips[ips.length - 1]
    if (lastIp) return lastIp
  }
  // Fallback for platforms that expose a direct real-ip header instead.
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

export function rateLimit(options: { max?: number; windowMs?: number } = {}) {
  const { max = 10, windowMs = 60000 } = options

  return {
    check: (identifier: string): { allowed: boolean; remaining: number; reset: number } => {
      const now = Date.now()
      const entry = rateMap.get(identifier)

      if (!entry || now > entry.reset) {
        rateMap.set(identifier, { count: 1, reset: now + windowMs })
        return { allowed: true, remaining: max - 1, reset: now + windowMs }
      }

      entry.count++

      if (entry.count > max) {
        return { allowed: false, remaining: 0, reset: entry.reset }
      }

      return { allowed: true, remaining: max - entry.count, reset: entry.reset }
    },
  }
}
