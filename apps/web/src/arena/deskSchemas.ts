import { z } from 'zod';
import { CLAN } from '@astera/rules';
import { SHIP_CLASSES, TACTICS } from '@astera/rules/arena';

/** The desks' answers, parsed by the client and by the server's contract test: no browser globals here. */
export const resources = z.object({ alloy: z.number(), crystal: z.number(), deuterium: z.number() });
const points = z.number().int().min(0).max(4).optional();
const abilities = z.object({ signature: points, turbo: points, smoke: points, cloak: points, illusion: points, radar: points }).strict();
export const hangarSchema = z.object({
  core: z.number().int(), minCore: z.number().int(),
  ship: z.object({ class: z.enum(SHIP_CLASSES), changeUntil: z.string().nullable(), fuel: z.number(), ammo: z.number(),
    hold: z.array(z.number()), readyAt: z.string().nullable(), readyReason: z.enum(['repair', 'service']).nullable(), flying: z.boolean(),
    /** Y9: out with a fleet, or flying home alone until `homeAt`. Defaulted for a desk from before the deploy. */
    away: z.enum(['escort', 'homeward']).nullable().default(null), homeAt: z.string().nullable().default(null),
    level: z.number().int().min(1).max(20), xp: z.number().int().nonnegative(), xpNext: z.number().int().nonnegative(),
    levelCap: z.number().int().min(1).max(20), upgrade: resources, abilities,
    /** What the launch tops the tank and the magazine up to, in percent (owner 2026-10-27); full on a desk from before. */
    plan: z.object({ fuel: z.number().int(), ammo: z.number().int() }).default({ fuel: 100, ammo: 100 }) }).nullable(),
  refill: z.object({ fuel: z.number(), ammo: z.number(), total: z.number() }),
  /** The capital's stock: what pays a refill and a level. */
  deuterium: z.number(), alloy: z.number(), crystal: z.number(), cap: resources, sent: resources, resetsAt: z.string(), entryClosesAt: z.string(),
  /** Who flies the Yarık right now (bots are not pilots). Optional for a rolling deploy. */
  live: z.object({ pilots: z.number().int().nonnegative(),
    /** The asker's own ship is in the room and alive: a closed page can fly it on (F22). */
    yours: z.boolean().default(false) }).optional(),
});

const shares = z.object({ alloy: z.number().int().nonnegative(), crystal: z.number().int().nonnegative(), deuterium: z.number().int().nonnegative() });
export const teamSchema = z.object({
  playerId: z.string().uuid(), clanId: z.string().uuid().nullable(), capacity: z.number().int().positive().max(120), canCreate: z.boolean(),
  team: z.object({ id: z.string().uuid(), state: z.enum(['forming', 'flying']), leaderId: z.string().max(64), joined: z.boolean(),
    members: z.array(z.object({ playerId: z.string().uuid(), name: z.string().max(80), ready: z.boolean(), tactic: z.enum(TACTICS),
      outcome: z.string().max(32).nullable(), blocked: z.string().max(64).nullable(),
      ship: z.object({ class: z.enum(SHIP_CLASSES), level: z.number().int().min(1).max(20), fuel: z.number().nonnegative(), fuelMax: z.number().positive(), readyAt: z.string().datetime().nullable() }).nullable(),
    })).max(CLAN.maxMembers),
  }).nullable(),
  claims: z.array(z.object({ teamId: z.string().uuid(), share: shares, finishedAt: z.string().datetime(), autoAt: z.string().datetime() })).max(20),
  receipt: z.object({ deposit: shares, overflow: shares }).optional(),
});
