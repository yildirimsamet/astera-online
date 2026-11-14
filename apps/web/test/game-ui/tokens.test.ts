import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ONE PLACE FOR EVERY GAME-KIT COLOUR. The kit's palette lives in
 * `src/game-ui/tokens.css`, each colour with one meaning; every other kit file and
 * the kit gallery refer to it by name, so a hue cannot drift on one surface.
 */

const KIT = 'src/game-ui';
const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]);

describe('the game kit palette', () => {
  const tokens = readFileSync(join(KIT, 'tokens.css'), 'utf8');

  it.each([
    ['action', 'the one primary action'],
    ['self', 'you and your selection'],
    ['hostile', 'the enemy and harm'],
    ['good', 'strong and progress'],
    ['warn', 'a risk you can still avoid'],
    ['info', 'panel edges and information'],
  ])('names the %s role (%s)', (role) => {
    expect(tokens).toMatch(new RegExp(`--gk-${role}:`));
  });

  it('sets the narrow bold Saira as the one display face (owner 2026-11-12, look 2.9 "Komuta")', () => {
    expect(tokens).toMatch(/--gk-font-display:\s*'Saira Variable'/);
    expect(tokens).toMatch(/--gk-display-weight:\s*700/);
    expect(tokens).toMatch(/--gk-display-stretch:\s*84%/);
    expect(readFileSync(join(KIT, 'game-ui.css'), 'utf8')).not.toMatch(/russo-one/);
  });

  /**
   * Owner 2026-11-14 picked "Gözlemevi" from four palettes (Grafit, Gözlemevi, Kobalt krom,
   * Gece altını): the kit's plates take the v2 navy, so a panel on the kit and a v2 page
   * under it are one ground. It replaces 2026-11-12's graphite.
   */
  it('paints the panels in the Gözlemevi navy, on the v2 ground (owner 2026-11-14)', () => {
    const material = [...tokens.matchAll(/--gk-(metal-[\w]+|glass[\w-]*|steel[\w-]*|void|deep|tint):\s*(#[0-9a-fA-F]{6})\b/g)];
    expect(material.length).toBeGreaterThan(12);
    const cast = (hex: string): number => parseInt(hex.slice(5, 7), 16) - parseInt(hex.slice(1, 3), 16);
    expect(material.filter(([, , hex = '']) => cast(hex) < 7).map(([, name]) => name)).toEqual([]);
    const v2 = readFileSync('src/v2/tokens.css', 'utf8');
    const value = (source: string, name: string): string | undefined => new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(source)?.[1];
    expect(value(tokens, '--gk-deep')).toBe(value(v2, '--color-v2-deep'));
    expect(value(tokens, '--gk-glass')).toBe(value(v2, '--color-v2-panel'));
    expect(tokens).not.toMatch(/--gk-tint:\s*var\(--gk-info\)/);
  });

  it('keeps one look: no trial skins or tones are left in the kit', () => {
    const marks = files(KIT).filter((f) => /data-gk-(skin|tone|font)/.test(readFileSync(f, 'utf8')));
    expect(marks).toEqual([]);
  });

  it('opens a panel in 160 ms, from one token (owner 2026-11-12, standard 2.6)', () => {
    expect(tokens).toMatch(/--gk-panel:\s*160ms;/);
    const css = readFileSync(join(KIT, 'game-ui.css'), 'utf8');
    expect(/\.gk-dialog\s*\{[^}]*animation:\s*gk-dialog var\(--gk-panel\)/.exec(css)).toBeTruthy();
  });

  it('keeps every screen edge 12 px in, from one token (owner 2026-11-12, standard 2.7)', () => {
    expect(tokens).toMatch(/--gk-gutter:\s*12px;/);
    const css = readFileSync(join(KIT, 'game-ui.css'), 'utf8');
    const edges = ['.gk-catalog', '.gk-hud', '.gk-sheet__head', '.gk-sheet__body', '.gk-sheet__foot'];
    const off = edges.filter((selector) => {
      const body = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
      return !body.includes('var(--gk-gutter)');
    });
    expect(off).toEqual([]);
  });

  it('keeps raw colours out of every other kit file and the kit gallery', () => {
    const offenders = [...files(KIT).filter((f) => !f.endsWith('tokens.css')), 'src/v2/gallery/GameKitGallery.tsx']
      .filter((f) => RAW.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
    expect(offenders).toEqual([]);
  });
});
