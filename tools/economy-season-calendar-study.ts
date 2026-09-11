/** Current-rule measurement, not a fitted economy. Keep policy and calendar distinct. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fleetEntries, HULLS, hullBuildable } from '../packages/rules/src/index.js';
import { runSeason, type World } from '../packages/sim/src/season.js';

const profiles = ['average', 'low', 'low-once'] as const;
const median = (xs: number[]) => {
  xs.sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  return xs.length ? xs.length % 2 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2 : null;
};
export function summarizeProfiles(world: World) {
  const calendars = world.activityProfiles ?? [];
  return [...new Set(calendars)].map(profile => {
    const ps = world.players.filter(p => calendars[p.id % calendars.length] === profile);
    return { profile, players: ps.length,
      medianFinalCore: median(ps.map(p => p.buildings.CORE)),
      medianFinalShipyard: median(ps.map(p => p.buildings.SHIPYARD)),
      colonyOwners: ps.filter(p => world.neutrals.some(n => n.controllerId === p.id)).length,
      homeT3Holders: ps.filter(p => fleetEntries(p.fleet).some(([h, n]) => n > 0 && HULLS[h].tier === 3)).length,
      homeT4Holders: ps.filter(p => fleetEntries(p.fleet).some(([h, n]) => n > 0 && HULLS[h].tier === 4)).length,
      finalT3Buildable: ps.filter(p => Object.values(HULLS).some(h => h.tier === 3 && hullBuildable(h.id, p.buildings.SHIPYARD, p.tech))).length,
      finalT4Buildable: ps.filter(p => Object.values(HULLS).some(h => h.tier === 4 && hullBuildable(h.id, p.buildings.SHIPYARD, p.tech))).length,
    };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = ['packages/sim/src/season.ts', 'packages/sim/src/player-calendar.ts', 'packages/sim/src/archetypes.ts',
    'packages/rules/src/constants.ts', 'packages/rules/src/hulls.ts', 'packages/rules/src/economy.ts',
    'packages/rules/src/tech.ts', 'packages/rules/src/research.ts', 'tools/economy-season-calendar-study.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')]));
  const rows = [];
  for (const players of [300, 500, 1000]) {
    const config = { players, days: 14, seed: 42, activityProfiles: profiles, spendingArchetype: 'CASUAL' as const };
    const r = runSeason(config);
    const groups = summarizeProfiles(r.world);
    rows.push({ config, decisions: r.world.activityDecisions, groups, strategic: r.diagnostics.strategic, dayReports: r.days });
    process.stderr.write(JSON.stringify({ players, groups }) + '\n');
  }
  process.stdout.write(JSON.stringify({ version: 2, sourceHashes,
    caveat: 'Current rules, legacy CASUAL policy, one seed, 51 fixed neutrals. Not final calibration or server parity. Home-held hulls and final buildable gates are not first-access times. Minute discretization, optimistic intel, strategic bay/capacity/transfer approximations and incomplete PvE/reward/colony loops remain.', rows }, null, 2) + '\n');
}
