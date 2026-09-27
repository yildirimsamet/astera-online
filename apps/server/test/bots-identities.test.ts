import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { accounts, botProfiles, players } from '../src/db/schema.js';
import { addBot, handleFor, listBots, retireBot } from '../src/services/bots/roster.js';
import { BOT_IDENTITIES, syncBotIdentities } from '../src/services/bots/identities.js';
import { USERNAME_PATTERN } from '../src/auth/credentials.js';
import { seedWorld, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(async () => { f = await seedWorld(2); });

describe('owner supplied bot identities', () => {
  it('contains 70 Turkish, 10 French, 10 German, and 10 Spanish unique names', () => {
    expect(BOT_IDENTITIES).toHaveLength(100);
    for (const [country, count] of [['TR', 70], ['FR', 10], ['DE', 10], ['ES', 10]] as const) {
      expect(BOT_IDENTITIES.filter((identity) => identity.country === country)).toHaveLength(count);
    }
    expect(new Set(BOT_IDENTITIES.map(({ name }) => name.toLocaleLowerCase('tr'))).size).toBe(100);
    expect(BOT_IDENTITIES).toContainEqual({ name: 'Gölge_Avcısı', country: 'TR' });
    expect(BOT_IDENTITIES).toContainEqual({ name: 'SchwarzerBär', country: 'DE' });
    expect(BOT_IDENTITIES).toContainEqual({ name: 'Turo_Rojo', country: 'ES' });
    for (const { name } of BOT_IDENTITIES) expect(USERNAME_PATTERN.test(handleFor(name))).toBe(true);
  });

  it('updates old commanders in place, creates missing ones, and is safe to rerun', async () => {
    const old = await addBot(f.db, 'OldCommander', f.clock);
    await f.db.insert(players).values({
      accountId: old.accountId, seasonId: f.seasonId, name: 'OldCommander',
    });
    const identities = [
      { name: 'KaraKedi', country: 'TR' },
      { name: 'L_Ombre', country: 'FR' },
      { name: 'Gizemli_', country: 'TR' },
    ] as const;

    await syncBotIdentities(f.db, f.clock, identities);
    const first = await listBots(f.db);
    expect(first.map((row) => [row.displayName, row.country])).toEqual(
      identities.map(({ name, country }) => [name, country]),
    );
    expect(first[0]?.accountId).toBe(old.accountId);
    const [player] = await f.db.select().from(players).where(eq(players.accountId, old.accountId));
    expect(player?.name).toBe('KaraKedi');
    await syncBotIdentities(f.db, f.clock, identities);
    expect(await listBots(f.db)).toEqual(first);
    expect(await f.db.select().from(botProfiles)).toHaveLength(3);
  });

  it('does not change any identity when a requested name belongs to a person', async () => {
    const old = await addBot(f.db, 'OldCommander', f.clock);
    await f.db.insert(accounts).values({
      username: 'karakedi', passwordHash: 'hash', displayName: 'KaraKedi', countryCode: 'DE',
    });
    await expect(syncBotIdentities(f.db, f.clock, [
      { name: 'KaraKedi', country: 'TR' }, { name: 'L_Ombre', country: 'FR' },
    ])).rejects.toThrow(/KaraKedi/);
    expect((await listBots(f.db)).map((row) => row.displayName)).toEqual(['OldCommander']);
    expect((await listBots(f.db))[0]?.accountId).toBe(old.accountId);
  });

  it('retires a renamed commander by its visible name', async () => {
    await addBot(f.db, 'OldCommander', f.clock);
    await syncBotIdentities(f.db, f.clock, [{ name: 'KaraKedi', country: 'TR' }]);
    expect(await retireBot(f.db, 'KaraKedi')).toBe(true);
    expect(await listBots(f.db)).toEqual([]);
  });

  it('keeps a deliberately retired listed commander retired', async () => {
    const retired = await addBot(f.db, 'KaraKedi', f.clock);
    await f.db.update(botProfiles).set({ retiredAt: f.clock.now() })
      .where(eq(botProfiles.accountId, retired.accountId));
    await syncBotIdentities(f.db, f.clock, [
      { name: 'KaraKedi', country: 'TR' }, { name: 'L_Ombre', country: 'FR' },
    ]);
    expect((await listBots(f.db)).map((row) => row.displayName)).toEqual(['L_Ombre']);
    const [account] = await f.db.select().from(accounts).where(eq(accounts.id, retired.accountId));
    expect(account?.countryCode).toBe('TR');
  });

  it('runs the roster sync after migration and before starting the worker', async () => {
    const script = await readFile(resolve(import.meta.dirname, '../../../deploy/deploy.sh'), 'utf8');
    const migrate = script.indexOf('apps/server/src/cli/season.ts migrate');
    const sync = script.indexOf('apps/server/src/cli/bots.ts sync');
    const start = script.indexOf('$COMPOSE up -d --remove-orphans worker api1 api2 api3');
    expect(migrate).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(migrate);
    expect(start).toBeGreaterThan(sync);
  });
});
