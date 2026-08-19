import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// connection_limit=1 is required for Vercel serverless + Supabase Transaction Pooler (pgbouncer).
// Without it each function invocation tries to hold multiple connections, causing pool exhaustion
// and connection-wait latency under concurrent load.
//
// Note the guard below only ADDS these params when the DSN does not already
// mention pgbouncer. A DSN that already carries its own connection_limit is
// passed through untouched, which is deliberate: the deployment owns that
// number at runtime.

/**
 * Force a small connection limit for the duration of a production build.
 *
 * A build is the one time this process fans out. Next.js runs static generation
 * across a worker per CPU, each worker is a separate process with its own
 * module scope and therefore its own Prisma client, and each client opens up to
 * `connection_limit` connections. On a 12-core machine against a DSN carrying
 * `connection_limit=10`, that is up to 120 connections chasing a Supabase
 * pooler capped at `pool_size: 15`, and the export dies with
 * "(EMAXCONNSESSION) max clients reached in session mode".
 *
 * Build-time reads are all memoised snapshots that issue a couple of queries
 * and stop, so one connection per worker is plenty. This is scoped to the build
 * phase on purpose: it does not touch the runtime pooling the deployment has
 * chosen for serving traffic.
 */
function buildTimeUrl(url: string): string {
  if (process.env.NEXT_PHASE !== 'phase-production-build') return url
  return url.includes('connection_limit=')
    ? url.replace(/connection_limit=\d+/, 'connection_limit=1')
    : `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`
}

const datasourceUrl = process.env.DATABASE_URL?.includes('pgbouncer')
  ? process.env.DATABASE_URL
  : `${process.env.DATABASE_URL}${process.env.DATABASE_URL?.includes('?') ? '&' : '?'}pgbouncer=true&connection_limit=1`

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: { url: buildTimeUrl(datasourceUrl) },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
