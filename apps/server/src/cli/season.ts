/**
 * Season operations — the only way a galaxy comes into existence.
 *
 * Until this existed, a live world could only be created from inside a test, which
 * meant the whole game was reachable over HTTP and unplayable in practice.
 *
 *   pnpm --filter @blindspace/server season migrate
 *   pnpm --filter @blindspace/server season create --shard EU-1 --seed 4242
 *   pnpm --filter @blindspace/server season status
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { ABUSE, SEASON } from '@blindspace/rules';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { addMinutes, systemClock } from '../clock.js';
import { accounts, players } from '../db/schema.js';
import { createSeason, liveSeason } from '../services/season.js';
import { joinSeason } from '../services/player.js';

const USAGE = `
season migrate                     apply pending migrations
season create [options]            open a galaxy on a shard
season status                      what is live right now

  --shard CODE      shard code            (default: SHARD_CODE env, or EU-1)
  --seed N          galaxy seed           (default: random)
  --days N          season length         (default: ${String(SEASON.days)})
  --cap N           player capacity       (default: 200)
  --unattended N    DEV AID ONLY: place N inert commanders so a solo developer
                    has something to scout and raid. Never use on a real shard.
`;

const NAMES = [
  'Rook', 'Sable', 'Ferrous', 'Anvil', 'Copperwood', 'Nyx',
  'Solenne', 'Garnet', 'Ashgrove', 'Perigee', 'Talon', 'Wren',
];

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Expected a number, got "${value}"`);
  return n;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      shard: { type: 'string' },
      seed: { type: 'string' },
      days: { type: 'string' },
      cap: { type: 'string' },
      unattended: { type: 'string' },
    },
  });

  const command = positionals[0];
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, { max: 4 });
  const shardCode = values.shard ?? env.SHARD_CODE;

  try {
    switch (command) {
      case 'migrate': {
        await runMigrations(db);
        console.log('migrations applied');
        return;
      }

      case 'status': {
        const row = await liveSeason(db, shardCode);
        if (!row) {
          console.log(`${shardCode}: no live season`);
          return;
        }
        const population = await db
          .select({ id: players.id })
          .from(players)
          .where(eq(players.seasonId, row.season.id));
        const hoursLeft = (row.season.endsAt.getTime() - Date.now()) / 3_600_000;
        console.log(
          [
            `shard      ${row.shard.code}`,
            `season     ${row.season.id}`,
            `seed       ${String(row.season.seed)}`,
            `players    ${String(population.length)} / ${String(row.shard.playerCap)}`,
            `ends in    ${hoursLeft.toFixed(1)}h`,
          ].join('\n'),
        );
        return;
      }

      case 'create': {
        // Refusing rather than overwriting: two live seasons on one shard would
        // make `liveSeason()` non-deterministic, and the loser would be a galaxy
        // full of players nobody can reach.
        const existing = await liveSeason(db, shardCode);
        if (existing) {
          throw new Error(
            `${shardCode} already has a live season (${existing.season.id}). ` +
              'End it before opening another.',
          );
        }

        const seed = num(values.seed, Math.floor(Math.random() * 1_000_000));
        const { season, galaxy } = await createSeason(db, {
          shardCode,
          seed,
          startsAt: systemClock.now(),
          days: num(values.days, SEASON.days),
          playerCap: num(values.cap, 200),
        });

        console.log(
          [
            `opened ${shardCode}`,
            `season     ${season.id}`,
            `seed       ${String(seed)}`,
            `slots      ${String(galaxy.slots.length)}`,
            `asteroids  ${String(galaxy.asteroids.length)}`,
            `ends       ${season.endsAt.toISOString()}`,
          ].join('\n'),
        );

        const unattended = num(values.unattended, 0);
        if (unattended > 0) {
          // Backdated past newcomer grace. Without this every one of them is
          // untouchable for four hours and the dev aid aids nothing on the day it
          // is created — which is the only day anyone runs this.
          const joinedAt = addMinutes(systemClock.now(), -(ABUSE.graceMinutes + 1));

          for (let i = 0; i < unattended; i++) {
            const name = `${NAMES[i % NAMES.length]!}-${String(100 + i)}`;
            const [account] = await db.insert(accounts).values({ displayName: name }).returning();
            const placed = await joinSeason(db, account!.id, season.id, systemClock);
            await db
              .update(players)
              .set({ joinedAt })
              .where(eq(players.id, placed.playerId));
          }
          console.log(
            `\nplaced ${String(unattended)} UNATTENDED commanders, already past newcomer grace.\n` +
              'They never act. They exist so a solo developer can exercise the loop —\n' +
              'anything they appear to teach you about balance is a lie.',
          );
        }
        return;
      }

      default:
        console.log(USAGE);
        process.exitCode = command === undefined ? 0 : 1;
    }
  } finally {
    await close();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
