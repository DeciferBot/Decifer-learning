import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  // tsconfig sets jsx:"preserve" for Next's own compiler, which leaves raw
  // JSX in Vite's transform output — unparseable when a test imports a .tsx
  // module. The oxc transform re-reads that tsconfig per file, so the only
  // override that sticks is turning its tsconfig discovery off and asking
  // for the automatic JSX runtime directly. (The legacy `esbuild` option is
  // ignored by Vite 8+, which transforms with oxc.) Vite's OxcOptions type
  // omits `tsconfig` even though the runtime forwards it to the transform,
  // hence the spread-through-object cast.
  oxc: { jsx: { runtime: 'automatic' }, ...({ tsconfig: false } as object) },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
