import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth not configured. Add GITHUB_CLIENT_ID to your environment variables." },
      { status: 503 }
    )
  }

  const url = new URL(req.url)
  const returnTo = url.searchParams.get("returnTo") ?? "/"

  const state = Buffer.from(JSON.stringify({ returnTo, ts: Date.now() })).toString("base64url")

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/github/callback`

  const githubUrl = new URL("https://github.com/login/oauth/authorize")
  githubUrl.searchParams.set("client_id", clientId)
  githubUrl.searchParams.set("redirect_uri", redirectUri)
  githubUrl.searchParams.set("scope", "repo public_repo")
  githubUrl.searchParams.set("state", state)

  return NextResponse.redirect(githubUrl.toString())
}
