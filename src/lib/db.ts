import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export function db() {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  const url = process.env.DATABASE_URL
  if (!url) return null

  const client = new PrismaClient({
    adapter: new PrismaPg(url),
  })
  globalForPrisma.prisma = client
  return client
}
