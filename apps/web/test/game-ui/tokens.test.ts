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

  it('sets Russo One as the one display face, loaded by the kit itself (owner 2026-11-12)', () => {
    expect(tokens).toMatch(/--gk-font-display:\s*'Russo One'/);
    expect(tokens).not.toMatch(/data-gk-font/);
    expect(readFileSync(join(KIT, 'game-ui.css'), 'utf8')).toMatch(/@import '@fontsource\/russo-one\//);
  });

  it('keeps raw colours out of every other kit file and the kit gallery', () => {
    const offenders = [...files(KIT).filter((f) => !f.endsWith('tokens.css')), 'src/v2/gallery/GameKitGallery.tsx']
      .filter((f) => RAW.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));
    expect(offenders).toEqual([]);
  });
});
