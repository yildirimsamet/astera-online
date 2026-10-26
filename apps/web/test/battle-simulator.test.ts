import { describe, expect, it } from 'vitest';
import { COMBAT, HULLS, PIRATE, activeBattleFleet, fleetCount, mulberry32, pirateOverrun, resolveBattle, resolveMonumentCombat, shieldHp, shipShieldHp } from '@astera/rules';
import { DEFAULT_SCENARIO, SIMULATION_UNIT_LIMIT, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { VOLLEY_SECONDS, buildReplayTimeline, sampleReplay, type ShotEvent } from '../src/battle-simulator/timeline.js';

describe('isolated battle simulator uses the real shared rules', () => {
  it('uses both owners research, entry wounds and Aegis charge with exact engine parity', () => {
    const scenario = scenarioSchema.parse(DEFAULT_SCENARIO);
    const run = simulateScenario(scenario);
    expect(run.recording.roundLimit).toBe(COMBAT.rounds);
    expect(run.aegisCapacity).toBe(shieldHp(scenario.aegisLevel));
    expect(run.recording.initialAegis / run.aegisCapacity).toBe(scenario.aegisCharge / 100);
    expect(run.recording.ships.some(s => s.hull === 'NULLIFIER')).toBe(true);
    expect(run.recording.ships.some(s => HULLS[s.hull].ground)).toBe(true);
    const plain = resolveBattle(run.attackers, run.defenders, run.recording.initialAegis, mulberry32(scenario.seed), 'HP_PLANET', true);
    expect(run.result).toEqual(plain);
    const changed = structuredClone(scenario);
    changed.attackers[0]!.tech.SHIP_SHIELDS = 4;
    changed.attackers[0]!.health.CORSAIR = 50;
    const other = simulateScenario(changed);
    const ship = other.recording.ships.find(s => s.side === 'ATTACK' && s.hull === 'CORSAIR')!;
    expect(ship.shield).toBe(shipShieldHp(changed.attackers[0]!.tech, 'CORSAIR'));
    expect(ship.hp).toBe(ship.maxHp * .5);
    expect(simulateScenario(scenario)).toEqual(run);
  });

  it('takes inactive ground guns and Aegis out of an EMP/offline fight without changing mobile defenders', () => {
    const run = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, defenceOffline: true }));
    expect(run.recording.initialAegis).toBe(0);
    expect(run.recording.ships.filter(s => s.side === 'DEFENCE').length).toBeGreaterThan(0);
    expect(run.recording.ships.some(s => HULLS[s.hull].ground)).toBe(false);
  });

  it('supports empty defenders, cargo-only fleets, and separate supporting owners', () => {
    const scenario = scenarioSchema.parse(DEFAULT_SCENARIO);
    scenario.defenders[0]!.fleet = {};
    expect(simulateScenario(scenario).recording.rounds).toEqual([]);
    scenario.attackers[0]!.fleet = { COURIER: 1 };
    scenario.defenders[0]!.fleet = { ARGOSY: 1 };
    expect(simulateScenario(scenario).recording.rounds).toEqual([]);
    scenario.attackers.push({ ...structuredClone(scenario.attackers[0]!), id: 'ally', fleet: { CORSAIR: 1 } });
    const run = simulateScenario(scenario);
    expect(new Set(run.recording.ships.filter(s => s.side === 'ATTACK').map(s => s.playerId)).size).toBe(2);
  });

  it('uses monument control and pirate damage modifiers without planetary defences in those environments', () => {
    const scenario = scenarioSchema.parse(DEFAULT_SCENARIO);
    scenario.environment = 'MONUMENT';
    scenario.aegisLevel = 0;
    scenario.attackers[0]!.fleet = { CORSAIR: 3 };
    scenario.defenders[0]!.fleet = { CORSAIR: 1 };
    const run = simulateScenario(scenario);
    expect(run.control).toBe('ATTACKER');
    expect(run.recording.initialAegis).toBe(0);
    expect(fleetCount(activeBattleFleet(run.result.defenderSurvivors, run.result.defenderRetreated))).toBe(0);
    scenario.pirateLevel = 1;
    const pirate = simulateScenario(scenario);
    expect(pirate.recording.ships.find(s => s.side === 'DEFENCE')?.attack).toBe(HULLS.CORSAIR.atk * PIRATE.damageMult[1]);
  });

  it('uses the real pre-battle escape and fuel checks, recording only the fight that actually occurs', () => {
    const scenario = scenarioSchema.parse({ ...DEFAULT_SCENARIO, automaticEscape: true, deuterium: 100000, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CORSAIR: 20 } }], defenders: [{ id: 'd', fleet: { DART: 5, BASTION: 1 } }] });
    const escaped = simulateScenario(scenario);
    expect(escaped.escape?.kind).toBe('ESCAPED');
    expect(escaped.recording.ships.some(s => s.side === 'DEFENCE' && s.hull === 'DART')).toBe(false);
    expect(escaped.result.defenderLosses.DART ?? 0).toBe(0);
    scenario.deuterium = 0;
    const stranded = simulateScenario(scenario);
    expect(stranded.escape?.kind).toBe('STRANDED');
    expect(stranded.recording.ships.filter(s => s.side === 'DEFENCE' && s.hull === 'DART')).toHaveLength(5);
  });

  it.each([
    { seed: -1 }, { seed: 1.5 }, { aegisCharge: 101 }, { aegisLevel: -1 },
    { attackers: [{ id: 'a', fleet: { DART: -1 } }] },
    { attackers: [{ id: 'a', fleet: { DART: 1.5 } }] },
    { attackers: [{ id: 'a', fleet: { FAKE: 2 } }] },
    { attackers: [{ id: 'a', fleet: { DART: Infinity } }] },
    { attackers: [{ id: 'a', fleet: { BASTION: 1 } }] },
    { attackers: [{ id: 'a', fleet: { DART: SIMULATION_UNIT_LIMIT + 1 } }] },
    { defenders: [{ id: 'd', fleet: { DART: 1 }, tech: { SHIP_SHIELDS: 99 } }] },
    { environment: 'MONUMENT' },
  ])('rejects unsafe or physically invalid editor input: %j', over => {
    expect(scenarioSchema.safeParse({ ...DEFAULT_SCENARIO, ...over }).success).toBe(false);
  });
});

/**
 * THE SIMULATOR FIGHTS EACH BATTLE THE WAY THE SERVER DOES (review 2026-10-25). A pirate is
 * `pirateRaid.ts`: no research, no Aegis, no guns, exempt from maintenance, its unescorted holds
 * taken after the fight. A monument is `resolveMonumentCombat`, its surviving cargo withdrawing
 * when the attacker takes control. A ship at or under 5% hull never stands in a line.
 */
describe('the simulator fights each battle the way the server does', () => {
  it('fights a pirate as pirateRaid does: no research, no Aegis, holds taken once the line falls', () => {
    // A pirate fights in open space, as its replay is drawn (`pirateRaid.ts`).
    const scenario = scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 7, pirateLevel: 2, environment: 'MONUMENT', aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CORSAIR: 1 } }],
      defenders: [{ id: 'd', fleet: { PIKE: 1, ARGOSY: 6 }, tech: { SHIP_POWER: 5, SHIP_ARMOR: 5 } }] });
    const run = simulateScenario(scenario);
    expect(run.recording.initialAegis).toBe(0);
    expect(run.control).toBeNull();
    const pike = run.recording.ships.find(s => s.side === 'DEFENCE' && s.hull === 'PIKE')!;
    expect(pike.attack).toBe(HULLS.PIKE.atk * PIRATE.damageMult[2]);
    expect(pike.maxHp).toBe(HULLS.PIKE.hp);
    const fought = resolveBattle(run.attackers, [{ stackId: 'd:d', playerId: 'd:d', fleet: { PIKE: 1, ARGOSY: 6 },
      tech: { tech: {}, damageMult: PIRATE.damageMult[2] }, maintenanceExempt: true }], 0, mulberry32(7), 'HP_PLANET', true);
    expect(run.result).toEqual(pirateOverrun(fought, { CORSAIR: 1 }));
    expect(run.result.grade).toBe('DECISIVE');
    expect(run.recording.aftermath?.[0]?.kind).toBe('PIRATE_OVERRUN');
    expect(run.recording.aftermath?.[0]?.shipIds.length).toBeGreaterThan(0);
    expect(run.recording.finalState?.filter(s => run.recording.aftermath![0]!.shipIds.includes(s.id)).every(s => s.status === 'DESTROYED')).toBe(true);
  });

  it('lets only a warship able to fire take a pirate’s holds, as pirateRaid counts its escort', () => {
    const pirate = (health: number) => simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 3, pirateLevel: 1, environment: 'MONUMENT',
      aegisLevel: 0, attackers: [{ id: 'a', fleet: { CORSAIR: 1, VIPER: 1 }, health: { CORSAIR: health } }], defenders: [{ id: 'd', fleet: { ARGOSY: 12 } }] }));
    expect(pirate(100).recording.aftermath?.[0]?.kind).toBe('PIRATE_OVERRUN');
    // The Viper still escorts; a grounded Corsair alone does not.
    expect(pirate(5).recording.aftermath?.[0]?.kind).toBe('PIRATE_OVERRUN');
    const alone = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 3, pirateLevel: 1, environment: 'MONUMENT', aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CORSAIR: 1 }, health: { CORSAIR: 5 } }], defenders: [{ id: 'd', fleet: { ARGOSY: 12 } }] }));
    expect(alone.recording.aftermath).toBeUndefined();
    expect(alone.result.grade).not.toBe('DECISIVE');
  });

  it('refuses pirate settings no pirate has', () => {
    const pirate = { ...DEFAULT_SCENARIO, pirateLevel: 1, environment: 'MONUMENT', aegisLevel: 0 };
    expect(scenarioSchema.safeParse({ ...pirate, environment: 'PLANET', defenders: [{ id: 'd', fleet: { DART: 1 } }] }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...pirate, defenders: [{ id: 'd', fleet: { DART: 1 } }, { id: 'e', fleet: { DART: 1 } }] }).success).toBe(false);
    expect(scenarioSchema.safeParse({ ...pirate, defenders: [{ id: 'd', fleet: { DART: 1 } }] }).success).toBe(true);
  });

  it('fights a monument as resolveMonumentCombat does, and withdraws the cargo the attacker drove off', () => {
    const scenario = scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 5, environment: 'MONUMENT', aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CORSAIR: 1 } }], defenders: [{ id: 'd', fleet: { PIKE: 1, ARGOSY: 6 } }] });
    const run = simulateScenario(scenario);
    const real = resolveMonumentCombat(run.attackers, run.defenders, mulberry32(5), true);
    expect(run.control).toBe(real.control);
    expect(run.result.grade).toBe(real.grade);
    expect(run.control).toBe('ATTACKER');
    const argosies = run.recording.ships.filter(s => s.side === 'DEFENCE' && s.hull === 'ARGOSY').map(s => s.id);
    expect(run.recording.aftermath).toEqual([{ kind: 'CARGO_WITHDRAWAL', shipIds: argosies }]);
    expect(run.recording.finalState?.filter(s => argosies.includes(s.id)).every(s => s.status === 'RETREATED')).toBe(true);
  });

  it('fields a ship at or under 5% hull as the engine does: out of a planet’s line, a target that cannot fire elsewhere', () => {
    const scenario = (over: object) => scenarioSchema.parse({ ...DEFAULT_SCENARIO, aegisLevel: 0, ...over });
    // A planet defender grounded for repair stays home; a grounded attacker flies as a target that cannot fire.
    const planet = simulateScenario(scenario({ attackers: [{ id: 'a', fleet: { DART: 2, CORSAIR: 2 }, health: { DART: 5 } }],
      defenders: [{ id: 'd', fleet: { DART: 3, PIKE: 1 }, health: { DART: 3 } }] }));
    expect(planet.recording.ships.filter(s => s.side === 'DEFENCE' && s.hull === 'DART')).toHaveLength(0);
    const passive = planet.recording.ships.filter(s => s.side === 'ATTACK' && s.hull === 'DART');
    expect(passive).toHaveLength(2);
    expect(passive.every(s => !s.canFire)).toBe(true);
    expect(planet.recording.ships.find(s => s.side === 'ATTACK' && s.hull === 'CORSAIR')?.canFire).toBe(true);
    // At a monument the wounded stand in the field without firing.
    const monument = simulateScenario(scenario({ environment: 'MONUMENT', attackers: [{ id: 'a', fleet: { CORSAIR: 2 } }],
      defenders: [{ id: 'd', fleet: { DART: 2, PIKE: 1 }, health: { DART: 4 } }] }));
    const wounded = monument.recording.ships.filter(s => s.side === 'DEFENCE' && s.hull === 'DART');
    expect(wounded).toHaveLength(2);
    expect(wounded.every(s => !s.canFire)).toBe(true);
    // A pirate is exempt from maintenance: its wounded still fire.
    const pirate = simulateScenario(scenario({ environment: 'MONUMENT', pirateLevel: 1, attackers: [{ id: 'a', fleet: { CORSAIR: 2 } }],
      defenders: [{ id: 'd', fleet: { DART: 2 }, health: { DART: 4 } }] }));
    expect(pirate.recording.ships.filter(s => s.side === 'DEFENCE').every(s => s.canFire)).toBe(true);
  });

  it('records the damage scale every shot already carries', () => {
    const run = simulateScenario(scenarioSchema.parse(DEFAULT_SCENARIO));
    expect(run.recording.damageScale?.attacker).toBeGreaterThan(0);
    expect(run.result.balance?.attackerPower).toBeGreaterThan(0);
  });
});

describe('seekable battle replay timeline', () => {
  it('keeps entry values until the real impact and applies that exact recorded hit', () => {
    const run = simulateScenario(scenarioSchema.parse(DEFAULT_SCENARIO));
    const timeline = buildReplayTimeline(run.recording);
    const first = timeline.events.find(e => e.kind === 'HIT')!;
    const before = sampleReplay(timeline, first.at - .00001);
    const after = sampleReplay(timeline, first.at);
    expect(before.ships.get(first.hit.targetId)?.hp).toBe(first.hit.hpBefore);
    expect(after.ships.get(first.hit.targetId)?.hp).toBe(first.hit.hpAfter);
    expect(after.ships.get(first.hit.targetId)?.shield).toBe(first.hit.shieldAfter);
  });

  it('finishes exactly at the authoritative final state and allows backwards seeking without cumulative damage', () => {
    const { recording } = simulateScenario(scenarioSchema.parse(DEFAULT_SCENARIO));
    const timeline = buildReplayTimeline(recording);
    const final = sampleReplay(timeline, timeline.duration);
    for (const state of recording.rounds.at(-1)!.after) expect(final.ships.get(state.id)).toEqual(state);
    expect(final.aegis).toBe(recording.rounds.at(-1)!.aegisAfter);
    const start = sampleReplay(timeline, 0);
    for (const ship of recording.ships) expect(start.ships.get(ship.id)?.hp).toBe(ship.hp);
    expect(sampleReplay(timeline, -10)).toEqual(start);
    expect(sampleReplay(timeline, timeline.duration + 10)).toEqual(final);
  });

  it('plays attacker shots and defender shots one at a time while preserving every authoritative hit', () => {
    const { recording } = simulateScenario(scenarioSchema.parse(DEFAULT_SCENARIO));
    const timeline = buildReplayTimeline(recording);
    for (const round of recording.rounds) {
      const events = timeline.events.filter(e => e.round === round.round);
      const attack = events.filter(e => e.kind === 'SHOT' && e.side === 'ATTACK');
      const defence = events.filter(e => e.kind === 'SHOT' && e.side === 'DEFENCE');
      const ordered = [...attack, ...defence];
      for (let i = 1; i < ordered.length; i++) {
        const previous = ordered[i - 1]!, next = ordered[i]!;
        if (previous.kind === 'SHOT') expect(next.at).toBeGreaterThan(previous.impactEnd);
      }
      for (const side of ['ATTACK', 'DEFENCE'] as const) {
        const actual = events.filter(e => e.kind === 'HIT' && e.side === side);
        const expected = (side === 'ATTACK' ? round.attackerShots : round.defenderShots).flatMap(s => s.hits);
        expect(actual.map(e => e.kind === 'HIT' ? e.hit : null)).toEqual(expected);
      }
    }
  });

  // 200v200 played one shot at a time ran for half an hour. A big side fires as one long volley.
  it('fires a large side as overlapping volleys, so a turn lasts about as long as a small one, and still shows every shot in order', () => {
    const { recording } = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 3, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 100, CORSAIR: 100 } }], defenders: [{ id: 'd', fleet: { RAMPART: 100, CITADEL: 100 } }] }));
    const timeline = buildReplayTimeline(recording);
    for (const turn of timeline.rounds) {
      const round = recording.rounds.find(item => item.round === turn.round)!;
      const shots = timeline.events.filter((e): e is ShotEvent => e.kind === 'SHOT' && e.round === turn.round);
      for (const [side, from, to, recorded] of [['ATTACK', turn.openingEnd, turn.defenderStart, round.attackerShots], ['DEFENCE', turn.defenderStart, turn.retreatAt, round.defenderShots]] as const) {
        const list = shots.filter(e => e.side === side);
        expect(list.map(e => e.shot)).toEqual(recorded);
        for (let i = 1; i < list.length; i++) expect(list[i]!.at).toBeGreaterThan(list[i - 1]!.at);
        if (list.length > 12) expect(to - from).toBeLessThanOrEqual(VOLLEY_SECONDS + 3);
      }
    }
    expect(timeline.duration).toBeLessThan(recording.rounds.length * 45);
  });

  it('keeps a zero-HP defender visible for its frozen firing right, then destroys it after its own shot', () => {
    const scenario = scenarioSchema.parse({ ...DEFAULT_SCENARIO, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CATACLYSM: 2 } }], defenders: [{ id: 'd', fleet: { DART: 1 } }] });
    const { recording } = simulateScenario(scenario), timeline = buildReplayTimeline(recording);
    const defender = recording.ships.find(ship => ship.side === 'DEFENCE')!;
    const lethal = timeline.events.find(event => event.kind === 'HIT' && event.hit.targetId === defender.id && event.hit.hpAfter === 0)!;
    const returnFire = timeline.events.find(event => event.kind === 'SHOT' && event.shot.sourceId === defender.id)!;
    const beforeReply = sampleReplay(timeline, lethal.at + .01);
    expect(beforeReply.ships.get(defender.id)?.hp).toBe(0);
    expect(beforeReply.pendingFire.has(defender.id)).toBe(true);
    expect(returnFire.at).toBeGreaterThan(lethal.at);
    if (returnFire.kind === 'SHOT') {
      expect(sampleReplay(timeline, returnFire.impactEnd + .01).pendingFire.has(defender.id)).toBe(false);
      const destruction = timeline.events.find(event => event.kind === 'DESTROY' && event.shipId === defender.id)!;
      expect(destruction.at).toBeGreaterThanOrEqual(returnFire.impactEnd);
    }
  });

  it('shows Aegis absorption before overflow impacts and exposes only actual damage badges', () => {
    const { recording } = simulateScenario(scenarioSchema.parse(DEFAULT_SCENARIO));
    const timeline = buildReplayTimeline(recording);
    const shieldHit = timeline.events.find(event => event.kind === 'AEGIS_HIT' || event.kind === 'AEGIS_STRIKE')!;
    expect(shieldHit).toBeDefined();
    const hit = shieldHit.kind === 'AEGIS_STRIKE' ? shieldHit.strike : shieldHit.hit;
    expect(sampleReplay(timeline, shieldHit.at - .001).aegis).toBe(hit.aegisBefore);
    expect(sampleReplay(timeline, shieldHit.at).aegis).toBe(hit.aegisAfter);
    const impact = timeline.events.find(event => event.kind === 'HIT' && event.hit.hullDamage + event.hit.shieldDamage > 0)!;
    if (impact.kind !== 'HIT') throw new Error('expected unit impact');
    const badge = sampleReplay(timeline, impact.at).damageBadges.find(item => item.targetId === impact.hit.targetId)!;
    expect(badge.hullDamage).toBeCloseTo(impact.hit.hullDamage);
    expect(badge.shieldDamage).toBeCloseTo(impact.hit.shieldDamage);
    expect(sampleReplay(timeline, 0).damageBadges).toEqual([]);
  });

  it('keeps the special Aegis bonus separate from normal absorption in the live frame', () => {
    const timeline = buildReplayTimeline(simulateScenario(DEFAULT_SCENARIO).recording);
    const bonus = timeline.events.find(event => event.kind === 'AEGIS_STRIKE')!;
    const frame = sampleReplay(timeline, bonus.at);
    const recent = timeline.events.filter(event => event.kind === 'AEGIS_STRIKE' && event.at <= bonus.at && bonus.at - event.at < 1.2);
    expect(frame.aegisBonusDamage).toBeCloseTo(recent.reduce((sum, event) => sum + (event.kind === 'AEGIS_STRIKE' ? event.strike.damage : 0), 0));
    expect(frame.aegisDamage).toBeCloseTo(frame.aegisNormalDamage + frame.aegisBonusDamage);
    expect(sampleReplay(timeline, 0).aegisBonusDamage).toBe(0);
  });
});
