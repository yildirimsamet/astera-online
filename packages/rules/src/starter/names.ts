/**
 * WHAT A PLACE IS CALLED. An outpost gets a made-up word any language reads the same, so a name never
 * needs translating; the code stays as the line that tells two alike apart (player test: "OP-625C").
 */
const HEADS = ['Vel', 'Cor', 'Ash', 'Mir', 'Tal', 'Ser', 'Kev', 'Dor', 'Orm', 'Zan', 'Eld', 'Rav', 'Tev', 'Aur', 'Sol', 'Nym'] as const;
const TAILS = ['ara', 'ion', 'eth', 'ova', 'ix', 'uma', 'ere', 'is', 'en', 'ar', 'eon', 'os', 'ine', 'ade', 'yn', 'ok'] as const;

/** FNV-1a, as a ship's hull: the name needs no column and never changes. */
function hash(id: string): number {
  let value = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) value = Math.imul(value ^ id.charCodeAt(i), 0x01000193);
  return value >>> 0;
}

export function outpostName(id: string): string {
  const value = hash(id);
  return `${HEADS[value % HEADS.length]!}${TAILS[(value >>> 8) % TAILS.length]!}`;
}

export const siteCode = (site: { id: string; kind: string }): string =>
  `${site.kind === 'OUTPOST' ? 'OP' : 'WR'}-${site.id.slice(0, 4).toUpperCase()}`;
