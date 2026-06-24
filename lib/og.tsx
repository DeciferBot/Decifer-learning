import { ImageResponse } from 'next/og'

// Shared Open Graph card renderer for DECIFER Learning.
// Every page that wants its own WhatsApp / social preview re-uses this so the
// brand design stays identical and only the copy changes.

export const ogSize = { width: 1200, height: 630 }
export const ogContentType = 'image/png'

export type OgCardConfig = {
  /** First headline line (dark). */
  headlineTop: string
  /** Second headline line (orange). */
  headlineBottom: string
  /** Supporting line under the headline. */
  subtitle: string
  /** Up to four short pills along the bottom. */
  pills: string[]
  /** Accent colour for the bar, second headline, brand mark and pills. Defaults to brand orange. */
  accent?: string
  /** Soft tint behind pills, paired with `accent`. Defaults to the orange tint. */
  pillTint?: string
  /** Word shown after the DECIFER mark (e.g. "Learning" or "Blitz"). */
  brandWord?: string
}

// Decifer Blitz purple — matches the in-app Blitz button (#7C3AED).
export const BLITZ_ACCENT = '#7C3AED'
export const BLITZ_TINT = '#F3EEFC'

/**
 * The shared Blitz social card. Every Blitz surface (/blitz, /play, /join,
 * /live/[gameId]) renders this so a shared game link previews as Blitz — not
 * the home page card. Keep the copy here so all four stay identical.
 */
export function renderBlitzOgCard() {
  return renderOgCard({
    headlineTop: 'Join my',
    headlineBottom: 'Decifer Blitz!',
    subtitle: 'A live, Kahoot-style quiz battle. Tap the link, pick a nickname, play — no account needed.',
    pills: ['Live quiz', 'No sign-up', 'Any device', 'UK curriculum'],
    accent: BLITZ_ACCENT,
    pillTint: BLITZ_TINT,
    brandWord: 'Blitz',
  })
}

export function renderOgCard(config: OgCardConfig) {
  const {
    headlineTop,
    headlineBottom,
    subtitle,
    pills,
    accent = '#F05A28',
    pillTint = '#FEF0E8',
    brandWord = 'Learning',
  } = config

  return new ImageResponse(
    (
      <div
        style={{
          background: '#FAFBFF',
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Orange left bar */}
        <div
          style={{
            width: 10,
            height: '100%',
            background: accent,
            flexShrink: 0,
            display: 'flex',
          }}
        />

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 72px',
          }}
        >
          {/* Brand row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                background: accent,
                borderRadius: 8,
                padding: '6px 14px',
                color: '#fff',
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: '0.06em',
                display: 'flex',
              }}
            >
              DECIFER
            </div>
            <div
              style={{
                color: '#1a1f36',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.03em',
                display: 'flex',
              }}
            >
              {brandWord}
            </div>
          </div>

          {/* Headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <span
                style={{
                  color: '#0f1623',
                  fontSize: 68,
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: '-0.025em',
                  display: 'flex',
                }}
              >
                {headlineTop}
              </span>
              <span
                style={{
                  color: accent,
                  fontSize: 68,
                  fontWeight: 800,
                  lineHeight: 1.08,
                  letterSpacing: '-0.025em',
                  display: 'flex',
                }}
              >
                {headlineBottom}
              </span>
            </div>
            <div
              style={{
                color: '#5a6379',
                fontSize: 25,
                fontWeight: 400,
                maxWidth: 620,
                display: 'flex',
              }}
            >
              {subtitle}
            </div>
          </div>

          {/* Bottom pills + domain */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {pills.map((label) => (
                <div
                  key={label}
                  style={{
                    background: pillTint,
                    border: `1.5px solid ${accent}40`,
                    borderRadius: 20,
                    padding: '8px 18px',
                    color: accent,
                    fontSize: 17,
                    fontWeight: 600,
                    display: 'flex',
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div style={{ color: '#9ba3b8', fontSize: 18, fontWeight: 500, display: 'flex' }}>
              deciferlearning.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...ogSize }
  )
}
