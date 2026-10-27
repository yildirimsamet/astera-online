import type { ArenaWorld, ShipClass } from '@astera/rules/arena';
import type { ArenaCopy } from './copy.js';

/**
 * "NE OLDU?" — why a flight ended, read from the world the moment it ended (doc 14 §Sonuç, KG-A14).
 * Every kill has an owner (a bolt or a missile), so a destroyed ship always names its shooter; the
 * distance is only given while the shooter is in sight, never guessed.
 */
export type Debrief =
  | { kind: 'shot'; by: number; ship: ShipClass | null; metres: number | null }
  | { kind: 'fuel' } | { kind: 'link' } | { kind: 'recalled' };

export function readDebrief(world: ArenaWorld): Debrief | null {
  const self = world.pilot;
  if (self.phase === 'dead') {
    const by = world.drones.find(d => d.id === self.lastAttacker && d.decoyOf < 0);
    return { kind: 'shot', by: self.lastAttacker, ship: by?.ship ?? null,
      metres: by ? Math.round(Math.hypot(by.p.x - self.p.x, by.p.y - self.p.y, by.p.z - self.p.z)) : null };
  }
  if (self.phase === 'towed') return self.fuel === 0 ? { kind: 'fuel' } : { kind: 'link' };
  return null;
}

export function debriefText(debrief: Debrief, c: ArenaCopy, name: (id: number) => string): string {
  return debrief.kind === 'shot'
    ? c.debrief.shot(name(debrief.by), debrief.ship ? c.classes[debrief.ship].name : null, debrief.metres)
    : c.debrief[debrief.kind];
}

/** A pilot as the HUD names it: a bot by its role, a player by the roster's name. */
export function pilotName(id: number, c: ArenaCopy, world: ArenaWorld,
  network: { roles: ReadonlyMap<number, keyof ArenaCopy['roles']>; names: ReadonlyMap<number, string> }): string {
  const role = network.roles.get(id) ?? world.brains.get(id)?.role;
  return role ? c.roles[role] : network.names.get(id) ?? `${c.rival} ${String(id)}`;
}
