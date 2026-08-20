/**
 * World operations — the only way galaxies come into existence.
 *
 *   pnpm --filter @blindspace/server season migrate
 *   pnpm --filter @blindspace/server season bootstrap
 *   pnpm --filter @blindspace/server season status
 *   pnpm --filter @blindspace/server season wipe --yes
 */
import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SEASON, SERVERS } from '@blindspace/rules';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { addMinutes, systemClock } from '../clock.js';
import { accounts, players } from '../db/schema.js';
import { hashPassword } from '../auth/password.js';
import { createSeason, liveSeason } from '../services/season.js';
import { joinSeason } from '../services/player.js';
import {
  bootstrapServers,
  listServers,
  shardNameFor,
  wipeAllServers,
} from '../services/servers.js';

const USAGE = `
season migrate                     apply pending migrations
season bootstrap [options]         open all ${String(SERVERS.count)} galaxies (idempotent)
season create [options]            open ONE galaxy on a named shard
season status                      every galaxy, its population and who is on it
season wipe --yes [options]        END EVERYTHING. Fold records into accounts,
                                   delete every season world, open fresh galaxies.

  --shard CODE      shard code, for 'create'   (default: EU-1)
  --seed N          galaxy seed / seed base    (default: random)
  --days N          season length              (default: ${String(SEASON.days)})
  --cap N           planets per galaxy         (default: ${String(SERVERS.capacity)})
  --count N         galaxies, for 'bootstrap'  (default: ${String(SERVERS.count)})
  --unattended N    DEV AID ONLY: place N inert commanders on the FIRST open galaxy
                    so a solo developer has something to scout and raid.
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
      count: { type: 'string' },
      unattended: { type: 'string' },
      yes: { type: 'boolean' },
    },
  });

  const command = positionals[0];
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, { max: 4 });
  const shardCode = values.shard ?? 'EU-1';

  try {
    switch (command) {
      case 'migrate': {
        await runMigrations(db);
        console.log('migrations applied');
        return;
      }

      case 'bootstrap': {
        const result = await bootstrapServers(db, systemClock, {
          count: num(values.count, SERVERS.count),
          capacity: num(values.cap, SERVERS.capacity),
          days: num(values.days, SEASON.days),
          ...(values.seed === undefined ? {} : { seedBase: num(values.seed, 0) }),
        });
        console.log(
          [
            `opened     ${result.created.join(', ') || '(none)'}`,
            `already up ${result.existing.join(', ') || '(none)'}`,
            `capacity   ${String(num(values.cap, SERVERS.capacity))} planets each`,
          ].join('\n'),
        );
        await placeUnattended(db, num(values.unattended, 0));
        return;
      }

      case 'status': {
        const servers = await listServers(db, systemClock);
        if (servers.length === 0) {
          console.log('no galaxies. run: season bootstrap');
          return;
        }
        console.log('  #  shard      name          planets   online  status');
        for (const s of servers) {
          console.log(
            [
              String(s.ordinal).padStart(3),
              '  ',
              s.code.padEnd(11),
              s.name.padEnd(14),
              `${String(s.planets)}/${String(s.capacity)}`.padStart(7),
              String(s.online).padStart(8),
              '  ',
              s.status,
            ].join(''),
          );
        }
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
          shardName: shardNameFor(1),
          seed,
          startsAt: systemClock.now(),
          days: num(values.days, SEASON.days),
          playerCap: num(values.cap, SERVERS.capacity),
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
        await placeUnattended(db, num(values.unattended, 0));
        return;
      }

      case 'wipe': {
        // A confirmation flag rather than a prompt: this command is meant to be
        // runnable from a script, and a script cannot answer a prompt. What it
        // must not be is runnable by accident.
        if (values.yes !== true) {
          throw new Error(
            'wipe ends every season and deletes every planet in the world. ' +
              'Re-run with --yes if that is what you mean.',
          );
        }
        const result = await wipeAllServers(db, systemClock, {
          count: num(values.count, SERVERS.count),
          capacity: num(values.cap, SERVERS.capacity),
          days: num(values.days, SEASON.days),
          ...(values.seed === undefined ? {} : { seedBase: num(values.seed, 0) }),
        });
        console.log(
          [
            `seasons wiped   ${String(result.seasonsWiped)}`,
            `players cleared ${String(result.playersCleared)}`,
            `galaxies opened ${result.serversOpened.join(', ') || '(none)'}`,
          ].join('\n'),
        );
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

/**
 * DEV AID ONLY. Inert commanders on the first galaxy that will take them.
 *
 * They never act. Anything they appear to teach you about balance is a lie — they
 * exist so that a solo developer has something to point a telescope at.
 */
async function placeUnattended(
  db: Awaited<ReturnType<typeof createDb>>['db'],
  count: number,
): Promise<void> {
  if (count <= 0) return;

  const servers = await listServers(db, systemClock);
  const open = servers.find((s) => s.status === 'open');
  if (!open) throw new Error('no open galaxy to place unattended commanders on');

  const row = await liveSeason(db, open.code);
  if (!row) throw new Error(`${open.code} has no live season`);

  // Backdated a few hours so they read as established commanders rather than as a
  // crowd that appeared in the same second. Nothing gates on it any more —
  // newcomer grace is gone (D14) — but the ladder and the return payload both read
  // joinedAt, and a shard where every player is zero minutes old looks broken.
  const joinedAt = addMinutes(systemClock.now(), -300);

  for (let i = 0; i < count; i++) {
    const name = `${NAMES[i % NAMES.length]!}-${String(100 + i)}`;
    const [account] = await db
      .insert(accounts)
      .values({
        // Usernames are unique, so a second run must not collide with the first.
        username: `${name.toLowerCase().replace('-', '_')}_${randomBytes(2).toString('hex')}`,
        // A real hash of bytes nobody has. These accounts are not sign-in-able by
        // design: an unattended commander with a guessable password is a way in.
        passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
        displayName: name,
      })
      .returning();

    const placed = await joinSeason(db, account!.id, row.season.id, systemClock);
    await db.update(players).set({ joinedAt }).where(eq(players.id, placed.playerId));
  }

  console.log(
    `\nplaced ${String(count)} UNATTENDED commanders on ${open.code}.\n` +
      'They never act. They exist so a solo developer can exercise the loop —\n' +
      'anything they appear to teach you about balance is a lie.',
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
