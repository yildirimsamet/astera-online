/** Small percentage-only calibration; simulation only, single-process CLI. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { preparePolicyEngine } from './distributed-damage-model.mjs';
import { aggregateSamples, buildCases, summarizeBattle } from './distributed-damage-study.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const row = (minRatio, wc, wh, sc, sh) => ({ minRatio, weak: { chance: wc, threshold: wh }, strong: { chance: sc, threshold: sh } });
export const BASE_POLICY = [row(1, .25, .25, .25, .25), row(1.5, .33, .3, .2, .3), row(2, .55, .55, .15, .3), row(3, .7, .7, .1, .25)];
const shift = (chance, threshold) => BASE_POLICY.map((r, i) => ({ ...structuredClone(r),
  weak: { chance: r.weak.chance + chance, threshold: r.weak.threshold + threshold },
  ...(i === 0 ? { strong: { chance: r.strong.chance + chance, threshold: r.strong.threshold + threshold } } : {}),
}));
export const POLICY_CANDIDATES = [
  { id: 'baseline', rows: structuredClone(BASE_POLICY) },
  { id: 'hp-plus5', rows: shift(0, .05) },
  { id: 'hp-plus10', rows: shift(0, .1) },
  { id: 'chance-plus5', rows: shift(.05, 0) },
  { id: 'chance-plus5-hp-plus5', rows: shift(.05, .05) },
  { id: 'chance-plus5-hp-plus10', rows: shift(.05, .1) },
  { id: 'chance-minus5-hp-plus10', rows: shift(-.05, .1) },
  { id: 'low-ratio-only', rows: [row(1, .3, .35, .3, .35), row(1.5, .35, .35, .2, .3), ...structuredClone(BASE_POLICY.slice(2))] },
  { id: 'targeted', rows: [row(1, .3, .35, .3, .35), row(1.5, .35, .35, .2, .3), row(2, .55, .6, .15, .3), row(3, .65, .75, .1, .25)] },
];

export async function runTuning({ stage = 'screen', ids } = {}) {
  const started = Date.now(), screening = stage === 'screen';
  const policies = ids ? POLICY_CANDIDATES.filter(p => ids.includes(p.id)) : POLICY_CANDIDATES;
  assert.ok(policies.some(p => p.id === 'baseline'));
  const engines = [];
  for (const policy of policies) engines.push(await preparePolicyEngine(policy.rows));
  const cases = buildCases(screening ? [2, 10, 50] : [2, 10, 50, 200]), rows = [];
  let battles = 0, maxRssMiB = 0;
  for (let i = 0; i < cases.length; i++) {
    const input = cases[i], trials = screening ? (input.size >= 50 ? 20 : 50) : input.size >= 200 ? 30 : input.size >= 50 ? 100 : 300;
    const samples = policies.map(() => []), flips = policies.map(() => 0), empty = policies.map(() => 0);
    const a = [{ contributionId: 'a', playerId: 'a', fleet: input.attacker, tech: { tech: input.tech } }];
    const d = [{ stackId: 'host', playerId: 'd', fleet: input.defender, tech: { tech: input.tech } }];
    for (let n = 0; n < trials; n++) {
      // Separate streams from the previous study; final seeds are held out from screening.
      const seed = Math.imul(n + 1, 0x9e3779b1) ^ (screening ? 0x51CE2023 : 0xF1A12023) ^ i;
      let first, firstLosses;
      for (let p = 0; p < policies.length; p++) {
        const result = engines[p].candidate(a, d, 0, mulberry32(seed), true, true);
        const summary = summarizeBattle(input, result, engines[p].trace);
        const losses = [result.rounds[0]?.attackerLosses, result.rounds[0]?.defenderLosses];
        if (p === 0) { first = summary; firstLosses = losses; }
        else {
          // Tuning cannot alter damage before the first retreat window.
          assert.deepEqual(losses, firstLosses);
          flips[p] += Number(summary.monumentControl !== first.monumentControl);
        }
        empty[p] += Number(summary.attacker.active === 0 && summary.defender.active === 0);
        samples[p].push(summary);
        battles++;
      }
    }
    rows.push({ ...input, trials, outcomes: Object.fromEntries(policies.map((p, index) => [p.id,
      { ...aggregateSamples(samples[index]), controlFlipRate: flips[index] / trials, bothActiveEmpty: empty[index] / trials }])) });
    if (i % 20 === 19) {
      maxRssMiB = Math.max(maxRssMiB, Math.round(process.memoryUsage().rss / 1048576));
      console.log(JSON.stringify({ stage, progress: i + 1, cases: cases.length, battles, seconds: (Date.now() - started) / 1000, maxRssMiB }));
    }
  }
  const data = { metadata: { stage, createdAt: new Date().toISOString(), battles, maxRssMiB,
    elapsedSeconds: (Date.now() - started) / 1000, sourceHash: engines[0].sourceHash,
    knobs: 'Only chance +/-5 percentage points and HP threshold +0..10 points; damage and retreat timing unchanged.',
    weighting: 'Equal weight per composition/size/shield/orientation/ratio case; paired seeds; validation seeds held out.',
    limits: 'Single process, CPUQuota=100%, MemoryMax=2G, MemorySwapMax=0, heap 1536MiB, v8-pool-size=1.' }, policies, rows };
  const output = resolve(ROOT, `docs/evidence/distributed-retreat-tuning-${stage}-2026-10-23.json`);
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...data.metadata }));
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const stage = process.argv.find(a => a.startsWith('--stage='))?.slice(8) ?? 'screen';
  const ids = process.argv.find(a => a.startsWith('--ids='))?.slice(6).split(',');
  await runTuning({ stage, ids });
}
