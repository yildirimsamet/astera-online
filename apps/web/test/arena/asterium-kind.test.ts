import { describe, expect, it } from 'vitest';
import { FARM_KINDS } from '@astera/rules/arena';
import { arenaCopy } from '../../src/arena/copy.js';
import { FARM_HEX, FARM_RGB, FARM_TONE } from '../../src/arena/farmColors.js';
import i18n from '../../src/i18n/index.js';

/*
  EVERY FARM KIND IS DRAWN AND NAMED (plan 2026-11-24 §3.2). The storm's Asteryum is kind 3; a kind with no
  colour has no mesh, so its stones would sit in the field invisible, and a nameless one reads blank on the hold.
*/
describe('farm kinds on the client', () => {
  it('has a colour for every kind, in every form the renderer reads', () => {
    expect(FARM_HEX).toHaveLength(FARM_KINDS.length);
    expect(FARM_RGB).toHaveLength(FARM_KINDS.length);
    expect(FARM_TONE).toHaveLength(FARM_KINDS.length);
  });

  it('names every kind in both arena languages', async () => {
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      expect(arenaCopy().kinds).toHaveLength(FARM_KINDS.length);
    }
    expect(arenaCopy().kinds[3]).toBe('Asteryum');
  });
});
