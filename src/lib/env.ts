import { z } from "zod"
import "server-only"

const envSchema = z.object({
  DATABASE_URL: z.string().url().min(1),
  GEMINI_API_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_PLAN_ID_PRO_MONTHLY: z.string().optional(),
  RAZORPAY_PLAN_ID_PRO_YEARLY: z.string().optional(),
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
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      RAZORPAY_PLAN_ID_PRO_MONTHLY: process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY,
      RAZORPAY_PLAN_ID_PRO_YEARLY: process.env.RAZORPAY_PLAN_ID_PRO_YEARLY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      NODE_ENV: "development",
    }
    return defaults
  }

  return parsed.data
}

export const env = parseEnv()
