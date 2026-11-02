import { describe, expect, it, vi } from 'vitest';
import { galaxySchema, intelSchema, miningSchema, miningFieldSchema, planetSchema, planetsSchema, trafficSchema } from '../src/api/schemas.js';
import { createSchool, SCHOOL_HOME } from '../src/onboarding/flightSchool/world.js';
import { schoolFetch, schoolPending, schoolTraffic } from '../src/onboarding/flightSchool/api.js';
import { Api } from '../src/api/client.js';
import { schoolAction, SCHOOL_ROCK, SCHOOL_TARGET, SCHOOL_RAID } from '../src/onboarding/flightSchool/world.js';

describe('private school API boundary', () => {
  it('serves the actual game schemas and never falls through to live fetch', async () => {
    const live = vi.spyOn(globalThis, 'fetch');
    const w = createSchool(1_800_000_000_000);
    const fetcher = schoolFetch(() => w, () => { throw new Error('unexpected mutation'); }, () => w.startedAt);
    for (const [path, schema] of [['/api/planet', planetSchema], ['/api/planets', planetsSchema], ['/api/galaxy', galaxySchema], ['/api/intel', intelSchema], ['/api/mining', miningSchema], ['/api/galaxy/traffic', trafficSchema]] as const) {
      const response = await fetcher(path);
      expect(response.status, path).toBe(200);
      expect(schema.safeParse(await response.json()).success, path).toBe(true);
    }
    expect((await fetcher('/api/auth/refresh', { method: 'POST' })).status).toBe(404);
    expect(live).not.toHaveBeenCalled();
  });
  it('publishes a discovered moving asteroid through the strict field schema without a private index', async () => {
    const w = createSchool(1_800_000_000_000); w.instruments.TELESCOPE = 1;
    const fetcher = schoolFetch(() => w, vi.fn(), () => w.startedAt);
    const raw: unknown = await (await fetcher('/api/mining/field')).json();
    const parsed = miningFieldSchema.parse(raw);
    expect(parsed.asteroids).toHaveLength(1);
    expect(parsed.asteroids[0]).not.toHaveProperty('index');
  });
  it('rejects foreign world writes, malformed quantities, and duplicate commitments', async () => {
    let w = { ...createSchool(1_800_000_000_000), scene: 'core' as const };
    const dispatch = vi.fn();
    const fetcher = schoolFetch(() => w, dispatch, () => w.startedAt);
    const post = (path: string, body: unknown) => fetcher(path, { method: 'POST', body: JSON.stringify(body) });
    expect((await post('/api/planets/foreign/upgrade', { type: 'CORE' })).status).toBe(400);
    expect((await post(`/api/planets/${SCHOOL_HOME}/upgrade`, { type: 'REFINERY' })).status).toBe(400);
    expect((await post('/api/planet/build', { hull: 'DART', count: 0.5 })).status).toBe(400);
    expect(dispatch).not.toHaveBeenCalled();
    w = { ...w, scene: 'core' };
  });
  it('answers mining and raid commitments through the actual API client schemas', async () => {
    let w = createSchool(1_800_000_000_000);
    w = { ...w, scene: 'mine', fleet: { PROSPECTOR: 1 }, instruments: { ...w.instruments, TELESCOPE: 1 } };
    const api = new Api({ baseUrl: '', authTransport: null, fetch: schoolFetch(() => w, (action, now) => { w = schoolAction(w, action, now); }, () => w.startedAt) });
    await expect(api.mine(SCHOOL_ROCK, 1, SCHOOL_HOME)).resolves.toMatchObject({ craft: 1 });
    w = { ...w, flight: null, scene: 'raid', fleet: SCHOOL_RAID, resources: { alloy: 1000, crystal: 400, deuterium: 600 } };
    await expect(api.launch(SCHOOL_HOME, SCHOOL_TARGET, SCHOOL_RAID)).resolves.toHaveProperty('exposureMinutes');
  });
  it('shows an actual inbound warning after Radar is installed, including preparation time', () => {
    const w = { ...createSchool(1_800_000_000_000), scene: 'warning' as const };
    expect(schoolPending(w, w.startedAt)).toHaveLength(0);
    const radar = { ...w, instruments: { ...w.instruments, RADAR: 1 } };
    expect(schoolPending(radar, w.startedAt)).toEqual([expect.objectContaining({ kind: 'incoming', targetName: 'Aurora' })]);
    expect(schoolTraffic(radar, w.startedAt).find(c => c.id === 'school-incoming')?.inbound).toBe(true);
  });
  it('keeps a finite readable asteroid window after a long pause and removes depleted ore at interception', async () => {
    const now = 1_800_000_000_000;
    let w = createSchool(now - 86_400_000);
    w = { ...w, scene: 'mine', fleet: { PROSPECTOR: 1 }, instruments: { ...w.instruments, TELESCOPE: 1 } };
    const fetcher = schoolFetch(() => w, vi.fn(), () => now);
    const field = miningFieldSchema.parse(await (await fetcher('/api/mining/field')).json());
    expect(field.asteroids[0]!.expiresAt - (now - w.startedAt) / 60_000).toBe(20);
    const sent = schoolAction(w, { kind: 'mine' }, now);
    const returning = schoolFetch(() => sent, vi.fn(), () => sent.flight!.arriveAt + 1);
    expect(miningFieldSchema.parse(await (await returning('/api/mining/field')).json()).asteroids).toHaveLength(0);
    expect(sent.buffer).toEqual(w.buffer);
  });
});

it('holds the incoming fleet during preparation and publishes the native battle window after resuming', () => {
  const at = 1_800_000_000_000;
  const w = { ...createSchool(at), scene: 'defend' as const, instruments: { TELESCOPE: 1, RADAR: 1, AEGIS: 1, VEIL: 0 } };
  const first = schoolTraffic(w, at).find(c => c.id === 'school-incoming')!;
  const later = schoolTraffic(w, at + 90_000).find(c => c.id === 'school-incoming')!;
  expect(first.from).toEqual(first.to);
  expect(later.from).toEqual(first.from);
  const sent = schoolAction(w, { kind: 'defend' }, at + 100_000);
  expect(sent.flight!.from).toEqual(first.from);
  const battle = schoolTraffic(sent, sent.flight!.arriveAt + 1).find(c => c.id === 'school-incoming')!;
  expect(battle.engagement).toEqual({ target: sent.flight!.to, arriveAt: new Date(sent.flight!.arriveAt), endsAt: new Date(sent.flight!.turnAt) });
});

it('acknowledges the real destination level when upgrading a building', async () => {
 const at=1_800_000_000_000;
 const w={...createSchool(at),scene:'core' as const};
 const fetcher=schoolFetch(()=>w,vi.fn(),()=>at);
 const api=new Api({baseUrl:'',authTransport:null,fetch:fetcher});
 await expect(api.upgrade(SCHOOL_HOME,'CORE')).resolves.toMatchObject({level:2});
});

it('quotes the probe arrival duration consistently with its arrival timestamp', async () => {
 const at=1_800_000_000_000,w={...createSchool(at),scene:'probe' as const};
 const api=new Api({baseUrl:'',authTransport:null,fetch:schoolFetch(()=>w,vi.fn(),()=>at)});
 const result=await api.probe(SCHOOL_TARGET,SCHOOL_HOME);
 expect(result.flightMinutes).toBe((result.arriveAt.getTime()-at)/60_000);
});
