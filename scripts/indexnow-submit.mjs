#!/usr/bin/env node
/**
 * Submit the site's sitemap URLs to IndexNow.
 *
 * Why this exists: Google does not participate in IndexNow and never has, so
 * this does nothing for Google Search. It reaches Bing, Yandex, Naver,
 * Seznam, Yep and Amazon, and one submission propagates to all of them.
 *
 * The reason it is worth running anyway is Bing specifically. ChatGPT search
 * leans on Bing's index, and Analytics already shows a real visitor arriving
 * from chatgpt.com, so getting pages into Bing quickly is the one lever we
 * have on that channel. Treat the ChatGPT link as plausible rather than
 * documented: OpenAI has never confirmed an IndexNow dependency.
 *
 * Usage:
 *   node scripts/indexnow-submit.mjs            # submit every sitemap URL
 *   node scripts/indexnow-submit.mjs <url> ...  # submit specific URLs
 *
 * The key file must stay reachable at https://<HOST>/<KEY>.txt containing
 * exactly the key, or submissions return 403.
 */

const HOST = 'www.deciferlearning.com'
const KEY = '02155323c4767db5c5fb261f20f8d79c'
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const MAX_URLS = 10_000 // IndexNow's documented per-request limit

async function sitemapUrls() {
  const res = await fetch(`https://${HOST}/sitemap.xml`)
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`)
  const xml = await res.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
}

async function main() {
  const explicit = process.argv.slice(2)
  const urlList = explicit.length > 0 ? explicit : await sitemapUrls()

  if (urlList.length === 0) {
    console.error('No URLs to submit.')
    process.exit(1)
  }
  if (urlList.length > MAX_URLS) {
    console.error(`${urlList.length} URLs exceeds the ${MAX_URLS} per-request limit.`)
    process.exit(1)
  }

  // Guard against a 422: every URL must be on the same host as `host`.
  const offHost = urlList.filter((u) => new URL(u).host !== HOST)
  if (offHost.length > 0) {
    console.error(`These URLs are not on ${HOST}:\n  ${offHost.join('\n  ')}`)
    process.exit(1)
  }

  const keyUrl = `https://${HOST}/${KEY}.txt`
  const keyCheck = await fetch(keyUrl)
  const keyBody = keyCheck.ok ? (await keyCheck.text()).trim() : ''
  if (keyBody !== KEY) {
    console.error(
      `Key file check failed at ${keyUrl} (HTTP ${keyCheck.status}). ` +
        'IndexNow returns 403 without it. Deploy before submitting.',
    )
    process.exit(1)
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: keyUrl, urlList }),
  })

  // 200 accepted, 202 accepted with key validation pending. Both are fine.
  const ok = res.status === 200 || res.status === 202
  console.log(`Submitted ${urlList.length} URLs — HTTP ${res.status}${ok ? ' (accepted)' : ''}`)
  if (!ok) {
    const meaning =
      { 400: 'invalid format', 403: 'key not found or invalid', 422: 'URL/host mismatch', 429: 'rate limited' }[
        res.status
      ] ?? 'unexpected'
    console.error(`Failed: ${meaning}. Body: ${await res.text()}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
