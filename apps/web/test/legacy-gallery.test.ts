import { describe, expect, it } from 'vitest';
import { legacyAwardSchema } from '../src/api/legacySchemas.js';
import { LEGACY_CATALOGUE } from '@astera/rules';
import { FIXTURE_SHELF, FIXTURE_SHELF_NEW, COLLECTION, legacyGalleryApi } from '../src/v2/gallery/LegacyGallery.js';

describe('the port 5188 preview exercises the actual award components', () => {
  it('puts all six replacement families on the opening shelf', () => {
    expect(FIXTURE_SHELF.flatMap(row => row ? [row.definitionId] : []).sort()).toEqual([
      'honor-podium', 'dominion-podium', 'colony-pioneer', 'pirate-hunter', 'asteroid-hunter', 'missile-hunter',
    ].sort());
  });
  it('uses collected award identities on the shelf and returns the same season in their detail', async () => {
    const api = legacyGalleryApi(true);
    const profile = await api.legacyMe();
    const collection = await api.legacyCollection(profile.publicId);
    for (const slot of profile.showcase) {
      expect(collection.awards.some(row => row.id === slot.awardId), slot.award.definitionId).toBe(true);
      const detail = await api.legacyAward(profile.publicId, slot.awardId);
      expect(detail.award.id).toBe(slot.awardId);
      if (slot.award.sourceSeasonId) expect(detail.season?.seasonId).toBe(slot.award.sourceSeasonId);
    }
  });
  it('offers all four metals for each replaced family without duplicate award identities', () => {
    expect(new Set(COLLECTION.map(row => row.id)).size).toBe(COLLECTION.length);
    for (const row of COLLECTION) expect(legacyAwardSchema.safeParse(row).success).toBe(true);
    for (const definitionId of ['honor-podium', 'dominion-podium', 'colony-pioneer', 'pirate-hunter', 'asteroid-hunter', 'missile-hunter', 'radiation-master', 'clan-comrade', 'monument-warden']) {
      const rarities = new Set(COLLECTION.filter(row => row.definitionId === definitionId).map(row => row.rarity));
      expect([...rarities].sort()).toEqual(['COMMON', 'EPIC', 'LEGENDARY', 'RARE']);
    }
  });
});


it('never shows progress below an award already earned by the preview commander', async () => {
  const progress = await legacyGalleryApi(true).legacyProgress();
  for (const award of COLLECTION) {
    const definition = LEGACY_CATALOGUE.find(row => row.id === award.definitionId)!;
    if (definition.scope !== 'CAREER') continue;
    expect(progress.achievements.find(row => row.id === award.definitionId)?.progress)
      .toBeGreaterThanOrEqual(definition.goals[award.tier - 1]!);
  }
});


it('gives the new three award families a dedicated inspectable shelf', () => {
  const pieces = FIXTURE_SHELF_NEW.flatMap(row => row ? [row] : []);
  expect(pieces).toHaveLength(6);
  expect(new Set(pieces.map(row => row.definitionId))).toEqual(new Set(['radiation-master', 'clan-comrade', 'monument-warden']));
  expect(new Set(pieces.map(row => row.rarity)).size).toBeGreaterThanOrEqual(3);
});


it('unlocks inspectable examples of every piece the commander asked to review', () => {
  for (const id of ['season-memento', 'year-of-service', 'astera-supporter', 'shipwright-dart',
    'troublemaker', 'show-off', 'final-verdict', 'shipwright-cataclysm']) {
    expect(COLLECTION.some(award => award.definitionId === id), id).toBe(true);
  }
});

it('makes every Death Star finish inspectable without real account grants', () => {
  expect(COLLECTION.filter(row => row.definitionId === 'final-verdict').map(row => row.tier).sort()).toEqual([1, 2, 3, 4]);
});
