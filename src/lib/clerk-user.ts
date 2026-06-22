import { verifyToken } from "@clerk/nextjs/server"
import { env } from "@/lib/env"

function getCookie(name: string, cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1] ?? "") : null
}

export async function getSessionUserId(req: Request): Promise<string | null> {
  const sessionToken = getCookie("__session", req.headers.get("cookie"))
  if (!sessionToken) return null
  try {
    const payload = await verifyToken(sessionToken, {
      secretKey: env.CLERK_SECRET_KEY,
    })
    return (payload as any).sub ?? null
  } catch (err) {
    return null
  }
}
