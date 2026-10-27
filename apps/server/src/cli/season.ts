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
import { GALAXY_EVENT_KINDS, MULTI_WORLD, SEASON, SERVERS, rewardId, type GalaxyEventKind } from '@astera/rules';
import { createDb } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { addMinutes, systemClock } from '../clock.js';
import { accounts, players, seasons } from '../db/schema.js';
import { hashPassword } from '../auth/password.js';
import { createSeason, liveSeason } from '../services/season.js';
import { adoptMonumentLayout } from '../services/monumentAdoption.js';
import { activateMonumentMotion } from '../services/monumentMotionAdoption.js';
import { recallMonumentFleets } from '../services/monumentRecall.js';
import { activateSpawnGate } from '../services/spawnGate.js';
import { activateMonumentRadiation } from '../services/monumentRadiationAdoption.js';
import { activateRadiationBombs } from '../services/radiationBombAdoption.js';
import { activateAdmiral } from '../services/admiralActivation.js';
import { activateTempoSlowdown } from '../services/tempoAdoption.js';
import { activateHonorShadow, hideHonorRanking, openHonorRanking } from '../services/honorActivation.js';
import { enableHonorBenefits } from '../services/honorBenefits.js';
import { enableHonorLootWeight } from '../services/honorLootWeight.js';
import {
  restampFutureOccurrences,
  syncMissingFixedOccurrences,
  adoptLiveEventCalendar,
  type CalendarAdoptionReport,
} from '../services/galaxyEvents.js';
import { joinSeason } from '../services/player.js';
import { grantReward } from '../services/rewards.js';
import { describeAccount } from '../services/accountDeletion.js';
import { departToSilentSpace, describeSilentSpaceDeparture } from '../services/silentSpace.js';
import {
  bootstrapServers,
  listServers,
  shardNameFor,
  wipeAllServers,
} from '../services/servers.js';
import { forceSeasonEnd } from '../worker/handlers.js';
import { bootstrapLocalWorld } from './localWorld.js';

/** The @JoinAstera bonus, which is the only hand-checked reward there is. */
const SOCIAL_REWARD = rewardId('SOCIAL', 1);

const USAGE = `
season migrate                     apply pending migrations
season bootstrap [options]         open all ${String(SERVERS.count)} galaxies (idempotent)
season local-bootstrap [options]   refresh obsolete LOCAL development worlds and
                                   open today's ruleset; preserve accounts
season create [options]            open ONE galaxy on a named shard
season status                      every galaxy, its population and who is on it
season wipe --yes [options]        END EVERYTHING. Seal permanent season records,
                                   delete every season world, open fresh galaxies.
season reward NAME [--id ID]       unlock a hand-checked reward for one commander
                                   (default SOCIAL:1 — the @JoinAstera bonus)
season silent-space NAME [--yes] MOVE ONE PERSON out of their main galaxy into
                                   Silent Space at their own request, playing or
                                   not. Worlds, buildings, stock, fleet and
                                   research go with them; the addresses they
                                   leave become their return addresses and the
                                   colony sites reopen as caretaker worlds. Dry
                                   run unless --yes. Refuses, writing nothing,
                                   while anything of theirs is in the air.
season delete-account NAME        inspect a legacy name-based deletion preview.
                                   Destructive --yes is retired: use the verified
                                   admin account-deletion workflow and journal.
season restamp [--yes] [options]    re-deal the effect of every window of ONE event
                                   kind that has NOT opened yet, from today's
                                   rules. Dry run unless --yes; opened windows are
                                   never touched (see the note in the service).
                                   --kind KIND, default ASTEROID_SHOWER
season sync-events [--yes] [options]
                                   append missing current/future fixed windows without
                                   renumbering the live calendar. Dry run unless --yes.
                                   --kind KIND, default ASTEROID_SHOWER
season adopt-event-calendar [--yes] [--shard CODE]
                                   move a LIVE season onto today's weekday/weekend
                                   shower and convoy windows and the dynamic asteroid
                                   field, from the next hour boundary. Freezes the
                                   derived field first so no rock in the sky moves.
                                   Never touches an opened window or the merchant.
                                   Dry run unless --yes; safe to run twice.
season adopt-monuments --shard CODE [--yes]
                                   adopt four Easy and four Hard monuments in one
                                   LIVE galaxy. Requires no held monuments, active
                                   fleets, probes or joint operations. Dry run unless
                                   --yes; safe to run twice. Keeps target IDs/history.

season activate-spawn-gate --shard CODE [--yes]
                                   cap drifting asteroids (showers exempt) and pirate fleets at
                                   the people who played in the last 5 minutes, from now on.
                                   Existing rocks and pirates stay. Dry run unless --yes.

season recall-monuments --shard CODE [--yes]
                                   MAINTENANCE ONLY, LIVE SEASON STAYS OPEN: land every
                                   monument fleet at home with ships, health, cargo and
                                   unspent return fuel; vacated monuments get the normal
                                   24h garrison return. Refuses travelling probes and
                                   clan operations. Dry run unless --yes; safe to rerun.

season activate-monument-motion --shard CODE [--yes]
                                   start 8h/16h motion in an idle LIVE galaxy.
                                   Refuses active fleets, probes and joint operations.
                                   Dry run unless --yes; does not reset season rules.

season activate-tempo-slowdown --shard CODE [--yes]
                                   preserve earned production and retire existing NPC targets;
                                   refuses active pirate raids or merchant convoys

season activate-admiral --shard CODE [--yes]
                                   open commander ship escorts in a LIVE season dealt
                                   before ruleset 19, from now on. Flights already in the
                                   air keep their rules. Dry run unless --yes; safe to rerun.

season activate-radiation-bombs --shard CODE [--yes]
                                   enable bombs, parked-ship exposure and the 50 HP/min cap
                                   from one explicit instant. Entity radiation is required.
                                   Dry run unless --yes; preserves old source history.

season activate-monument-radiation --shard CODE [--yes]
                                   adopt 9/12.5 HP/min and radiation shielding after
                                   motion is active. Requires idle fleets/probes/ops.
                                   Dry run unless --yes; preserves source history.

season honor-open --season UUID [--yes]
                                   open an announced Honor race after shadow observation.
                                   Starts competitive points/budgets at zero, preserves
                                   military history and excludes already sent attacks.
                                   Dry run unless --yes; retries never reset the race.

season honor-hide --season UUID [--yes]
                                   return an opened Honor race to invisible
                                   observation: every point becomes evidence again,
                                   Dominion decides this season and the next season
                                   starts ranked. Dry run unless --yes.

season honor-shadow --season UUID [--yes]
                                   collect invisible Honor evidence in ONE open
                                   main season. Dry run unless --yes. Existing
                                   Dominion ranking and prizes stay in effect.
                                   Cannot activate ranked Honor or change a catalogue.

season honor-benefits --season UUID [--yes]
                                   enable frozen Honor economic tiers in one active
                                   Honor season. Dry run unless --yes. Existing paid
                                   repairs and launched flights keep their terms.

season honor-loot --season UUID [--yes]
                                   use 40% loot in new Honor dispatch contracts.
                                   Dry run unless --yes. Preserves old flights,
                                   scored history and earned retaliation budgets.

  --shard CODE      shard code, for 'create'   (default: EU-1)
  --seed N          galaxy seed / seed base    (default: random)
  --days N          season length              (default: ${String(SEASON.days)})
  --cap N           planets per galaxy         (default: ${String(SERVERS.capacity)})
  --count N         galaxies, for 'bootstrap'  (default: ${String(SERVERS.count)})
  --ruleset N       explicit season ruleset (default: ${String(MULTI_WORLD.rulesetVersion)};
                    local-bootstrap always uses the current default)
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
      season: { type: 'string' },
      seed: { type: 'string' },
      days: { type: 'string' },
      cap: { type: 'string' },
      count: { type: 'string' },
      ruleset: { type: 'string' },
      unattended: { type: 'string' },
      id: { type: 'string' },
      kind: { type: 'string' },
      yes: { type: 'boolean' },
    },
  });

  const command = positionals[0];
  if (command === 'delete-account' && values.yes) throw new Error('Use the verified account-deletion workflow; legacy --yes cannot bypass approval and the erasure journal');
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, {
    max: 4,
    applicationName: 'astera-season-cli',
  });
  const shardCode = values.shard ?? 'EU-1';

  try {
    switch (command) {
      case 'honor-loot': {
        if (!values.season || positionals.length !== 1
          || Object.keys(values).some(key => key !== 'season' && key !== 'yes')) {
          throw new Error('Usage: season honor-loot --season UUID [--yes]');
        }
        const result = await enableHonorLootWeight(db, { seasonId: values.season, clock: systemClock, apply: values.yes === true });
        console.log(JSON.stringify(result));
        console.log(result.applied ? 'New Honor dispatches use 40% loot. Existing flights, scores and budgets keep their terms.'
          : result.status === 'ALREADY_ACTIVE' ? 'Already active. Nothing was written.' : 'Nothing was written; pass --yes to apply.');
        break;
      }
      case 'honor-benefits': {
        if (!values.season || positionals.length !== 1
          || Object.keys(values).some(key => key !== 'season' && key !== 'yes')) {
          throw new Error('Usage: season honor-benefits --season UUID [--yes]');
        }
        const result = await enableHonorBenefits(db, values.season, systemClock, values.yes === true);
        console.log(JSON.stringify(result));
        console.log(result.applied ? 'Honor economic program enabled. Existing orders and flights keep their terms.' : 'Nothing was written; pass --yes to apply.');
        break;
      }
      case 'honor-open': {
        if (!values.season || positionals.length !== 1
          || Object.keys(values).some(key => key !== 'season' && key !== 'yes')) {
          throw new Error('Usage: season honor-open --season UUID [--yes]');
        }
        const result = await openHonorRanking(db, { seasonId: values.season, clock: systemClock, apply: values.yes === true });
        console.log(JSON.stringify(result));
        if (result.applied) console.log('Honor ranking opened with zero competitive points and budgets. Observation history and Dominion are preserved.');
        else console.log(result.status === 'ALREADY_ACTIVE' ? 'Already active. Nothing was written.' : 'Announce the rules and opening before applying. Nothing was written; pass --yes to apply.');
        break;
      }
      case 'honor-hide': {
        if (!values.season || positionals.length !== 1
          || Object.keys(values).some(key => key !== 'season' && key !== 'yes')) {
          throw new Error('Usage: season honor-hide --season UUID [--yes]');
        }
        const result = await hideHonorRanking(db, { seasonId: values.season, clock: systemClock, apply: values.yes === true });
        console.log(JSON.stringify(result));
        if (result.applied) console.log('Honor is invisible again; Dominion decides this season. The next season starts with ranked Honor.');
        else console.log(result.status === 'ALREADY_HIDDEN' ? 'Already hidden. Nothing was written.' : 'Nothing was written; pass --yes to apply.');
        break;
      }
      case 'honor-shadow': {
        if (!values.season || positionals.length !== 1
          || Object.keys(values).some(key => key !== 'season' && key !== 'yes')) {
          throw new Error('Usage: season honor-shadow --season UUID [--yes]');
        }
        const result = await activateHonorShadow(db, { seasonId: values.season, clock: systemClock, apply: values.yes === true });
        console.log(JSON.stringify(result));
        if (result.applied) console.log('SHADOW evidence collection started. Player ranking and season prizes remain unchanged.');
        else console.log(result.status === 'ALREADY_ENABLED' ? 'Already enabled. Nothing was written.' : 'Nothing was written; pass --yes to apply.');
        break;
      }
      case 'migrate': {
        await runMigrations(db);
        console.log('migrations applied');
        return;
      }

      case 'adopt-monuments': {
        if (!values.shard) throw new Error('adopt-monuments requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await adoptMonumentLayout(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; held=${String(result.held)}, fleets=${String(result.fleets)}, `
          + `probes=${String(result.probes)}, operations=${String(result.operations)}`);
        if (result.applied) console.log('Applied four Easy and four Hard monuments. Existing IDs and history were preserved.');
        else if (result.status === 'BUSY') {
          console.log('Nothing was written. Wait until monument activity ends, then run the command again.');
          if (values.yes === true) process.exitCode = 1;
        } else if (result.status === 'ALREADY_UPDATED') console.log('The monument layout is already updated. Nothing was written.');
        else console.log('Nothing was written; pass --yes to apply.');
        break;
      }

      case 'activate-spawn-gate': {
        if (!values.shard) throw new Error('activate-spawn-gate requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateSpawnGate(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt.toISOString()}`);
        console.log(result.applied ? 'Spawn gate on. The worker decides every later birth.' : 'Nothing was written.');
        break;
      }

      case 'recall-monuments': {
        if (!values.shard) throw new Error('recall-monuments requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await recallMonumentFleets(db, { seasonId: live.season.id, clock: systemClock,
          apply: values.yes === true, adminUsernames: env.ADMIN_USERNAMES });
        console.log(`${values.shard}: ${result.status}; at=${result.at.toISOString()}; fleets=${String(result.fleets)}, probes=${String(result.probes)}, operations=${String(result.operations)}`);
        if (result.applied) console.log('Landed every monument fleet at home. The season stays open; vacated monuments follow the 24h garrison rule.');
        else console.log(result.status === 'IDLE' ? 'No monument fleet is out. Nothing was written.' : 'Nothing was written.');
        if (result.status === 'BUSY' && values.yes === true) process.exitCode = 1;
        break;
      }

      case 'activate-monument-motion': {
        if (!values.shard) throw new Error('activate-monument-motion requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateMonumentMotion(db, { seasonId: live.season.id, clock: systemClock,
          apply: values.yes === true, adminUsernames: env.ADMIN_USERNAMES });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt.toISOString()}; fleets=${String(result.fleets)}, probes=${String(result.probes)}, operations=${String(result.operations)}`);
        if (result.applied) console.log('Applied motion and entity radiation. Current coordinates, season and history were preserved.');
        else console.log('Nothing was written.');
        if (result.status === 'BUSY' && values.yes === true) process.exitCode = 1;
        break;
      }
      case 'activate-admiral': {
        if (!values.shard) throw new Error('activate-admiral requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateAdmiral(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt?.toISOString() ?? '-'}`);
        console.log(result.applied ? 'Opened commander ship escorts. Season rules and flights in the air were preserved.'
          : result.status === 'READY' ? 'Nothing was written; pass --yes to apply.' : 'Nothing was written.');
        break;
      }
      case 'activate-radiation-bombs': {
        if (!values.shard) throw new Error('activate-radiation-bombs requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateRadiationBombs(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt.toISOString()}; planets=${String(result.planets)}`);
        console.log(result.applied ? 'Activated radiation bombs. Season rules, earned resources and source history were preserved.' : 'Nothing was written.');
        break;
      }
      case 'activate-monument-radiation': {
        if (!values.shard) throw new Error('activate-monument-radiation requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateMonumentRadiation(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt.toISOString()}; monuments=${String(result.monuments)}; fleets=${String(result.fleets)}, probes=${String(result.probes)}, operations=${String(result.operations)}`);
        console.log(result.applied ? 'Applied calibrated source windows and shielding research. Season rules and history were preserved.' : 'Nothing was written.');
        if (result.status === 'BUSY' && values.yes === true) process.exitCode = 1;
        break;
      }
      case 'activate-tempo-slowdown': {
        if (!values.shard) throw new Error('activate-tempo-slowdown requires an explicit --shard CODE');
        const live = await liveSeason(db, values.shard);
        if (!live) throw new Error(`no live season on ${values.shard}`);
        const result = await activateTempoSlowdown(db, { seasonId: live.season.id, clock: systemClock, apply: values.yes === true });
        console.log(`${values.shard}: ${result.status}; start=${result.startsAt.toISOString()}; pirate raids=${String(result.pirateRaids)}, trade runs=${String(result.tradeRuns)}`);
        console.log(result.applied ? 'Applied tempo cutover. Earned production and historical NPC records were preserved.' : 'Nothing was written.');
        if (result.status === 'BUSY' && values.yes === true) process.exitCode = 1;
        break;
      }
      case 'bootstrap':
      case 'local-bootstrap': {
        if (command === 'local-bootstrap' && values.ruleset !== undefined) {
          throw new Error('local-bootstrap always uses the current ruleset; omit --ruleset.');
        }
        const capacity = galaxyCapacity(values.cap, env.NODE_ENV === 'production');
        const options = {
          count: galaxyCount(values.count),
          capacity,
          days: num(values.days, SEASON.days),
          ...(values.seed === undefined ? {} : { seedBase: num(values.seed, 0) }),
          ...(values.ruleset === undefined ? {} : { rulesetVersion: num(values.ruleset, MULTI_WORLD.rulesetVersion) }),
        };
        const result = command === 'local-bootstrap'
          ? await bootstrapLocalWorld(db, systemClock, env, options)
          : await bootstrapServers(db, systemClock, options);
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
          spawnGate: true,
          ...(values.ruleset === undefined ? {} : { rulesetVersion: num(values.ruleset, MULTI_WORLD.rulesetVersion) }),
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
       * A fixed calendar can gain a new daily window after a season was dealt.
       * This appends only missing current/future rows; existing sequence numbers
       * and therefore existing asteroid ids stay untouched.
       */
      case 'sync-events': {
        const now = systemClock.now();
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
          const inserted = await db.transaction((tx) =>
            syncMissingFixedOccurrences(tx, { now, seasonId, kinds }));
          console.log(`appended ${String(inserted)} missing window(s).`);
          break;
        }
        class DryRun extends Error {}
        let planned = 0;
        try {
          await db.transaction(async (tx) => {
            planned = await syncMissingFixedOccurrences(tx, { now, seasonId, kinds });
            throw new DryRun();
          });
        } catch (error) {
          if (!(error instanceof DryRun)) throw error;
        }
        console.log(
          `${String(planned)} missing current/future window(s) would be appended. `
          + 'Nothing was written; pass --yes to apply.',
        );
        break;
      }

      /**
       * 2026-09-16: the no-reset deploy of the working-week calendar and the dynamic
       * asteroid field. See `adoptLiveEventCalendar` for the safety argument.
       */
      case 'adopt-event-calendar': {
        const now = systemClock.now();
        const seasonId = values.shard === undefined
          ? undefined
          : (await liveSeason(db, values.shard))?.season.id;
        if (values.shard !== undefined && seasonId === undefined) {
          throw new Error(`no live season on ${values.shard}`);
        }
        const describe = (reports: CalendarAdoptionReport[]) => {
          for (const report of reports) {
            console.log(
              `season ${report.seasonId}: cutover ${report.cutoverAt.toISOString()}, `
              + (report.frozen ? 'derived field frozen, ' : '')
              + `${String(report.deleted)} window(s) removed, ${String(report.inserted)} added.`,
            );
          }
          if (reports.length === 0) console.log('no live season on a fixed calendar.');
        };
        if (values.yes === true) {
          describe(await db.transaction((tx) => adoptLiveEventCalendar(tx, { now, seasonId })));
          break;
        }
        class DryRun extends Error {}
        let planned: CalendarAdoptionReport[] = [];
        try {
          await db.transaction(async (tx) => {
            planned = await adoptLiveEventCalendar(tx, { now, seasonId });
            throw new DryRun();
          });
        } catch (error) {
          if (!(error instanceof DryRun)) throw error;
        }
        describe(planned);
        console.log('Nothing was written; pass --yes to apply.');
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
       * MOVING ONE PERSON WHO ASKED TO BE MOVED.
       *
       * A COMMAND RATHER THAN AN AUTOMATIC SWEEP:
       * the thing being confirmed is a HUMAN REQUEST that no server-side check
       * can verify. Silent Space is otherwise entered by absence alone, and it
       * stays that way — this waives the activity clock for one named commander
       * and steps around no other fence.
       *
       * Dry run by default, and for the same reason: `display_name` is not
       * unique, the operator is typing a name read in a message, and the one
       * failure this must never have is moving the wrong person.
       *
       * IT IS NOT A DELETION AND NOT A TRAPDOOR. Nothing of theirs is destroyed,
       * and the ordinary return application brings them home to the addresses
       * they left, from the game, with no operator involved.
       */
      case 'silent-space': {
        const name = positionals[1];
        if (name === undefined) throw new Error('Which commander? season silent-space NAME');
        const found = await describeSilentSpaceDeparture(db, systemClock, name);

        if (values.yes !== true) {
          console.log(
            [
              `WOULD MOVE    ${found.commander}  (commander ${found.playerId})`,
              `out of        ${found.shard}`,
              `worlds        ${
                found.worlds.length === 0
                  ? '(none)'
                  : found.worlds
                    .map((world) => `${world.name} [${world.kind} @${String(world.slotIndex)}]`)
                    .join(', ')
              }`,
              `inactive      ${found.inactive ? 'yes — the sweep would take them anyway' : 'no — this is an owner-authorised move'}`,
              '',
              'Everything they own travels with them. The addresses above become',
              'their return addresses; each colony site reopens as a caretaker world.',
              '',
              'Nothing was written. Re-run with --yes to move this person.',
            ].join('\n'),
          );
          return;
        }

        const result = await departToSilentSpace(db, systemClock, name, { adminUsernames: env.ADMIN_USERNAMES });
        if (result.status !== 'MOVED') {
          throw new Error(
            `${found.commander} was NOT moved (${result.status}) and nothing was written. `
            + 'Let whatever is in the air land, then run it again.',
          );
        }
        console.log(
          [
            `moved         ${found.commander} out of ${found.shard} into Silent Space`,
            `galaxy        ${result.targetSeasonId ?? '(none)'}`,
            `worlds        ${found.worlds.map((world) => world.name).join(', ') || '(none)'}`,
            'return        theirs to ask for, from the game, whenever they want it.',
          ].join('\n'),
        );
        return;
      }

      /** Legacy inspection only; all erasures use the verified admin request workflow. */
      case 'delete-account': {
        const name = positionals[1];
        if (name === undefined) throw new Error('Which commander? season delete-account NAME');
        const found = await describeAccount(db, name);
        if (!found) throw new Error(`No commander named ${name}`);
        console.log([
          `LEGACY PREVIEW  ${found.account} (login ${found.username})`,
          `joined          ${found.createdAt.toISOString()}`,
          `worlds          ${found.worlds.map(world => `${world.name} [${world.kind} @${String(world.slotIndex)}]`).join(', ') || '(none)'}`,
          'Nothing was written. Use the verified admin account-deletion workflow for erasure.',
        ].join('\n'));
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
        const live = await db
          .select({ id: seasons.id })
          .from(seasons)
          .where(eq(seasons.status, 'live'));
        const adminUsernames = new Set(env.ADMIN_USERNAMES);
        for (const season of live) {
          await forceSeasonEnd({ db, clock: systemClock, adminUsernames }, season.id);
        }
        const result = await wipeAllServers(db, systemClock, {
          count: galaxyCount(values.count),
          capacity: galaxyCapacity(values.cap, env.NODE_ENV === 'production'),
          days: num(values.days, SEASON.days),
          ...(values.seed === undefined ? {} : { seedBase: num(values.seed, 0) }),
          ...(values.ruleset === undefined ? {} : { rulesetVersion: num(values.ruleset, MULTI_WORLD.rulesetVersion) }),
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
