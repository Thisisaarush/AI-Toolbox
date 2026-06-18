import { NextResponse } from "next/server"

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
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    )
  }

  console.error("[api-error]", err)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 },
  )
}
