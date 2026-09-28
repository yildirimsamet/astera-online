import { describe, expect, it } from 'vitest';
import type { Contact } from '../src/api/schemas.js';
import { knownPirateContacts, pirateTargetName } from '../src/lib/galaxyTargets.js';

const at = { x: 0, y: 0, z: 0 };
const now = new Date('2026-01-01T00:00:00Z');
const unknown: Contact = {
  id: 'radar-return', kind: 'unknown', silhouette: 'pirate',
  from: at, to: at, startAt: now, endAt: now,
};

describe('pirate finder disclosure', () => {
  it('counts and lists only telescope-identified pirates, including remembered ones', () => {
    const identified: Contact = { ...unknown, id: 'identified', kind: 'pirate', level: 2 };
    const remembered: Contact = { ...identified, id: 'remembered', remembered: true };
    const effectOnly: Contact = { ...identified, id: 'public-effect', effectOnly: true };
    expect(knownPirateContacts([unknown, identified, remembered, effectOnly]).map((contact) => contact.id))
      .toEqual(['identified', 'remembered']);
  });

  it('keeps a radar-only contact anonymous even though its payload has a callsign', () => {
    expect(pirateTargetName({ zone: 'CONTACT', callsign: 'mJtQ' }))
      .toEqual({ key: 'pirate.unknownContact' });
  });

  it('names an identified pirate and its known level', () => {
    expect(pirateTargetName({ zone: 'IDENTIFIED', level: 3, callsign: 'mJtQ' }))
      .toEqual({ key: 'pirate.name', level: 3, callsign: 'mJtQ' });
  });

  it('does not infer identity when a partial identified reading lacks a level', () => {
    expect(pirateTargetName({ zone: 'IDENTIFIED', callsign: 'mJtQ' }))
      .toEqual({ key: 'pirate.unknownContact' });
  });
});
