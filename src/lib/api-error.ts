import { NextResponse } from "next/server"
import * as Sentry from "@sentry/nextjs"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    // Expected/handled errors (bad input, missing key, rate limit, etc.) —
    // not worth alerting on, just return the response.
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    )
  }

  console.error("[api-error]", err)
  Sentry.captureException(err)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  )
}
