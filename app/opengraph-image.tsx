import { ImageResponse } from 'next/og'

export const alt = 'DECIFER Learning — UK National Curriculum for Families'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#FAFBFF',
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Orange left accent bar */}
        <div
          style={{
            width: 8,
            height: '100%',
            background: 'linear-gradient(180deg, #F05A28 0%, #f47040 100%)',
            flexShrink: 0,
          }}
        />

        {/* Main content */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '64px 72px',
          }}
        >
          {/* Top: brand */}
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
              }}
            >
              Learning
            </div>
          </div>

          {/* Centre: headline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div
              style={{
                color: '#0f1623',
                fontSize: 68,
                fontWeight: 800,
                lineHeight: 1.08,
                letterSpacing: '-0.025em',
              }}
            >
              Build confidence,
              <br />
              <span style={{ color: '#F05A28' }}>one topic at a time.</span>
            </div>
            <div
              style={{
                color: '#5a6379',
                fontSize: 26,
                fontWeight: 400,
                lineHeight: 1.45,
                maxWidth: 640,
              }}
            >
              AI-assisted learning for the UK National Curriculum.
              Game-like motivation for Year 3 and Year 7.
            </div>
          </div>

          {/* Bottom: year badges + domain */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              {['Year 3', 'Year 7', 'Parents', 'Progress'].map((label) => (
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
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
            <div style={{ color: '#9ba3b8', fontSize: 19, fontWeight: 500 }}>
              deciferlearning.com
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
