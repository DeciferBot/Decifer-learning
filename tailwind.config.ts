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
        maths: '#6C9EFF',
        english: '#FF8FAB',
        science: '#52D9A0',
        sprout: '#A8E6CF',
        explorer: '#74C0FC',
        lightning: '#FFD43B',
        'points-gold': '#FFC107',
        correct: '#40C057',
        incorrect: '#FF6B6B',
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
