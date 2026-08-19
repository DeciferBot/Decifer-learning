import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

// A low connection_limit matters for Vercel serverless + Supabase Transaction
// Pooler (pgbouncer): without it each function invocation tries to hold several
// connections, which exhausts the pool and adds connection-wait latency under
// concurrent load.
//
// Read the guard below carefully, because it does less than it looks like it
// does. It only APPENDS `pgbouncer=true&connection_limit=1` when the DSN does
// not already mention pgbouncer. A DSN that already says pgbouncer is passed
// through exactly as written, whatever connection_limit it carries.
//
// That is deliberate: the deployment owns its own runtime pooling. But it does
// mean the paragraph above is a statement of intent, not a guarantee. If the
// deployed DATABASE_URL sets a high connection_limit, runtime gets that high
// limit. The number lives in the environment, so it is changed there and not
// here.

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
