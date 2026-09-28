import type { Contact, PirateContact } from '../api/schemas.js';

/** The finder and its count read the same disclosed contacts as the galaxy canvas. */
export function knownPirateContacts(contacts: readonly Contact[]): Contact[] {
  return contacts.filter((contact) => contact.kind === 'pirate' && contact.effectOnly !== true);
}

/** A radar return may carry a wire callsign without earning an identity on screen. */
export function pirateTargetName(pirate: Pick<PirateContact, 'zone' | 'level' | 'callsign'>):
  | { key: 'pirate.unknownContact' }
  | { key: 'pirate.name'; level: number; callsign: string } {
  if (pirate.zone !== 'IDENTIFIED' || pirate.level === undefined) {
    return { key: 'pirate.unknownContact' };
  }
  return { key: 'pirate.name', level: pirate.level, callsign: pirate.callsign };
}
