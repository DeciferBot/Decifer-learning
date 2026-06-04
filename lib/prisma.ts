import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// connection_limit=1 is required for Vercel serverless + Supabase Transaction Pooler (pgbouncer).
// Without it each function invocation tries to hold multiple connections, causing pool exhaustion
// and connection-wait latency under concurrent load.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL?.includes('pgbouncer')
          ? process.env.DATABASE_URL
          : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}pgbouncer=true&connection_limit=1`,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
