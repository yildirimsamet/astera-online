import { z } from 'zod';
import {
  ALL_HULLS, BATTLE_REPLAY_RESEARCH, ESCAPE, HULLS, PIRATE, RESEARCH_PROJECTS, activeBattleFleet, createBattleRecording,
  fleetCount, fleetEntries, mulberry32, partitionCombatFleet, pirateOverrun, resolveBattle, resolveMonumentCombat, resolveRaid, shieldHp,
  type BattleRecording, type BattleReplayOwner, type DefenderStack, type EscapeOutcome, type Fleet, type HullId, type HpDamageLot, type JointAttackerStack,
} from '@astera/rules';

/**
 * Local budget, not a limit on fleets in the real game: 500 against 500. Combat v3 records one target
 * per shot, so 1,000 units resolve in ~20 ms into a ~2 MB recording; the cost that sets this number
 * is the replay stage on a mid-range phone (docs/simulator-mobile-ux-plan-2026-10-26.md).
 */
export const SIMULATION_UNIT_LIMIT = 1000;
export const COMBAT_RESEARCH = BATTLE_REPLAY_RESEARCH;
const hull = z.string().refine((value): value is HullId => ALL_HULLS.some(id => id === value), 'unknown hull');
const fleet = z.record(hull, z.number().int().min(0).max(SIMULATION_UNIT_LIMIT)).default({});
const health = z.record(hull, z.number().int().min(1).max(100)).default({});
const level = (id: typeof COMBAT_RESEARCH[number]) => z.number().int().min(0).max(RESEARCH_PROJECTS[id].maxLevel).default(0);
const participant = z.object({
  id: z.string().min(1).max(50), fleet, health,
  tech: z.object({ SHIP_POWER: level('SHIP_POWER'), SHIP_ARMOR: level('SHIP_ARMOR'),
    SHIP_SHIELDS: level('SHIP_SHIELDS'), EMPLACEMENT_DOCTRINE: level('EMPLACEMENT_DOCTRINE') }).default({}),
});
export const scenarioSchema = z.object({
  seed: z.number().int().min(0).max(0xffffffff),
  environment: z.enum(['PLANET', 'MONUMENT']).default('PLANET'),
  aegisLevel: z.number().int().min(0).max(20).default(0),
  aegisCharge: z.number().min(0).max(100).default(100),
  defenceOffline: z.boolean().default(false),
  automaticEscape: z.boolean().default(false), deuterium: z.number().int().min(0).max(1_000_000_000).default(100000),
  pirateLevel: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).default(0),
  attackers: z.array(participant).min(1).max(5), defenders: z.array(participant).min(1).max(5),
}).superRefine((input, ctx) => {
  let units = 0;
  for (const [side, participants] of [['attackers', input.attackers], ['defenders', input.defenders]] as const) {
    const ids = new Set<string>();
    for (let index = 0; index < participants.length; index++) {
      const owner = participants[index]!;
      if (ids.has(owner.id)) ctx.addIssue({ code: 'custom', path: [side, index, 'id'], message: 'duplicate owner' });
      ids.add(owner.id);
      for (const [id, count] of fleetEntries(owner.fleet)) {
        units += count;
        if (HULLS[id].ground && (side === 'attackers' || index > 0 || input.environment === 'MONUMENT')) {
          ctx.addIssue({ code: 'custom', path: [side, index, 'fleet', id], message: 'ground defences require the planet host' });
        }
      }
    }
  }
  if (units > SIMULATION_UNIT_LIMIT) ctx.addIssue({ code: 'custom', message: 'recording size limit' });
  if (input.environment === 'MONUMENT' && input.aegisLevel > 0) {
    ctx.addIssue({ code: 'custom', path: ['aegisLevel'], message: 'no planetary shield in space' });
  }
  // A pirate is one crew in open space, with no research, Aegis or guns (`pirateRaid.ts`).
  if (input.pirateLevel > 0 && (input.environment !== 'MONUMENT' || input.defenders.length > 1)) {
    ctx.addIssue({ code: 'custom', path: ['pirateLevel'], message: 'a pirate is one crew in open space' });
  }
  if (input.automaticEscape && (input.environment !== 'PLANET' || input.defenders.length > 1)) {
    ctx.addIssue({ code: 'custom', path: ['automaticEscape'], message: 'automatic fleet escape requires an unsupported planet host' });
  }
});
export type BattleScenario = z.infer<typeof scenarioSchema>;
export type SimulationParticipant = BattleScenario['attackers'][number];
export const DEFAULT_SCENARIO: BattleScenario = scenarioSchema.parse({
  seed: 20261024, environment: 'PLANET', aegisLevel: 6, aegisCharge: 75,
  attackers: [{ id: '1', fleet: { CORSAIR: 4, VIPER: 4, NULLIFIER: 2, COURIER: 1 } }],
  defenders: [{ id: '1', fleet: { CITADEL: 2, DART: 6, BASTION: 2, THORN: 1 } }],
});

/**
 * What happens after the last round, written into the recording as the server writes it into a
 * replay (`buildBattleReplay`): the defending cargo still flying is taken (a pirate's) or withdraws
 * (a monument's), and the final state says so.
 */
function settleAftermath(recording: BattleRecording, kind: 'PIRATE_OVERRUN' | 'CARGO_WITHDRAWAL'): void {
  const finalState = (recording.rounds.at(-1)?.after ?? recording.ships).map(({ id, hp, shield, status }) => ({ id, hp, shield, status }));
  const shipIds = recording.ships.filter(ship => ship.side === 'DEFENCE' && (ship.cls ?? HULLS[ship.hull].cls) === 'SUPPORT'
    && finalState.some(state => state.id === ship.id && state.status === 'ACTIVE' && state.hp > 0)).map(ship => ship.id);
  for (const state of finalState) if (shipIds.includes(state.id)) {
    state.status = kind === 'PIRATE_OVERRUN' ? 'DESTROYED' : 'RETREATED';
    if (kind === 'PIRATE_OVERRUN') { state.hp = 0; state.shield = 0; }
  }
  recording.finalState = finalState;
  if (shipIds.length > 0) recording.aftermath = [{ kind, shipIds }];
}

/** Only freely chosen scenario inputs enter here; no live player or intelligence queries. */
export function simulateScenario(input: BattleScenario) {
  const damage = (owner: SimulationParticipant): HpDamageLot[] => fleetEntries(owner.fleet).flatMap(([hull, count]) => {
    const pct = owner.health[hull] ?? 100;
    return pct === 100 ? [] : [{ hull, count, damageBp: (100 - pct) * 100 }];
  });
  const attackers: JointAttackerStack[] = input.attackers.map(owner => ({
    contributionId: `a:${owner.id}`, playerId: `a:${owner.id}`, fleet: owner.fleet,
    tech: { tech: owner.tech }, damage: damage(owner),
  }));
  const level = input.pirateLevel, pirate = level > 0;
  const defenders: DefenderStack[] = input.defenders.map(owner => ({
    stackId: `d:${owner.id}`, playerId: `d:${owner.id}`,
    fleet: Object.fromEntries(fleetEntries(owner.fleet).filter(([hull]) => !input.defenceOffline || !HULLS[hull].ground)),
    // A pirate crew holds no research and is never grounded for maintenance (`pirateRaid.ts`).
    tech: level === 0 ? { tech: owner.tech } : { tech: {}, damageMult: PIRATE.damageMult[level] },
    damage: damage(owner).filter(lot => !input.defenceOffline || !HULLS[lot.hull].ground),
    ...(pirate ? { maintenanceExempt: true } : {}),
  }));
  const recording = createBattleRecording();
  const shield = input.environment === 'PLANET' && !input.defenceOffline ? shieldHp(input.aegisLevel) * input.aegisCharge / 100 : 0;
  let escape: EscapeOutcome | null = null;
  if (input.automaticEscape) {
    const host = defenders[0]!;
    const raid = resolveRaid({ stacks: attackers, line: host.fleet, shield, rng: () => mulberry32(input.seed),
      defender: host.tech, deuterium: input.deuterium, escape: true, minimumCombatShips: ESCAPE.minimumCombatShips,
      hostPlayerId: host.playerId, homeDamage: host.damage, maintenance: true, preciseDamage: true });
    escape = raid.escape;
    if (escape?.kind === 'ESCAPED') defenders[0] = { ...host,
      fleet: Object.fromEntries(fleetEntries(host.fleet).filter(([hull]) => HULLS[hull].ground)),
      damage: host.damage?.filter(lot => HULLS[lot.hull].ground) };
  }
  // Each battlefield through the call the server settles it with.
  let result, control: 'ATTACKER' | 'DEFENDER' | 'EMPTY' | null = null, aftermath: 'PIRATE_OVERRUN' | 'CARGO_WITHDRAWAL' | null = null;
  if (pirate) {
    const fought = resolveBattle(attackers, defenders, 0, mulberry32(input.seed), 'HP_PLANET', true, recording);
    // Only a ship able to fire takes the holds (`pirateRaid.ts`): grounded attackers are not escorts.
    const ready: Fleet = {};
    for (const stack of attackers) for (const [hull, count] of fleetEntries(partitionCombatFleet(stack.fleet, stack.damage).eligible)) ready[hull] = (ready[hull] ?? 0) + count;
    result = pirateOverrun(fought, ready);
    if (result !== fought) aftermath = 'PIRATE_OVERRUN';
  } else if (input.environment === 'MONUMENT') {
    const fought = resolveMonumentCombat(attackers, defenders, mulberry32(input.seed), true, recording);
    result = fought; control = fought.control;
    if (control === 'ATTACKER' && fleetCount(activeBattleFleet(result.defenderSurvivors, result.defenderRetreated)) > 0) aftermath = 'CARGO_WITHDRAWAL';
  } else {
    result = resolveBattle(attackers, defenders, shield, mulberry32(input.seed), 'HP_PLANET', true, recording);
  }
  if (aftermath) settleAftermath(recording, aftermath);
  const owners: BattleReplayOwner[] = [
    ...attackers.map((owner, index) => ({ side: 'ATTACK' as const, playerId: owner.playerId, stackId: owner.contributionId, wing: index + 1, research: { ...owner.tech.tech } })),
    ...defenders.map((owner, index) => ({ side: 'DEFENCE' as const, playerId: owner.playerId, stackId: owner.stackId, wing: index + 1, research: { ...owner.tech.tech } })),
  ];
  return { recording, owners, result, control, attackers, defenders, escape, environment: input.environment, seed: input.seed,
    aegisCapacity: input.environment === 'PLANET' ? shieldHp(input.aegisLevel) : 0, defenceOffline: input.defenceOffline };
}
export type BattleSimulation = ReturnType<typeof simulateScenario>;
