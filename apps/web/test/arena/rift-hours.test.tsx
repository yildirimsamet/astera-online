import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_LAYOUT, ARENA_PROTOCOL, CLASS_STATS, createSandboxWorld, type CargoDrop } from '@astera/rules/arena';
import { arenaCopy } from '../../src/arena/copy.js';
import { ASTERIUM_REACH, EXIT_REACH, exitReach, nearestAsterium, nearestExit } from '../../src/arena/compass.js';
import { closedDebrief } from '../../src/arena/debrief.js';
import { blockLine, launchText } from '../../src/arena/Hangar.js';
import { hangarSchema, launchBlock, refusedAtHangar, sortieSchema, type Hangar } from '../../src/arena/hangarDesk.js';
import { RiftChip, riftLine } from '../../src/arena/Hud.js';
import { createArenaNetwork, riftDeadline } from '../../src/arena/network.js';
import { teamCopy } from '../../src/arena/teamCopy.js';
import i18n from '../../src/i18n/index.js';

/**
 * YARIK SAATLERİ (owner 2026-11-27): the Yarık is open twice a day; the door says when it opens, the flight
 * says how long it stays open and, after a window, how long is left to fly out. Inside, an arrow points at
 * the nearest Asteryum stone once it is within 500 m.
 */
const NOW = Date.parse('2026-11-27T13:00:00.000Z');
const MIN = 60_000;
beforeEach(async () => { await i18n.changeLanguage('tr'); });

const drop = (over: Partial<CargoDrop>): CargoDrop => ({ p: { x: 0, y: 0, z: 0 }, amount: 2, active: true, age: 0, field: true, kind: 3, claim: -1, ...over });

describe('the arrow to the nearest Asteryum', () => {
  it('reaches 500 m', () => {
    expect(ASTERIUM_REACH).toBe(500);
  });

  it('points at the nearest live stone within reach, and at nothing else', () => {
    const drops = [
      drop({ p: { x: 0, y: 0, z: 480 } }),
      drop({ p: { x: 300, y: 0, z: 0 } }),
      drop({ p: { x: 100, y: 0, z: 0 }, kind: 0 }), // ore, not Asteryum
      drop({ p: { x: 50, y: 0, z: 0 }, active: false }),
      drop({ p: { x: 0, y: 40, z: 0 }, amount: 0 }),
    ];
    expect(nearestAsterium(drops, { x: 0, y: 0, z: 0 })).toEqual({ index: 1, distance: 300 });
    expect(nearestAsterium([drop({ p: { x: 0, y: 0, z: 501 } })], { x: 0, y: 0, z: 0 })).toBeNull();
    expect(nearestAsterium([], { x: 0, y: 0, z: 0 })).toBeNull();
  });
});

/** Owner 2026-11-27: the exit marker shows only within 2 km of an exit. */
describe('the exit marker', () => {
  const exits = [{ x: 0, y: 0, z: 2500 }, { x: 1200, y: 0, z: 0 }, { x: 0, y: 1900, z: 0 }];
  it('points at the nearest exit within 2 km, and at none farther', () => {
    expect(EXIT_REACH).toBe(2000);
    expect(nearestExit(exits, { x: 0, y: 0, z: 0 })).toEqual({ exit: exits[1], distance: 1200 });
    expect(nearestExit(exits, { x: -900, y: 0, z: 0 })).toBeNull();
    expect(nearestExit([], { x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('shows the nearest exit however far while the Yarık is closing (owner 2026-11-27)', () => {
    // From the middle the exits are ~10 km off: the five minutes to fly out need the way shown from anywhere.
    expect(exitReach(false)).toBe(EXIT_REACH);
    expect(exitReach(true)).toBe(Infinity);
    expect(nearestExit(exits, { x: 0, y: 0, z: -9000 }, exitReach(true))?.exit).toBe(exits[1]);
  });

  it('knows the Yarık is closing from the room\'s word, or from the close passing', () => {
    expect(riftDeadline({ open: false, closesAt: null, deadline: NOW + MIN }, NOW)).toBe(NOW + MIN);
    expect(riftDeadline({ open: true, closesAt: NOW - 1000, deadline: null }, NOW)).toBe(NOW - 1000 + 5 * MIN);
    expect(riftDeadline({ open: true, closesAt: NOW + MIN, deadline: null }, NOW)).toBeNull();
    expect(riftDeadline({ open: false, closesAt: null, deadline: NOW - 1 }, NOW)).toBeNull();
    expect(riftDeadline(null, NOW)).toBeNull();
  });
});

describe('the Yarık\'s line in the flight', () => {
  const c = () => arenaCopy();

  it('counts down to the close while it is open', () => {
    expect(riftLine({ open: true, closesAt: NOW + 42 * MIN, deadline: null }, NOW, c())).toEqual({ text: c().riftCloses('42 dk'), tone: 'calm' });
    // The last five minutes are a warning: whatever is in the hold has to reach an exit.
    expect(riftLine({ open: true, closesAt: NOW + 4 * MIN, deadline: null }, NOW, c())?.tone).toBe('warn');
  });

  it('counts the minutes left to fly out once it has closed', () => {
    const line = riftLine({ open: false, closesAt: null, deadline: NOW + 4 * MIN + 12_000 }, NOW, c());
    expect(line).toEqual({ text: c().riftClosing('4:12'), tone: 'alarm' });
  });

  it('turns to the minutes to fly out the moment the close passes, before the room\'s next word', () => {
    // The room reads the calendar every 5 s; the grace is a rule, so the page needs no word to start counting it.
    expect(riftLine({ open: true, closesAt: NOW - 30_000, deadline: null }, NOW, c())).toEqual({ text: c().riftClosing('4:30'), tone: 'alarm' });
    expect(riftLine({ open: true, closesAt: NOW - 6 * MIN, deadline: null }, NOW, c())).toBeNull();
    expect(riftLine({ open: false, closesAt: null, deadline: NOW - 1 }, NOW, c())).toBeNull();
  });

  it('says nothing before the room has told it the window', () => {
    expect(riftLine(null, NOW, c())).toBeNull();
    expect(riftLine({ open: true, closesAt: null, deadline: null }, NOW, c())).toBeNull();
  });

  it('ticks on its own, every second', () => {
    vi.useFakeTimers({ now: NOW });
    try {
      render(<RiftChip rift={{ open: false, closesAt: null, deadline: NOW + 2 * MIN }} c={c()} />);
      expect(screen.getByRole('status').textContent).toContain('2:00');
      expect(screen.getByRole('status').dataset.tone).toBe('alarm');
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByRole('status').textContent).toContain('1:59');
    } finally { vi.useRealTimers(); }
  });
});

const hangar = (rift?: Hangar['rift'], ship: Partial<NonNullable<Hangar['ship']>> = {}): Hangar => ({
  core: 11, minCore: 9,
  ship: { class: 'kilavuz', changeUntil: null, fuel: CLASS_STATS.kilavuz.fuelTank, ammo: CLASS_STATS.kilavuz.ammoCapacity,
    hold: [0, 0, 0], readyAt: null, readyReason: null, flying: false, away: null, homeAt: null,
    level: 3, xp: 40, xpNext: 150, levelCap: 11, abilities: {}, upgrade: { alloy: 450, crystal: 225, deuterium: 0 }, plan: { fuel: 100, ammo: 100 }, ...ship },
  refill: { fuel: 20, ammo: 3, total: 23 }, deuterium: 140, alloy: 5000, crystal: 2000,
  cap: { alloy: 5664, crystal: 2832, deuterium: 76 }, sent: { alloy: 664, crystal: 0, deuterium: 80 },
  resetsAt: '2026-11-28T00:00:00.000Z', entryClosesAt: '2026-12-20T00:00:00.000Z', ...(rift ? { rift } : {}),
});
const shut = { open: false, storm: false, closesAt: null, deadline: null, opensAt: '2026-11-27T14:00:00.000Z' };

describe('the door to the Yarık', () => {
  it('reads the window from the hangar, and an older room without one', () => {
    const raw = { ...hangar(), rift: shut };
    expect(hangarSchema.parse(raw).rift).toEqual(shut);
    expect(hangarSchema.parse(hangar()).rift).toBeUndefined();
  });

  it('stays shut while the Yarık is closed, and says when it opens', () => {
    expect(launchBlock(hangar(shut), NOW)).toEqual({ kind: 'closed', opensAt: Date.parse(shut.opensAt) });
    const opens = new Intl.DateTimeFormat('tr', { hour: '2-digit', minute: '2-digit' }).format(new Date(shut.opensAt));
    expect(blockLine({ kind: 'closed', opensAt: Date.parse(shut.opensAt) }, NOW, arenaCopy())).toContain(opens);
    expect(blockLine({ kind: 'closed', opensAt: null }, NOW, arenaCopy())).toBe(arenaCopy().riftShut);
    expect(launchText(hangar(shut), NOW, arenaCopy()).line).toContain(opens);
  });

  it('opens inside a window, or where the room says nothing of one', () => {
    expect(launchBlock(hangar({ open: true, storm: false, closesAt: '2026-11-27T15:00:00.000Z', deadline: null, opensAt: null }), NOW)).toBeNull();
    expect(launchBlock(hangar(), NOW)).toBeNull();
  });

  it('opens on its own once the hour comes, and shuts at the close, without a fresh read', () => {
    const opens = Date.parse(shut.opensAt);
    expect(launchBlock(hangar(shut), opens)).toBeNull();
    const open = { open: true, storm: false, closesAt: '2026-11-27T15:00:00.000Z', deadline: null, opensAt: null };
    expect(launchBlock(hangar(open), Date.parse(open.closesAt) - 1)).toBeNull();
    expect(launchBlock(hangar(open), Date.parse(open.closesAt))).toEqual({ kind: 'closed', opensAt: null });
  });

  it('still lets a ship that is in the air go back to it', () => {
    expect(launchBlock(hangar(shut, { flying: true }), NOW)).toEqual({ kind: 'flying' });
  });

  it('sends a refused launch back to the hangar', () => {
    expect(refusedAtHangar('RIFT_CLOSED')).toBe(true);
    expect(arenaCopy().kicks.RIFT_CLOSED).toContain(arenaCopy().riftShut);
  });

  it('tells a team lobby the Yarık is shut, not that the team could not be read', async () => {
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      expect(teamCopy().errors.RIFT_CLOSED).toContain(arenaCopy().riftShut);
    }
  });
});

describe('a ship the Yarık closed on', () => {
  it('says so in the flight\'s result', () => {
    const report = sortieSchema.parse({ kind: 'sortie', outcome: 'dead', deposit: { alloy: 0, crystal: 0, deuterium: 0 },
      overflow: { alloy: 0, crystal: 0, deuterium: 0 }, readyAt: '2026-11-27T15:10:00.000Z', readyReason: 'repair', xp: { earned: 4, kept: 1, banked: 1 }, closed: true });
    expect(report.closed).toBe(true);
    expect(closedDebrief(report, arenaCopy())).toEqual({ title: arenaCopy().riftClosedOut, what: arenaCopy().riftClosedWhat });
    expect(closedDebrief({ ...report, closed: undefined }, arenaCopy())).toBeNull();
    expect(closedDebrief(null, arenaCopy())).toBeNull();
  });
});

class FakeSocket {
  static last: FakeSocket | null = null;
  readyState = 0; bufferedAmount = 0; sent: unknown[] = [];
  onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor(readonly url: string) { FakeSocket.last = this; }
  send(data: string): void { this.sent.push(JSON.parse(data)); }
  close(): void { this.readyState = 3; this.onclose?.(); }
  open(): void { this.readyState = 1; this.onopen?.(); }
  receive(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
}

describe('the room telling the window', () => {
  beforeEach(() => { vi.stubGlobal('WebSocket', FakeSocket); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('turns the room\'s milliseconds into this page\'s clock, at the welcome and at each turn', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(NOW);
    try {
      const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined);
      network.connect('kilavuz', 'smoke');
      const socket = FakeSocket.last; if (!socket) throw new Error('no socket');
      socket.open();
      socket.receive({ kind: 'welcome', v: ARENA_PROTOCOL, storm: false, pilotId: 4, tick: 0, seq: 0, tickRate: 30, snapshotRate: 15,
        layoutVersion: ARENA_LAYOUT.version, pilots: [], rift: { open: true, closesIn: 30 * MIN, deadlineIn: null } });
      expect(network.getSnapshot().rift).toEqual({ open: true, closesAt: NOW + 30 * MIN, deadline: null });
      socket.receive({ kind: 'rift', open: false, closesIn: null, deadlineIn: 5 * MIN });
      expect(network.getSnapshot().rift).toEqual({ open: false, closesAt: null, deadline: NOW + 5 * MIN });
      network.dispose();
    } finally { now.mockRestore(); }
  });
});
