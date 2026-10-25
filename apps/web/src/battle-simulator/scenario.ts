import { z } from 'zod';
import {
  ALL_HULLS, BATTLE_REPLAY_RESEARCH, ESCAPE, HULLS, PIRATE, RESEARCH_PROJECTS, activeBattleFleet, createBattleRecording,
  fleetEntries, monumentBattleControl, mulberry32, resolveBattle, resolveRaid, shieldHp,
  type BattleReplayOwner, type DefenderStack, type EscapeOutcome, type HullId, type HpDamageLot, type JointAttackerStack,
} from '@astera/rules';

/** Local recording budget, not a limit on fleets in the real game. Pairwise hits cost memory. */
export const SIMULATION_UNIT_LIMIT = 400;
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
  const defenders: DefenderStack[] = input.defenders.map(owner => ({
    stackId: `d:${owner.id}`, playerId: `d:${owner.id}`,
    fleet: Object.fromEntries(fleetEntries(owner.fleet).filter(([hull]) => !input.defenceOffline || !HULLS[hull].ground)),
    tech: { tech: owner.tech, damageMult: input.pirateLevel === 0 ? 1 : PIRATE.damageMult[input.pirateLevel] },
    damage: damage(owner).filter(lot => !input.defenceOffline || !HULLS[lot.hull].ground),
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
  const result = resolveBattle(attackers, defenders, shield, mulberry32(input.seed), input.environment === 'PLANET' ? 'HP_PLANET' : 'MONUMENT', true, recording);
  const control = input.environment === 'MONUMENT'
    ? monumentBattleControl(result.attackerCombatSurvivors ?? activeBattleFleet(result.attackerSurvivors, result.attackerRetreated),
      activeBattleFleet(result.defenderSurvivors, result.defenderRetreated)) : null;
  const owners: BattleReplayOwner[] = [
    ...attackers.map((owner, index) => ({ side: 'ATTACK' as const, playerId: owner.playerId, stackId: owner.contributionId, wing: index + 1, research: { ...owner.tech.tech } })),
    ...defenders.map((owner, index) => ({ side: 'DEFENCE' as const, playerId: owner.playerId, stackId: owner.stackId, wing: index + 1, research: { ...owner.tech.tech } })),
  ];
  return { recording, owners, result, control, attackers, defenders, escape, environment: input.environment, seed: input.seed,
    aegisCapacity: input.environment === 'PLANET' ? shieldHp(input.aegisLevel) : 0, defenceOffline: input.defenceOffline };
}
export type BattleSimulation = ReturnType<typeof simulateScenario>;
