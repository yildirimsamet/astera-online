/**
 * THE ROSTER, AND THE OWNER IS THE ONLY THING THAT FILLS IT. D159.
 *
 * The names are the whole illusion. Nothing in this system generates one, and this
 * file is why: the pool is typed by a person, in their own language, and the sweep
 * seats what it is given and warns when that is not enough. A commander called
 * "Bot-07" beside "Kara Şahin" on the leaderboard would end the whole thing in one
 * glance, and no amount of careful behaviour afterwards would recover it.
 *
 * Safe to run against production, which is why there is no `_staging` guard like
 * `cli/capacity.ts` has: `add` creates accounts and `retire` removes a profile row.
 * Neither deletes a world — that stays `reclaimIdleSeats`' job, on its ordinary
 * three-day terms, because a retired commander is simply one who stopped playing.
 *
 *   pnpm bots add "Kara Şahin" "Yıldız" "Poyraz"
 *   pnpm bots list
 *   pnpm bots retire "Poyraz"
 */
import { parseArgs } from 'node:util';
import { createDb } from '../db/client.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { systemClock } from '../clock.js';
import { GameError } from '../services/planet.js';
import { addBot, listBots, retireBot } from '../services/bots/roster.js';
import { BOTS } from '../services/bots/personas.js';

const { positionals } = parseArgs({ allowPositionals: true, options: {} });
const [command, ...rest] = positionals;

const usage = (): void => {
  console.error('usage: bots add "<name>" ["<name>" ...] | bots list | bots retire "<name>"');
  process.exitCode = 1;
};

if (command === undefined) {
  usage();
} else {
  loadDotEnv();
  const env = loadEnv();
  const { db, close } = createDb(env.DATABASE_URL, { max: 2, applicationName: 'astera-bots' });

  try {
    switch (command) {
      case 'add': {
        if (rest.length === 0) {
          usage();
          break;
        }
        for (const name of rest) {
          try {
            const added = await addBot(db, name, systemClock);
            // Printed once and stored nowhere readable. These commanders never sign
            // in; the value exists only so the owner can take one over if they want to.
            console.log(
              `+ ${added.displayName}  ordinal ${String(added.ordinal)}  ${added.persona}`
              + `  login ${added.username} / ${added.password}`,
            );
          } catch (err) {
            const why = err instanceof GameError ? err.message : String(err);
            console.error(`! ${name}: ${why}`);
            process.exitCode = 1;
          }
        }
        const roster = await listBots(db);
        console.log(
          `\n${String(roster.length)} on the roster; each live galaxy seats ${String(BOTS.perGalaxy)}.`,
        );
        if (roster.length < BOTS.perGalaxy) {
          console.log(`Add ${String(BOTS.perGalaxy - roster.length)} more to fill one galaxy.`);
        }
        break;
      }
      case 'list': {
        const roster = await listBots(db);
        if (roster.length === 0) {
          console.log('The roster is empty. Nothing will be seated.');
          break;
        }
        for (const row of roster) {
          console.log(
            `${String(row.ordinal).padStart(3)}  ${row.displayName.padEnd(20)}`
            + `  ${row.persona.padEnd(10)}  next ${row.nextActionAt.toISOString()}`,
          );
        }
        console.log(`\n${String(roster.length)} total · ${String(BOTS.perGalaxy)} seated per live galaxy`);
        break;
      }
      case 'retire': {
        const name = rest[0];
        if (name === undefined) {
          usage();
          break;
        }
        const removed = await retireBot(db, name);
        console.log(removed
          ? `- ${name} is off the roster. Its world stays exactly where it is and goes quiet.`
          : `! no commander named ${name}`);
        if (!removed) process.exitCode = 1;
        break;
      }
      default:
        usage();
    }
  } finally {
    await close();
  }
}
