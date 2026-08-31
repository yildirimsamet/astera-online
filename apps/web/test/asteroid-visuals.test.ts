import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ASTEROID_RIM_EXPANSION,
  ASTEROID_RIM_OPACITY,
} from '../src/galaxy/Asteroids.js';
import { asteroidRimColour } from '../src/galaxy/asteroidSignal.js';

describe('the asteroid silhouette rim', () => {
  it('expands the real rock geometry by a light, narrow amount', () => {
    expect(ASTEROID_RIM_EXPANSION).toBeGreaterThan(0);
    expect(ASTEROID_RIM_EXPANSION).toBeLessThan(0.1);
  });

  it('keeps the neon rim plainly visible against the dark galaxy', () => {
    expect(ASTEROID_RIM_OPACITY).toBeGreaterThanOrEqual(0.7);
    expect(ASTEROID_RIM_OPACITY).toBeLessThan(0.85);
  });

  it('keeps ordinary rocks visible and preserves the isotope signal', () => {
    expect(asteroidRimColour(false)).toMatch(/^#[0-9a-f]{6}$/i);
    expect(asteroidRimColour(true)).toBe('#8eea36');
    expect(asteroidRimColour(false)).not.toBe(asteroidRimColour(true));
  });

  it('renders an instanced back-face rim, so visibility does not add one draw call per rock', () => {
    const source = readFileSync('src/galaxy/Asteroids.tsx', 'utf8');
    expect(source).toContain('name="asteroid-rims"');
    expect(source).toMatch(/name="asteroid-rims"[\s\S]*?raycast=\{\(\) => null\}/);
    expect(source).toContain('side: THREE.BackSide');
    expect(source).toContain('instanceMatrix * expanded');
  });
});

describe('the native scrollbar', () => {
  it('uses the game palette in Firefox and Chromium/WebKit', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).toMatch(/scrollbar-color:\s*var\(--color-crystal\)\s+var\(--color-deep\)/);
    expect(css).toContain('::-webkit-scrollbar-thumb');
    expect(css).toContain('var(--color-crystal)');
    expect(css).toContain('::-webkit-scrollbar-track');
    expect(css).toContain('var(--color-deep)');
  });
});
