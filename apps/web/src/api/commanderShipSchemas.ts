import { z } from 'zod';
import { SHIP_CLASSES } from '@astera/rules/arena';

const point = z.object({ x: z.number(), y: z.number(), z: z.number() });

/** `/api/commander-ship`: the asking commander's ship and its capital (server `readCommanderShip`). */
export const commanderShipSchema = z.object({
  capitalPlanetId: z.string().uuid(),
  rulesetVersion: z.number().int(),
  /** Escorts are open now; optional for an API from before the live switch (then the ruleset decides). */
  admiral: z.boolean().optional(),
  ship: z.object({
    class: z.enum(SHIP_CLASSES),
    level: z.number().int().min(1),
    status: z.enum(['ready', 'repair', 'service', 'admiral', 'yarik']),
    readyAt: z.string().datetime({ offset: true }).nullable(),
  }).nullable(),
  /** Y9: flying home alone after its fleet — from the battle to the world it left, on these clocks. */
  homeward: z.object({ from: point, to: point, departAt: z.string().datetime({ offset: true }), arriveAt: z.string().datetime({ offset: true }) })
    .nullable().optional(),
});
export type CommanderShipView = z.infer<typeof commanderShipSchema>;
