// Simple in-memory rate limiter.
// Works per-instance (serverless), which is sufficient for the family pilot.
// Upgrade to Upstash/Redis if multi-instance abuse becomes a concern.

const buckets = new Map<string, number[]>()

/**
 * Returns true if the request is allowed; false if the rate limit is exceeded.
 * @param key      Unique identifier (e.g. "child-lookup:1.2.3.4")
 * @param max      Max requests allowed in the window
 * @param windowMs Time window in milliseconds
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const prev = buckets.get(key) ?? []
  const recent = prev.filter((t) => now - t < windowMs)
  if (recent.length >= max) return false
  recent.push(now)
  buckets.set(key, recent)
  // Prevent unbounded memory growth
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k)
    }
  }
  return true
}
