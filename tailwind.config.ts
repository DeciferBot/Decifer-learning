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

        // Subject colours. These are light hues meant for tints, borders and
        // chips — never as the background under white text (white on maths is
        // 2.63:1). When a surface IS the subject colour, its text must be the
        // matching `on-*` ink below.
        maths: 'rgb(var(--tw-maths) / <alpha-value>)',
        english: 'rgb(var(--tw-english) / <alpha-value>)',
        science: 'rgb(var(--tw-science) / <alpha-value>)',
        'on-maths': 'rgb(var(--tw-on-maths) / <alpha-value>)',
        'on-english': 'rgb(var(--tw-on-english) / <alpha-value>)',
        'on-science': 'rgb(var(--tw-on-science) / <alpha-value>)',

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
      // Corners come from styles/tokens.css, not from numbers typed here.
      //
      // Before this, the config carried its own values (8/10/14/18/20/24px)
      // while tokens.css carried different ones (8/12/16/24/20/28px), and the
      // product used 14 different corner sizes including one-off 13px, 5px and
      // 3px. Pointing the config at the tokens makes the token file real: change
      // a corner there and it changes everywhere.
      borderRadius: {
        sm: 'var(--radius-sm)',        // 8px  — chips, small elements
        md: 'var(--radius-button)',    // 12px — controls, buttons, inputs
        lg: 'var(--radius-card)',      // 16px — cards
        xl: 'var(--radius-lg)',        // 20px — large cards
        '2xl': 'var(--radius-modal)',  // 24px — modals, panels, sheets
        '3xl': 'var(--radius-xl)',     // 28px — hero cards
      },

      // Motion also comes from the tokens. Five easing curves were chosen for
      // this product and then used exactly zero times, which is the single
      // biggest reason the interface feels dead: every transition in the app
      // was falling back to the browser's flat default.
      transitionTimingFunction: {
        out: 'var(--ease-out)',
        'out-expo': 'var(--ease-out-expo)',
        'out-back': 'var(--ease-out-back)',
        spring: 'var(--ease-spring)',
        'in-out': 'var(--ease-in-out)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        dramatic: 'var(--duration-dramatic)',
      },
      zIndex: {
        raised: 'var(--z-raised)',
        sticky: 'var(--z-sticky)',
        dropdown: 'var(--z-dropdown)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        top: 'var(--z-top)',
      },
      // ── Clay depth scale ────────────────────────────────────────────────
      // There was no shadow scale at all, so every surface reached for
      // Tailwind's default `shadow-sm` and the whole product read as flat
      // paperwork. A child-facing product needs objects that look pressable.
      //
      // Each step is a soft drop shadow plus an inset highlight along the top
      // edge, which is what reads as "moulded" rather than "printed". Ember,
      // Indigo and Geist are untouched: this is depth, not repaint.
      boxShadow: {
        'clay-sm': '0 2px 0 0 rgb(0 0 0 / 0.06), 0 4px 10px -4px rgb(49 46 129 / 0.12), inset 0 1px 0 0 rgb(255 255 255 / 0.7)',
        clay: '0 4px 0 0 rgb(0 0 0 / 0.06), 0 10px 20px -8px rgb(49 46 129 / 0.16), inset 0 2px 0 0 rgb(255 255 255 / 0.75)',
        'clay-lg': '0 6px 0 0 rgb(0 0 0 / 0.07), 0 18px 34px -12px rgb(49 46 129 / 0.2), inset 0 2px 0 0 rgb(255 255 255 / 0.8)',
        // Pressed: the object sinks, so the drop edge shrinks and the highlight
        // flips to a shading from above.
        'clay-pressed': '0 1px 0 0 rgb(0 0 0 / 0.06), inset 0 3px 6px -2px rgb(49 46 129 / 0.22)',
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
