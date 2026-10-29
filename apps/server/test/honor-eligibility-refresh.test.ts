import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { HONOR_LAUNCH_VERSION } from '@astera/rules';
import { accounts, botProfiles, honorCommitments, honorEvents, players, seasons } from '../src/db/schema.js';
import { refreshHonorEligibility } from '../src/services/honorActivation.js';
import { commitHonor, honorCommitmentSchema, worldHonorCommitment } from '../src/services/honorCommitment.js';
import { advanceHonor, emptyHonorState } from '../src/services/honorAccounting.js';
import { honorEvidenceHash, prepareHonorSeason } from '../src/services/honorLedger.js';
import { observeHonorOwner } from '../src/services/honorReference.js';
import { strategicHonorEvidence } from '../src/services/honorStrategic.js';
import { seedWorld, testDb, type Fixture } from './helpers.js';

/** Owner 2026-10-29: fights with bots count. Flights committed by the previous image froze the old exclusion. */
describe('re-judging unsettled Honor commitments frozen under the bot exclusion', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await seedWorld(4, 7719);
    await f.db.transaction(async tx => {
      await prepareHonorSeason(tx, f.seasonId, 'ACTIVE', f.clock, HONOR_LAUNCH_VERSION);
      for (const id of [...f.playerIds].sort()) await observeHonorOwner(tx, id, f.clock.now());
    });
    await f.db.insert(botProfiles).values([1, 3].map((index, ordinal) => ({ accountId: f.accountIds[index]!,
      ordinal: ordinal + 1, persona: 'RAIDER', nextActionAt: f.clock.now(), createdAt: f.clock.now() })));
  });
  afterAll(async () => { await (await testDb()).close(); });

  /** Commits under today's rule, then writes the verdict the previous image froze. */
  const oldCommit = async (attacker: number, defender: number, admins: ReadonlySet<string> = new Set()) => {
    const id = randomUUID();
    const snapshot = await f.db.transaction(tx => commitHonor(tx, { seasonId: f.seasonId, source: 'WORLD', id,
      attack: [f.playerIds[attacker]!], defence: [f.playerIds[defender]!], at: f.clock.now(), adminUsernames: admins }));
    await f.db.update(honorCommitments).set({ snapshot: { ...snapshot!, eligible: false } })
      .where(eq(honorCommitments.sourceId, id));
    return id;
  };
  const frozen = async (id: string) => honorCommitmentSchema.parse((await f.db.select().from(honorCommitments)
    .where(eq(honorCommitments.sourceId, id)))[0]!.snapshot).eligible;
  const refresh = (apply: boolean, admins: ReadonlySet<string> = new Set()) =>
    refreshHonorEligibility(f.db, { seasonId: f.seasonId, adminUsernames: admins, apply });

  it('previews without writing, then rescores a person-versus-bot flight once', async () => {
    const id = await oldCommit(0, 1);
    expect(await refresh(false)).toMatchObject({ applied: false, refreshed: [`WORLD:${id}`] });
    expect(await frozen(id)).toBe(false);
    expect(await refresh(true)).toMatchObject({ applied: true, refreshed: [`WORLD:${id}`] });
    expect(await frozen(id)).toBe(true);
    const settled = await f.db.transaction(tx => worldHonorCommitment(tx, { seasonId: f.seasonId, missionId: id,
      host: f.playerIds[1]!, supporters: [], adminUsernames: new Set() }));
    expect(settled?.eligible).toBe(true);
    expect((await refresh(true)).refreshed).toEqual([]);
  });

  it('passes over a flight whose commander has since left the galaxy and still rescues the rest', async () => {
    const departed = await oldCommit(0, 1);
    const kept = await oldCommit(2, 3);
    const [original] = await f.db.select().from(seasons).where(eq(seasons.id, f.seasonId));
    const otherId = randomUUID();
    await f.db.insert(seasons).values({ id: otherId, shardId: original!.shardId, cycleId: original!.cycleId,
      seed: 7720, startsAt: original!.endsAt, endsAt: new Date(original!.endsAt.getTime() + 86_400_000) });
    await f.db.update(players).set({ seasonId: otherId }).where(eq(players.id, f.playerIds[1]!));
    expect((await refresh(true)).refreshed).toEqual([`WORLD:${kept}`]);
    expect(await frozen(departed)).toBe(false);
  });

  it('leaves bots-only, operator and already settled flights as they were', async () => {
    const bots = await oldCommit(3, 1);
    const [admin] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[2]!));
    const admins = new Set([admin!.username]);
    const operator = await oldCommit(0, 2, admins);
    const settled = await oldCommit(0, 1);
    const [row] = await f.db.select().from(honorCommitments).where(eq(honorCommitments.sourceId, settled));
    const evidence = { ...strategicHonorEvidence(honorCommitmentSchema.parse(row!.snapshot), settled, f.clock.now()),
      source: 'WORLD' as const };
    await f.db.insert(honorEvents).values({ seasonId: f.seasonId, source: 'WORLD', sourceId: settled, at: f.clock.now(),
      evidence, evidenceHash: honorEvidenceHash(evidence, HONOR_LAUNCH_VERSION),
      outcome: advanceHonor(emptyHonorState(), evidence, HONOR_LAUNCH_VERSION).event });
    expect((await refresh(true, admins)).refreshed).toEqual([]);
    for (const id of [bots, operator, settled]) expect(await frozen(id)).toBe(false);
    expect(await f.db.select().from(honorEvents).where(and(eq(honorEvents.sourceId, settled)))).toHaveLength(1);
  });
});
