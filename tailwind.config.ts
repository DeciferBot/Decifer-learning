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
        // Brand accent — orange
        brand: '#F97316',
        'brand-50': '#FFF7ED',
        'brand-600': '#EA580C',
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
        muted: '#718096',
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
