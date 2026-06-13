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
}

export function renderOgCard(config: OgCardConfig) {
  const { headlineTop, headlineBottom, subtitle, pills } = config

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
            background: '#F05A28',
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
                background: '#F05A28',
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
              Learning
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
                  color: '#F05A28',
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
                    background: '#FEF0E8',
                    border: '1.5px solid rgba(240,90,40,0.25)',
                    borderRadius: 20,
                    padding: '8px 18px',
                    color: '#CC4A21',
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
