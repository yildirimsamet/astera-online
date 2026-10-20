import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { honorCommitments, honorEvents, honorObservations, honorSeasons, honorTotals, planets, players, seasons } from '../src/db/schema.js';
import { TEST_DATABASE_URL, seedWorld, testDb, type Fixture } from './helpers.js';
import { prepareHonorSeason } from '../src/services/honorLedger.js';

describe('the real season honor-shadow command', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(1, 24017);
    const now = new Date();
    await f.db.update(seasons).set({ startsAt: new Date(now.getTime() - 3_600_000),
      endsAt: new Date(now.getTime() + 86_400_000) }).where(eq(seasons.id, f.seasonId));
  });
  afterAll(async () => { await (await testDb()).close(); });
  const command = (args: readonly string[], operation = 'honor-shadow') => new Promise<{ ok: boolean; stdout: string; stderr: string }>((resolve) => {
    execFile(process.execPath, ['--import', 'tsx', 'src/cli/season.ts', operation, ...args], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 20_000, maxBuffer: 64 * 1024,
      env: { ...process.env, NODE_ENV: 'test', NODE_OPTIONS: '--max-old-space-size=512', DATABASE_URL: TEST_DATABASE_URL,
        JWT_SECRET: 'honor-cli-test-secret-do-not-use' },
    }, (error, stdout, stderr) => { resolve({ ok: error === null, stdout, stderr }); });
  });

  it('previews and explicitly enables benefits without changing Honor scores or observations', async () => {
    const [season] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    if (!season) throw new Error('Missing CLI season');
    f.clock.set(season.startsAt);
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 75_000_000 });
    const before = await snapshot();
    const preview = await command(['--season', f.seasonId], 'honor-benefits');
    expect(preview.ok, preview.stderr).toBe(true);
    expect(preview.stdout).toContain('"applied":false');
    expect(await snapshot()).toEqual(before);
    const applied = await command(['--season', f.seasonId, '--yes'], 'honor-benefits');
    expect(applied.ok, applied.stderr).toBe(true);
    expect((await f.db.select().from(honorSeasons))[0]?.benefitsVersion).toBe(1);
    const after = await snapshot();
    expect(after.totals).toEqual(before.totals);
    expect(after.samples).toEqual(before.samples);
    expect(after.players).toEqual(before.players);
    const retry = await command(['--season', f.seasonId, '--yes'], 'honor-benefits');
    expect(retry.ok, retry.stderr).toBe(true);
    expect(await snapshot()).toEqual(after);
  });

  it('previews and opens the real honor-open command without adopting trial scores', async () => {
    const now = new Date();
    f.clock.set(new Date(now.getTime() - 2 * 86_400_000));
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    await f.db.insert(honorTotals).values({ seasonId: f.seasonId, playerId: f.playerIds[0]!, score: 999_000_000 });
    const before = await snapshot();
    const preview = await command(['--season', f.seasonId], 'honor-open');
    expect(preview.ok, preview.stderr).toBe(true);
    expect(preview.stdout).toContain('"applied":false');
    expect(await snapshot()).toEqual(before);
    const applied = await command(['--season', f.seasonId, '--yes'], 'honor-open');
    expect(applied.ok, applied.stderr).toBe(true);
    expect(applied.stdout).toContain('"applied":true');
    expect((await f.db.select().from(honorSeasons))[0]!.mode).toBe('ACTIVE');
    expect(await f.db.select().from(honorTotals)).toHaveLength(0);
    const opened = await snapshot();
    const retry = await command(['--season', f.seasonId, '--yes'], 'honor-open');
    expect(retry.ok, retry.stderr).toBe(true);
    expect(retry.stdout).toContain('ALREADY_ACTIVE');
    expect(await snapshot()).toEqual(opened);
  });

  it('previews and hides an opened race with the real honor-hide command', async () => {
    const now = new Date();
    f.clock.set(new Date(now.getTime() - 2 * 86_400_000));
    await f.db.transaction(tx => prepareHonorSeason(tx, f.seasonId, 'SHADOW', f.clock));
    expect((await command(['--season', f.seasonId, '--yes'], 'honor-open')).ok).toBe(true);
    const before = await snapshot();
    const preview = await command(['--season', f.seasonId], 'honor-hide');
    expect(preview.ok, preview.stderr).toBe(true);
    expect(preview.stdout).toContain('"applied":false');
    expect(await snapshot()).toEqual(before);
    const applied = await command(['--season', f.seasonId, '--yes'], 'honor-hide');
    expect(applied.ok, applied.stderr).toBe(true);
    expect(applied.stdout).toContain('"applied":true');
    expect((await f.db.select().from(honorSeasons))[0]).toMatchObject({ mode: 'SHADOW', rankedAt: null, successorAnnounced: true });
    const hidden = await snapshot();
    const retry = await command(['--season', f.seasonId, '--yes'], 'honor-hide');
    expect(retry.ok, retry.stderr).toBe(true);
    expect(retry.stdout).toContain('ALREADY_HIDDEN');
    expect(await snapshot()).toEqual(hidden);
  });

  it.each([[], ['--season', 'not-a-season'], ['--season', 'missing', '--days', '2']]
    .map(args => ({ args })))('rejects malformed honor-hide input: $args', async ({ args }) => {
    const before = await snapshot();
    const result = await command(args, 'honor-hide');
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });

  it.each([[], ['--shard', 'EU-1'], ['--season', 'not-a-season'], ['--season', 'missing', '--days', '2']]
    .map(args => ({ args })))('rejects malformed honor-open input: $args', async ({ args }) => {
    const before = await snapshot();
    const result = await command(args, 'honor-open');
    expect(result.ok).toBe(false);
    expect(await snapshot()).toEqual(before);
  });
  const snapshot = async () => ({
    seasons: await f.db.select().from(seasons), players: await f.db.select().from(players), planets: await f.db.select().from(planets),
    config: await f.db.select().from(honorSeasons), samples: await f.db.select().from(honorObservations),
    commitments: await f.db.select().from(honorCommitments), events: await f.db.select().from(honorEvents), totals: await f.db.select().from(honorTotals),
  });

  it('defaults to preview and writes absolutely no game or Honor rows', async () => {
    const before = await snapshot();
    const result = await command(['--season', f.seasonId]);
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toContain('"applied":false');
    expect(result.stdout).toContain(`"seasonId":"${f.seasonId}"`);
    expect(result.stdout).toContain('"mode":"SHADOW"');
    expect(result.stdout).toContain('"version":4');
    expect(await snapshot()).toEqual(before);
  });

  it('requires the explicit write flag and remains idempotent on retry', async () => {
    const result = await command(['--season', f.seasonId, '--yes']);
    expect(result.ok, result.stderr).toBe(true);
    expect(result.stdout).toContain('"applied":true');
    expect((await f.db.select().from(honorSeasons))[0]?.mode).toBe('SHADOW');
    const before = await snapshot();
    const retry = await command(['--season', f.seasonId, '--yes']);
    expect(retry.ok, retry.stderr).toBe(true);
    expect(retry.stdout).toContain('"status":"ALREADY_ENABLED"');
    expect(retry.stdout).toContain('"applied":false');
    expect(await snapshot()).toEqual(before);
  });

  it.each([
    [], ['--shard', 'EU-1'], ['--season', 'not-a-season'],
    ['--mode', 'ACTIVE'], ['--yes', 'extra'],
  ].map(args => ({ args })))('rejects an invalid operator command without database writes: $args', async ({ args }) => {
    const before = await snapshot();
    const result = await command(args);
    expect(result.ok).toBe(false);
    expect(result.stderr.length).toBeGreaterThan(0);
    expect(await snapshot()).toEqual(before);
  });
});
