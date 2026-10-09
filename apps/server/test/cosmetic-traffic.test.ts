import { expect, it } from 'vitest';
import { decorateCosmeticContacts } from '../src/services/cosmeticTraffic.js';
import type { Contact } from '../src/services/traffic.js';
const base = { id: 'flight', from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 }, startAt: new Date(0), endAt: new Date(1) };
const appearances = new Map([['flight', { engineId: 'engine-aurora', flagId: 'flag-helios', probeId: 'probe-ufo' }]]);
it('projects only the appearance appropriate to an already identified craft', () => {
  expect(decorateCosmeticContacts([{ ...base, kind: 'fleet' }], appearances)[0]?.appearance).toEqual({ engineId: 'engine-aurora', flagId: 'flag-helios' });
  expect(decorateCosmeticContacts([{ ...base, kind: 'probe' }], appearances)[0]?.appearance).toEqual({ probeId: 'probe-ufo' });
});
it('does not leak cosmetics through radar, effect-only battles, or other craft types', () => {
  for (const contact of [
    { ...base, kind: 'unknown' as const }, { ...base, kind: 'fleet' as const, effectOnly: true as const },
    { ...base, kind: 'pirate' as const }, { ...base, kind: 'mining' as const },
  ]) expect(decorateCosmeticContacts([contact], appearances)).toEqual([contact]);
  const contacts: Contact[] = [{ ...base, kind: 'fleet' }];
  expect(decorateCosmeticContacts(contacts)).toBe(contacts);
  expect(decorateCosmeticContacts(contacts, new Map())).toEqual(contacts);
});

it('shows a model skin only for a disclosed hull actually in this flight', () => {
  const looks = new Map([['flight', { shipSkins: { CORSAIR: 'ship-red-dragon' as const, CITADEL: 'ship-shark' as const } }]]);
  expect(decorateCosmeticContacts([{ ...base, kind: 'fleet', fleet: { CITADEL: 2, CORSAIR: 0 } }], looks)[0]?.appearance)
    .toEqual({ shipSkins: { CITADEL: 'ship-shark' } });
  for (const contact of [
    { ...base, kind: 'fleet' as const }, { ...base, kind: 'unknown' as const, fleet: { CITADEL: 2 } },
    { ...base, kind: 'probe' as const }, { ...base, kind: 'fleet' as const, fleet: { DART: 2 } },
  ]) expect(decorateCosmeticContacts([contact], looks)).toEqual([contact]);
});
