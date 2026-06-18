const rateMap = new Map<string, { count: number; reset: number }>()

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
