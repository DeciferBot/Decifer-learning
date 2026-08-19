/**
 * Retry a database read through the connection contention a build creates.
 *
 * Next.js runs static generation across a worker per CPU. Each worker is its own
 * process with its own module scope, so its own Prisma client, and they all
 * share one Supabase pooler. Even with a small connection limit per client the
 * workers can briefly outnumber the pool, and a worker that loses that race gets
 * "(EMAXCONNSESSION) max clients reached in session mode". It clears as other
 * workers finish, so the right response is to wait and try again.
 *
 * Two rules keep this from doing harm:
 *
 *  - The total budget stays inside Next's 60-second per-page timeout for
 *    collecting page data and generating static pages. An earlier version
 *    doubled up to a 32-second step, about 64 seconds of backoff in total, so a
 *    single round of contention guaranteed the page blew the timeout and got
 *    restarted instead of recovering. Capping the step keeps the whole budget
 *    near 20 seconds.
 *  - Errors that waiting cannot fix are thrown straight away. Retrying a
 *    misconfiguration is a slow way to report the wrong problem: a missing
 *    DATABASE_URL used to burn the whole budget and then surface as a timeout,
 *    which says nothing about the actual cause.
 */

const MAX_BACKOFF_MS = 5_000

/**
 * How hard to try, by where we are.
 *
 * The generous budget belongs to the build and nowhere else. A build has no
 * user waiting on it, and the contention it hits is self-inflicted and clears
 * on its own. A live request is the opposite: these same helpers sit behind
 * POST /api/skills-check/start, which a child is waiting on, and behind the
 * public curriculum pages. Spending twelve seconds of backoff there would turn
 * a fast, honest failure into a hang.
 *
 * So: retry hard during a build, retry once at runtime to ride out a single
 * blip, and never make anybody wait longer than a second for that.
 */
const BUILD_ATTEMPTS = 6
const RUNTIME_ATTEMPTS = 2
const RUNTIME_MAX_BACKOFF_MS = 400

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build'
}

/** True for errors that more waiting cannot fix. */
function isFatalDbError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return (
    msg.includes('the URL must start with the protocol') ||
    msg.includes('Error validating datasource') ||
    msg.includes('Environment variable not found')
  )
}

export async function withDbRetry<T>(fn: () => Promise<T>, attempts?: number): Promise<T> {
  const build = isBuildPhase()
  const maxAttempts = attempts ?? (build ? BUILD_ATTEMPTS : RUNTIME_ATTEMPTS)
  const maxBackoff = build ? MAX_BACKOFF_MS : RUNTIME_MAX_BACKOFF_MS

  let lastError: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (isFatalDbError(err)) throw err
      if (i < maxAttempts - 1) {
        // Exponential backoff with jitter, capped. The jitter stops every worker
        // retrying on the same beat.
        const backoff = Math.min(500 * 2 ** i, maxBackoff)
        await new Promise((r) => setTimeout(r, backoff + Math.floor(Math.random() * 250)))
      }
    }
  }
  throw lastError
}
