import type { Contact } from '../api/schemas.js';

/**
 * Which rail a touched contact opens. A pirate in the main galaxy is a target (D150) and its rail
 * reads the pirate roster; aboard there is no roster, so a pirate is read as any other craft is.
 */
export const contactRail = (contact: Pick<Contact, 'kind'>, aboard: boolean): 'pirate' | 'contact' =>
  contact.kind === 'pirate' && !aboard ? 'pirate' : 'contact';
