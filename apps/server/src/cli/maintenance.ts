import { systemClock } from '../clock.js';
import { createDb } from '../db/client.js';
import { loadDotEnv, loadEnv } from '../env.js';
import { cancelMaintenance, listMaintenance, scheduleMaintenance } from '../services/maintenanceWindow.js';
import { GameError } from '../services/planet.js';
import { parseMaintenanceCommand } from './maintenanceCommand.js';

/**
 * `pnpm maintenance …` — plan, list and cancel a maintenance window. Scaling plan F0.9.
 *
 * A planned window is announced in the client a day ahead and refuses hostile arrivals
 * inside it. Taking the site down is `deploy/maintenance.sh on|off`, a separate step.
 */

loadDotEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);

try {
  const command = parseMaintenanceCommand(process.argv.slice(2));
  const now = systemClock.now();
  if (command.command === 'schedule') {
    const window = await scheduleMaintenance(db, { startsAt: command.startsAt, minutes: command.minutes, now });
    console.log(`planned ${window.id}  ${window.startsAt.toISOString()} → ${window.endsAt.toISOString()}`);
  } else if (command.command === 'cancel') {
    await cancelMaintenance(db, command.id, now);
    console.log(`cancelled ${command.id}`);
  } else {
    for (const window of await listMaintenance(db, now)) {
      console.log(`${window.id}  ${window.startsAt.toISOString()} → ${window.endsAt.toISOString()}`);
    }
  }
} catch (err) {
  // A refusal names what it collided with (a season end, a convoy), so the operator can pick again.
  console.error(err instanceof GameError ? `${err.code}: ${err.message}${err.params ? ` ${JSON.stringify(err.params)}` : ''}` : err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await close();
}
