import { STARTER_CRATES } from '@astera/rules';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vessels } from '../src/db/schema.js';
import { testDb } from './helpers.js';
import { bearer, freshAccount, starterWorld } from './starterFixture.js';

afterAll(async () => { await (await testDb()).close(); });

interface Crate { id: string; module: string; stage: number; alloy: number; crystal: number; state: 'sealed' | 'ready' | 'opened' }
interface VesselAnswer { id: string; alloy: number; crystal: number; crates: Crate[] }

/** KURTARMA KASALARI (retention plan §6.2): a done repair unseals its bay's crate; opening it pays once. */
describe('the salvage crates', () => {
  let world: Awaited<ReturnType<typeof starterWorld>>;
  let token: string;
  let vesselId: string;

  const read = async () => (await world.app.inject({ url: '/api/starter/vessel', headers: bearer(token) })).json<{ vessel: VesselAnswer }>().vessel;
  const open = (id?: string) => world.app.inject({ method: 'POST', url: '/api/starter/crates/open', headers: bearer(token), payload: id === undefined ? {} : { id } });
  const repaired = (modules: Record<string, number>) => world.f.db.update(vessels).set({ modules }).where(eq(vessels.id, vesselId));
  const first = STARTER_CRATES[0]!;
  const second = STARTER_CRATES[1]!;

  beforeEach(async () => {
    world = await starterWorld();
    const person = await freshAccount(world.f);
    token = person.token;
    vesselId = (await world.app.inject({ method: 'POST', url: '/api/starter/enlist', headers: bearer(token) })).json<{ vessel: VesselAnswer }>().vessel.id;
  });
  afterEach(async () => { await world.built.close(); });

  it('shows every crate on the ship, sealed until its repair is done', async () => {
    const view = await read();
    expect(view.crates.map(crate => crate.id)).toEqual(STARTER_CRATES.map(crate => crate.id));
    expect(view.crates.every(crate => crate.state === 'sealed')).toBe(true);
    await repaired({ REFINERY: first.stage });
    expect((await read()).crates.find(crate => crate.id === first.id)?.state).toBe('ready');
  });

  it('pays a ready crate into the store once', async () => {
    await repaired({ REFINERY: first.stage });
    const before = await read();
    const answer = await open(first.id);
    expect(answer.statusCode).toBe(200);
    const after = answer.json<{ vessel: VesselAnswer; opened: string[] }>();
    expect(after.opened).toEqual([first.id]);
    expect(after.vessel.alloy).toBeCloseTo(before.alloy + first.reward.alloy, 3);
    expect(after.vessel.crystal).toBeCloseTo(before.crystal + first.reward.crystal, 3);
    expect(after.vessel.crates.find(crate => crate.id === first.id)?.state).toBe('opened');
    const again = await open(first.id);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: 'CRATE_NOT_READY' });
  });

  it('refuses a sealed crate and one that does not exist', async () => {
    expect((await open(first.id)).json()).toMatchObject({ error: 'CRATE_NOT_READY' });
    expect((await open('NOPE:1')).statusCode).toBe(400);
  });

  it('opens every ready crate at once when none is named', async () => {
    await repaired({ REFINERY: first.stage, EXTRACTOR: 1, SURVEY: second.stage });
    const before = await read();
    const answer = (await open()).json<{ vessel: VesselAnswer; opened: string[] }>();
    expect(answer.opened.sort()).toEqual([first.id, second.id].sort());
    expect(answer.vessel.alloy).toBeCloseTo(before.alloy + first.reward.alloy + second.reward.alloy, 3);
  });

  /** N9: the yard's victory crate waits for the first decisive outpost win as well as for the yard. */
  it('pays the first victory crate only after the win, and once when two presses race', async () => {
    const victory = STARTER_CRATES.find(crate => crate.fact === 'FIRST_OUTPOST_VICTORY')!;
    await repaired({ REFINERY: 3, EXTRACTOR: 1, SURVEY: 1, SHIPYARD: 1 });
    expect((await read()).crates.find(crate => crate.id === victory.id)?.state).toBe('sealed');
    expect((await open(victory.id)).json()).toMatchObject({ error: 'CRATE_NOT_READY' });
    await world.f.db.update(vessels).set({ facts: ['FIRST_OUTPOST_VICTORY'] }).where(eq(vessels.id, vesselId));
    const before = await read();
    const answers = await Promise.all([open(victory.id), open(victory.id)]);
    expect(answers.map(a => a.statusCode).sort()).toEqual([200, 409]);
    const after = await read();
    expect(after.alloy).toBeCloseTo(before.alloy + victory.reward.alloy, 3);
    expect(after.crystal).toBeCloseTo(before.crystal + victory.reward.crystal, 3);
    expect(after.crates.find(crate => crate.id === victory.id)?.state).toBe('opened');
  });

  it('pays once when two presses race', async () => {
    await repaired({ REFINERY: first.stage });
    const before = await read();
    const answers = await Promise.all([open(first.id), open(first.id)]);
    expect(answers.map(a => a.statusCode).sort()).toEqual([200, 409]);
    expect((await read()).alloy).toBeCloseTo(before.alloy + first.reward.alloy, 3);
  });
});
