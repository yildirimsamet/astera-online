/** Headless smoke test for prototype.js — stubs just enough DOM to run the loop. */
const el = () => new Proxy({}, {
  get(_, k) {
    if (k === 'querySelectorAll') return () => [];
    if (k === 'closest') return () => null;
    if (k === 'dataset') return {};
    if (k === 'showModal' || k === 'close' || k === 'addEventListener') return () => {};
    if (k === 'style') return {};
    return undefined;
  },
  set() { return true; },
});
let store = {};
globalThis.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};
globalThis.document = { getElementById: el, addEventListener: () => {}, querySelectorAll: () => [] };
globalThis.confirm = () => false;
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
globalThis.setInterval = () => 0;

// Bot behaviour uses Math.random, so seed it — a flaky test is worse than none.
import { mulberry32 } from './rules.mjs';
const seeded = mulberry32(1337);
Math.random = seeded;

const REAL_NOW = Date.now();
let offset = 0;
Date.now = () => REAL_NOW + offset;

const { __test } = await import('./prototype.js');
const S = __test.state();

const check = (label, cond, extra = '') => {
  console.log(`  ${cond ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label}${extra ? '  \x1b[90m' + extra + '\x1b[0m' : ''}`);
  if (!cond) process.exitCode = 1;
};

console.log('\n\x1b[1mASTERA ONLINE prototype — smoke test\x1b[0m\n');

check('starts with 12 Wasps', S.player.fleet.WASP === 12);
check('telescope locked at start', !S.unlocked.telescope);

// ── 45 minutes pass with the player idle ──
offset = 45 * 60000;
__test.catchUp();
check('clock advanced', S.t >= 45, `t=${S.t}`);
check('alloy accrued', S.player.alloy > 500, `${Math.round(S.player.alloy)} alloy`);
check('bots acted', S.bots.some((b) => b.refinery > 2 || b.awayUntil > 0));

// ── scout a neighbour, wait for the probe ──
const before = S.player.alloy;
__test.sendProbe(3);                       // KETH
check('probe cost deducted', S.player.alloy < before);
offset += 10 * 60000;
__test.catchUp();
check('probe report filed', !!S.probes[3], S.probes[3] ? `${Math.round(S.probes[3].alloy.low)}–${Math.round(S.probes[3].alloy.high)} alloy` : '');
check('report is a band, not a number', S.probes[3] && S.probes[3].alloy.high > S.probes[3].alloy.low);

// ── launch an attack ──
const sent = { WASP: Math.floor(S.player.fleet.WASP * 0.7) };
__test.launchAttack(3, sent);
check('fleet left home', S.player.fleet.WASP < 12, `${S.player.fleet.WASP} left`);
check('exposure window set', S.player.awayUntil > S.t, `${S.player.awayUntil - S.t} min`);
check('attack counted after scout', S.tm.attacksAfterScout === 1);

offset += 60 * 60000;
__test.catchUp();
check('fleet came home', S.player.awayUntil <= S.t);
check('telescope unlocked on return', S.unlocked.telescope);
check('battle was logged', S.events.some((e) => /DECISIVE|PARTIAL|REPELLED/.test(e.text)));

// ── long absence: the world must keep running ──
const evBefore = S.events.length;
offset += 8 * 3600 * 1000;
__test.catchUp();
const botsMoved = S.bots.some((b) => b.awayUntil > 0) || S.events.length > evBefore;
check('8h absence moved the world', botsMoved, `${S.events.length - evBefore} new events`);
check('bots grew while away', S.bots.some((b) => b.refinery >= 4));

// ── clarity gradient actually varies by target ──
S.watching = 1;                            // MARROW, veil 3
S.player.telescope = 1;
__test.render();
const marrow = S.teleLast[1];
check('veil-3 target is opaque to a L1 telescope', marrow === undefined);

console.log(`\n  \x1b[90mfinal: t=${S.t}min  alloy=${Math.round(S.player.alloy)}  fleet=${JSON.stringify(S.player.fleet)}  events=${S.events.length}\x1b[0m`);
console.log(process.exitCode ? '\n\x1b[31mFAILED\x1b[0m\n' : '\n\x1b[32mAll checks passed.\x1b[0m\n');
