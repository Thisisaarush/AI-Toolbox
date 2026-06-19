import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "Strava OAuth not configured. Add STRAVA_CLIENT_ID to your environment variables." },
      { status: 503 }
    )
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get("returnTo") ?? "/"
  const state = Buffer.from(JSON.stringify({ returnTo, ts: Date.now() })).toString("base64url")
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/strava/callback`

  const stravaUrl = new URL("https://www.strava.com/oauth/authorize")
  stravaUrl.searchParams.set("client_id", clientId)
  stravaUrl.searchParams.set("response_type", "code")
  stravaUrl.searchParams.set("redirect_uri", redirectUri)
  stravaUrl.searchParams.set("approval_prompt", "auto")
  stravaUrl.searchParams.set("scope", "activity:read_all")
  stravaUrl.searchParams.set("state", state)

  return NextResponse.redirect(stravaUrl.toString())
}
