import { NextResponse } from "next/server"

type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string }

export function ok<T>(data: T, status = 200) {
  const body: ApiResponse<T> = { success: true, data }
  return NextResponse.json(body, { status })
}

export function err(error: string, status = 400) {
  const body: ApiResponse = { success: false, error }
  return NextResponse.json(body, { status })
}

export function unauthorized() {
  return err("Unauthorized", 401)
}

export function notFound(message = "Not found") {
  return err(message, 404)
}

export function serverError() {
  return err("Internal server error", 500)
}

export async function parseBody<T>(req: Request): Promise<T> {
  try {
    return await req.json()
  } catch {
    throw new Error("Invalid JSON body")
  }
}
