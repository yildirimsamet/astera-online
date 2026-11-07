import { eq } from 'drizzle-orm';
import { pino } from 'pino';
import { fleetEntries, type Fleet, type VesselModules } from '@astera/rules';
import { starterSites, vesselUnits, vessels } from '../src/db/schema.js';
import { sweepStarterWorld } from '../src/services/starter/sites.js';
import { EventWorker } from '../src/worker/loop.js';
import { bearer, freshAccount, type starterWorld } from './starterFixture.js';

export type StarterWorld = Awaited<ReturnType<typeof starterWorld>>;

/** A ship, as its owner holds it, and the means to set it up without walking the ladder. */
export async function aboard(world: StarterWorld, name = 'Pilot', modules?: VesselModules) {
  const person = await freshAccount(world.f, name);
  const body = (await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(person.token) }))
    .json<{ vessel: { id: string; position: { x: number; y: number; z: number } } }>();
  const id = body.vessel.id;
  if (modules) await world.f.db.update(vessels).set({ modules: { REFINERY: 1, ...modules } }).where(eq(vessels.id, id));
  return { ...person, vesselId: id, position: body.vessel.position, headers: bearer(person.token) };
}

export const placeShip = (world: StarterWorld, id: string, at: { x: number; y?: number; z?: number }) =>
  world.f.db.update(vessels).set({ x: at.x, y: at.y ?? 0, z: at.z ?? 0 }).where(eq(vessels.id, id));

export const enrich = (world: StarterWorld, id: string, alloy = 50_000, crystal = 50_000, deuterium = 5_000) =>
  world.f.db.update(vessels).set({ alloy, crystal, deuterium }).where(eq(vessels.id, id));

export async function arm(world: StarterWorld, id: string, fleet: Fleet) {
  for (const [hull, count] of fleetEntries(fleet)) {
    await world.f.db.insert(vesselUnits).values({ vesselId: id, hull, location: 'HOME', count })
      .onConflictDoUpdate({ target: [vesselUnits.vesselId, vesselUnits.hull, vesselUnits.location], set: { count } });
  }
}

export const workerOf = (world: StarterWorld) =>
  new EventWorker(world.f.db, world.f.clock, { pollMs: 50, batch: 50, staleMinutes: 5 }, pino({ level: 'silent' }));

/** Moves the clock and lets the queue catch up, as the real worker would have. */
export async function pass(world: StarterWorld, minutes: number) {
  world.f.clock.advance(minutes);
  const worker = workerOf(world);
  for (let i = 0; i < 6; i++) await worker.tick();
}

export const get = <T>(world: StarterWorld, url: string, headers: Record<string, string>) =>
  world.app.inject({ url, headers }).then(answer => answer.json<T>());

export const post = (world: StarterWorld, url: string, headers: Record<string, string>, payload: object = {}) =>
  world.app.inject({ method: 'POST', url, headers, payload });

export const siteOf = async (world: StarterWorld, kind: 'OUTPOST' | 'WRECK' | 'ASTEROID', level?: number) => {
  await sweepStarterWorld(world.f.db, world.f.clock);
  const rows = await world.f.db.select().from(starterSites).where(eq(starterSites.kind, kind));
  const site = rows.find(row => level === undefined || row.level === level);
  if (!site) throw new Error(`no ${kind} in this galaxy`);
  return site;
};
