import { describe, expect, it } from 'vitest';
import { COMBAT, HULLS, PIRATE, activeBattleFleet, fleetCount, mulberry32, resolveBattle, shieldHp, shipShieldHp } from '@astera/rules';
import { DEFAULT_SCENARIO, SIMULATION_UNIT_LIMIT, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline, sampleReplay } from '../src/battle-simulator/timeline.js';

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
