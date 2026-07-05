#!/usr/bin/env node
/*
 * Brand-hex guardrail.
 *
 * Brand chrome colours (the Ember family) and the deprecated oranges must not
 * be hardcoded as hex in the app. Use the colour class (e.g. text-brand,
 * bg-brand) or the CSS variable var(--brand), so every surface resolves from
 * the one source of truth in styles/tokens.css and follows the theme.
 *
 * Raw hex stays allowed where variables cannot reach: illustrations, avatars,
 * data-viz, transactional emails, the canonical mark, and a few config literals
 * (see ALLOW). This is why the check targets the specific brand hexes rather
 * than banning all hex.
 */
import fs from 'node:fs'
import path from 'node:path'

const BANNED = [
  // deprecated oranges — the "three oranges" drift, never again
  'F05A28', 'F97316', 'EA580C', 'FFF7ED',
  // brand chrome (Ember family) — must be the token, not a literal
  'FB5A24', 'FF7A4D', 'D63F11', 'B83300',
]
const bannedRe = new RegExp('#(' + BANNED.join('|') + ')\\b', 'i')

// Legitimate literal-colour contexts, where a token cannot reach.
const ALLOW = [
  /components\/learn\//,        // diagrams and widgets — illustrations
  /components\/explore\//,      // 3D / canvas visualisations
  /components\/ui\/DeciferMark\.tsx$/,   // the canonical mark colour lives here once
  /components\/ui\/DeciferAvatar\.tsx$/, // avatar palette
  /lib\/avatar-catalogue\.ts$/,
  /lib\/og\.tsx$/,
  /lib\/(engagement-emails|parent-notify|parent-verification|pipeline-alert)\.ts$/,
  /app\/api\//,                 // transactional email HTML (email clients can't read CSS vars)
  /app\/layout\.tsx$/,          // themeColor meta must be a literal hex
  /app\/\(child\)\/customise\/page\.tsx$/, // theme-picker swatch data
  /app\/\(child\)\/profile\/page\.tsx$/,   // avatar accent map
]

const roots = ['app', 'components', 'lib']
const offenders = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') walk(p)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    const rel = p.replace(/\\/g, '/')
    if (ALLOW.some((re) => re.test(rel))) continue
    const lines = fs.readFileSync(p, 'utf8').split('\n')
    lines.forEach((line, i) => {
      // a token fallback like var(--brand, #FB5A24) is fine — strip it before testing
      const stripped = line.replace(/,\s*#[0-9a-fA-F]{6}\s*\)/g, ')')
      if (bannedRe.test(stripped)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`)
    })
  }
}
roots.forEach((r) => {
  if (fs.existsSync(r)) walk(r)
})

if (offenders.length) {
  console.error('\nBrand-hex guardrail failed. Use a colour class (text-brand) or var(--brand), not a hardcoded hex:\n')
  offenders.forEach((o) => console.error('  ' + o))
  console.error(
    `\n${offenders.length} offender(s). If a use is genuinely a literal (illustration, avatar, ` +
      `data-viz, email), add its path to ALLOW in scripts/check-brand-hex.mjs.\n`,
  )
  process.exit(1)
}
console.log('Brand-hex guardrail passed: no hardcoded brand chrome or deprecated oranges.')
