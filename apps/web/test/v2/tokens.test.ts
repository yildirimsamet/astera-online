import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * THE GÖZLEMEVİ PALETTE, HELD TO THE SPEC. docs/ui-v2/gozlemevi.md, "On anlam, on renk".
 *
 * Ten hues and each one means exactly one thing: red is something happening to you,
 * teal is you and your move, blue is your clan. The v2 tokens live beside the
 * current theme until F10, so they carry a `v2-` prefix and may never reuse a name
 * the current theme already publishes — two different ambers under one name is the
 * drift `palette.test.ts` was written to stop.
 */

const tokensCss = readFileSync('src/v2/tokens.css', 'utf8');
const styles = readFileSync('src/styles.css', 'utf8');

const SPEC: Record<string, string> = {
  'v2-void': '#04060b',
  'v2-deep': '#080d18',
  'v2-panel': '#0d1422',
  'v2-raise': '#131c2f',
  'v2-line': '#1d2842',
  'v2-line-hi': '#2c3c60',
  'v2-ink': '#eef3ff',
  'v2-ink-2': '#a4b1cd',
  'v2-ink-3': '#66738f',
  'v2-self': '#2ee6c8',
  'v2-self-ink': '#032520',
  'v2-ally': '#5b8cff',
  'v2-neutral': '#8c97ad',
  'v2-rival': '#f25cd3',
  'v2-hostile': '#ff4b4b',
  'v2-warn': '#ffcc4d',
  'v2-alloy': '#f2a14a',
  'v2-crystal': '#7fd0ff',
  'v2-deut': '#a8ea4c',
  'v2-premium': '#e6c77e',
};

const declared = (css: string, name: string): string[] =>
  [...css.matchAll(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'g'))].map((m) => m[1] ?? '');

type Rgb = readonly [number, number, number];
const rgb = (hex: string): Rgb => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]: Rgb): number => {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [luminance(rgb(a)), luminance(rgb(b))];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe('the v2 palette', () => {
  it('is imported by the stylesheet Tailwind builds', () => {
    expect(styles).toContain("@import './v2/tokens.css';");
  });

  it.each(Object.entries(SPEC))('states %s once, at the spec value', (name, hex) => {
    expect(declared(tokensCss, name)).toEqual([hex]);
  });

  it('never reuses a name the current theme publishes', () => {
    const v2Names = [...tokensCss.matchAll(/--([a-z]+-[\w-]+):/g)].map((m) => m[1] ?? '');
    expect(v2Names.length).toBeGreaterThan(0);
    for (const name of v2Names) {
      expect(name, `${name} must be v2-prefixed`).toMatch(/^[a-z]+-v2(-|$)/);
      expect(styles.includes(`--${name}:`), `${name} is already in styles.css`).toBe(false);
    }
  });

  /** Five marks, five hues, none of them a colour the disc already spends (K2). */
  it('keeps five rival slots apart from every other meaning', () => {
    const slots = [1, 2, 3, 4, 5].map((i) => declared(tokensCss, `v2-rival-${String(i)}`)[0] ?? '');
    expect(new Set(slots).size).toBe(5);
    const others = Object.entries(SPEC).filter(([name]) => name !== 'v2-rival').map(([, hex]) => hex);
    for (const slot of slots) expect(others).not.toContain(slot);
  });

  it('keeps every ink readable on the panel it sits on', () => {
    expect(contrast(SPEC['v2-ink'] ?? '', SPEC['v2-panel'] ?? '')).toBeGreaterThanOrEqual(12);
    expect(contrast(SPEC['v2-ink-2'] ?? '', SPEC['v2-panel'] ?? '')).toBeGreaterThanOrEqual(7);
    expect(contrast(SPEC['v2-ink-3'] ?? '', SPEC['v2-panel'] ?? '')).toBeGreaterThanOrEqual(3.5);
    expect(contrast(SPEC['v2-self-ink'] ?? '', SPEC['v2-self'] ?? '')).toBeGreaterThanOrEqual(7);
  });
});

describe('v2 code names colours only through tokens', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : [path];
    });

  it('writes no raw hex or rgb literal outside tokens.css', () => {
    const offenders = files('src/v2')
      .filter((path) => /\.(tsx?|css)$/.test(path) && !path.endsWith('tokens.css'))
      .filter((path) => /#[0-9a-f]{3,8}\b|rgba?\(/i.test(readFileSync(path, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
