/** Compare ONLY the round count and the approved pre-final retreat window. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HULLS } from '../packages/rules/src/hulls.ts';
import { mulberry32 } from '../packages/rules/src/rng.ts';
import { BASE_POLICY } from './distributed-retreat-tuning.mjs';
import { prepareRoundEngine } from './distributed-damage-model.mjs';
import { aggregateSamples, buildCases, summarizeBattle } from './distributed-damage-study.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const buildMainCases = () => buildCases([20, 50, 100, 200]);

export async function runFourRoundsStudy() {
  const started = Date.now(), engines = [await prepareRoundEngine(BASE_POLICY, 3), await prepareRoundEngine(BASE_POLICY, 4)];
  const cases = buildMainCases(), rows = [];
  let battles = 0, maxRssMiB = 0;
  for (let i = 0; i < cases.length; i++) {
    const input = cases[i], trials = input.size >= 200 ? 30 : input.size >= 100 ? 50 : input.size >= 50 ? 100 : 200;
    const a = [{ contributionId: 'a', playerId: 'a', fleet: input.attacker, tech: { tech: input.tech } }];
    const d = [{ stackId: 'host', playerId: 'd', fleet: input.defender, tech: { tech: input.tech } }];
    const samples = [[], []];
    let controlFlips = 0;
    for (let n = 0; n < trials; n++) {
      const seed = Math.imul(n + 1, 0x9e3779b1) ^ 0x40A12023 ^ i;
      const base = engines[0].candidate(a, d, 0, mulberry32(seed), true, true);
      const baseSummary = summarizeBattle(input, base, engines[0].trace, 2);
      const changed = engines[1].candidate(a, d, 0, mulberry32(seed), true, true);
      assert.deepEqual(changed.rounds.slice(0, 2), base.rounds.slice(0, 2));
      const summary = summarizeBattle(input, changed, engines[1].trace, 3);
      for (const side of ['attacker', 'defender']) assert.ok(Math.abs(summary[side].active + summary[side].escape.reduce((s, c) => s + c, 0) - summary[side].physical) < 1e-10);
      assert.ok(changed.rounds.every(round => round.round !== 4 || round.retreats.length === 0));
      samples[0].push(baseSummary); samples[1].push(summary);
      controlFlips += Number(baseSummary.monumentControl !== summary.monumentControl);
      battles += 2;
    }
    rows.push({ ...input, trials, three: aggregateSamples(samples[0], 2), four: aggregateSamples(samples[1], 3), controlFlipRate: controlFlips / trials });
    if (i % 20 === 19) {
      maxRssMiB = Math.max(maxRssMiB, Math.round(process.memoryUsage().rss / 1048576));
      console.log(JSON.stringify({ progress: i + 1, cases: cases.length, battles, seconds: (Date.now() - started) / 1000, maxRssMiB }));
    }
  }
  const examples = [];
  for (const hull of ['CORSAIR', 'CITADEL', 'CATACLYSM']) for (const ratio of [1, 1.5, 2, 3]) {
    const input = { attacker: { [hull]: 20 * ratio }, defender: { [hull]: 20 } };
    const a = [{ contributionId: 'a', playerId: 'a', fleet: input.attacker, tech: { tech: {} } }];
    const d = [{ stackId: 'host', playerId: 'd', fleet: input.defender, tech: { tech: {} } }];
    const three = engines[0].candidate(a, d, 0, mulberry32(20261023), true, true);
    const four = engines[1].candidate(a, d, 0, mulberry32(20261023), true, true);
    examples.push({ hull, ratio, ...input, three, four });
    battles += 2;
  }
  const explanatoryStats = Object.fromEntries(['CORSAIR', 'CITADEL', 'CATACLYSM'].map(id => [id, {
    atk: HULLS[id].atk, hp: HULLS[id].hp, shield: HULLS[id].hp * .25,
    neutralAverageHullAfterThree: Math.max(0, HULLS[id].hp * 1.25 - HULLS[id].atk * 3),
    neutralAverageHullAfterFour: Math.max(0, HULLS[id].hp * 1.25 - HULLS[id].atk * 4),
  }]));
  const metadata = { createdAt: new Date().toISOString(), battles, mainPairedBattles: battles - examples.length * 2,
    maxRssMiB, elapsedSeconds: (Date.now() - started) / 1000, sourceHash: engines[0].sourceHash,
    comparison: '3 rounds with retreat after 1/2 versus 4 rounds with retreat after 1/2/3. No other parameters changed.',
    mainSizes: [20, 50, 100, 200], smallFleetsExcludedFromMain: true,
    weighting: 'Equal weight per composition/size/shield/orientation/ratio case; same seeds paired.',
    limits: 'Single CPU, 2GiB cgroup, swap disabled, Node heap 1536MiB, v8-pool-size=1.' };
  const output = resolve(ROOT, 'docs/evidence/combat-four-rounds-study-2026-10-23.json');
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify({ metadata, policy: BASE_POLICY, rows, examples, explanatoryStats }, null, 2) + '\n');
  console.log(JSON.stringify({ output, ...metadata }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await runFourRoundsStudy();
