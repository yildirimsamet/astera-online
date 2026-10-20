/**
 * Runs the public TrashSim worker unchanged in a local JS context.
 * Clone https://github.com/klaasvp/trashsim-public first, then:
 * TRASHSIM_SOURCE=/path/to/clone node --import tsx tools/ogame-attrition-audit.mjs --run
 * Classical V7 units, equal 10/10/10 research, rapid fire enabled.
 * No classes/lifeforms, tactical retreat, debris collection or Space Dock recovery.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createContext, runInContext } from 'node:vm';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from '../packages/rules/src/rng.ts';

export function createTrashSim(root, { shields = true } = {}) {
  const files = ['src/Resources/js-libs/entityInfo.js',
    'src/Resources/js/workers/simulator/party.class.js',
    'src/Resources/js/workers/simulator/simulator.js'];
  const sources = files.map(path => readFileSync(resolve(root, path), 'utf8'));
  const context = createContext({ postMessage: () => undefined }, { codeGeneration: { strings: false, wasm: false } });
  runInContext(sources[0] + '\n globalThis.info = entityInfoV7;', context);
  if (!shields) {
    for (const unit of Object.values(context.info)) unit.shield = 0;
  }
  runInContext('const chromium = true; const entityInfo = globalThis.info;\n'
    + sources.slice(1).join('\n')
    + '\nglobalThis.simulate = (...args) => Simulator.handleSimulations(...args);'
    + '\nglobalThis.seedRandom = fn => { Math.random = fn; };', context);
  return {
    info: context.info,
    hashes: Object.fromEntries(files.map((path, i) => [path, createHash('sha256').update(sources[i]).digest('hex')])),
    battle(attacker, defender, seed) {
      context.seedRandom(mulberry32(seed));
      const techs = { weapon: 10, shield: 10, armour: 10 };
      return context.simulate(1, [{ techs, entities: attacker }], [{ techs, entities: defender }], true, 0)[0];
    },
  };
}

export function runOgameAudit(root, samples = 200, { shields = true, mirrorsOnly = false } = {}) {
  const engine = createTrashSim(root, { shields });
  const count = fleet => Object.values(fleet).reduce((sum, n) => sum + n, 0);
  const value = fleet => Object.entries(fleet).reduce((sum, [id, n]) => {
    const r = engine.info[id].resources;
    return sum + n * (r.metal + r.crystal + r.deuterium);
  }, 0);
  const loss = (start, left) => ({
    wiped: count(left) === 0, count: (count(start) - count(left)) / count(start),
    value: (value(start) - value(left)) / value(start),
  });
  const formations = [
    { name: 'LIGHT_FIGHTER', fleet: { 204: 500 } },
    { name: 'HEAVY_FIGHTER', fleet: { 205: 500 } },
    { name: 'CRUISER', fleet: { 206: 500 } },
    { name: 'BATTLESHIP', fleet: { 207: 500 } },
    { name: 'BATTLECRUISER', fleet: { 215: 500 } },
    { name: 'DESTROYER', fleet: { 213: 500 } },
    { name: 'MIX_LF_CR_BS', fleet: { 204: 1000, 206: 100, 207: 100 } },
    { name: 'MIX_LF_BC_DEST', fleet: { 204: 1000, 215: 100, 213: 100 } },
  ];
  const cells = [];
  const pairs = formations.map(f => [f, f]);
  const cross = formations.filter(f => ['LIGHT_FIGHTER', 'CRUISER', 'BATTLESHIP', 'BATTLECRUISER'].includes(f.name));
  if (!mirrorsOnly) {
    for (const a of cross) for (const d of cross) if (a !== d) pairs.push([a, d]);
  }
  for (const [a, d] of pairs) {
    for (const ratio of [1, 1.5, 2, 3]) {
      const factor = value(d.fleet) * ratio / value(a.fleet);
      const attacker = Object.fromEntries(Object.entries(a.fleet).map(([id, n]) => [id, Math.floor(n * factor)]));
      const defender = d.fleet;
      const totals = { samples, eitherWiped: 0, bothWiped: 0, attackerWiped: 0, defenderWiped: 0,
        eitherNearCount: 0, eitherNearValue: 0, attackerLossCount: 0, defenderLossCount: 0,
        attackerLossValue: 0, defenderLossValue: 0, draws: 0, rounds: 0 };
      for (let seed = 0; seed < samples; seed++) {
        const result = engine.battle(attacker, defender, 0xA57E0000 + seed);
        const al = loss(attacker, result.remaining.attackers[0]);
        const dl = loss(defender, result.remaining.defenders[0]);
        totals.eitherWiped += Number(al.wiped || dl.wiped);
        totals.bothWiped += Number(al.wiped && dl.wiped);
        totals.attackerWiped += Number(al.wiped);
        totals.defenderWiped += Number(dl.wiped);
        totals.eitherNearCount += Number(al.count >= 0.9 || dl.count >= 0.9);
        totals.eitherNearValue += Number(al.value >= 0.9 || dl.value >= 0.9);
        totals.attackerLossCount += al.count;
        totals.defenderLossCount += dl.count;
        totals.attackerLossValue += al.value;
        totals.defenderLossValue += dl.value;
        totals.draws += Number(result.result.draw === 1);
        totals.rounds += result.rounds;
      }
      cells.push({ a: a.name, d: d.name, ratio, actualRatio: value(attacker) / value(defender),
        attacker, defender, totals });
    }
    process.stderr.write(`TrashSim ${a.name}/${d.name}: ${cells.length * samples} battles\n`);
  }
  return { source: 'https://github.com/klaasvp/trashsim-public',
    sourceRevision: execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    hashes: engine.hashes, battles: cells.length * samples, samplesPerCell: samples,
    settings: { techs: { weapon: 10, shield: 10, armour: 10 }, rapidFire: true, shields, mirrorsOnly,
      classes: false, lifeforms: false, recovery: false,
      note: 'Classic published TrashSim JS worker, not the current proprietary Gameforge server. Every input and engine source hash retained. Seed 0xA57E0000+i. Mirror ratios exact; cross ratios rounded down to integer ships. Resource budget = M+C+D. Classical unit stats taken from the source.' },
    roster: engine.info, cells };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--run')) {
  if (!process.env.TRASHSIM_SOURCE) throw new Error('TRASHSIM_SOURCE is required');
  process.stdout.write(JSON.stringify(runOgameAudit(process.env.TRASHSIM_SOURCE, 200, {
    shields: !process.argv.includes('--no-shields'), mirrorsOnly: process.argv.includes('--mirrors-only'),
  }), null, 2) + '\n');
}
