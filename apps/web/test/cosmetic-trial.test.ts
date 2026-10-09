import { expect, it } from 'vitest';
import { applyCosmeticTrial, type TrialWorld } from '../src/galaxy/cosmeticTrial.js';
const owned: TrialWorld = { id: 'mine', isOwned: true, intel: 'RESOLVED', skin: { id: 'planet-ice', status: 'RECOVERY_SHIELD' }, ringId: 'ring-helios' };
const other: TrialWorld = { id: 'other', isOwned: false, intel: 'RESOLVED' };
it('tries an unowned planet skin on one owned world without mutating live data or its ring/shield', () => {
  const worlds = [owned, other];
  const result = applyCosmeticTrial(worlds, { planetId: 'mine', cosmeticId: 'planet-lava', enabled: true });
  expect(result[0]).toEqual({ ...owned, skin: { id: 'planet-lava', status: 'RECOVERY_SHIELD' } });
  expect(result[1]).toBe(other);
  expect(worlds[0]).toBe(owned);
  expect(owned.skin?.id).toBe('planet-ice');
});
it('tries a ring without replacing the planet skin, and restores the latest live appearance when stopped or comparing', () => {
  const worlds = [owned];
  expect(applyCosmeticTrial(worlds, { planetId: 'mine', cosmeticId: 'ring-singularity', enabled: true })[0]).toEqual({ ...owned, ringId: 'ring-singularity' });
  expect(applyCosmeticTrial(worlds, null)).toBe(worlds);
  expect(applyCosmeticTrial(worlds, { planetId: 'mine', cosmeticId: 'ring-singularity', enabled: false })).toBe(worlds);
});
it('refuses other worlds, fog-hidden worlds, vanished worlds and unsupported craft/flag IDs', () => {
  const worlds = [other, { ...owned, id: 'hidden', intel: 'UNKNOWN' as const }, { ...owned, id: 'mine', isOwned: false }];
  for (const planetId of ['other','hidden','missing','mine']) expect(applyCosmeticTrial(worlds, { planetId, cosmeticId: 'ring-aurora', enabled: true })).toEqual(worlds);
  for (const cosmeticId of ['probe-ufo','engine-aurora','flag-reaper','__proto__','missing']) expect(applyCosmeticTrial([owned], { planetId: 'mine', cosmeticId, enabled: true })).toEqual([owned]);
});
it('uses the live world recovery appearance when no planet skin is equipped yet', () => {
  const bare = { ...owned, skin: undefined };
  expect(applyCosmeticTrial([bare], { planetId: 'mine', cosmeticId: 'planet-lava', enabled: true }, 'RECOVERY_SHIELD')[0]?.skin)
    .toEqual({ id: 'planet-lava', status: 'RECOVERY_SHIELD' });
});
