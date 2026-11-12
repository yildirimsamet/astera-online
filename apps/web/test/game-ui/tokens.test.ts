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

  it('paints the panels in graphite, without a blue cast (owner 2026-11-12: "this bluish colour is not for me")', () => {
    const material = [...tokens.matchAll(/--gk-(metal-[\w]+|glass[\w-]*|steel[\w-]*|void|deep|tint):\s*(#[0-9a-fA-F]{6})\b/g)];
    expect(material.length).toBeGreaterThan(12);
    const cast = (hex: string): number => parseInt(hex.slice(5, 7), 16) - parseInt(hex.slice(1, 3), 16);
    expect(material.filter(([, , hex = '']) => cast(hex) > 20).map(([, name]) => name)).toEqual([]);
    expect(tokens).not.toMatch(/--gk-tint:\s*var\(--gk-info\)/);
  });

  it('keeps one look: no trial skins or tones are left in the kit', () => {
    const marks = files(KIT).filter((f) => /data-gk-(skin|tone|font)/.test(readFileSync(f, 'utf8')));
    expect(marks).toEqual([]);
  });

  it('keeps raw colours out of every other kit file and the kit gallery', () => {
    const offenders = [...files(KIT).filter((f) => !f.endsWith('tokens.css')), 'src/v2/gallery/GameKitGallery.tsx']
      .filter((f) => RAW.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
    expect(offenders).toEqual([]);
  });
});
