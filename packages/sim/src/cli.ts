/**
 * node --experimental-strip-types src/cli.ts [--players=140] [--days=14] [--seed=42]
 *
 * The test suite is the regression gate; this is for looking at a season by hand.
 */
import { RESEARCH_PROJECTS, dominion, median } from '@astera/rules';
import {
  BANDS,
  LEVERS,
  ladderByArchetype,
  raidReturn,
  runSeason,
  verdict,
  type InvariantKey,
} from './index.js';

const arg = (k: string, d: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? Number(hit.split('=')[1]) : d;
};

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  red: '\x1b[31m', green: '\x1b[32m', grey: '\x1b[90m', orange: '\x1b[38;5;208m',
};

const requestedShare = process.argv.find((a) => a.startsWith('--crystal-share='));
const hullCrystalShare = requestedShare === undefined
  ? undefined
  : Number(requestedShare.split('=')[1]) as 0.25 | 0.30 | 0.35;
if (hullCrystalShare !== undefined && ![0.25, 0.30, 0.35].includes(hullCrystalShare)) {
  throw new Error('--crystal-share must be 0.25, 0.30 or 0.35');
}
const cfg = {
  players: arg('players', 140),
  days: arg('days', 14),
  seed: arg('seed', 42),
  ...(hullCrystalShare === undefined ? {} : { hullCrystalShare }),
  spectrometryCrystalCost: arg(
    'spectrometry-cost',
    RESEARCH_PROJECTS.ISOTOPE_SPECTROMETRY.costAt(1).crystal,
  ),
};
const { world, days, diagnostics } = runSeason(cfg);
const keys = Object.keys(BANDS) as InvariantKey[];

const pad = (s: unknown, n: number) => String(s).padEnd(n);
const num = (v: number) => (Number.isNaN(v) ? '  n/a' : v.toFixed(2).padStart(5));
const tint = (k: InvariantKey, v: number) =>
  verdict(k, v) === 'OK' ? C.green : verdict(k, v) === 'n/a' ? C.grey : C.red;

console.log(`\n${C.bold}${C.orange}ASTERA ONLINE${C.reset} ${C.dim}season simulation${C.reset}`);
console.log(`${C.grey}${cfg.players} players · ${cfg.days} days · seed ${cfg.seed}${C.reset}\n`);
console.log(C.bold + pad('DAY', 5) + keys.map((k) => pad(k, 8)).join('') + pad('ATK', 6) + pad('D/P/R', 12) + C.reset);
console.log(C.grey + '─'.repeat(5 + keys.length * 8 + 18) + C.reset);

for (const d of days) {
  const cells = keys.map((k) => `${tint(k, d.invariants[k])}${num(d.invariants[k])}${C.reset}   `).join('');
  const g = d.stats.byGrade;
  console.log(pad(d.day, 5) + cells + pad(d.stats.attacks, 6) + C.grey + `${g.DECISIVE}/${g.PARTIAL}/${g.REPELLED}` + C.reset);
}

console.log(`\n${C.grey}bands  ${keys.map((k) => `${k} ${BANDS[k][0]}–${BANDS[k][1]}`).join(' · ')}${C.reset}`);

const settledDays = days.slice(2);
const settled = settledDays.map((d) => d.invariants);
const settledSummary = Object.fromEntries(keys.map((key) => [
  key,
  key === 'RR'
    ? raidReturn(settledDays.map((day) => day.stats))
    : median(settled.map((snapshot) => snapshot[key]).filter((value) => !Number.isNaN(value))),
])) as Record<InvariantKey, number>;
const fails = keys
  .map((k) => ({ k, m: settledSummary[k] }))
  .filter(({ k, m }) => verdict(k, m) !== 'OK');

console.log(`\n${C.bold}VERDICT${C.reset}`);
if (fails.length === 0) {
  console.log(`${C.green}  ✓ All invariants held from day 3 onward.${C.reset}`);
} else {
  for (const { k, m } of fails) {
    console.log(`${C.red}  ✗ ${k} median ${m.toFixed(2)} is ${verdict(k, m)}${C.reset}  ${C.grey}→ ${LEVERS[k]}${C.reset}`);
  }
}

console.log(`\n${C.bold}THE LADDER${C.reset} ${C.dim}(Dominion — taken minus lost)${C.reset}`);
for (const r of ladderByArchetype(world.players)) {
  const mark = r.type === 'GRINDER' ? `${C.green} ← informed${C.reset}` : '';
  console.log(
    `  ${pad(r.type, 9)}${C.grey}median rank${C.reset}${String(Math.round(r.medianRank)).padStart(5)}` +
    `   ${C.grey}best${C.reset}${String(r.bestRank).padStart(4)}` +
    `   ${C.grey}dominion${C.reset}${Math.round(r.medianDominion).toLocaleString('en-US').padStart(10)}${mark}`,
  );
}

const sc = days.reduce((s, d) => s + d.stats.scoutedAttacks, 0);
const bl = days.reduce((s, d) => s + d.stats.blindAttacks, 0);
const scNet = sc ? (days.reduce((s, d) => s + d.stats.scoutedGain - d.stats.scoutedLoss, 0)) / sc : 0;
const blNet = bl ? (days.reduce((s, d) => s + d.stats.blindGain - d.stats.blindLoss, 0)) / bl : 0;
console.log(`\n${C.bold}DOES INTEL PAY?${C.reset} ${C.dim}(dominion per raid)${C.reset}`);
console.log(`  ${pad('scouted', 10)}${String(sc).padStart(5)} raids   net ${Math.round(scNet).toLocaleString('en-US').padStart(8)}`);
console.log(`  ${pad('blind', 10)}${String(bl).padStart(5)} raids   net ${Math.round(blNet).toLocaleString('en-US').padStart(8)}`);
console.log(`\n${C.grey}top wealth ${Math.max(...world.players.map((p) => p.wealthNow)).toLocaleString('en-US')} · ` +
  `#1 dominion ${Math.max(...world.players.map((p) => dominion(p.ledger))).toLocaleString('en-US')} · ` +
  `peak Core L${Math.max(...world.players.map((p) => p.buildings.CORE))}${C.reset}\n`);

console.log(`${C.bold}CRYSTAL USE${C.reset}`);
console.log(`  cap player-hours ${Math.round(diagnostics.capPlayerHours).toLocaleString('en-US')} · ` +
  `median unused ${Math.round(diagnostics.medianUnused).toLocaleString('en-US')}`);
console.log(`  spend ${Object.entries(diagnostics.spentShare)
  .map(([category, share]) => `${category} ${(share * 100).toFixed(1)}%`)
  .join(' · ')}`);
console.log(`  mining ${diagnostics.mining.launches.toLocaleString('en-US')} launches · ` +
  `${Math.round(diagnostics.mining.oreClaimed).toLocaleString('en-US')} claimed · ` +
  `${Math.round(
    diagnostics.mining.alloyDelivered
      + diagnostics.mining.crystalDelivered
      + diagnostics.mining.deuteriumDelivered,
  ).toLocaleString('en-US')} delivered · ` +
  `${Math.round(diagnostics.mining.overflowLost).toLocaleString('en-US')} overflow\n`);

const strategic = diagnostics.strategic;
console.log(`${C.bold}MULTI-WORLD / STRATEGIC${C.reset}`);
console.log(`  neutral raids ${strategic.neutralRaids.toLocaleString('en-US')} · ` +
  `${strategic.uniqueNeutralRaiders.toLocaleString('en-US')} unique raiders · ` +
  `${(strategic.neutralLootShare * 100).toFixed(1)}% of external income`);
console.log(`  taken T1/T2/T3 ${[1, 2, 3]
  .map((tier) => Math.round(strategic.neutralTaken[tier as 1 | 2 | 3]).toLocaleString('en-US'))
  .join('/')} · remaining ${[1, 2, 3]
  .map((tier) => strategic.remainingNeutral[tier as 1 | 2 | 3])
  .join('/')}`);
console.log(`  colonies ${strategic.coloniesPerPlayer.filter((count) => count > 0).length} commanders · ` +
  `${Math.round(strategic.transferredResources).toLocaleString('en-US')} transferred`);
console.log(`  Death Star ${strategic.deathStar.builds}/${strategic.deathStar.launches}/` +
  `${strategic.deathStar.firstHits}/${strategic.deathStar.captures}/${strategic.deathStar.misses} ` +
  `${C.dim}(build/launch/first/capture/miss)${C.reset} · ` +
  `${Math.round(strategic.capitalHeldDeathStarValue).toLocaleString('en-US')} held at capitals\n`);
