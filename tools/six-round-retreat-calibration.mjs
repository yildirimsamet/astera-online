/** Six rounds, escape after rounds 1..5; tune only percentages, never ship stats. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { prepareRoundEngine } from './distributed-damage-model.mjs';
import { BASE_POLICY } from './distributed-retreat-tuning.mjs';
import { aggregateSamples, buildCases, summarizeBattle } from './distributed-damage-study.mjs';
import { buildMainCases } from './combat-four-rounds-study.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SIX_POLICIES = [{ id: 'current', rows: structuredClone(BASE_POLICY) }];
for (const [gates, thresholds] of [['A', [.30, .45, .60, .75]], ['B', [.40, .50, .70, .85]]]) {
  for (const [name, chances] of [['low', [.10, .15, .20, .30]], ['middle', [.15, .20, .25, .35]], ['high', [.20, .25, .30, .40]]]) {
    SIX_POLICIES.push({ id: `${gates}-${name}`, rows: [1, 1.5, 2, 3].map((minRatio, i) => ({ minRatio,
      weak: { chance: chances[i], threshold: thresholds[i] },
      strong: i === 0 ? { chance: chances[0], threshold: thresholds[0] }
        : { chance: i === 3 ? .05 : .10, threshold: i === 3 ? .25 : .30 },
    })) });
  }
}
// Entry ratio is frozen, so these rows reproduce their measured source policy
// exactly within each bucket. Validate the combined table on held-out seeds.
export const SIX_BALANCED = { id:'balanced', rows:structuredClone(['A-low','A-middle','A-low','A-high']
  .map((id,i)=>SIX_POLICIES.find(p=>p.id===id).rows[i])) };
const gap = (value, low, high) => Math.max(low - value, 0, value - high);
export function targetError(ratio, summary, strongSide = 'ATTACK') {
  if (ratio < 2) return (gap(summary.attacker.physical, .1, .2) ** 2 + gap(summary.defender.physical, .1, .2) ** 2) / 2;
  const desiredControl = strongSide === 'ATTACK' ? 'ATTACKER' : 'DEFENDER';
  return gap(summary.weak.escape.reduce((s, n) => s + n, 0), ratio >= 3 ? .2 : .1, ratio >= 3 ? .3 : .2) ** 2
    + .1 * summary.weak.active ** 2 + .1 * Number(summary.monumentControl !== desiredControl);
}

export async function runSixCalibration(stage = 'screen') {
  const screening = stage === 'screen', started = Date.now();
  let policies = SIX_POLICIES;
  if (!screening) {
    const screen = JSON.parse(readFileSync(resolve(ROOT, 'docs/evidence/six-round-retreat-screen-2026-10-23.json'), 'utf8'));
    assert.equal(screen.rows.length,40);
    policies = [SIX_POLICIES[0],SIX_BALANCED];
  }
  const engines = [];
  for (const policy of policies) engines.push(await prepareRoundEngine(policy.rows, 6));
  const cases = screening ? buildCases([20]).filter(c => c.strongSide === 'ATTACK' && c.ratio !== 2.5) : buildMainCases();
  const rows = [];
  let battles = 0, maxRssMiB = 0;
  for (let i = 0; i < cases.length; i++) {
    const input = cases[i], trials = screening ? 30 : input.size >= 200 ? 10 : input.size >= 100 ? 20 : input.size >= 50 ? 40 : 100;
    const a = [{ contributionId: 'a', playerId: 'a', fleet: input.attacker, tech: { tech: input.tech } }];
    const d = [{ stackId: 'host', playerId: 'd', fleet: input.defender, tech: { tech: input.tech } }];
    const samples = policies.map(() => []), errors = policies.map(() => 0);
    for (let n = 0; n < trials; n++) {
      const seed = Math.imul(n + 1, 0x9e3779b1) ^ (screening ? 0x61CE2023 : 0x6F1A2023) ^ i;
      let firstLosses;
      for (let p = 0; p < policies.length; p++) {
        const result = engines[p].candidate(a, d, 0, mulberry32(seed), true, true);
        const losses = [result.rounds[0]?.attackerLosses, result.rounds[0]?.defenderLosses];
        if (p === 0) firstLosses = losses;
        else assert.deepEqual(losses, firstLosses);
        const summary = summarizeBattle(input, result, engines[p].trace, 5);
        for (const side of ['attacker', 'defender']) assert.ok(Math.abs(summary[side].active + summary[side].escape.reduce((s,c)=>s+c,0) - summary[side].physical) < 1e-10);
        assert.ok(result.rounds.every(r => r.round !== 6 || r.retreats.length === 0));
        samples[p].push(summary);
        errors[p] += targetError(input.ratio, summary, input.strongSide);
        battles++;
      }
    }
    rows.push({ ...input, trials, outcomes: Object.fromEntries(policies.map((p,index)=>[p.id,
      { ...aggregateSamples(samples[index],5), targetError: errors[index] / trials }])) });
    if (i % 10 === 9) {
      maxRssMiB = Math.max(maxRssMiB, Math.round(process.memoryUsage().rss / 1048576));
      console.log(JSON.stringify({ stage, progress:i+1, cases:cases.length, battles, seconds:(Date.now()-started)/1000, maxRssMiB }));
    }
  }
  const ranking = policies.map(p => ({ id:p.id, error:rows.reduce((sum,r)=>sum+r.outcomes[p.id].targetError,0)/rows.length })).sort((a,b)=>a.error-b.error);
  const metadata = { stage, createdAt:new Date().toISOString(), battles, maxRssMiB, seconds:(Date.now()-started)/1000,
    rounds:6, retreatRounds:[1,2,3,4,5], shipStatsChanged:false, sourceHash:engines[0].sourceHash,
    weighting:'Equal per composition, size, tech, direction and power case. Role failures remain visible.',
    sampling:'Screen: 30 seeds at size20, stronger attacker. Validation: held-out seeds; sizes20/50/100/200, both directions; 100/40/20/10 trials.',
    score:'Mean per-battle squared distance outside target bands. Near: physical survivors separately for both sides. Unequal: weaker escaped share, inactive weakness and stronger control.',
    selection:'Diagnostic ranking is not a global optimum. Final table combines A-low at 1/2, A-middle at 1.5, A-high at 3 to approach average ratio targets; per-role misses are reported.',
    limits:'CPUQuota=100%, MemoryMax=2G, MemorySwapMax=0, heap1536MiB, v8-pool-size=1.' };
  const output = resolve(ROOT,`docs/evidence/six-round-retreat-${stage}-2026-10-23.json`);
  mkdirSync(resolve(output,'..'),{recursive:true});
  writeFileSync(output,JSON.stringify({metadata,policies,ranking,rows},null,2)+'\n');
  console.log(JSON.stringify({output,ranking,...metadata}));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runSixCalibration(process.argv.find(a=>a.startsWith('--stage='))?.slice(8) ?? 'screen');
}
