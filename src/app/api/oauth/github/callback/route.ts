import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const stateParam = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/?oauth_error=github_denied`)
  }

  let returnTo = "/"
  try {
    if (stateParam) {
      const decoded = JSON.parse(Buffer.from(stateParam, "base64url").toString())
      returnTo = decoded.returnTo ?? "/"
    }
  } catch { /* ignore */ }

  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?oauth_error=not_configured`)
  }

  // Exchange code for access token
  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/oauth/github/callback`,
      }),
    })

    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/?oauth_error=github_token_failed`)
    }

    // Redirect back to the tool with token in fragment (never sent to server)
    // The client JS reads it, stores in localStorage, removes from URL
    const redirectUrl = new URL(`${appUrl}${returnTo}`)
    redirectUrl.hash = `github_token=${tokenData.access_token}`

    const response = NextResponse.redirect(redirectUrl.toString())

    // Also set a short-lived cookie as backup (httpOnly, 1 hour)
    response.cookies.set("github_oauth_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600,
      path: "/",
    })

    return response
  } catch {
    return NextResponse.redirect(`${appUrl}/?oauth_error=github_network`)
  }
}
