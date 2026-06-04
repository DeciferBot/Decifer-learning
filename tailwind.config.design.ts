import type { Config } from 'tailwindcss'

/**
 * DECIFER LEARNING — Tailwind CSS v3 Config Extension
 * "Where curious minds level up"
 *
 * All values mirror tokens.css exactly — single source of truth is tokens.css.
 * Update both files together when changing a token.
 *
 * Usage in component:
 *   className="bg-surface text-heading rounded-card shadow-card"
 *   className="font-display text-h2 leading-h2 tracking-h2"
 */
const config: Config = {
  content: [
    './src/**/*.{ts,tsx,js,jsx,html}',
    './app/**/*.{ts,tsx,js,jsx,html}',
    './components/**/*.{ts,tsx,js,jsx,html}',
    './pages/**/*.{ts,tsx,js,jsx,html}',
  ],
  theme: {
    extend: {

      // ── COLOURS ───────────────────────────────────────────────────────
      colors: {
        // Core brand
        background:     '#FAFBFF',
        surface:        '#FFFFFF',
        'surface-raised': '#F7F9FF',
        'surface-sunken': '#EDF2FF',

        // Subjects
        maths:          '#6C9EFF',
        'maths-bg':     '#EEF3FF',
        'maths-bdr':    '#B8D0FF',
        english:        '#FF8FAB',
        'english-bg':   '#FFF0F4',
        'english-bdr':  '#FFB3C6',
        science:        '#52D9A0',
        'science-bg':   '#EDFDF5',
        'science-bdr':  '#86EFBE',
        history:        '#9B59B6',
        'history-bg':   '#FAF5FF',
        'history-bdr':  '#D8B4FE',
        geography:      '#F97316',
        'geography-bg': '#FFF7ED',
        'geography-bdr':'#FED7AA',

        // Difficulty tiers
        sprout:         '#A8E6CF',
        explorer:       '#74C0FC',
        lightning:      '#FFD43B',

        // Gamification
        'points-gold':  '#FFC107',
        xp:             '#FFC107',
        'xp-bg':        '#FFFBEB',
        streak:         '#FF6B35',
        'streak-bg':    '#FFF4EF',
        'streak-at-risk':'#F59F00',

        // Feedback
        correct:        '#40C057',
        incorrect:      '#FF6B6B',

        // Semantic
        success:        '#40C057',
        'success-bg':   '#ECFDF5',
        'success-bdr':  '#A3E6B8',
        error:          '#FF6B6B',
        'error-bg':     '#FFF5F5',
        'error-bdr':    '#FFBDBD',
        warning:        '#F59F00',
        'warning-bg':   '#FFFBEB',
        'warning-bdr':  '#FFE08A',
        info:           '#1C7ED6',
        'info-bg':      '#EBF5FF',
        'info-bdr':     '#A5C8F0',

        // Rarity
        common:         '#94A3B8',
        'common-bg':    '#F1F5F9',
        'common-bdr':   '#CBD5E1',
        uncommon:       '#22C55E',
        'uncommon-bg':  '#F0FDF4',
        'uncommon-bdr': '#86EFAC',
        rare:           '#3B82F6',
        'rare-bg':      '#EFF6FF',
        'rare-bdr':     '#93C5FD',
        epic:           '#A855F7',
        'epic-bg':      '#FAF5FF',
        'epic-bdr':     '#D8B4FE',
        legendary:      '#F59E0B',
        'legendary-bg': '#FFFBEB',
        'legendary-bdr':'#FCD34D',

        // Guardian / Boss
        guardian:       '#5C3B8B',
        'guardian-bg':  '#F3EEFF',
        'guardian-bdr': '#C4B0E8',
        'guardian-dark':'#2D1B4E',

        // Borders
        'border-default': '#E2E8F4',
        'border-strong':  '#CBD5E8',
        'border-focus':   '#4A7FD4',
        divider:          '#EDF2F7',

        // Text
        'text-heading':     '#1A202C',
        'text-primary':     '#2D3748',
        'text-body':        '#2D3748',
        'text-secondary':   '#4A5568',
        'text-muted':       '#666666',
        'text-placeholder': '#A0AEC0',
        'text-disabled':    '#CBD5E0',
        'text-inverse':     '#FFFFFF',
        'text-link':        '#1C7ED6',
        'text-link-hover':  '#1558A8',
      },

      // ── TYPOGRAPHY ────────────────────────────────────────────────────
      fontFamily: {
        display: ['Nunito', 'system-ui', 'sans-serif'],
        body:    ['Inter',  'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },

      fontSize: {
        // format: [fontSize, { lineHeight, letterSpacing, fontWeight }]
        'display-xl': ['4.5rem',  { lineHeight: '1.0',  letterSpacing: '-0.03em' }],
        'display-lg': ['3.5rem',  { lineHeight: '1.1',  letterSpacing: '-0.02em' }],
        'h1':         ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'h2':         ['1.75rem', { lineHeight: '1.2',  letterSpacing: '-0.01em' }],
        'h3':         ['1.375rem',{ lineHeight: '1.3',  letterSpacing: '0em'     }],
        'h4':         ['1.125rem',{ lineHeight: '1.4',  letterSpacing: '0em'     }],
        'label-lg':   ['1rem',    { lineHeight: '1.4',  letterSpacing: '0.01em'  }],
        'label-md':   ['0.875rem',{ lineHeight: '1.4',  letterSpacing: '0.01em'  }],
        'label-sm':   ['0.75rem', { lineHeight: '1.4',  letterSpacing: '0.02em'  }],
        'body-lg':    ['1.125rem',{ lineHeight: '1.7',  letterSpacing: '0em'     }],
        'body-md':    ['1rem',    { lineHeight: '1.65', letterSpacing: '0em'     }],
        'body-sm':    ['0.875rem',{ lineHeight: '1.6',  letterSpacing: '0em'     }],
        'caption':    ['0.75rem', { lineHeight: '1.5',  letterSpacing: '0em'     }],
        'code':       ['0.875rem',{ lineHeight: '1.6',  letterSpacing: '0em'     }],
      },

      fontWeight: {
        'display': '800',
        'heading': '700',
        'label':   '700',
        'body':    '400',
      },

      // ── SPACING ──────────────────────────────────────────────────────
      spacing: {
        '1':   '4px',
        '2':   '8px',
        '3':  '12px',
        '4':  '16px',
        '5':  '20px',
        '6':  '24px',
        '8':  '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        // Touch target
        'touch':    '48px',
        // Layout
        'panel':    '16px',
        'panel-lg': '24px',
      },

      // ── BORDER RADIUS ─────────────────────────────────────────────────
      borderRadius: {
        'sm':     '8px',
        'chip':   '8px',
        'input':  '12px',
        'button': '12px',
        'card':   '16px',
        'lg':     '20px',
        'xl':     '28px',
        'modal':  '24px',
        'pill':   '999px',
        'avatar': '50%',
      },

      // ── BOX SHADOWS ───────────────────────────────────────────────────
      boxShadow: {
        'card':     '0 1px 3px rgba(66,100,200,0.08), 0 1px 2px rgba(66,100,200,0.04)',
        'hover':    '0 4px 12px rgba(66,100,200,0.12), 0 2px 4px rgba(66,100,200,0.06)',
        'sticky':   '0 2px 8px rgba(66,100,200,0.10), 0 1px 3px rgba(66,100,200,0.06)',
        'elevated': '0 8px 24px rgba(66,100,200,0.16), 0 3px 8px rgba(66,100,200,0.08)',
        'toast':    '0 12px 32px rgba(66,100,200,0.18), 0 4px 12px rgba(66,100,200,0.10)',
        'btn-primary': '0 4px 14px rgba(108,158,255,0.40)',
        'correct':  '0 0 0 4px rgba(64,192,87,0.25)',
        'guardian': '0 8px 32px rgba(92,59,139,0.35)',
        'focus':    '0 0 0 2px #4A7FD4',
      },

      // ── MAX WIDTHS ────────────────────────────────────────────────────
      maxWidth: {
        'content':  '428px',
        'dashboard':'1100px',
      },

      // ── Z-INDEX ───────────────────────────────────────────────────────
      zIndex: {
        'base':     '0',
        'raised':   '10',
        'sticky':   '100',
        'dropdown': '200',
        'overlay':  '300',
        'modal':    '400',
        'toast':    '500',
        'top':      '999',
      },

      // ── TRANSITIONS ───────────────────────────────────────────────────
      transitionDuration: {
        'instant': '80ms',
        'fast':   '150ms',
        'normal': '250ms',
        'slow':   '400ms',
        'dramatic':'800ms',
      },

      transitionTimingFunction: {
        'out-back':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spring':    'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'in-out':    'cubic-bezier(0.45, 0.00, 0.55, 1.00)',
        'out-expo':  'cubic-bezier(0.16, 1.00, 0.30, 1.00)',
        'out':       'cubic-bezier(0.22, 1.00, 0.36, 1.00)',
      },

      // ── ANIMATIONS ────────────────────────────────────────────────────
      keyframes: {
        // Tap feedback — all buttons
        tapScale: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(0.96)' },
        },
        // Correct answer — green pulse
        correctPulse: {
          '0%':   { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(64,192,87,0.5)' },
          '50%':  { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgba(64,192,87,0)' },
          '100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(64,192,87,0)'   },
        },
        // Wrong answer — horizontal shake
        incorrectShake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%':  { transform: 'translateX(-4px)' },
          '40%':  { transform: 'translateX(4px)'  },
          '60%':  { transform: 'translateX(-4px)' },
          '80%':  { transform: 'translateX(4px)'  },
        },
        // Points float up
        pointBurst: {
          '0%':   { opacity: '1', transform: 'translateY(0) scale(1)'    },
          '80%':  { opacity: '1', transform: 'translateY(-32px) scale(1.1)' },
          '100%': { opacity: '0', transform: 'translateY(-48px) scale(0.9)' },
        },
        // Page enter
        pageEnter: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)'    },
        },
        // Page exit
        pageExit: {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
        // Streak flame — idle breathing
        flamePulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.08) rotate(3deg)' },
        },
        // Card flip reveal
        cardFlip: {
          '0%':   { transform: 'rotateY(0deg)'   },
          '100%': { transform: 'rotateY(180deg)' },
        },
        // Guardian entrance
        guardianEnter: {
          '0%':   { opacity: '0', transform: 'translateY(40px) scale(0.8)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)'      },
        },
        // Toast slide in
        toastEnter: {
          '0%':   { opacity: '0', transform: 'translateY(-12px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)'        },
        },
        // Skeleton shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
      },

      animation: {
        'tap-scale':       'tapScale 150ms ease-in-out',
        'correct-pulse':   'correctPulse 500ms cubic-bezier(0.34,1.56,0.64,1)',
        'incorrect-shake': 'incorrectShake 400ms ease-in-out',
        'point-burst':     'pointBurst 800ms cubic-bezier(0.16,1,0.30,1) forwards',
        'page-enter':      'pageEnter 250ms cubic-bezier(0.16,1,0.30,1)',
        'page-exit':       'pageExit 200ms ease-in',
        'flame-pulse':     'flamePulse 2s ease-in-out infinite',
        'card-flip':       'cardFlip 600ms cubic-bezier(0.34,1.56,0.64,1)',
        'guardian-enter':  'guardianEnter 600ms cubic-bezier(0.34,1.56,0.64,1)',
        'toast-enter':     'toastEnter 250ms cubic-bezier(0.16,1,0.30,1)',
        'shimmer':         'shimmer 1.5s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
