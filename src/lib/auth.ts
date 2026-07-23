import "server-only"
import { auth, verifyToken } from "@clerk/nextjs/server"

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (token) {
    try {
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      })
      if (payload?.sub) return payload.sub
    } catch {
      // Invalid/expired/forged token — fall through to null, do NOT trust it.
      return null
    }
  }

  try {
    const { userId } = await auth()
    return userId
  } catch {
    return null
  }
}
