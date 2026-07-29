import { defineConfig } from 'vitest/config';

/**
 * Tests cover the pure logic modules (src/desktop, src/ai) — the rules that
 * are easy to break silently and expensive to catch by hand. React components
 * are verified end-to-end in a browser instead, which is where their real
 * failure modes (clipping, hit targets, event races) actually show up.
 *
 * Node environment with a small globals shim beats pulling in jsdom: these
 * modules touch only localStorage, a single document query, and vibrate.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'packages/**/src/**/*.test.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
