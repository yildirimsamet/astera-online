import { defineConfig } from 'vitest/config';

/** The calibration suite drives a real Chromium in its setup hook; pressing every control takes a while. */
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 60_000, hookTimeout: 120_000 } });
