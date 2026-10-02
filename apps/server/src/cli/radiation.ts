import { systemClock } from '../clock.js';
import { createDb } from '../db/client.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { GameError } from '../services/planet.js';
import { addRadiationSource, endRadiationSource, listRadiationSources } from '../services/radiation.js';
import { parseRadiationCommand } from './radiationCommand.js';

/**
 * `pnpm radiation …` — the operator's test clouds. Owner decision K4 (`plan.md` F9).
 *
 * No live season has radiation; this places a cloud on a world or a point in space so a
 * flight can be flown through it, lists a season's clouds, and ends one (never deletes:
 * a flight that crossed it still settles against it). Every change tells the clients
 * to read the galaxy again. Refused in a season dealt before ship damage.
 */

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

try {
  const command = parseRadiationCommand(process.argv.slice(2));
  if (command.command === 'add') {
    const row = await addRadiationSource(db, command.input, systemClock);
    console.log(`added ${row.mode} ${row.id} at ${String(row.x)},${String(row.y)},${String(row.z)} r=${String(row.radius)}`);
  } else if (command.command === 'end') {
    const row = await endRadiationSource(db, command.id, systemClock);
    console.log(`ended ${row.id} at ${row.activeUntil?.toISOString() ?? 'never'}`);
  } else {
    for (const row of await listRadiationSources(db, command.seasonId)) {
      console.log([
        row.id, row.mode, row.anchorKind, `${String(row.x)},${String(row.y)},${String(row.z)}`,
        `r=${String(row.radius)}`, `${String(row.intensityPctPerMinute)}%/min`,
        row.activeFrom.toISOString(), row.activeUntil?.toISOString() ?? 'open', row.label,
      ].join('  '));
    }
  }
} catch (err) {
  console.error(err instanceof GameError ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await close();
}
