import { z } from "zod"
import "server-only"

const envSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  GEMINI_API_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
})

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error("[env] Invalid vars:", parsed.error.flatten().fieldErrors)

    if (process.env.NODE_ENV === "production") {
      throw new Error("Invalid environment variables. Check server logs.")
    }

    const defaults: Env = {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "placeholder",
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "placeholder",
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
      STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      NODE_ENV: "development",
    }
    return defaults
  }

  return parsed.data
}

export const env = parseEnv()
