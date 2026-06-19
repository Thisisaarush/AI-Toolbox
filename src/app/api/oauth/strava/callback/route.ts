import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?oauth_error=strava_denied`)
  }

  let returnTo = "/"
  try {
    if (stateParam) {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString())
      returnTo = decoded.returnTo ?? "/"
    }
  } catch { /* ignore */ }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?oauth_error=not_configured`)
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    })

    const tokenData = await tokenRes.json() as {
      access_token?: string
      refresh_token?: string
      expires_at?: number
      athlete?: { firstname?: string; lastname?: string }
      errors?: unknown[]
    }

    if (tokenData.errors || !tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/?oauth_error=strava_token_failed`)
    }

    // Pass token + metadata via URL fragment (never sent to server after redirect)
    const payload = encodeURIComponent(JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete: tokenData.athlete,
    }))

    const redirectUrl = new URL(`${appUrl}${returnTo}`)
    redirectUrl.hash = `strava_token=${payload}`

    const response = NextResponse.redirect(redirectUrl.toString())
    response.cookies.set("strava_oauth_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: tokenData.expires_at
        ? tokenData.expires_at - Math.floor(Date.now() / 1000)
        : 3600,
      path: "/",
    })

    return response
  } catch {
    return NextResponse.redirect(`${appUrl}/?oauth_error=strava_network`)
  }
}
