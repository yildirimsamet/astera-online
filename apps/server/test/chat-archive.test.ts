import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { asc, eq } from 'drizzle-orm';
import {
  accounts,
  chatArchive,
  chatMessages,
  clanMessages,
  clans,
  perfSessions,
  seasons,
} from '../src/db/schema.js';
import { deleteAccount } from '../src/services/accountDeletion.js';
import { wipeAllServers } from '../src/services/servers.js';
import { forceSeasonEnd } from '../src/worker/handlers.js';
import { makeAccount, seedWorld, testDb, type Fixture } from './helpers.js';

afterAll(async () => {
  const { close } = await testDb();
  await close();
});

/**
 * THE CONVERSATION OUTLIVES THE GALAXY. Owner instruction, 2026-09-27:
 * *"Sezon bitimlerinde force wipe bile olsa chat saklanmalı silinmemeli. Bizim için geriye
 * dönük veri."*
 *
 * The live chat tables hang off `players`, which every wipe deletes, so the rows cannot simply be
 * left behind. The wipe copies both channels into `chat_archive` — who said it (account and the
 * name they wore), where (galaxy language or clan), what and when — and only then clears the
 * live tables exactly as before. A scheduled rollover and a forced wipe share this path.
 */
describe('the chat archive', () => {
  let f: Fixture;

  beforeEach(async () => {
    f = await seedWorld(2, 5151);
  });

  const talk = async () => {
    await f.db.insert(chatMessages).values({
      seasonId: f.seasonId,
      authorPlayerId: f.playerIds[0]!,
      language: 'en',
      content: 'hello galaxy',
      createdAt: f.clock.now(),
    });
    const [clan] = await f.db.insert(clans).values({
      seasonId: f.seasonId, name: 'Orion Guard', nameKey: 'orion guard', tag: 'OG',
      createdAt: f.clock.now(),
    }).returning();
    await f.db.insert(clanMessages).values({
      seasonId: f.seasonId,
      clanId: clan!.id,
      authorPlayerId: f.playerIds[1]!,
      content: 'saldırı 21:00',
      createdAt: f.clock.now(),
    });
    return clan!;
  };

  const wipe = async () => {
    await forceSeasonEnd({ db: f.db, clock: f.clock }, f.seasonId);
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 4 });
  };

  it('keeps the galaxy and the clan conversation through a forced wipe', async () => {
    const clan = await talk();
    const [author0] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));
    const [author1] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[1]!));

    await wipe();

    expect(await f.db.select().from(chatMessages)).toHaveLength(0);
    expect(await f.db.select().from(clanMessages)).toHaveLength(0);
    const archived = await f.db.select().from(chatArchive).orderBy(asc(chatArchive.channel));
    expect(archived).toHaveLength(2);
    expect(archived[0]).toMatchObject({
      seasonId: f.seasonId,
      channel: 'CLAN',
      language: null,
      clanId: clan.id,
      clanTag: 'OG',
      clanName: 'Orion Guard',
      authorAccountId: f.accountIds[1],
      authorName: author1!.displayName,
      content: 'saldırı 21:00',
      createdAt: f.clock.now(),
    });
    expect(archived[1]).toMatchObject({
      seasonId: f.seasonId,
      channel: 'GALAXY',
      language: 'en',
      clanId: null,
      clanTag: null,
      clanName: null,
      authorAccountId: f.accountIds[0],
      authorName: author0!.displayName,
      content: 'hello galaxy',
      createdAt: f.clock.now(),
    });
  });

  it('keeps the archive of every earlier season when the next one is wiped', async () => {
    await talk();
    await wipe();
    // The next season is played by nobody here and wiped again: nothing earlier may go.
    const live = await f.db.select().from(seasons).where(eq(seasons.status, 'live'));
    for (const next of live) await forceSeasonEnd({ db: f.db, clock: f.clock }, next.id);
    await wipeAllServers(f.db, f.clock, { count: 1, capacity: 4 });
    const archived = await f.db.select().from(chatArchive);
    expect(archived).toHaveLength(2);
    expect(archived.every((row) => row.seasonId === f.seasonId)).toBe(true);
  });

  /**
   * ERASURE STILL MEANS ERASURE. A person who asks to be deleted takes what they wrote with them,
   * from the archive as much as from a live galaxy — and nobody else's words go with it.
   */
  it('erases what a deleted person said, and only that', async () => {
    await talk();
    await wipe();
    const [leaver] = await f.db.select().from(accounts).where(eq(accounts.id, f.accountIds[0]!));

    await deleteAccount(f.db, f.clock, leaver!.username);

    const left = await f.db.select().from(chatArchive);
    expect(left).toHaveLength(1);
    expect(left[0]?.authorAccountId).toBe(f.accountIds[1]);
  });
});

/**
 * A PERFORMANCE RECORDING BELONGS TO ITS ACCOUNT. `perf_sessions` (0100) references `accounts`
 * with no cascade, and the erasure never learned about it — so deleting anybody who had ever
 * recorded a session failed on the foreign key and the person could not be erased at all.
 */
describe('erasing a person who recorded a performance session', () => {
  it('takes the recordings with the account', async () => {
    const f = await seedWorld(1, 5152);
    const spare = await makeAccount(f.db, 'Recorder');
    await f.db.insert(perfSessions).values({
      accountId: spare.id,
      startedAt: f.clock.now(),
      endedAt: f.clock.now(),
      device: {},
      summary: {},
      samples: [],
      createdAt: f.clock.now(),
    });

    await deleteAccount(f.db, f.clock, spare.username);

    expect(await f.db.select().from(accounts).where(eq(accounts.id, spare.id))).toHaveLength(0);
    expect(await f.db.select().from(perfSessions)).toHaveLength(0);
  });
});
