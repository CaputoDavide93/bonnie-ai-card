/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for bonnie-ai-card unit tests.
 *
 * Tests run in jsdom (we exercise DOMPurify + browser-shape APIs).
 * The card source is TypeScript-only; vitest handles transpile through
 * esbuild without a separate rollup pass.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globals: false,
  },
})
