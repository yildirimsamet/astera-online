import { describe, expect, it } from 'vitest';
import {
  resolveCombat,
  computeLoot,
  DEBRIS,
  HULLS,
  MOBILE_HULLS,
  PIRATE,
  TRAFFIC,
  TRAVEL,
  asteroidOrbitRadius,
  distance,
  fleetCount,
  fleetEntries,
  fleetCargo,
  fleetValue,
  generateAsteroidSchedule,
  generatePirateSchedule,
  interceptAsteroid,
  interceptOrbit,
  mulberry32,
  orbitPosition,
  orbitRadius,
  pirateActive,
  pirateCapture,
  pirateHoard,
  piratePosition,
  pirateRoster,
  pirateStats,
  resourcesTotal,
  seededFrom,
  travelExact,
  type PirateLevel,
  type Fleet,
  type PirateSpec,
} from '../src/index.js';

const LEVELS: readonly PirateLevel[] = [1, 2, 3, 4];

const schedule = (seed = 7, span = 60 * 24): PirateSpec[] =>
  generatePirateSchedule(mulberry32(seed), span);

/** Middle of a sorted sample. The lead measurements below are medians, not means. */
const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
};

/** Every hull that flies and is built to chase — the pirate-hunting class. */
const skirmishers = MOBILE_HULLS.filter((id) => HULLS[id].cls === 'SKIRMISHER');

/**
 * KORSAN FİLOLARI — D150.
 *
 * A pirate is a pure function of the season key: its orbit, its roster, its hoard
 * and its life are all derived, and the only thing the database is allowed to hold
 * is what cannot be derived — what has been shot off it, and whether it is gone.
 * These tests hold that line, and they hold the two places the feature can silently
 * become something else: a roster that cannot fight back, and a published window
 * wide enough to be a route.
 */
describe('the pirate table', () => {
  it('never lets a pirate hit as hard as the fleet it faces', () => {
    /*
      The penalty is the ONLY thing separating a pirate from an equal-value player
      fleet, and it is why the reward can be positive at all. D11 keeps combat
      simple, so this is a multiplier on one side's fire — not a fifth axis, not a
      research rung, and never a change to hp: an L4 pirate has to stay genuinely
      dangerous while it is being shot at.
    */
    for (const level of LEVELS) {
      expect(PIRATE.damageMult[level]).toBeGreaterThan(0);
      expect(PIRATE.damageMult[level]).toBeLessThan(1);
      expect(pirateStats(level).damageMult).toBe(PIRATE.damageMult[level]);
    }
    for (const level of [2, 3, 4] as const) {
      expect(PIRATE.damageMult[level]).toBeGreaterThan(PIRATE.damageMult[(level - 1) as PirateLevel]);
    }
  });

  it('pays the best capture odds where the fight is easiest to win', () => {
    // The inverse of the damage table by construction: a level 1 pirate is the
    // cheapest ship in the game to win, so its ship is the one worth least.
    for (const level of [2, 3, 4] as const) {
      expect(PIRATE.captureChance[level]).toBeLessThan(
        PIRATE.captureChance[(level - 1) as PirateLevel],
      );
    }
    for (const level of LEVELS) {
      expect(PIRATE.captureChance[level]).toBeGreaterThan(0);
      expect(PIRATE.captureChance[level]).toBeLessThan(1);
    }
  });

  it('spends its whole level distribution', () => {
    const total = PIRATE.levelWeights.reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(PIRATE.levelWeights[0]).toBe(0);
    expect(PIRATE.levelWeights).toHaveLength(5);
  });

  it('flies at a pace off the hull table, so a raid can cut it off', () => {
    /*
      THE BAND IS THE HULL TABLE'S OWN, AND THAT IS THE WHOLE OF D155.

      It used to be 200-420 units per minute, chosen "deliberately under the rocks"
      — but the craft that chases a rock is a Prospector at 825, and the craft that
      chases a pirate is a warship at 106-231. On the hull table's scale the old
      band was 240-504: FASTER THAN EVERY SHIP IN THE GAME. So `interceptOrbit`
      answered correctly and the answer was never a lead — it was the far side of
      the orbit, one lap of waiting, and the owner reported it exactly as the rock
      lane was once reported: the fleet sets off somewhere unrelated.

      Both ends are read off the catalogue rather than typed, because a number
      typed here is a number that stops meaning what it says the next time D152
      moves the ladder — which is precisely what happened to the old figure.

        · TOP: a Dart's pace. The cheapest ship in the game outruns the fastest
          pirate, so "can I catch it" is never a question about your wallet.
        · FLOOR: a Cataclysm's pace. A heavy line cannot lead one, so the chase is
          a real choice between guns and geometry rather than a free win.

      EVERY COMPARISON HERE IS IN UNITS PER MINUTE, which is the scale a pirate's
      `speed` is already on. `travelExact` divides a hull's catalogue figure by
      `distanceFactor` to reach it, so that division is the comparison — and
      leaving it out is exactly how the two scales came to be confused.
    */
    expect(PIRATE.speedMax).toBeCloseTo(HULLS.DART.speed / TRAVEL.distanceFactor, 9);
    expect(PIRATE.speedMin).toBeCloseTo(HULLS.CATACLYSM.speed / TRAVEL.distanceFactor, 9);
    expect(PIRATE.speedMin).toBeLessThan(PIRATE.speedMax);

    // The hunting class outruns every pirate the lane can draw, at every rung.
    expect(skirmishers.length).toBeGreaterThan(2);
    for (const id of skirmishers) {
      expect(HULLS[id].speed / TRAVEL.distanceFactor).toBeGreaterThanOrEqual(PIRATE.speedMax);
    }
    // And a heavy line does not: the floor IS the heaviest striker's pace, so
    // anything slower than a Cataclysm is buying guns at the cost of the chase.
    expect(HULLS.CITADEL.speed / TRAVEL.distanceFactor).toBeLessThan(PIRATE.speedMin);
  });

  it('derives its published window from the client poll interval and never below it', () => {
    /*
      CLAUDE.md records this exact bug having happened: a published window and the
      client's refetch floor drifted apart, and every craft in the game began
      publishing the world it was flying to. `bearingMs` is therefore DERIVED here
      rather than typed as its own number — and a pirate's window is deliberately
      much shorter than a straight leg's, because a closed orbit turns a long
      window into a visibly wrong straight chord.
    */
    expect(PIRATE.bearingMs).toBe(TRAFFIC.refreshMs * 2);
    expect(PIRATE.bearingMs).toBeGreaterThanOrEqual(TRAFFIC.refreshMs);
    expect(PIRATE.bearingMs / 60_000).toBeLessThan(TRAFFIC.bearingMinutes);
  });
});

describe('the pirate roster', () => {
  it('always brings something that can shoot back at its own level', () => {
    /*
      THE FEATURE DIES WITHOUT THIS LINE. A roster drawn freely from everything at
      or below the level can legally come out as two Couriers — zero attack — and
      then "raiding a level 4 pirate" is a delivery, not a fight. One guaranteed
      combat hull AT the level is what makes the level mean anything.
    */
    for (const level of LEVELS) {
      for (let seed = 0; seed < 200; seed++) {
        const roster = pirateRoster(level, seededFrom('roster', level, seed));
        const top = fleetEntries(roster).filter(
          ([id]) => HULLS[id].tier === level && HULLS[id].cls !== 'SUPPORT',
        );
        expect(top.length).toBeGreaterThan(0);
      }
    }
  });

  it('holds its size band', () => {
    for (const level of LEVELS) {
      for (let seed = 0; seed < 200; seed++) {
        const count = fleetCount(pirateRoster(level, seededFrom('size', level, seed)));
        expect(count).toBeGreaterThanOrEqual(PIRATE.sizeMin);
        expect(count).toBeLessThanOrEqual(PIRATE.sizeMax);
      }
    }
  });

  it('never leaks a hull that cannot fly, and never one above its level', () => {
    /*
      `Hull.tier` is null on BASTION, THORN and PROSPECTOR. A bare `tier <= level`
      compares null against a number, which TypeScript refuses and JavaScript would
      have answered `true` for — putting a ground gun in a fleet that flies. The
      pool filter reads `?? Infinity` for exactly this, and this test is what keeps
      it there.
    */
    for (const level of LEVELS) {
      for (let seed = 0; seed < 300; seed++) {
        for (const [id] of fleetEntries(pirateRoster(level, seededFrom('pool', level, seed)))) {
          expect(MOBILE_HULLS).toContain(id);
          expect(HULLS[id].ground).toBe(false);
          expect(HULLS[id].tier).not.toBeNull();
          expect(HULLS[id].tier ?? Infinity).toBeLessThanOrEqual(level);
        }
      }
    }
  });

  it('is the same roster every time it is asked', () => {
    for (const level of LEVELS) {
      const a = pirateRoster(level, seededFrom('same', level));
      const b = pirateRoster(level, seededFrom('same', level));
      expect(a).toEqual(b);
    }
  });
});

describe('the pirate hoard', () => {
  it('is priced off what the pirate is worth, not off what a player owns', () => {
    for (const level of LEVELS) {
      const roster = pirateRoster(level, seededFrom('hoard', level));
      const hoard = pirateHoard(roster);
      expect(resourcesTotal(hoard)).toBeGreaterThan(0);
      // Within rounding of the multiplier: three floors, never more.
      const want = fleetValue(roster) * PIRATE.hoardValueMult;
      expect(resourcesTotal(hoard)).toBeGreaterThan(want - 4);
      expect(resourcesTotal(hoard)).toBeLessThanOrEqual(want);
      expect(hoard.alloy).toBeGreaterThan(0);
      expect(hoard.crystal).toBeGreaterThan(0);
      expect(Number.isInteger(hoard.alloy)).toBe(true);
      expect(Number.isInteger(hoard.crystal)).toBe(true);
      expect(Number.isInteger(hoard.deuterium)).toBe(true);
    }
  });

  it('pays a fleet composed for the target, and punishes one that is not', () => {
    /*
      "KÂRLI" IS A DECISION, NOT A SLOGAN, AND THIS IS THE ASSERTION OF IT.

      It used to read `expect(PIRATE.hoardValueMult).toBeGreaterThan(1)`, which is
      a tautology about a constant — it could not have failed if the whole reward
      had been unreachable. The claim in `docs/balance.md` is that `E[net]` is
      positive for a wing built for the target and negative for the same budget
      spent on the wrong shape, and the GAP between those two is where the decision
      lives. `tools/pirate-study.ts` sweeps it across five seeds; this holds the
      sign so a constant change cannot quietly invert it.
    */
    const net = (level: PirateLevel, fleet: Fleet): number => {
      const values: number[] = [];
      for (const spec of schedule(11, 60 * 24).filter((p) => p.level === level).slice(0, 8)) {
        const result = resolveCombat({ ...fleet }, { ...spec.roster }, 0,
          seededFrom('net', spec.index), {
            attacker: { tech: {} },
            defender: { tech: {}, damageMult: PIRATE.damageMult[level] },
          });
        const loot = computeLoot(
          spec.hoard,
          { alloy: 0, crystal: 0, deuterium: 0 },
          { alloy: 0, crystal: 0, deuterium: 0 },
          result.grade,
          fleetCargo(result.attackerSurvivors, {}),
        );
        values.push(
          loot.alloy + loot.crystal + loot.deuterium
          + (fleetValue(result.attackerLosses) + fleetValue(result.defenderLosses)) * DEBRIS.share
          - fleetValue(result.attackerLosses),
        );
      }
      return values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length);
    };

    for (const level of LEVELS) {
      const guns = 30 * level * level;
      // Guns to win the fight and a hold to carry the prize.
      expect(net(level, { DART: guns, COURIER: level + 1 })).toBeGreaterThan(0);
      // The same budget with nothing that shoots.
      expect(net(level, { COURIER: guns / 2 })).toBeLessThan(0);
    }
  });
});

describe('capturing a hull', () => {
  it('happens only on a DECISIVE win', () => {
    const spec = schedule()[0]!;
    const rng = mulberry32(1);
    for (let i = 0; i < 200; i++) {
      expect(pirateCapture(spec.level, spec.roster, 'PARTIAL', rng)).toBeNull();
      expect(pirateCapture(spec.level, spec.roster, 'REPELLED', rng)).toBeNull();
    }
  });

  it('hands over a ship that was actually in that pirate', () => {
    for (const spec of schedule().slice(0, 40)) {
      for (let seed = 0; seed < 30; seed++) {
        const hull = pirateCapture(
          spec.level, spec.roster, 'DECISIVE', seededFrom('cap', spec.index, seed),
        );
        if (hull === null) continue;
        expect((spec.roster[hull] ?? 0)).toBeGreaterThan(0);
      }
    }
  });

  it('can only hand over a ship this raid actually shot down', () => {
    /*
      DRAWN FROM THE CREW THAT WAS FOUGHT, NOT FROM THE ROSTER THAT SET OUT.

      A pirate can be worn down by more than one commander. Reading the launch
      roster let the raid that finished it tow home a hull somebody ELSE had
      destroyed hours earlier — weighted by that hull's original count, so the
      prize a level 4 pirate is hunted for could be won by whoever cleaned up the
      last Dart. The crew standing when the shooting started is the honest pool.
    */
    const spec = schedule()[0]!;
    const fought: Fleet = { DART: 2 };
    for (let seed = 0; seed < 400; seed++) {
      const hull = pirateCapture(4, fought, 'DECISIVE', seededFrom('worn', seed));
      if (hull === null) continue;
      expect(hull).toBe('DART');
    }
    // And a crew that is already gone hands over nothing at all.
    for (let seed = 0; seed < 50; seed++) {
      expect(pirateCapture(spec.level, {}, 'DECISIVE', seededFrom('empty', seed))).toBeNull();
    }
  });

  it('lands near the advertised chance for its level', () => {
    for (const level of LEVELS) {
      const roster = pirateRoster(level, mulberry32(3));
      let hits = 0;
      const runs = 4000;
      const rng = mulberry32(99);
      for (let i = 0; i < runs; i++) if (pirateCapture(level, roster, 'DECISIVE', rng) !== null) hits++;
      expect(hits / runs).toBeGreaterThan(PIRATE.captureChance[level] - 0.03);
      expect(hits / runs).toBeLessThan(PIRATE.captureChance[level] + 0.03);
    }
  });
});

describe('the pirate orbit', () => {
  it('rides one circle and comes back round', () => {
    /*
      The closed orbit is not decoration. A straight pass can only be met by a
      craft FASTER than the target, which is what forced asteroid speeds down until
      the field stopped reading as moving. Because a pirate returns, a fleet of any
      speed has a rendezvous available to it — that is the whole reason a slow
      Bulwark wing can raid one at all.
    */
    for (const spec of schedule().slice(0, 30)) {
      const now = spec.appearsAt + 3;
      const a = piratePosition(spec, now);
      const b = piratePosition(spec, now + spec.period);
      expect(distance(a, b)).toBeLessThan(1e-6);
      expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(spec.radius, 6);
    }
  });

  it('stays inside the playable sphere and inside the shared radius draw', () => {
    for (const spec of schedule()) {
      expect(spec.radius).toBeGreaterThanOrEqual(PIRATE.orbitMin);
      expect(spec.radius).toBeLessThanOrEqual(PIRATE.orbitMax);
      expect(spec.period).toBeCloseTo((2 * Math.PI * spec.radius) / spec.speed, 9);
    }
  });

  it('shares the fourth-power radius draw that keeps opportunity even', () => {
    // The asteroid study measured a linear draw at ~7.6x p90:p10 opportunity
    // imbalance and the fourth-power draw at ~2.1x. One draw, two lanes.
    for (const roll of [0, 0.13, 0.5, 0.87, 1]) {
      expect(orbitRadius(roll, 400, 2000)).toBeCloseTo(asteroidOrbitRadius(roll), 9);
    }
  });

  it('is there between its two moments and nowhere else', () => {
    const spec = schedule()[0]!;
    expect(pirateActive(spec, spec.appearsAt - 0.01)).toBe(false);
    expect(pirateActive(spec, spec.appearsAt)).toBe(true);
    expect(pirateActive(spec, spec.expiresAt - 0.01)).toBe(true);
    expect(pirateActive(spec, spec.expiresAt)).toBe(false);
  });
});

describe('the pirate schedule', () => {
  it('is the same field every time the season key is read', () => {
    expect(schedule(11)).toEqual(schedule(11));
    expect(schedule(11)).not.toEqual(schedule(12));
  });

  it('gives every pirate a stable index, a level and a finite life', () => {
    const field = schedule();
    expect(field.length).toBeGreaterThan(0);
    field.forEach((spec, i) => {
      expect(spec.index).toBe(i);
      expect(LEVELS).toContain(spec.level);
      const life = (spec.expiresAt - spec.appearsAt) / 60;
      expect(life).toBeGreaterThanOrEqual(PIRATE.lifeHoursMin);
      expect(life).toBeLessThanOrEqual(PIRATE.lifeHoursMax);
      expect(spec.appearsAt).toBeGreaterThanOrEqual(0);
    });
  });

  it('spreads arrivals across the whole span rather than bunching them', () => {
    const span = 60 * 24;
    const field = schedule(5, span);
    const first = field.filter((s) => s.appearsAt < span / 2).length;
    expect(first).toBeGreaterThan(field.length * 0.3);
    expect(first).toBeLessThan(field.length * 0.7);
  });

  it('scales with the seats it has to feed', () => {
    // Content that does not scale with the galaxy dies when the galaxy grows.
    const span = 600;
    const field = schedule(3, span);
    const expected = Math.round((PIRATE.spawnPerHour * span) / 60);
    expect(field.length).toBe(expected);
    expect(PIRATE.spawnPerHour).toBeGreaterThan(0);
  });

  it('rolls levels in the advertised proportions', () => {
    const field = generatePirateSchedule(mulberry32(21), 60 * 24 * 30);
    for (const level of LEVELS) {
      const share = field.filter((s) => s.level === level).length / field.length;
      expect(share).toBeGreaterThan(PIRATE.levelWeights[level]! - 0.04);
      expect(share).toBeLessThan(PIRATE.levelWeights[level]! + 0.04);
    }
  });
});

/**
 * ONE SOLVER, TWO LANES. The forced adjacent change recorded in D150.
 *
 * `interceptAsteroid` was the only scan-and-bisect in the game and a pirate needs
 * the identical answer for a different moving thing. A second copy is the failure
 * this codebase has already shipped and named — a rule honoured in one place and
 * forgotten in the other — so the solver was extracted rather than duplicated.
 * The real regression proof is that `invariants.test.ts`'s generated-field sweep
 * stayed green untouched; this asserts the delegation itself.
 */
describe('the shared orbit solver', () => {
  it('answers for a rock exactly as the rock-shaped call does', () => {
    const rocks = generateAsteroidSchedule(mulberry32(4), 60 * 6, 4).slice(0, 25);
    const from = { x: 120, y: -80, z: 300 };
    for (const rock of rocks) {
      const now = rock.appearsAt + 0.5;
      const direct = interceptAsteroid(from, 400, rock, now);
      const shared = interceptOrbit(
        from,
        400,
        (minutes) => orbitPosition(rock, minutes),
        rock.expiresAt,
        now,
      );
      expect(shared).toEqual(direct);
    }
  });

  it('finds a rendezvous a fleet can actually keep', () => {
    /*
      THE MEETING HAS TO BE EXACT, or the ten-second engagement is drawn between a
      fleet and a pirate that is no longer standing there. `travelExact` is the
      canonical trip (D121), so the solve is checked against the same function the
      launch will schedule against.
    */
    /*
      EVERY PIRATE, FROM EVERYWHERE, WITH THE SLOWEST THING WORTH SENDING.

      This is the pirate lane's version of the generated-field sweep
      `invariants.test.ts` runs over the rocks, and it is asserted at 100% rather
      than at a majority on purpose. A visible target a commander cannot reach is
      the worst outcome this feature has: the fog gate already means you may only
      aim at a pirate you can SEE, so an unreachable one is a refusal at the launch
      screen for something the disc is actively showing you.

      THE RIM IS THE CASE THAT MATTERS. The galactic centre is the friendliest
      origin on the map — no orbit is further than the outer radius from it — and a
      sweep that only launched from there would prove nothing about the commanders
      who were seeded on the edge.

      THE SPEEDS ARE READ FROM THE CATALOG, NOT TYPED. This said `const speed = 160`
      beside a comment calling it a Dart, and D152 raised the Dart to 200 and left
      the fixture testing a hull that no longer exists. It also retired the reason
      the comment gave: at 200 a Dart is no longer slower than every pirate
      (`PIRATE.speedMin` is 200 too). That never mattered — a STRAIGHT pass is what
      can only be met by a faster craft; a closed orbit comes back round, so the
      rendezvous exists at any speed, above or below the target's. Both ends of the
      catalog are swept here to say so: 100% at the Dart's 200 with flights of
      4.5-22.5 minutes, and 100% at the slowest mobile hull the game sells — the
      Citadel at 56 — with flights of 10.5-57.5.
    */
    const field = schedule(9, 60 * 12);
    const origins = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1900, y: 200, z: 0 },
    ];
    const slowest = Math.min(...MOBILE_HULLS.map((id) => HULLS[id].speed));
    for (const speed of [HULLS.DART.speed, slowest]) {
      for (const from of origins) {
        for (const spec of field.slice(0, 40)) {
          const now = spec.appearsAt + 0.25;
          const hit = interceptOrbit(
            from, speed, (m) => piratePosition(spec, m), spec.expiresAt, now,
          );
          expect(hit, `speed ${String(speed)}`).not.toBeNull();
          expect(hit!.meetsAtMinutes).toBeLessThan(spec.expiresAt);
          expect(hit!.meetsAtMinutes).toBeGreaterThan(now);
          expect(distance(hit!.at, piratePosition(spec, hit!.meetsAtMinutes))).toBeLessThan(1e-6);
          expect(travelExact(distance(from, hit!.at), speed)).toBeCloseTo(hit!.flightMinutes, 6);
        }
      }
    }
  });

  it('aims ahead of a pirate rather than a lap behind it', () => {
    /*
      THE MIRROR OF THE ROCK LANE'S LEAD TEST, and it is the same design rule.

      `invariants.test.ts` holds a drill's aim point under a QUARTER revolution at
      the median, because a craft that has to wait for another lap reads as a craft
      flying somewhere unrelated — the owner reported that about the rocks, D40 and
      D121 fixed it, and the ceiling has been asserted ever since. Nothing held the
      same line on this lane, and the same bug duly appeared here: at the old speed
      band the median meeting was a third of a lap away with three quarters of them
      past the pirate's own position.

      Measured over the generated lane rather than a fixture, so a future change to
      the lane re-measures the geometry instead of assuming it.
    */
    const field = schedule(11, 60 * 12);
    const origins = [
      { x: 0, y: 0, z: 0 },
      { x: 1000, y: 0, z: 0 },
      { x: 1900, y: 200, z: 0 },
      { x: -1400, y: -120, z: 900 },
    ];
    const laps: number[] = [];
    for (const from of origins) {
      for (const spec of field.slice(0, 120)) {
        const now = spec.appearsAt + 0.25;
        const hit = interceptOrbit(
          from, HULLS.DART.speed, (m) => piratePosition(spec, m), spec.expiresAt, now,
        );
        if (!hit) continue;
        laps.push(hit.flightMinutes / spec.period);
      }
    }
    expect(laps.length).toBeGreaterThan(200);
    // A lead at all: a fleet aimed at where the pirate IS would meet empty space.
    expect(median(laps)).toBeGreaterThan(0);
    // And a lead shot rather than a lap of waiting — the rock lane's own ceiling.
    expect(median(laps)).toBeLessThan(0.25);
    // A median hides a tail, and one baffling launch is the memory that sticks.
    expect(Math.max(...laps)).toBeLessThan(1);
  });

  it('refuses a meeting that would land after the pirate is gone', () => {
    const spec = schedule()[0]!;
    expect(
      interceptOrbit({ x: 0, y: 0, z: 0 }, 160, (m) => piratePosition(spec, m), spec.expiresAt, spec.expiresAt + 1),
    ).toBeNull();
    expect(
      interceptOrbit({ x: 0, y: 0, z: 0 }, 0, (m) => piratePosition(spec, m), spec.expiresAt, spec.appearsAt),
    ).toBeNull();
  });
});
