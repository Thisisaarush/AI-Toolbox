type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  [key: string]: unknown
}

let requestIdCounter = 0

export function generateRequestId(): string {
  requestIdCounter++
  return `req-${Date.now()}-${requestIdCounter}`
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const isClient = typeof window !== "undefined"

  if (isClient) {
    if (level === "error") {
      console.error(`[${level}] ${message}`, meta ?? "")
    } else if (level === "warn") {
      console.warn(`[${level}] ${message}`, meta ?? "")
    }
    return
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  }

  const output = JSON.stringify(entry)

  if (level === "error" || level === "warn") {
    process.stderr.write(output + "\n")
  } else {
    process.stdout.write(output + "\n")
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
}
