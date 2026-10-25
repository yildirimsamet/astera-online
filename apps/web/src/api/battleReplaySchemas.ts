import type { BattleReplayData, BattleSide } from '@astera/rules';
import { z } from 'zod';
import { grade, hullId } from './schemas.js';

const nonnegative = z.number().finite().nonnegative();
const side = z.enum(['ATTACK', 'DEFENCE']);
const shipState = z.object({ id: z.string().min(1), hp: nonnegative, shield: nonnegative, status: z.enum(['ACTIVE', 'DESTROYED', 'RETREATED']) });
const hit = z.object({ targetId: z.string(), pass: nonnegative.int(), baseShare: nonnegative, counter: nonnegative,
  hpBefore: nonnegative, hpAfter: nonnegative, shieldBefore: nonnegative, shieldAfter: nonnegative,
  aegisBefore: nonnegative, aegisAfter: nonnegative, bonusAegisDamage: nonnegative, normalAegisDamage: nonnegative,
  shieldDamage: nonnegative, hullDamage: nonnegative });
const shot = z.object({ sourceId: z.string(), order: nonnegative.int(), baseDamage: nonnegative, unusedBaseDamage: nonnegative, hits: z.array(hit) });
const fleet = z.record(hullId, nonnegative.int());
const recording = z.object({ schemaVersion: z.literal(1), roundLimit: nonnegative.int().positive(), initialAegis: nonnegative,
  ships: z.array(shipState.extend({ side, hull: hullId, stackId: z.string(), playerId: z.string(), maxHp: nonnegative.positive(),
    maxShield: nonnegative, attack: nonnegative, canFire: z.boolean(), cls: z.enum(['SKIRMISHER', 'LANCE', 'BULWARK', 'SUPPORT']).optional(), ground: z.boolean().optional() })),
  rounds: z.array(z.object({ round: nonnegative.int().positive(), attackerRoll: nonnegative, defenderRoll: nonnegative,
    aegisBefore: nonnegative, aegisAfter: nonnegative, aegisStrikes: z.array(z.object({ sourceId: z.string(), baseDamage: nonnegative,
      classMultiplier: nonnegative, bonusMultiplier: nonnegative, damage: nonnegative, aegisBefore: nonnegative, aegisAfter: nonnegative })).optional(), attackerShots: z.array(shot), defenderShots: z.array(shot),
    retreated: z.array(z.string()), after: z.array(shipState) })),
  aftermath: z.array(z.object({ kind: z.enum(['PIRATE_OVERRUN', 'CARGO_WITHDRAWAL']), shipIds: z.array(z.string()) })).optional(),
  finalState: z.array(shipState).optional(),
}).superRefine((value, ctx) => {
  const ids = new Set(value.ships.map(ship => ship.id));
  const unknown = (id: string) => !ids.has(id);
  const complete = (states: { id: string }[]) => states.length === ids.size && new Set(states.map(state => state.id)).size === ids.size && !states.some(state => unknown(state.id));
  if (ids.size !== value.ships.length || value.rounds.some(round => !complete(round.after) || round.retreated.some(unknown) || round.aegisStrikes?.some(strike => unknown(strike.sourceId)) === true
    || [...round.attackerShots, ...round.defenderShots].some(shot => unknown(shot.sourceId) || shot.hits.some(hit => unknown(hit.targetId))))
    || value.aftermath?.some(action => action.shipIds.some(unknown)) === true || value.finalState !== undefined && !complete(value.finalState)) {
    ctx.addIssue({ code: 'custom', message: 'Recording refers to unknown or duplicate units' });
  }
});
export const battleReplayResponseSchema: z.ZodType<{ viewer: BattleSide; ownPlayerIds?: string[]; replay: BattleReplayData }> = z.object({ viewer: side, ownPlayerIds: z.array(z.string()).optional(), replay: z.object({ recording,
  owners: z.array(z.object({ side, playerId: z.string(), stackId: z.string(), wing: nonnegative.int().positive(),
    research: z.object({ SHIP_POWER: nonnegative.int().optional(), SHIP_ARMOR: nonnegative.int().optional(),
      SHIP_SHIELDS: nonnegative.int().optional(), EMPLACEMENT_DOCTRINE: nonnegative.int().optional() }) })),
  result: z.object({ grade, defenceSalvage: fleet }), environment: z.enum(['PLANET', 'MONUMENT']),
  aegisCapacity: nonnegative, defenceOffline: z.boolean(), escape: z.object({ kind: z.enum(['ESCAPED', 'STRANDED']), ships: fleet }).nullable(),
  control: z.enum(['ATTACKER', 'DEFENDER', 'EMPTY']).nullable(),
}) });
