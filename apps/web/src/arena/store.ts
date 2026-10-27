import { ARENA_TUNING as T, CLASS_STATS, abilityStats, alive, sameSide, flightRanks, dustAt, lockShare, locked as missileLocked, remainingFlightSeconds, shipTuning, type ArenaWorld, type Pilot } from '@astera/rules/arena';

export interface HudSnapshot {
  friends: readonly { id: number; x: number; z: number }[];
  clientPhase: 'preflight' | 'flight' | 'paused';
  phase: Pilot['phase'];
  /** The class flown, and its level (Y6b): every gauge reads against its own hull, tank, hold and magazine. */
  ship: Pilot['ship']; level: number;
  ranks: Pilot['ranks'];
  /** `remaining`: seconds the tank lasts at full throttle, a reading that only falls (F20: it followed the throttle and jumped). */
  hull: number; fuel: number; remaining: number; cargo: number; speed: number; throttle: number;
  /** Rounds left in the magazine; the shield layer's hit points and its maximum (0 without a shield). */
  ammo: number; shieldHp: number; shieldMax: number;
  /** Units aboard by farm kind, and what they would score at an exit. */
  hold: readonly number[];
  /** Farm kind of the deposit the ship sits on, or -1 off any deposit. */
  depositKind: number;
  turboCharge: number; turboActive: boolean; shield: number; cloak: number; cloakCooldown: number; smokeCooldown: number;
  /**
   * Y4c. The B slot chosen; seconds until A works again; the missile lock's share built (0–1) and
   * whether it holds; what aims at this ship (0 nothing, 1 a lock building, 2 locked, 3 a missile);
   * seconds left of a raised shield and of a repair.
   */
  tactic: Pilot['tactic']; signatureCooldown: number; lockProgress: number; lockReady: boolean; threat: number; ward: number; mend: number;
  /**
   * Y4d. Seconds until an illusion or a sweep works again; our copy's id (-1 none) and the
   * seconds it has left; the seconds our sweep still marks. A threat of 4: we were swept.
   */
  tacticCooldown: number; decoy: number; illusion: number; scan: number;
  landed: boolean; landedOn: 'rock' | 'crystal' | 'structure' | null; mining: boolean; reserve: number; dry: boolean;
  extraction: number; inExit: boolean; rescue: number; linkLost: number; locked: boolean; canLand: boolean;
  hits: number; kills: number; attacker: number; damageRecent: boolean; boundary: number;
  /** Inside a dust cloud: sight is cut to `dustSight` both ways. */
  inDust: boolean;
  landing: 'idle' | 'approach' | 'landed'; landingDistance: number;
}

const initial: HudSnapshot = {
  friends: [],
  clientPhase: 'preflight', phase: 'flying', ship: 'kilavuz', level: 1, hull: CLASS_STATS.kilavuz.hull, fuel: CLASS_STATS.kilavuz.fuelTank, remaining: 0, cargo: 0, speed: 0, throttle: 0,
  ranks: flightRanks('kilavuz', 'smoke', {}),
  ammo: CLASS_STATS.kilavuz.ammoCapacity, shieldHp: 0, shieldMax: 0,
  hold: [0, 0, 0], depositKind: -1,
  turboCharge: T.turboCharge, turboActive: false, shield: T.spawnShield, cloak: 0, cloakCooldown: 0, smokeCooldown: 0,
  tactic: 'smoke', signatureCooldown: 0, lockProgress: 0, lockReady: false, threat: 0, ward: 0, mend: 0,
  tacticCooldown: 0, decoy: -1, illusion: 0, scan: 0,
  landed: false, landedOn: null, mining: false, reserve: 0, dry: false, extraction: 0, inExit: false, rescue: 0, linkLost: 0,
  locked: false, canLand: false, hits: 0, kills: 0, attacker: -1, damageRecent: false, boundary: 9999, inDust: false,
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
        friends: world.drones.filter(d => d.decoyOf < 0 && alive(d) && sameSide(p, d)).map(d => ({ id: d.id, x: d.p.x, z: d.p.z })),
        clientPhase, phase: p.phase, ship: p.ship, level: p.level, ranks: p.ranks, hull: p.hull, fuel: p.fuel, ammo: p.ammo, shieldHp: p.shieldHp, shieldMax: p.shieldMax,
        remaining: remainingFlightSeconds(p.fuel, 1, false, shipTuning(p.ship, p.level)), cargo: p.cargo, speed: p.s, throttle: p.throttle,
        hold: [...p.hold], depositKind: slot >= 0 ? world.layout.depositKinds[slot] ?? -1 : -1,
        turboCharge: p.turboCharge, turboActive: p.turboActive, shield: p.shield / T.tickRate, cloak: p.cloak / T.tickRate,
        cloakCooldown: p.cloakCooldown / T.tickRate, smokeCooldown: p.smokeCooldown / T.tickRate,
        tactic: p.tactic, signatureCooldown: p.signatureCooldown / T.tickRate,
        lockProgress: lockShare(p), lockReady: missileLocked(p),
        threat: p.threat, ward: p.ward / T.tickRate, mend: p.mend / T.tickRate,
        // The copy lives the first illusionDuration of the cooldown its cast started, unless it broke first.
        tacticCooldown: p.tacticCooldown / T.tickRate, decoy: p.decoy,
        illusion: p.decoy >= 0 ? Math.max(0, p.tacticCooldown / T.tickRate - (abilityStats(p.ship, 'illusion', p.ranks.tactic).cooldown - abilityStats(p.ship, 'illusion', p.ranks.tactic).duration)) : 0,
        scan: p.scan / T.tickRate,
        landed: p.landed > 0, landedOn: surface?.kind ?? null, mining: p.mining,
        reserve: slot >= 0 ? world.minerals[slot] ?? 0 : 0, dry: slot >= 0 && world.dry[slot] === true,
        extraction: p.extraction / T.tickRate, inExit, rescue: p.rescue / T.tickRate, linkLost: p.linkLost / T.tickRate,
        locked, canLand, hits: p.hits, kills: p.kills, attacker: p.lastAttacker,
        damageRecent: world.tick - p.lastDamage < 15,
        boundary: Math.min(world.layout.radius - planar, world.layout.halfHeight - Math.abs(p.p.y)),
        inDust: dustAt(world.layout, p.p) !== undefined,
        landing, landingDistance,
      });
      for (const notify of listeners) notify();
    },
  };
}
export type HudStore = ReturnType<typeof createHudStore>;
