import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Unit tests run in jsdom; integration tests talk to Prisma and need node.
    environmentMatchGlobs: [
      ['tests/integration/**', 'node'],
      ['tests/**', 'jsdom'],
    ],
    // Integration tests share one SQLite file — parallel writes would collide.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['lib/automation/**/*.ts'],
      thresholds: { statements: 100, branches: 90, functions: 100, lines: 100 },
    },
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
