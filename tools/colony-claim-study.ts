/** Isolates the real settlement race after economic preparation. Not a full season model. */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMBAT, MULTI_WORLD } from '../packages/rules/src/constants.js';
import { SETTLEMENT_CLAIM_MINUTES } from '../packages/rules/src/strategic.js';
import { fleetTravelExact } from '../packages/rules/src/travel.js';
import { missionFuel } from '../packages/rules/src/fuel.js';
import type { Resources } from '../packages/rules/src/types.js';
import { playerWindows } from './economy-calendar-model.js';

interface Player {
  id: string; distance: number; readyAt: number; stock: Resources;
  raidMode?: 'cargo-escort' | 'combat-only';
  windows: { start: number; end: number }[];
}
const keys = ['alloy', 'crystal', 'deuterium'] as const;
const zero = (): Resources => ({ alloy: 0, crystal: 0, deuterium: 0 });
const settlers = { [MULTI_WORLD.settlement.transportHull]: MULTI_WORLD.settlement.transports };
type Kind = 'decision' | 'raid-resolved' | 'raid-returned' | 'settlement-arrived' | 'settlement-returned';

/** Players already have capital Core >=6, one free colony slot, 2 Darts and 3 Couriers, three bays and known target. */
export function claimRace(input: Player[], end: number) {
  const ids = new Set(input.map(p => p.id));
  if (ids.size !== input.length || !Number.isFinite(end) || end < 0 || input.some(p =>
    !Number.isFinite(p.distance) || p.distance < 0 || !Number.isFinite(p.readyAt) || p.readyAt < 0
    || keys.some(k => !Number.isFinite(p.stock[k]) || p.stock[k] < 0)
    || p.windows.some(w => !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.start < 0 || w.end < w.start))) {
    throw new Error('Invalid race inputs');
  }
  const players = input.map(p => ({ ...p, stock: { ...p.stock }, raidAway: false, settlersAway: false }));
  let sequence = 0, owner: string | null = null, acquiredAt: number | null = null, claimUntil = -1;
  const events: { time: number; kind: Kind; index: number; seq: number }[] = [];
  const log: { time: number; kind: string; player: string }[] = [];
  const fuelSink = zero(), foundingSink = zero(), inTransit = zero();
  const push = (time: number, kind: Kind, index: number) => { events.push({ time, kind, index, seq: sequence++ }); };
  input.forEach((p, index) => {
    for (const w of p.windows) for (let time = w.start; time < Math.min(w.end, end); time += 2) {
      if (time >= p.readyAt) push(time, 'decision', index);
    }
  });
  while (events.length) {
    // Outcomes at the same time are authoritative before new commands; tie order is deterministic.
    events.sort((a, b) => a.time - b.time || Number(a.kind === 'decision') - Number(b.kind === 'decision') || a.seq - b.seq);
    const e = events.shift()!;
    if (e.time > end) break;
    const p = players[e.index]!;
    const raidFleet = p.raidMode === 'combat-only' ? { DART: 2 } : { DART: 2, COURIER: 1 };
    const record = (kind: string) => { log.push({ time: e.time, kind, player: p.id }); };
    if (e.kind === 'raid-resolved') {
      // Explicit unguarded tier-1 target only, no stock/loot. A guarded fight needs the full combat ledger.
      if (owner === null && claimUntil <= e.time) claimUntil = e.time + SETTLEMENT_CLAIM_MINUTES;
      record(e.kind);
      push(e.time + fleetTravelExact(p.distance, raidFleet, { boost: 1, tech: {} }), 'raid-returned', e.index);
    } else if (e.kind === 'raid-returned') {
      p.raidAway = false; record(e.kind);
    } else if (e.kind === 'settlement-arrived') {
      if (owner === null && e.time < claimUntil) {
        owner = p.id; acquiredAt = e.time;
        for (const k of keys) { inTransit[k] -= MULTI_WORLD.settlement.cost[k]; foundingSink[k] += MULTI_WORLD.settlement.cost[k]; }
        record('acquired');
      } else {
        record('settlement-lost');
        push(e.time + fleetTravelExact(p.distance, settlers, { boost: 1, tech: {} }), 'settlement-returned', e.index);
      }
    } else if (e.kind === 'settlement-returned') {
      for (const k of keys) { p.stock[k] += MULTI_WORLD.settlement.cost[k]; inTransit[k] -= MULTI_WORLD.settlement.cost[k]; }
      p.settlersAway = false; record(e.kind);
    } else if (owner === null) {
      const settleFlight = fleetTravelExact(p.distance, settlers, { boost: 1, tech: {} });
      const fuel = missionFuel(settlers, p.distance, 1);
      if (!p.settlersAway && e.time + settleFlight < claimUntil
        && keys.every(k => p.stock[k] >= MULTI_WORLD.settlement.cost[k] + (k === 'deuterium' ? fuel : 0))) {
        for (const k of keys) { p.stock[k] -= MULTI_WORLD.settlement.cost[k]; inTransit[k] += MULTI_WORLD.settlement.cost[k]; }
        p.stock.deuterium -= fuel; fuelSink.deuterium += fuel;
        p.settlersAway = true; record('settlement-launched');
        push(e.time + settleFlight, 'settlement-arrived', e.index);
      } else if (!p.raidAway && !p.settlersAway && claimUntil <= e.time) {
        const raidFuel = missionFuel(raidFleet, p.distance, 2);
        if (p.stock.deuterium < raidFuel) continue;
        p.stock.deuterium -= raidFuel; fuelSink.deuterium += raidFuel;
        p.raidAway = true; record('raid-launched');
        push(e.time + fleetTravelExact(p.distance, raidFleet, { boost: 1, tech: {} }) + COMBAT.engagementSeconds / 60, 'raid-resolved', e.index);
      }
    }
  }
  const conservationError = zero();
  for (const k of keys) conservationError[k] = input.reduce((s, p) => s + p.stock[k], 0)
    - players.reduce((s, p) => s + p.stock[k], 0) - inTransit[k] - fuelSink[k] - foundingSink[k];
  return { owner, acquiredAt, claimUntil, players, log, fuelSink, foundingSink, inTransit, conservationError };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = [];
  for (const distance of [250, 500, 1000, 1250, 1750, 2500, 3500]) {
    for (const raidMode of ['cargo-escort', 'combat-only'] as const) for (const minutes of [10, 15, 90]) {
      const p: Player = { id: 'player', distance, readyAt: 0,
        raidMode,
        stock: { alloy: 10000, crystal: 10000, deuterium: 1000 }, windows: [{ start: 0, end: minutes }] };
      rows.push({ kind: 'single-session', distance, minutes, raidMode, result: claimRace([p], 120) });
    }
    for (const raidMode of ['cargo-escort', 'combat-only'] as const) for (const profile of ['average', 'low', 'low-once'] as const) {
      const readyAt = (profile === 'average' ? 2.0625 : profile === 'low' ? 2.5625 : 3.5625) * 1440;
      const p: Player = { id: profile, distance, readyAt,
        raidMode,
        stock: { alloy: 10000, crystal: 10000, deuterium: 1000 }, windows: playerWindows(profile, 14) };
      rows.push({ kind: 'calendar-handoff', distance, profile, readyAt, raidMode, result: claimRace([p], 14 * 1440) });
    }
  }
  const files = ['packages/rules/src/strategic.ts', 'packages/rules/src/constants.ts', 'packages/rules/src/hulls.ts',
    'packages/rules/src/fuel.ts', 'packages/rules/src/travel.ts', 'apps/server/src/services/movement.ts',
    'apps/server/src/services/neutral.ts', 'packages/sim/src/season.ts', 'tools/colony-claim-study.ts'];
  const sourceHashes = Object.fromEntries(files.map(f => [f, createHash('sha256')
    .update(readFileSync(new URL(`../${f}`, import.meta.url))).digest('hex')]));
  process.stdout.write(JSON.stringify({ version: 1, sourceHashes, claimMinutes: SETTLEMENT_CLAIM_MINUTES,
    caveat: 'Isolated live-rule claim timing, not integrated income/progression. Prepared, funded players; target known, unguarded and empty; no reinforcements or later attacks on a captured colony. Three home Couriers allow raid+settlement concurrently. Founding cargo is classified as sink matching current successful resolver, despite the launch comment. Calendar readiness is a copied explicit scenario from the prior bundle model, not a new validated gate.', rows }, null, 2) + '\n');
}
