import "server-only"
import { auth } from "@clerk/nextjs/server"

function decodeToken(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  } catch {
    return null
  }
}

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization")
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null
  if (token) {
    const payload = decodeToken(token)
    if (payload?.sub) return payload.sub as string
  }

  try {
    const { userId } = await auth()
    return userId
  } catch {
    return null
  }
}
