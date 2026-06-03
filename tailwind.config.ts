import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#FAFBFF',
        surface: '#FFFFFF',
        // DECIFER master mark orange — consistent across all products
        mark: '#F05A28',
        // Brand accent — aligned to DECIFER mark orange
        brand: '#F05A28',
        'brand-50': '#FEF0E8',
        // brand-600/700 are the accessible button shades (≥4.5:1 with white)
        'brand-600': '#B83A14',
        'brand-700': '#9A2E10',
        // Subject colours
        maths: '#6C9EFF',
        english: '#FF8FAB',
        science: '#52D9A0',
        // Rarity / difficulty tiers
        sprout: '#A8E6CF',
        explorer: '#74C0FC',
        lightning: '#FFD43B',
        // Feedback & gamification
        'points-gold': '#FFC107',
        correct: '#40C057',
        incorrect: '#FF6B6B',
        // Typography
        ink: '#2D3748',
        muted: '#666666', // 5.55:1 on #FAFBFF bg — passes WCAG AA with margin
        // State colours
        success: '#0dc47c',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        heading: ['var(--font-nunito)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
