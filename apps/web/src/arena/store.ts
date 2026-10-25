import { ARENA_TUNING as T, holdPoints, remainingFlightSeconds, type ArenaWorld, type Pilot } from '@astera/rules/arena';

export interface HudSnapshot {
  clientPhase: 'preflight' | 'flight' | 'paused';
  phase: Pilot['phase'];
  hull: number; fuel: number; remaining: number; cargo: number; speed: number; throttle: number;
  /** Units aboard by farm kind, and what they would score at an exit. */
  hold: readonly number[]; points: number;
  /** Farm kind of the deposit the ship sits on, or -1 off any deposit. */
  depositKind: number;
  turboCharge: number; turboActive: boolean; shield: number; cloak: number; cloakCooldown: number; smokeCooldown: number;
  landed: boolean; landedOn: 'rock' | 'crystal' | 'structure' | null; mining: boolean; reserve: number; dry: boolean;
  extraction: number; inExit: boolean; rescue: number; linkLost: number; locked: boolean; canLand: boolean;
  hits: number; kills: number; attacker: number; damageRecent: boolean; boundary: number;
  landing: 'idle' | 'approach' | 'landed'; landingDistance: number;
}

const initial: HudSnapshot = {
  clientPhase: 'preflight', phase: 'flying', hull: T.hull, fuel: T.fuelTank, remaining: 0, cargo: 0, speed: 0, throttle: 0,
  hold: [0, 0, 0], points: 0, depositKind: -1,
  turboCharge: T.turboCharge, turboActive: false, shield: T.spawnShield, cloak: 0, cloakCooldown: 0, smokeCooldown: 0,
  landed: false, landedOn: null, mining: false, reserve: 0, dry: false, extraction: 0, inExit: false, rescue: 0, linkLost: 0,
  locked: false, canLand: false, hits: 0, kills: 0, attacker: -1, damageRecent: false, boundary: 9999,
  landing: 'idle', landingDistance: 0,
};

/** HUD numbers at ~10 Hz outside React; per-frame markers are written straight to the DOM. */
export function createHudStore() {
  const listeners = new Set<() => void>();
  let snapshot: Readonly<HudSnapshot> = initial;
  return {
    getSnapshot: (): Readonly<HudSnapshot> => snapshot,
    subscribe: (notify: () => void): (() => void) => { listeners.add(notify); return () => { listeners.delete(notify); }; },
    publish(world: ArenaWorld, clientPhase: HudSnapshot['clientPhase'], locked: boolean, canLand: boolean,
      landing: HudSnapshot['landing'] = 'idle', landingDistance = 0): void {
      const p = world.pilot;
      const surface = p.landed ? world.layout.obstacles[p.landed - 1] : undefined;
      const slot = surface ? world.layout.deposits.indexOf(surface.id) : -1;
      const inExit = world.layout.exits.some(exit => {
        const x = p.p.x - exit.x; const y = p.p.y - exit.y; const z = p.p.z - exit.z;
        return x * x + y * y + z * z <= T.exitRadius * T.exitRadius;
      });
      const planar = Math.sqrt(p.p.x * p.p.x + p.p.z * p.p.z);
      snapshot = Object.freeze({
        clientPhase, phase: p.phase, hull: p.hull, fuel: p.fuel,
        remaining: remainingFlightSeconds(p.fuel, p.throttle, p.turboActive), cargo: p.cargo, speed: p.s, throttle: p.throttle,
        hold: [...p.hold], points: holdPoints(p.hold), depositKind: slot >= 0 ? world.layout.depositKinds[slot] ?? -1 : -1,
        turboCharge: p.turboCharge, turboActive: p.turboActive, shield: p.shield / T.tickRate, cloak: p.cloak / T.tickRate,
        cloakCooldown: p.cloakCooldown / T.tickRate, smokeCooldown: p.smokeCooldown / T.tickRate,
        landed: p.landed > 0, landedOn: surface?.kind ?? null, mining: p.mining,
        reserve: slot >= 0 ? world.minerals[slot] ?? 0 : 0, dry: slot >= 0 && world.dry[slot] === true,
        extraction: p.extraction / T.tickRate, inExit, rescue: p.rescue / T.tickRate, linkLost: p.linkLost / T.tickRate,
        locked, canLand, hits: p.hits, kills: p.kills, attacker: p.lastAttacker,
        damageRecent: world.tick - p.lastDamage < 15,
        boundary: Math.min(world.layout.radius - planar, world.layout.halfHeight - Math.abs(p.p.y)),
        landing, landingDistance,
      });
      for (const notify of listeners) notify();
    },
  };
}
export type HudStore = ReturnType<typeof createHudStore>;
