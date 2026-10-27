import { CLASS_STATS } from '@astera/rules/arena';
import type { ArenaShips } from '../../src/arena/server.js';
import type { HangarView, Launch, SortieEnd } from '../../src/services/arenaShips.js';
import { GameError } from '../../src/services/planet.js';

/** The hangar port without a database: every launch flies a full Kılavuz unless told otherwise; every call is recorded. */
export function fakeShips(over: Partial<ArenaShips> = {}) {
  const calls = { launch: [] as string[], end: [] as { accountId: string; sortieId: string; end: SortieEnd }[], recall: 0, choose: [] as string[], upgrade: [] as string[], repair: [] as string[] };
  let flights = 0;
  const zero = { alloy: 0, crystal: 0, deuterium: 0 };
  const view: HangarView = { core: 9, minCore: 9, ship: null, refill: { fuel: 0, ammo: 0, total: 0 }, deuterium: 100, alloy: 0, crystal: 0, cap: zero, sent: zero,
    resetsAt: '2026-10-24T00:00:00.000Z', entryClosesAt: '2026-11-01T00:00:00.000Z' };
  const ships: ArenaShips = {
    spectate: () => Promise.reject(new GameError('TEAM_NOT_SPECTATING', 'No team flight', 409)),
    hangar: () => Promise.resolve(view),
    choose: (accountId, ship) => { calls.choose.push(`${accountId}:${ship}`); return Promise.resolve(view); },
    upgrade: accountId => { calls.upgrade.push(accountId); return Promise.resolve(view); },
    repair: accountId => { calls.repair.push(accountId); return Promise.resolve(view); },
    ability: () => Promise.resolve(view),
    loadout: () => Promise.resolve(view),
    launch: (accountId): Promise<Launch> => {
      calls.launch.push(accountId);
      return Promise.resolve({ sortieId: `sortie-${String(++flights)}`, ship: 'kilavuz', level: 1, fuel: CLASS_STATS.kilavuz.fuelTank,
        ammo: CLASS_STATS.kilavuz.ammoCapacity, hold: [0, 0, 0], refilled: 0, abilities: {} });
    },
    end: (accountId, sortieId, end) => {
      calls.end.push({ accountId, sortieId, end });
      return Promise.resolve({ outcome: end.outcome, deposit: { alloy: Math.floor(end.hold[0] ?? 0), crystal: 0, deuterium: 0 }, overflow: zero,
        readyAt: null, readyReason: end.outcome === 'dead' ? 'repair' : 'service', xp: { earned: 10, kept: 10, banked: 10 } });
    },
    recallOpen: () => { calls.recall++; return Promise.resolve(0); },
    ...over,
  };
  return { ships, calls };
}
