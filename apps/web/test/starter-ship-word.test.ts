import { describe, expect, it } from 'vitest';
import { worldKindKey } from '../src/galaxy/worldKind.js';
import i18n from '../src/i18n/index.js';

/** Owner 2026-11-09: a ship's name stood under "Ana gezegen". Its word is its own. */
describe('the word above a name', () => {
  it('calls a ship a home ship and a world what it is', () => {
    expect(worldKindKey({ kind: 'CAPITAL', body: 'VESSEL' })).toBe('kindVessel');
    expect(worldKindKey({ kind: 'CAPITAL' })).toBe('kindCapital');
    expect(worldKindKey({ kind: 'COLONY' })).toBe('kindColony');
    expect(worldKindKey({ kind: 'NEUTRAL', body: 'OUTPOST' })).toBe('kindNeutral');
  });
  it('reads "Ana gemi" in Turkish, on the label and on the sheet', async () => {
    await i18n.changeLanguage('tr');
    expect(i18n.t('galaxy.kindVessel')).toBe('Ana gemi');
    expect(i18n.t('focus.planet.kindVessel')).toBe('Ana gemi');
  });
});
