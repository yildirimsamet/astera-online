import { expect, it } from 'vitest';
import { readsForShardEvent } from '../src/session/shardEvents.js';
import { ESCORT_LENGTH, escortSlot } from '../src/galaxy/flightVisual.js';
import { towingFormation } from '../src/galaxy/towing.js';
import { CRAFT_SCALE } from '../src/galaxy/scene.js';
import { keys } from '../src/api/keys.js';
import { contactFocusRadius } from '../src/galaxy/Fleets.js';

it('refreshes parked appearances and airborne escorts when their physical state changes', () => {
  expect(readsForShardEvent('shard:commander-ship')).toEqual([keys.galaxy, keys.traffic]);
});
it('frames a visible foreign escort as fully as the owner escort', () => {
  const fleet = { DART: 1 }; const admiral = { ship: 'kilavuz' as const, level: 4 };
  const base = { id: 'flight', kind: 'fleet' as const, from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, startAt: new Date(), endAt: new Date(), fleet };
  expect(contactFocusRadius({ ...base, admiral })).toBeGreaterThan(contactFocusRadius(base));
  const scale = .195 * CRAFT_SCALE;
  const formation = towingFormation(fleet, undefined, scale);
  expect(contactFocusRadius({ ...base, admiral })).toBeGreaterThanOrEqual(
    Math.hypot(...escortSlot(formation, scale)) + ESCORT_LENGTH * scale * Math.sqrt(3) / 2,
  );
});
