/**
 * World operations — the only way galaxies come into existence.
 *
 *   pnpm --filter @astera/server season migrate
 *   pnpm --filter @astera/server season bootstrap
 *   pnpm --filter @astera/server season status
 *   pnpm --filter @astera/server season wipe --yes
 */
import { parseArgs } from 'node:util';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { GALAXY_EVENT_KINDS, SEASON, SERVERS, rewardId, type GalaxyEventKind } from '@astera/rules';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { addMinutes, systemClock } from '../clock.js';
import { accounts, players } from '../db/schema.js';
import { hashPassword } from '../auth/password.js';
import { createSeason, liveSeason } from '../services/season.js';
import { restampFutureOccurrences } from '../services/galaxyEvents.js';
import { joinSeason } from '../services/player.js';
import { grantReward } from '../services/rewards.js';
import { deleteAccount, describeAccount } from '../services/accountDeletion.js';
import {
  bootstrapServers,
  listServers,
  shardNameFor,
  wipeAllServers,
} from '../services/servers.js';

/** The @JoinAstera bonus, which is the only hand-checked reward there is. */
const SOCIAL_REWARD = rewardId('SOCIAL', 1);

const USAGE = `
season migrate                     apply pending migrations
season bootstrap [options]         open all ${String(SERVERS.count)} galaxies (idempotent)
season create [options]            open ONE galaxy on a named shard
season status                      every galaxy, its population and who is on it
season wipe --yes [options]        END EVERYTHING. Fold records into accounts,
                                   delete every season world, open fresh galaxies.
season reward NAME [--id ID]       unlock a hand-checked reward for one commander
                                   (default SOCIAL:1 — the @JoinAstera bonus)
season delete-account NAME [--yes] ERASE ONE PERSON at their own request: the
                                   account, the commander, the capital and every
                                   row either was the reason for. A captured
                                   colony is handed back to the galaxy as the
                                   caretaker world it was born as. Dry run unless
                                   --yes. Refuses while anything is in the air.
season restamp [--yes] [options]    re-deal the effect of every window of ONE event
                                   kind that has NOT opened yet, from today's
                                   rules. Dry run unless --yes; opened windows are
                                   never touched (see the note in the service).
                                   --kind KIND, default ASTEROID_SHOWER

  --shard CODE      shard code, for 'create'   (default: EU-1)
  --seed N          galaxy seed / seed base    (default: random)
  --days N          season length              (default: ${String(SEASON.days)})
  --cap N           planets per galaxy         (default: ${String(SERVERS.capacity)})
  --count N         galaxies, for 'bootstrap'  (default: ${String(SERVERS.count)})
  --unattended N    DEV AID ONLY: place N inert commanders on the FIRST open galaxy
                    so a solo developer has something to scout and raid.
  --id ID           reward tier, for 'reward'    (default: ${SOCIAL_REWARD})

THE TWITTER BONUS IS A HUMAN CHECKING A DIRECT MESSAGE, and this is the whole of
its implementation. A player follows @JoinAstera and sends their commander name;
you read it and run:

  pnpm --filter @astera/server season reward Vantage

That writes the grant. The PLAYER still claims it in the game, from the rewards
panel, so the resources arrive while they are looking at them and the ordinary
claim path does the locking, the once-only key and the toast. Idempotent: running
it twice for the same commander is a no-op and says so.

ONCE PER PERSON, NOT ONCE PER SEASON. The grant is written against the ACCOUNT, so
somebody who was paid in an earlier galaxy is reported as already holding it — and
a commander between galaxies, with no world at all, can still be granted it ready
for whichever one they join next.

There is no HTTP route for this on purpose. An admin endpoint would put an admin
credential in the environment of a public API for the sake of a few dozen manual
grants a season; a command on a box only the operator can reach does the same job
with no attack surface at all.
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

function galaxyCount(value: string | undefined): number {
  const count = num(value, SERVERS.count);
  if (!Number.isInteger(count) || count < 1 || count > SERVERS.count) {
    throw new Error(`Galaxy count must be an integer from 1 to ${String(SERVERS.count)}`);
  }
  return count;
}

function galaxyCapacity(value: string | undefined, production: boolean): number {
  const capacity = num(value, SERVERS.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('Galaxy capacity must be a positive integer');
  }
  if (production && capacity !== SERVERS.capacity) {
    throw new Error(
      `Production galaxy capacity is fixed at ${String(SERVERS.capacity)}; `
      + `refusing --cap ${String(capacity)}.`,
    );
  }
  return capacity;
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
      id: { type: 'string' },
      kind: { type: 'string' },
      yes: { type: 'boolean' },
    },
  });

  const command = positionals[0];
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, {
    max: 4,
    applicationName: 'astera-season-cli',
  });
  const shardCode = values.shard ?? 'EU-1';

  try {
    switch (command) {
      case 'migrate': {
        await runMigrations(db);
        console.log('migrations applied');
        return;
      }

      case 'bootstrap': {
        const capacity = galaxyCapacity(values.cap, env.NODE_ENV === 'production');
        const result = await bootstrapServers(db, systemClock, {
          count: galaxyCount(values.count),
          capacity,
          days: num(values.days, SEASON.days),
          ...(values.seed === undefined ? {} : { seedBase: num(values.seed, 0) }),
        });
        console.log(
          [
            `opened     ${result.created.join(', ') || '(none)'}`,
            `already up ${result.existing.join(', ') || '(none)'}`,
            `capacity   ${String(capacity)} planets each`,
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
        const officialOrdinal = Array.from(
          { length: SERVERS.count },
          (_, index) => index + 1,
        ).find((ordinal) => shardCode === `EU-${String(ordinal)}`);
        if (
          env.NODE_ENV === 'production'
          && officialOrdinal === undefined
        ) {
          throw new Error(
            `Production may open only EU-1..EU-${String(SERVERS.count)}; `
            + `${shardCode} would bypass the live-galaxy ceiling.`,
          );
        }
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
        const capacity = galaxyCapacity(values.cap, env.NODE_ENV === 'production');
        const { season, galaxy } = await createSeason(db, {
          shardCode,
          shardName: officialOrdinal === undefined ? shardCode : shardNameFor(officialOrdinal),
          ...(officialOrdinal === undefined ? {} : { ordinal: officialOrdinal }),
          seed,
          startsAt: systemClock.now(),
          days: num(values.days, SEASON.days),
          playerCap: capacity,
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

      /**
       * D178. The calendar is frozen at deal time, so a definition change reaches
       * nothing already on it. This is the door — and the safety rule lives in
       * `restampFutureOccurrences`, not here: a window that has opened owns rocks
       * whose indices are load-bearing, so only future ones are ever moved.
       *
       * A DRY RUN IS THE DEFAULT, and it is the real transaction rolled back
       * rather than a second code path that counts differently from the one that
       * writes.
       */
      case 'restamp': {
        const now = systemClock.now();
        // Named, never defaulted: see `restampFutureOccurrences` for why a sweep
        // over every lane is the wrong shape for this command.
        const kind = values.kind ?? 'ASTEROID_SHOWER';
        if (!GALAXY_EVENT_KINDS.includes(kind as GalaxyEventKind)) {
          throw new Error(`Unknown event kind ${kind}. One of: ${GALAXY_EVENT_KINDS.join(', ')}`);
        }
        const kinds = [kind as GalaxyEventKind];
        const seasonId = values.shard === undefined
          ? undefined
          : (await liveSeason(db, values.shard))?.season.id;
        if (values.shard !== undefined && seasonId === undefined) {
          throw new Error(`no live season on ${values.shard}`);
        }
        if (values.yes === true) {
          const changed = await db.transaction((tx) =>
            restampFutureOccurrences(tx, { now, seasonId, kinds }));
          console.log(`restamped ${String(changed)} pending window(s).`);
          break;
        }
        class DryRun extends Error {}
        let planned = 0;
        try {
          await db.transaction(async (tx) => {
            planned = await restampFutureOccurrences(tx, { now, seasonId, kinds });
            throw new DryRun();
          });
        } catch (error) {
          if (!(error instanceof DryRun)) throw error;
        }
        console.log(
          `${String(planned)} pending window(s) would change. Nothing was written; `
          + 'pass --yes to apply.',
        );
        break;
      }

      /**
       * The operator's half of a reward the game cannot see. See USAGE above and
       * `services/rewards.ts` for why this is a command and not a route.
       */
      case 'reward': {
        const name = positionals[1];
        if (name === undefined) throw new Error('Which commander? season reward NAME');
        const id = values.id ?? SOCIAL_REWARD;
        const result = await grantReward(db, name, id);
        console.log(
          result.already
            ? `${result.player} already has ${id}. Nothing written.`
            : `${result.player} may now claim ${id}.`,
        );
        return;
      }

      /**
       * ERASING ONE PERSON WHO ASKED TO BE ERASED.
       *
       * A COMMAND RATHER THAN A ROUTE, and rather than a sweep, for two reasons:
       * a player deletes themselves roughly never, and the thing being confirmed
       * is a HUMAN REQUEST that no server-side check can verify. The operator read
       * the message; the server can only be told the answer.
       *
       * Dry run by default. It prints who would go and what they hold, because the
       * one failure this command must never have is deleting the wrong person on a
       * name collision — and the operator is typing a name they read in a message,
       * not a uuid.
       */
      case 'delete-account': {
        const name = positionals[1];
        if (name === undefined) throw new Error('Which commander? season delete-account NAME');

        if (values.yes !== true) {
          const found = await describeAccount(db, name);
          if (!found) throw new Error(`No commander named ${name}`);
          console.log(
            [
              `WOULD DELETE  ${found.account}  (login ${found.username})`,
              `joined        ${found.createdAt.toISOString()}`,
              `worlds        ${
                found.worlds.length === 0
                  ? '(none)'
                  : found.worlds
                    .map((world) => `${world.name} [${world.kind} @${String(world.slotIndex)}]`)
                    .join(', ')
              }`,
              '',
              'Nothing was written. Re-run with --yes to erase this person.',
            ].join('\n'),
          );
          return;
        }

        const result = await deleteAccount(db, systemClock, name);
        console.log(
          [
            `deleted      ${result.account} (login ${result.username})`,
            `worlds gone  ${result.worldsRemoved.join(', ') || '(none)'}`,
            `given back   ${result.coloniesReturned.join(', ') || '(none)'}`,
          ].join('\n'),
        );
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
          count: galaxyCount(values.count),
          capacity: galaxyCapacity(values.cap, env.NODE_ENV === 'production'),
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
