import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── BACKGROUNDS ────────────────────────────────────────────
        background: '#FDF8F2',   // warm paper (Learning adaptation)
        surface: '#FFFFFF',

        // ── MASTER BRAND — EMBER (never changes across verticals) ──
        ember: '#FB5A24',
        'ember-bright': '#FF7A4D',  // hover
        'ember-deep': '#D63F11',    // pressed
        // brand is an alias kept for backwards-compat in existing classes
        brand: '#FB5A24',
        'brand-50': 'rgba(251,90,36,0.08)',
        'brand-600': '#D63F11',    // accessible dark shade for small text
        'brand-700': '#B83300',
        mark: '#FB5A24',           // mark is always Ember

        // ── LEARNING ADAPTATION PALETTE ────────────────────────────
        fig: '#FDD868',            // streaks · badges · highlights
        'fig-deep': '#E6BC2A',
        teal: '#2EC4A0',           // progress bars · mastery
        'teal-light': 'rgba(46,196,160,0.12)',
        rose: '#F97DA8',           // encouragement · wrong answer feedback (never red for kids)

        // ── SUBJECT COLOURS ─────────────────────────────────────────
        maths: '#6C9EFF',
        english: '#FF8FAB',
        science: '#52D9A0',

        // ── SEMANTIC (master brand — domain-adaptive) ───────────────
        // For child-facing copy, use `rose` instead of `incorrect`
        correct: '#29D17C',        // mastered / positive
        'points-gold': '#F5A524',  // caution / in progress
        incorrect: '#F05452',      // data/analytics views only — use `rose` for child copy

        // ── RARITY / DIFFICULTY TIERS ───────────────────────────────
        sprout: '#A8E6CF',
        explorer: '#74C0FC',
        lightning: '#FFD43B',

        // ── MASTER BRAND ACCENTS ────────────────────────────────────
        azure: '#3E8EFF',
        violet: '#9B7CFF',

        // ── TYPOGRAPHY ──────────────────────────────────────────────
        ink: '#1F1A14',            // Learning adaptation ink (warm dark)
        'ink-2': '#5C5147',
        muted: '#9A8E82',          // ink-3

        // ── STATE ────────────────────────────────────────────────────
        success: '#29D17C',
        warning: '#F5A524',
        error: '#F05452',
        info: '#3E8EFF',
      },
      borderRadius: {
        sm: '0.5rem',      // 8px
        md: '0.625rem',    // 10px — controls/buttons
        lg: '0.875rem',    // 14px — cards (master brand)
        xl: '1.125rem',    // 18px — modals / large panels
        '2xl': '1.25rem',  // 20px — Learning adaptation (rounder = friendlier)
        '3xl': '1.5rem',   // 24px — phone mockup panels
      },
      fontFamily: {
        // Geist Sans — interface, headings, body (master brand)
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Geist Mono — numbers, data, eyebrows (master brand)
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
        // Instrument Serif italic — human insight moments only (master brand)
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        // Legacy aliases — kept so existing className="font-heading/font-body" classes don't break
        heading: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
