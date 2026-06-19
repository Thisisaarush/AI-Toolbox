/**
 * Client-side wrapper for AI API calls.
 *
 * Automatically reads the user's Gemini API key from localStorage and sends
 * it as X-API-Key header. If the server returns 402 (api_key_required),
 * throws an AiKeyError so callers can show a consistent "add your key" message.
 */

export class AiKeyError extends Error {
  constructor() {
    super("api_key_required")
    this.name = "AiKeyError"
  }
}

function getStoredKey(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("toolbox-gemini-key")
}

export async function aiFetch(
  url: string,
  body: Record<string, unknown>,
  method: "POST" | "GET" = "POST",
): Promise<Response> {
  const key = getStoredKey()

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "X-API-Key": key } : {}),
    },
    body: method === "GET" ? undefined : JSON.stringify(body),
  })

  if (res.status === 402) {
    throw new AiKeyError()
  }

  return res
}

/** Returns true if the user has configured their own API key */
export function hasApiKey(): boolean {
  return !!getStoredKey()
}
