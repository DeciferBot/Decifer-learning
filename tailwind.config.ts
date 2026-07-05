import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Every colour resolves from the CSS-variable channels defined in
        // styles/tokens.css (--tw-*). Change a value there once and every
        // surface that uses these classes updates, and dark mode can override
        // the channels under a theme scope. The rgb(var(--x) / <alpha-value>)
        // form keeps opacity utilities (e.g. bg-brand/10, border-maths/20) working.
        // Values are identical to the previous hex, so light mode is unchanged.
        background: 'rgb(var(--tw-background) / <alpha-value>)',
        surface: 'rgb(var(--tw-surface) / <alpha-value>)',

        // Master brand — Ember
        ember: 'rgb(var(--tw-ember) / <alpha-value>)',
        'ember-bright': 'rgb(var(--tw-ember-bright) / <alpha-value>)',
        'ember-deep': 'rgb(var(--tw-ember-deep) / <alpha-value>)',
        brand: 'rgb(var(--tw-ember) / <alpha-value>)',           // alias of ember
        'brand-50': 'rgb(var(--tw-ember) / 0.08)',
        'brand-600': 'rgb(var(--tw-ember-deep) / <alpha-value>)',
        'brand-700': 'rgb(var(--tw-brand-700) / <alpha-value>)',
        mark: 'rgb(var(--tw-ember) / <alpha-value>)',            // mark is always Ember

        // Learning adaptation palette
        fig: 'rgb(var(--tw-fig) / <alpha-value>)',
        'fig-deep': 'rgb(var(--tw-fig-deep) / <alpha-value>)',
        teal: 'rgb(var(--tw-teal) / <alpha-value>)',
        'teal-light': 'rgb(var(--tw-teal) / 0.12)',
        rose: 'rgb(var(--tw-rose) / <alpha-value>)',
        'rose-700': 'rgb(var(--tw-rose-700) / <alpha-value>)',

        // Subject colours
        maths: 'rgb(var(--tw-maths) / <alpha-value>)',
        english: 'rgb(var(--tw-english) / <alpha-value>)',
        science: 'rgb(var(--tw-science) / <alpha-value>)',

        // Semantic
        correct: 'rgb(var(--tw-correct) / <alpha-value>)',
        'points-gold': 'rgb(var(--tw-points-gold) / <alpha-value>)',
        incorrect: 'rgb(var(--tw-incorrect) / <alpha-value>)',
        'correct-700': 'rgb(var(--tw-correct-700) / <alpha-value>)',
        'incorrect-700': 'rgb(var(--tw-incorrect-700) / <alpha-value>)',
        'points-gold-700': 'rgb(var(--tw-points-gold-700) / <alpha-value>)',

        // Rarity / difficulty tiers
        sprout: 'rgb(var(--tw-sprout) / <alpha-value>)',
        explorer: 'rgb(var(--tw-explorer) / <alpha-value>)',
        lightning: 'rgb(var(--tw-lightning) / <alpha-value>)',

        // Secondary / tertiary brand (Ember leads, Indigo anchors, Green grows)
        indigo: 'rgb(var(--tw-indigo) / <alpha-value>)',
        'indigo-deep': 'rgb(var(--tw-indigo-deep) / <alpha-value>)',
        'indigo-soft': 'rgb(var(--tw-indigo-soft) / <alpha-value>)',
        green: 'rgb(var(--tw-green) / <alpha-value>)',
        'green-deep': 'rgb(var(--tw-green-deep) / <alpha-value>)',
        'green-soft': 'rgb(var(--tw-green-soft) / <alpha-value>)',

        // Master brand accents
        azure: 'rgb(var(--tw-azure) / <alpha-value>)',
        violet: 'rgb(var(--tw-violet) / <alpha-value>)',

        // Typography
        ink: 'rgb(var(--tw-ink) / <alpha-value>)',
        'ink-2': 'rgb(var(--tw-ink-2) / <alpha-value>)',
        muted: 'rgb(var(--tw-muted) / <alpha-value>)',

        // State (aliases)
        success: 'rgb(var(--tw-correct) / <alpha-value>)',
        warning: 'rgb(var(--tw-points-gold) / <alpha-value>)',
        error: 'rgb(var(--tw-incorrect) / <alpha-value>)',
        info: 'rgb(var(--tw-azure) / <alpha-value>)',
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
