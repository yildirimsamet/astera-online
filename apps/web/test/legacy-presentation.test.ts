import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { LEGACY_CATALOGUE } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import {
  legacyArt, legacyVisualKey, legacyAwardTitle, legacyEditionLabel, legacyFinish, legacyGoalText, legacyNextGoal, sortLegacyAwards,
} from '../src/legacy/presentation.js';
import type { LegacyAward } from '../src/api/legacySchemas.js';

const award = (over: Partial<LegacyAward>): LegacyAward => ({
  id: '00000000-0000-4000-8000-000000000001', definitionId: 'pirate-hunter', tier: 1, edition: 'career',
  category: 'COMBAT', form: 'MEDAL', rarity: 'COMMON', sourceSeasonId: null, earnedAt: null,
  grantedAt: new Date('2026-10-01T00:00:00Z'), seasonOrdinal: null, rank: null, ...over,
});

beforeEach(async () => { await i18n.changeLanguage('tr'); });

describe('every award the server can grant has a face and a name', () => {
  it('maps each catalogue definition to art and to a name in every language', async () => {
    for (const language of ['tr', 'en', 'de', 'es', 'fr', 'ja']) {
      await i18n.changeLanguage(language);
      for (const definition of LEGACY_CATALOGUE) {
        expect(legacyArt(award({ definitionId: definition.id })), definition.id).toBeDefined();
        const title = legacyAwardTitle(award({ definitionId: definition.id, edition: definition.scope === 'YEAR' ? 'year:2026' : 'career' }));
        expect(title, `${language} ${definition.id}`).not.toMatch(/legacy\./);
        expect(title.length).toBeGreaterThan(1);
        for (const goal of definition.goals) expect(legacyGoalText(definition, goal), definition.id).not.toMatch(/legacy\.|\{\{/);
      }
    }
  });

  it('draws ships with their own hull model and the strategic weapons with the game models', () => {
    const dart = legacyArt(award({ definitionId: 'shipwright-dart' }));
    if (dart?.kind !== 'craft') throw new Error('No Dart miniature');
    expect(dart.url).toMatch(/^\/assets\/models\/ships\/dart_lod\.glb\?v=[a-f0-9]{10}$/);
    expect(dart.engines).toMatch(/^\/assets\/models\/ships\/dart\.glb\?v=[a-f0-9]{10}$/);
    expect(legacyArt(award({ definitionId: 'final-verdict' }))).toMatchObject({ kind: 'craft', url: '/assets/legacy/models/strategic-v1/iron_death_star.glb', engines: '/assets/models/ships/death_star.glb' });
    expect(legacyArt(award({ definitionId: 'deep-sight' }))).toMatchObject({ kind: 'glb', url: '/assets/legacy/models/sputnik.glb' });
  });

  it('lights the engines of every ship and weapon, and stands worlds on a trophy stand', () => {
    for (const id of ['shipwright-dart', 'final-verdict']) {
      expect(legacyArt(award({ definitionId: id })), id).toMatchObject({ kind: 'craft', flame: true });
    }
    expect(legacyArt(award({ definitionId: 'asteroid-hunter' }))).not.toHaveProperty('flame');
    expect(legacyArt(award({ definitionId: 'colony-hunter' }))).toMatchObject({ kind: 'globe' });
    expect(legacyArt(award({ definitionId: 'colony-pioneer' }))).toMatchObject({ kind: 'glb', tint: false });
    for (const definitionId of ['missile-hunter', 'radiation-master', 'clan-comrade', 'monument-warden']) {
      expect(legacyArt(award({ definitionId }))).toMatchObject({ kind: 'glb', tint: false });
      expect(legacyArt(award({ definitionId }))).not.toHaveProperty('flame');
    }
  });
});

describe('a tier reads as a metal and a numeral', () => {
  it('names a ladder tier with a Roman numeral and a single award without one', () => {
    expect(legacyAwardTitle(award({ tier: 3 }))).toBe('Korsan Avcısı III');
    expect(legacyAwardTitle(award({ definitionId: 'loyal-commander' }))).toBe('Sadık Komutan');
    expect(legacyAwardTitle(award({ definitionId: 'year-of-service', edition: 'year:2026' }))).toBe('2026 Yılı');
    expect(legacyAwardTitle(award({ definitionId: 'shipwright-dart', tier: 2 }))).toBe('Ok Tersanecisi II');
  });

  it('names a podium by its place and dresses it in the matching metal', () => {
    expect(legacyAwardTitle(award({ definitionId: 'honor-podium', tier: 1 }))).toBe('Honor Şampiyonu');
    expect(legacyAwardTitle(award({ definitionId: 'dominion-podium', tier: 4 }))).toBe('Hâkimiyet İlk 10');
    expect(['honor-podium', 'dominion-podium'].flatMap(id => [1, 2, 3, 4].map(tier => legacyFinish(award({ definitionId: id, tier })))))
      .toEqual(['gold', 'silver', 'bronze', 'iron', 'gold', 'silver', 'bronze', 'iron']);
  });

  it('follows rarity on a ladder, and the single honours wear the metal they are worth', () => {
    expect((['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const).map(rarity => legacyFinish(award({ rarity }))))
      .toEqual(['iron', 'bronze', 'silver', 'gold']);
    expect(legacyFinish(award({ definitionId: 'loyal-commander', rarity: 'RARE' }))).toBe('bronze');
    expect(legacyFinish(award({ definitionId: 'astera-supporter', rarity: 'LEGENDARY' }))).toBe('gold');
  });

  it('labels the season or the year an award belongs to', () => {
    expect(legacyEditionLabel(award({ definitionId: 'honor-podium', seasonOrdinal: 12 }))).toBe('S12');
    expect(legacyEditionLabel(award({ definitionId: 'year-of-service', edition: 'year:2027' }))).toBe('2027');
    expect(legacyEditionLabel(award({}))).toBeNull();
  });
});

it('selects the four Death Star accent variants while retaining its native pose and engine identity', () => {
  const rarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
  const metals = ['iron', 'bronz', 'silver', 'golden'];
  for (let index = 0; index < 4; index++) {
    const name = `${metals[index]}_death_star.glb`;
    expect(existsSync(resolve('public/assets/legacy/models/strategic-v1', name)), name).toBe(true);
    expect(legacyArt(award({ definitionId: 'final-verdict', tier: index + 1, rarity: rarities[index]! })))
      .toMatchObject({ kind: 'craft', url: `/assets/legacy/models/strategic-v1/${name}`, engines: '/assets/models/ships/death_star.glb', flame: true });
  }
});

describe('the rule is written where it is used', () => {
  it('states monument time as hours and days, and counts as counts', () => {
    const warden = LEGACY_CATALOGUE.find(row => row.id === 'monument-warden')!;
    expect(legacyGoalText(warden, 3_600)).toContain('1 saat');
    expect(legacyGoalText(warden, 43_200)).toContain('12 saat');
    expect(legacyGoalText(warden, 259_200)).toContain('3 gün');
    const pirates = LEGACY_CATALOGUE.find(row => row.id === 'pirate-hunter')!;
    expect(legacyGoalText(pirates, 30)).toContain('30');
  });

  it('names the next goal of a ladder, and nothing once the ladder is complete', () => {
    const pirates = LEGACY_CATALOGUE.find(row => row.id === 'pirate-hunter')!;
    expect(legacyNextGoal(pirates, 0)).toEqual({ tier: 1, goal: 10 });
    expect(legacyNextGoal(pirates, 30)).toEqual({ tier: 3, goal: 50 });
    expect(legacyNextGoal(pirates, 100)).toBeNull();
  });
});

describe('the strongest pieces come first', () => {
  it('orders by rarity, then by the most recent date', () => {
    const rows = [
      award({ id: 'a', rarity: 'COMMON', grantedAt: new Date('2026-10-03') }),
      award({ id: 'b', rarity: 'LEGENDARY', grantedAt: new Date('2026-09-01') }),
      award({ id: 'c', rarity: 'COMMON', earnedAt: new Date('2026-10-05'), grantedAt: new Date('2026-09-01') }),
      award({ id: 'd', rarity: 'EPIC', grantedAt: new Date('2026-08-01') }),
    ];
    expect(sortLegacyAwards(rows).map(row => row.id)).toEqual(['b', 'd', 'c', 'a']);
  });
});


describe('Meshy award families retain their authored material and select every earned metal', () => {
  it('maps nine different accomplishments to distinct, complete four-metal families', () => {
    const families = { 'honor-podium': 'honor', 'dominion-podium': 'kupa', 'colony-pioneer': 'gezegen',
      'pirate-hunter': 'korsan', 'asteroid-hunter': 'kazici', 'missile-hunter': 'roket',
      'radiation-master': 'radyasyon', 'clan-comrade': 'silah_arkadasi', 'monument-warden': 'anit_tutma' };
    const rarities = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
    const metals = ['iron', 'bronz', 'silver', 'golden'];
    for (const [definitionId, family] of Object.entries(families)) for (let index = 0; index < 4; index++) {
      const tier = definitionId.endsWith('-podium') ? 4 - index : index + 1;
      const assetPath = resolve('public/assets/legacy/models/meshy-v1', `${metals[index]}_${family}.glb`);
      expect(existsSync(assetPath), assetPath).toBe(true);
      expect(legacyArt(award({ definitionId, tier, rarity: rarities[index]! })))
        .toMatchObject({ kind: 'glb', url: `/assets/legacy/models/meshy-v1/${metals[index]}_${family}.glb`, tint: false });
    }
    expect(legacyArt(award({ definitionId: 'colony-hunter' }))).toMatchObject({ kind: 'globe' });
    expect(legacyArt(award({ definitionId: 'not-an-award' }))).toBeUndefined();
  });
});


it('does not reuse a thumbnail for a different same-metal tier or year edition', () => {
  const third = award({ definitionId: 'monument-warden', tier: 3, rarity: 'EPIC' });
  expect(legacyVisualKey(third)).not.toBe(legacyVisualKey({ ...third, tier: 4 }));
  const pin = award({ definitionId: 'year-of-service', edition: 'year:2026' });
  expect(legacyVisualKey(pin)).not.toBe(legacyVisualKey({ ...pin, edition: 'year:2027' }));
});
