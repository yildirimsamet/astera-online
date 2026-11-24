import { asc, eq, inArray } from 'drizzle-orm';
import { MULTI_WORLD, generateGalaxy, moonsEnabled, seedMoonPlan, selectNeutralSlots, type MoonRarity } from '@astera/rules';
import type { Clock } from '../clock.js';
import type { Db } from '../db/client.js';
import { moons, planets, seasons, shards } from '../db/schema.js';
import { publishShard } from '../stream/bus.js';
import { seedMoonAt } from './moon.js';
import { GameError } from './planet.js';

/*
  MOONS ARRIVE IN A LIVE SEASON (owner, 2026-11-24). One explicit instant, never a ruleset bump: the
  galaxies of a cycle keep equal rulesets for returns and transfers. At that instant a commander's colony
  gets the moon of its slot's tier, so no one's world is handed to another; capitals and captured capitals
  are no neutral slot and get none; an unowned neutral gets the season's seeded plan (§6.3). Every moon
  goes through the seed ledger, so a slot never gets a second one when it reopens.
*/
const COLONY_MOON: Record<1 | 2 | 3, MoonRarity> = { 1: 'COMMON', 2: 'RARE', 3: 'EPIC' };

const tally = (): Record<MoonRarity, number> => ({ COMMON: 0, RARE: 0, EPIC: 0, LEGENDARY: 0 });

export async function activateMoons(db: Db, input: { seasonId: string; clock: Clock; apply: boolean }) {
  return db.transaction(async tx => {
    const [season] = await tx.select().from(seasons).where(eq(seasons.id, input.seasonId)).for('update');
    const now = input.clock.now();
    if (season?.status !== 'live' || season.closedAt || now < season.startsAt || now >= season.endsAt) {
      throw new GameError('SEASON_FROZEN', 'An open live season is required', 409);
    }
    const [shard] = await tx.select({ role: shards.role }).from(shards).where(eq(shards.id, season.shardId));
    if (shard?.role !== 'MAIN') throw new GameError('MOONS_DISABLED', 'Moons open only in a main galaxy', 409);
    const colonies = tally();
    const neutrals = tally();
    if (moonsEnabled({ rulesetVersion: season.rulesetVersion }, shard)) {
      return { status: 'DEALT' as const, applied: false, startsAt: season.startsAt, colonies, neutrals };
    }
    if (season.moonsStartsAt) {
      return { status: 'ALREADY_ACTIVE' as const, applied: false, startsAt: season.moonsStartsAt, colonies, neutrals };
    }

    const selected = selectNeutralSlots(season.seed, generateGalaxy(season.seed, MULTI_WORLD.neutralSlotPool).slots);
    const tierOf = new Map(selected.map((neutral) => [neutral.slot.index, neutral.tier]));
    const plan = seedMoonPlan(season.seed, selected);
    const worlds = await tx.select({ id: planets.id, kind: planets.kind, slotIndex: planets.slotIndex, owner: planets.controllerPlayerId })
      .from(planets).where(eq(planets.seasonId, season.id)).orderBy(asc(planets.slotIndex));
    const withMoon = worlds.length === 0 ? new Set<string>() : new Set((await tx.select({ planetId: moons.planetId })
      .from(moons).where(inArray(moons.planetId, worlds.map((world) => world.id)))).map((row) => row.planetId));
    const placements: { planetId: string; slotIndex: number; rarity: MoonRarity }[] = [];
    for (const world of worlds) {
      const tier = tierOf.get(world.slotIndex);
      if (tier === undefined || withMoon.has(world.id)) continue;
      if (world.kind === 'COLONY' && world.owner !== null) {
        placements.push({ planetId: world.id, slotIndex: world.slotIndex, rarity: COLONY_MOON[tier] });
        colonies[COLONY_MOON[tier]] += 1;
      } else if (world.kind === 'NEUTRAL' && world.owner === null) {
        const rarity = plan.get(world.slotIndex);
        if (!rarity) continue;
        placements.push({ planetId: world.id, slotIndex: world.slotIndex, rarity });
        neutrals[rarity] += 1;
      }
    }
    if (!input.apply) return { status: 'READY' as const, applied: false, startsAt: now, colonies, neutrals };

    await tx.update(seasons).set({ moonsStartsAt: now }).where(eq(seasons.id, season.id));
    for (const placement of placements) await seedMoonAt(tx, { seasonId: season.id, ...placement, now });
    await publishShard(tx, season.id, 'world');
    return { status: 'ACTIVATED' as const, applied: true, startsAt: now, colonies, neutrals };
  });
}
