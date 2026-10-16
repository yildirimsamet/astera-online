import { randomUUID } from 'node:crypto';
import { afterAll, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { honorEvents, honorSeasons, honorTotals } from '../src/db/schema.js';
import { prepareHonorSeason, settleHonor } from '../src/services/honorLedger.js';
import { replayHonor, type HonorEvidence } from '../src/services/honorAccounting.js';
import { readHonorReceipts } from '../src/services/honorReports.js';
import { seedWorld, testDb } from './helpers.js';
import { testEnv } from './helpers.js';
import { buildApp } from '../src/app.js';
import { TokenService } from '../src/auth/tokens.js';
import { pino } from 'pino';
import { leaderboardSchema, seasonSchema } from '../../web/src/api/schemas.js';

afterAll(async () => { await (await testDb()).close(); });
const member = (id: string, over: Partial<HonorEvidence['attack'][number]> = {}) => ({ id, tier: 3, navy: 100_000,
  weight: 10_000, civilianWeight: 0, loss: 0, combatLoss: 0, lootLost: 0, ...over });
const event = (over: Partial<HonorEvidence> = {}): HonorEvidence => {
  const row = { source: 'WORLD' as const, id: randomUUID(), at: 1000, eligible: true,
    attack: [member('A'), member('B')], defence: [member('D', { loss: 50_000, combatLoss: 50_000 })], ...over };
  return { ...row, relations: row.attack.flatMap(a => row.defence.map(d => ({ a: a.id, b: d.id, related: false }))), ...over };
};

it('the new default suppresses shared positive credit but retains frozen v1/v2 team history', () => {
  const e = event();
  for (const version of [1, 2] as const) expect(replayHonor([e], version).events[0]!.attack.total).toBeGreaterThan(0);
  expect(replayHonor([e]).events[0]!.attack.total).toBe(0);
});

it.each(['WORLD', 'CLAN_WAR', 'MONUMENT'] as const)('%s: 2v1 suppresses the attacking team without suppressing the solo defender', source => {
  const result = replayHonor([event({ source, attack: [member('A', { loss: 10_000, combatLoss: 10_000 }), member('B')] })]).events[0]!;
  expect(result.attack.total).toBe(-1_000_000);
  expect(result.attack.shares.every(row => row.points <= 0)).toBe(true);
  expect(result.defence.total).toBeGreaterThan(0);
  expect(result.pool.attack.exposures.every(row => row.positive === 0)).toBe(true);
});

it('1v2 preserves the solo attacker and leaves both supported defenders unchanged', () => {
  const result = replayHonor([event({ attack: [member('A', { loss: 10_000, combatLoss: 10_000 })],
    defence: [member('D', { loss: 50_000, combatLoss: 50_000 }), member('S')] })]).events[0]!;
  expect(result.attack.total).toBeGreaterThan(0);
  expect(result.defence.total).toBe(0);
  expect(result.defence.shares.every(row => row.points === 0)).toBe(true);
  expect(result.pool.defence.exposures.every(row => row.positive === 0)).toBe(true);
});

it('2v2 retains only attacking debits, without reserving any positive pair budget', () => {
  const result = replayHonor([event({ attack: [member('A', { loss: 1000, combatLoss: 1000 }), member('B')],
    defence: [member('D', { loss: 50_000, combatLoss: 50_000 }), member('S')] })]);
  expect(result.events[0]!.attack.total).toBe(-100_000);
  expect(result.events[0]!.defence.total).toBe(0);
  expect(result.pairs.every(row => row.raw === 0)).toBe(true);
});

it('same-owner waves remain solo and reproduce 1v1 arithmetic exactly', () => {
  const solo = event({ attack: [member('A')] });
  const split = { ...solo, attack: [member('A', { weight: 5000 }), member('A', { weight: 5000 })] };
  expect(replayHonor([split])).toEqual(replayHonor([solo]));
});

it.each([{ weight: 1 }, { weight: 0, civilianWeight: 1 }, { weight: 0, civilianWeight: 0 }])('a token or lost-in-flight attacking ally cannot evade the shared policy: %j', over => {
  const result = replayHonor([event({ attack: [member('A', { loss: 1000 }), member('B', over)] })]).events[0]!;
  expect(result.attack.total).toBe(-100_000);
});

it('a weak target penalty survives overwhelming team success and escalates on repeat', () => {
  const first = event({ attack: [member('A', { tier: 4, navy: 200_000 }), member('B')], selectedDefenders: ['D'] });
  const second = { ...first, id: randomUUID(), at: 1001 };
  const result = replayHonor([first, second]);
  expect(result.events[0]!.attack.total).toBe(-6_250_000);
  expect(result.events[1]!.attack.total).toBe(-9_375_000);
  expect(result.repeats).toHaveLength(2);
  expect(result.retaliations.length).toBeGreaterThan(0);
});

it('an empty host with real support is shared; a completely absent supporter does not deny a solo host', () => {
  const host = member('D', { weight: 0 });
  const empty = member('S', { weight: 0 });
  const result = replayHonor([event({ selectedDefenders: ['D'], attack: [member('A', { loss: 1000, combatLoss: 1000 })],
    defence: [host, member('S')] })]).events[0]!;
  expect(result.defence.total).toBe(0);
  const facts = event({ selectedDefenders: ['D'], attack: [member('A', { loss: 1000, combatLoss: 1000 })], defence: [member('D'), empty] });
  expect(replayHonor([facts]).events[0]!.defence.total).toBeGreaterThan(0);
});

it.each([{ weight: 1 }, { weight: 0, civilianWeight: 1 }])('real tiny or passive support denies shared positive credit: %j', over => {
  expect(replayHonor([event({ selectedDefenders: ['D'], attack: [member('A', { loss: 1000, combatLoss: 1000 })],
    defence: [member('D'), member('S', over)] })]).events[0]!.defence.total).toBe(0);
});

it('a related owner cannot launder points through a shared side', () => {
  const e = event(); e.relations[0]!.related = true;
  expect(replayHonor([e]).events[0]!.attack.shares.every(row => row.points === 0)).toBe(true);
});

it('fresh teammates cannot reopen the exhausted actor’s positive pair budget', () => {
  const shared = event();
  const before = event({ id: 'old', at: 999, attack: [member('A')], defence: [member('D', { loss: 50_000, combatLoss: 50_000 })] });
  const initial = replayHonor([before]);
  const result = replayHonor([shared, before]);
  expect(result.events[1]!.attack.total).toBe(0);
  expect(result.pairs.find(row => row.a === 'A' && row.b === 'D')!.raw).toBe(initial.pairs[0]!.raw);
  expect(result.pairs.find(row => row.a === 'B' && row.b === 'D')!.raw).toBe(0);
});

it('a shared counterattack can spend only prior actual harm and creates no retaliatory chain for that spent harm', () => {
  const first = event({ at: 999, attack: [member('D', { tier: 2, navy: 50_000 })],
    defence: [member('A', { tier: 4, navy: 200_000, loss: 1000, combatLoss: 1000 })] });
  const counter = event({ attack: [member('A', { tier: 4, navy: 200_000 }), member('B', { tier: 4, navy: 200_000 })],
    defence: [member('D', { tier: 2, navy: 50_000, loss: 2000, combatLoss: 2000 })] });
  const result = replayHonor([first, counter]);
  expect(result.events[1]!.attack.total).toBe(-250_000);
  expect(result.events[1]!.pool.attack.exposures.reduce((sum, row) => sum + row.retaliationSpentFifths, 0)).toBe(5000);
  expect(result.retaliations.filter(row => row.holder === 'D').reduce((sum, row) => sum + row.remaining, 0)).toBe(5000);
});

it('non-target weak voluntary support cannot turn a shared attack into bullying', () => {
  const result = replayHonor([event({ selectedDefenders: ['D'], defence: [member('D', { loss: 1000, combatLoss: 1000 }),
    member('S', { tier: 2, navy: 20_000, loss: 10_000, combatLoss: 10_000 })] })]);
  expect(result.events[0]!.attack.total).toBe(0);
  expect(result.events[0]!.pool.attack.exposures.every(row => !row.bullying)).toBe(true);
});

it('new 1v1 amounts equal legacy 1v1 for peer, upper, weak, related, civilian and ineligible inputs', () => {
  for (const kind of ['PEER', 'UPPER', 'WEAK', 'RELATED', 'CIVILIAN', 'INELIGIBLE'] as const) {
    const e = event({ attack: [member('A', { loss: 1000, combatLoss: 1000 })], eligible: kind !== 'INELIGIBLE',
      defence: [member('D', { tier: kind === 'UPPER' ? 4 : kind === 'WEAK' ? 2 : 3,
        navy: kind === 'UPPER' ? 200_000 : kind === 'WEAK' ? 50_000 : 100_000,
        loss: 50_000, combatLoss: kind === 'CIVILIAN' ? 0 : 50_000 })] });
    if (kind === 'RELATED') e.relations[0]!.related = true;
    expect(replayHonor([e])).toEqual(replayHonor([e], 1));
  }
});

it('real ledger uses the new immutable version, reports shared zero and replays without extra credit', async () => {
  const f = await seedWorld(3, 5519);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  const [config] = await f.db.select().from(honorSeasons);
  expect(config!.version).toBe(3);
  const e = event({ at: f.clock.now().getTime(), attack: [member(f.playerIds[0]!), member(f.playerIds[2]!)],
    defence: [member(f.playerIds[1]!, { loss: 50_000, combatLoss: 50_000 })] });
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, e));
  const read = () => f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[0]!, [e]));
  expect((await read()).get(JSON.stringify([e.source, e.id]))).toMatchObject({ delta: 0, reason: 'SHARED_SIDE',
    breakdown: { sharedPositiveBlocked: true } });
  const receipt = (await read()).get(JSON.stringify([e.source, e.id]));
  const { honorReceiptSchema } = await import('../../web/src/api/schemas.js');
  expect(honorReceiptSchema.parse(receipt)).toEqual(receipt);
  const totals = await f.db.select().from(honorTotals);
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, e));
  expect(await f.db.select().from(honorTotals)).toEqual(totals);
  expect(await f.db.select().from(honorEvents).where(eq(honorEvents.seasonId, f.seasonId))).toHaveLength(1);
  await expect(f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock, 1))).rejects.toThrow('immutable');
});

it.each([{ mode: undefined, version: 3 }, { mode: 'SHADOW', version: 3 },
  { mode: 'ACTIVE', version: 3 }, { mode: 'ACTIVE', version: 1 }, { mode: 'ACTIVE', version: 4 }] as const)('public guidance matches the frozen policy: $mode/$version', async ({ mode, version }) => {
  const f = await seedWorld(2, 5519);
  if (mode) await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, version === 4 ? 'SHADOW' : mode, f.clock, version));
  if (version === 4) {
    const [config] = await f.db.select().from(honorSeasons);
    await f.db.update(honorSeasons).set({mode:'ACTIVE',rankedAt:config!.createdAt});
  }
  const built = buildApp({ db: f.db, clock: f.clock, env: testEnv(), logger: pino({ level: 'silent' }) });
  try {
    const authorization = `Bearer ${await new TokenService('test-secret-that-is-long-enough', 15, 30).issueAccess(f.accountIds[0]!)}`;
    for (const url of ['/api/season', '/api/leaderboard?ranking=HONOR']) {
      const response = await built.app.inject({ url, headers: { authorization } });
      expect(response.statusCode).toBe(200);
      const parsed = url === '/api/season' ? seasonSchema.parse(response.json()) : leaderboardSchema.parse(response.json());
      expect(parsed.honorSoloCredit).toBe(mode === 'ACTIVE' && (version === 3 || version === 4));
    }
  } finally { await built.close(); }
});

it.each([10_000, 0])('shared debit receipt matches the actual credited share, weight %s', async weight => {
  const f = await seedWorld(3, 5519);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  const e = event({ at: f.clock.now().getTime(), attack: [member(f.playerIds[0]!, { tier: 4, navy: 200_000 }),
    member(f.playerIds[2]!, { weight, civilianWeight: weight === 0 ? 1000 : 0 })], defence: [member(f.playerIds[1]!, { loss: 1000, combatLoss: 1000 })] });
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, e));
  const receipts = await f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[2]!, [e]));
  expect(receipts.get(JSON.stringify([e.source, e.id]))).toMatchObject({ reason: weight === 0 ? 'SHARED_SIDE' : 'WEAK_TARGET',
    breakdown: { permanentLoss: 0, sharedPositiveBlocked: true, weakTargetDebit: true } });
});

it('an absent support row neither blocks solo defence credit nor inflates the reported participant count', async () => {
  const f = await seedWorld(3, 5519);
  await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
  const e = event({ at: f.clock.now().getTime(), selectedDefenders: [f.playerIds[1]!],
    attack: [member(f.playerIds[0]!, { loss: 1000, combatLoss: 1000 })],
    defence: [member(f.playerIds[1]!), member(f.playerIds[2]!, { weight: 0 })] });
  await f.db.transaction(tx => settleHonor(tx, f.seasonId, e));
  const receipts = await f.db.transaction(tx => readHonorReceipts(tx, f.playerIds[1]!, [e]));
  const receipt = receipts.get(JSON.stringify([e.source, e.id]));
  expect(receipt!.delta).toBeGreaterThan(0);
  expect(receipt).toMatchObject({ reason: 'COMBAT', breakdown: { participants: 1 } });
  expect(receipt!.breakdown?.sharedPositiveBlocked).toBeUndefined();
});
