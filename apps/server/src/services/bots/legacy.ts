import { createHash } from 'node:crypto';
import { LEGACY_CATALOGUE } from '@astera/rules';

const STARTER_PIECES = new Set(['year-of-service', 'deep-sight', 'pirate-hunter', 'asteroid-hunter', 'clan-comrade', 'troublemaker']);

/** Stable account-specific variety: restarts and later seasons never redraw a commander's collection. */
export function botLegacyPieces(accountId: string) {
  const hash = (id: string) => createHash('sha256').update(`legacy-v1:${accountId}:${id}`).digest().readUInt32BE();
  return LEGACY_CATALOGUE.filter(row => STARTER_PIECES.has(row.id))
    .sort((a, b) => hash(a.id) - hash(b.id))
    .slice(0, 2 + hash('count') % 2);
}
