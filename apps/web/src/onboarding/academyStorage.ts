import { z } from 'zod';
import { ACADEMY_STEPS } from '@astera/rules';
import { advanceAcademy, beginAcademyFlight, beginAcademyOrder, openAcademy, type AcademyWorld } from './academyWorld.js';

/** Only authored action indices and clock anchors survive reload. No account,
 * resources, fleet or battle outcome is accepted from browser storage. */
const KEY = 'astera.academy.v1';
const moment = z.number().int().nonnegative().max(8_640_000_000_000_000);
const flight = z.object({ kind: z.enum(['pirate', 'mine', 'raid']), startedAt: moment }).strict();
const savedSchema = z.object({
  version: z.literal(1), step: z.number().int().min(0).max(ACADEMY_STEPS.length), startedAt: moment,
  orderAt: moment.nullable(), flight: flight.nullable(), journeys: z.array(flight).max(3),
  seenSignals: z.array(z.string()).max(2),
}).strict();

export function saveAcademy(world: AcademyWorld): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 1, step: world.step, startedAt: world.preview.season.startsAt.getTime(),
      orderAt: world.pending?.order.startedAt?.getTime() ?? null,
      flight: world.flight ? { kind: world.flight.kind, startedAt: world.flight.departAt } : null,
      journeys: world.journeys.map((f) => ({ kind: f.kind, startedAt: f.departAt })),
      seenSignals: world.seenSignals,
    }));
  } catch { /* Storage is optional, including access to the property itself. */ }
}

export function restoreAcademy(now: number): AcademyWorld {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null) return openAcademy(now);
    const saved = savedSchema.parse(JSON.parse(raw));
    if (saved.startedAt > now || (saved.flight && saved.orderAt !== null)) throw new Error('Invalid clock');
    let world = openAcademy(saved.startedAt, saved.step);
    for (const f of saved.journeys) {
      const step = ACADEMY_STEPS.findIndex((s) => s.id === f.kind);
      if (step >= saved.step || world.journeys.some((j) => j.kind === f.kind) || f.startedAt < saved.startedAt) throw new Error('Invalid journey');
      const journey = beginAcademyFlight(openAcademy(saved.startedAt, step), f.kind, f.startedAt);
      if (journey.flight!.homeAt > now) throw new Error('Unfinished journey');
      const done = advanceAcademy(journey, now);
      world.journeys.push(...done.journeys);
      world.reports.push(...done.reports);
    }
    world.seenSignals = saved.seenSignals.filter((id) => world.reports.some((r) => `${r.id}-signal` === id));
    if (saved.flight) {
      if (saved.flight.startedAt > now || saved.flight.startedAt < saved.startedAt) throw new Error('Invalid clock');
      world = beginAcademyFlight(world, saved.flight.kind, saved.flight.startedAt);
    }
    if (saved.orderAt !== null) {
      if (saved.orderAt > now || saved.orderAt < saved.startedAt) throw new Error('Invalid clock');
      const action = ACADEMY_STEPS[saved.step];
      if (!action) throw new Error('Invalid action');
      world = beginAcademyOrder(world, action.id, saved.orderAt);
    }
    return advanceAcademy(world, now);
  } catch { return openAcademy(now); }
}

export function clearAcademy(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* Optional storage. */ }
}
