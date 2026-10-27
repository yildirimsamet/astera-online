import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARENA_ECONOMY, ARENA_LAYOUT, ARENA_PROTOCOL, CLASS_STATS, createSandboxWorld, shipStats, type Pilot, type ShipClass } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { SortieSummary, launchText, levelGains } from '../../src/arena/Hangar.js';
import { teamCopy } from '../../src/arena/teamCopy.js';
import { capLeft, clockText, fetchHangar, hangarSchema, launchBlock, pickShip, refusedAtHangar, repairOffer, repairShip, setLoadout, upgradeShip, type Hangar } from '../../src/arena/hangarDesk.js';
import { ArenaHud, type HudBind } from '../../src/arena/Hud.js';
import { createArenaNetwork } from '../../src/arena/network.js';
import { createHudStore } from '../../src/arena/store.js';

/**
 * Y6a (plan 14 §7): the hangar is where a real flight is decided. It says what the ship is, when it
 * is ready, what filling it takes from the capital and what the capital can still take today; the
 * result says what reached the capital. The player reads resources, never units or points.
 */
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(previous); vi.unstubAllGlobals(); });

const NOW = Date.parse('2026-10-23T12:00:00Z');
const hangar = (patch: Partial<Hangar> = {}, ship: Partial<NonNullable<Hangar['ship']>> | null = {}): Hangar => ({
  core: 11, minCore: 9,
  ship: ship === null ? null : { class: 'kilavuz', changeUntil: null, fuel: CLASS_STATS.kilavuz.fuelTank, ammo: CLASS_STATS.kilavuz.ammoCapacity,
    hold: [0, 0, 0], readyAt: null, readyReason: null, flying: false, away: null, homeAt: null,
    level: 3, xp: 40, xpNext: 150, levelCap: 11, abilities: {}, upgrade: { alloy: 450, crystal: 225, deuterium: 0 }, plan: { fuel: 100, ammo: 100 }, ...ship },
  refill: { fuel: 20, ammo: 3, total: 23 }, deuterium: 140, alloy: 5000, crystal: 2000,
  cap: { alloy: 5664, crystal: 2832, deuterium: 76 }, sent: { alloy: 664, crystal: 0, deuterium: 80 },
  resetsAt: '2026-10-24T00:00:00.000Z', entryClosesAt: '2026-11-01T00:00:00.000Z', ...patch,
});
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('the hangar desk client', () => {
  it('buys the quoted repair with the session and preserves a refusal', async () => {
    const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect([url, init?.method, init?.body]).toEqual(['/arena/repair', 'POST', '{}']);
      expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
      return json(409, { error: 'REPAIR_NOT_SHORTER' });
    });
    expect(await repairShip('tok', fetcher)).toEqual({ ok: false, error: 'REPAIR_NOT_SHORTER', params: {} });
  });

  // Owner 2026-10-27: half a tank, a light magazine; a desk from before plans flies full.
  it('sets the launch plan with the session, and reads a desk from before plans as full', async () => {
    const planned = hangar({ refill: { fuel: 0, ammo: 0, total: 0 } }, { plan: { fuel: 50, ammo: 0 } });
    const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect([url, init?.method, init?.body]).toEqual(['/arena/loadout', 'POST', JSON.stringify({ fuel: 50, ammo: 0 })]);
      expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
      return json(200, planned);
    });
    expect(await setLoadout('tok', { fuel: 50, ammo: 0 }, fetcher)).toEqual({ ok: true, hangar: planned });
    const old = hangar();
    const before = { ...old, ship: Object.fromEntries(Object.entries(old.ship ?? {}).filter(([key]) => key !== 'plan')) };
    expect(hangarSchema.parse(before).ship?.plan).toEqual({ fuel: 100, ammo: 100 });
  });

  it('offers paid repair only while it saves time, never maintenance or a ship in flight', () => {
    const repairing = hangar({}, { level: 1, readyReason: 'repair', readyAt: new Date(NOW + 60 * 60_000).toISOString() });
    expect(repairOffer(repairing, NOW)).toEqual({ minutes: 15, cost: { alloy: 175, crystal: 60, deuterium: 0 } });
    for (const remaining of [15 * 60_000, 14 * 60_000, 0, -1000]) {
      expect(repairOffer(hangar({}, { level: 1, readyReason: 'repair', readyAt: new Date(NOW + remaining).toISOString() }), NOW)).toBeNull();
    }
    expect(repairOffer(hangar({}, { readyReason: 'service', readyAt: repairing.ship?.readyAt }), NOW)).toBeNull();
    expect(repairOffer(hangar({}, { flying: true, readyReason: 'repair', readyAt: repairing.ship?.readyAt }), NOW)).toBeNull();
    expect(repairOffer(hangar({}, null), NOW)).toBeNull();
    // Owner 2026-10-28: a Yarık death repairs faster than any quote, so it is never offered there.
    const yarik = new Date(NOW + ARENA_ECONOMY.repairMinutes * 60_000).toISOString();
    for (const level of [1, 10, 20]) expect(repairOffer(hangar({}, { level, readyReason: 'repair', readyAt: yarik }), NOW)).toBeNull();
  });
  it('reads the hangar with the session, and a refusal by its code', async () => {
    const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({ authorization: 'Bearer tok' });
      return url === '/arena/hangar' ? json(200, hangar()) : json(409, { error: 'CLASS_LOCKED', message: 'x' });
    });
    expect(await fetchHangar('tok', fetcher)).toEqual({ ok: true, hangar: hangar() });
    expect(await pickShip('tok', 'akinci', fetcher)).toEqual({ ok: false, error: 'CLASS_LOCKED', params: {} });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', body: JSON.stringify({ ship: 'akinci' }) });
    expect(await fetchHangar(null, fetcher)).toEqual({ ok: false, error: 'auth', params: {} });
    expect(await fetchHangar('tok', () => json(200, { core: 'nine' }))).toEqual({ ok: false, error: 'hangar', params: {} });
    expect(await fetchHangar('tok', () => Promise.reject(new Error('offline')))).toEqual({ ok: false, error: 'hangar', params: {} });
  });

  it('names the first thing that keeps a ship on the ground', () => {
    expect(launchBlock(hangar({ core: 7 }, null), NOW)).toEqual({ kind: 'core', core: 7, need: 9 });
    expect(launchBlock(hangar({}, null), NOW)).toEqual({ kind: 'ship' });
    expect(launchBlock(hangar({}, { flying: true }), NOW)).toEqual({ kind: 'flying' });
    expect(launchBlock(hangar({}, { readyAt: '2026-10-23T12:07:00.000Z', readyReason: 'service' }), NOW))
      .toEqual({ kind: 'ready', until: Date.parse('2026-10-23T12:07:00.000Z'), reason: 'service' });
    // A timer that ran out on this screen no longer holds the ship.
    expect(launchBlock(hangar({}, { readyAt: '2026-10-23T11:59:59.000Z', readyReason: 'repair' }), NOW)).toBeNull();
    expect(launchBlock(hangar({ entryClosesAt: '2026-10-23T12:00:00.000Z' }), NOW)).toEqual({ kind: 'season' });
    expect(launchBlock(hangar({ deuterium: 22 }), NOW)).toEqual({ kind: 'deuterium', need: 23, have: 22 });
    expect(launchBlock(hangar(), NOW)).toBeNull();
  });

  // Codex review CR3: an escorting ship read "Hazır" and the room's refusal looked like a broken link.
  it('keeps a ship that escorts a fleet, or flies home alone, on the ground until it lands', () => {
    expect(launchBlock(hangar({}, { away: 'escort', homeAt: null }), NOW)).toEqual({ kind: 'escort' });
    const homeAt = '2026-10-23T12:20:00.000Z';
    const lone = hangar({}, { away: 'homeward', homeAt, readyReason: 'repair', readyAt: '2026-10-23T13:20:00.000Z' });
    expect(launchBlock(lone, NOW)).toEqual({ kind: 'homeward', until: Date.parse(homeAt) });
    expect(launchText(lone, NOW, arenaCopy()).line).toBe(arenaCopy().homeward('20:00'));
    expect(launchText(hangar({}, { away: 'escort', homeAt: null }), NOW, arenaCopy()).line).toBe(arenaCopy().blocked.escort);
    // A desk from before the deploy carries neither field.
    expect(hangarSchema.parse(JSON.parse(JSON.stringify(hangar())) as unknown).ship).toMatchObject({ away: null, homeAt: null });
  });

  it('prices a repair on the road home from the moment the ship lands', () => {
    const lone = hangar({}, { level: 1, away: 'homeward', homeAt: new Date(NOW + 50 * 60_000).toISOString(), readyReason: 'repair', readyAt: new Date(NOW + 110 * 60_000).toISOString() });
    expect(repairOffer(lone, NOW)).toEqual({ minutes: 15, cost: { alloy: 175, crystal: 60, deuterium: 0 } });
    expect(repairOffer({ ...lone, ship: { ...lone.ship!, readyAt: new Date(NOW + 60 * 60_000).toISOString() } }, NOW)).toBeNull();
  });

  it('counts what the capital can still take today, never below nothing', () => {
    expect(capLeft(hangar())).toEqual({ alloy: 5000, crystal: 2832, deuterium: 0 });
    expect([clockText(0), clockText(59_000), clockText(9 * 60_000 + 58_000), clockText(60 * 60_000)]).toEqual(['0:00', '0:59', '9:58', '60:00']);
  });
});

describe('the hangar rules', () => {
  // Owner 2026-10-28: the waits are read from the rules, so the sheet never promises an old number.
  it('names the repair and the maintenance the rules hold, in both languages', async () => {
    for (const language of ['tr', 'en']) {
      await i18n.changeLanguage(language);
      const rules = arenaCopy().rules.join(' ');
      expect(rules).toContain(`${String(ARENA_ECONOMY.repairMinutes)} ${language === 'tr' ? 'dk' : 'min'}`);
      expect(rules).toContain(`${String(ARENA_ECONOMY.serviceMinutes)} ${language === 'tr' ? 'dk' : 'min'}`);
      expect(rules).not.toMatch(/\b(60|10) (dk|min)\b/);
    }
  });
});

describe('a launch the room refuses', () => {
  it('goes back to the hangar with words for the escort, the team window and a full room', () => {
    for (const code of ['ADMIRAL_AWAY', 'TEAM_CONNECT_EXPIRED', 'full', 'SHIP_NOT_READY']) {
      expect(refusedAtHangar(code)).toBe(true);
      expect(arenaCopy().kicks[code] ?? (teamCopy().errors as Readonly<Record<string, string>>)[code]).toBeTruthy();
    }
    // A broken link is put right by reconnecting, not in the hangar.
    expect(refusedAtHangar('replaced')).toBe(false);
  });
});

describe('the launch button', () => {
  const c = arenaCopy();
  it('names the fill it pays against the capital\'s deuterium, and the block when there is one', () => {
    // F9/F9b: what the D pays for (the tank and the racks filled at the launch) and that D is deuterium.
    expect(launchText(hangar(), NOW, c)).toEqual({ line: c.enter(23), note: c.refillNote(20, 3, '140') });
    const tr = arenaCopy();
    expect(tr.refillNote(20, 3, '140')).toBe('Döteryumla dolum · yakıt 20 + cephane 3 · başkentte 140');
    expect(tr.refillNote(13, 0, '140')).toBe('Döteryumla dolum · yakıt 13 · başkentte 140');
    // A full ship pays nothing, so there is nothing to weigh.
    expect(launchText(hangar({ refill: { fuel: 0, ammo: 0, total: 0 } }), NOW, c)).toEqual({ line: c.enter(0), note: null });
    expect(launchText(hangar({ deuterium: 9 }), NOW, c)).toEqual({ line: c.shortOf(9, 23), note: null });
    expect(launchText(hangar({}, { readyAt: '2026-10-23T12:07:00.000Z', readyReason: 'service' }), NOW, c).line).toContain('7:00');
  });
});

describe('the sortie summary', () => {
  const zero = { alloy: 0, crystal: 0, deuterium: 0 };
  it('lists what a team pilot put in the pool, and that the share comes when every flight ends', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={NOW} hold={[120.4, 0, 8]} report={{ outcome: 'extracted',
      teamId: '00000000-0000-4000-8000-000000000001', deposit: zero, overflow: zero, readyAt: null, readyReason: null,
      xp: { earned: 10, kept: 10, banked: 10 } }} />).container;
    expect(view.querySelector('.ap-eyebrow')?.textContent).toBe(teamCopy().pooled);
    expect([...view.querySelectorAll('.ss-pooled li')].map(li => li.textContent)).toEqual(['+120 Alaşım', '+8 Döteryum']);
    expect(view.querySelector('.ss-lost')).toBeNull();
  });
  it('does not call a recalled hold lost: it stays in the ship', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={NOW} hold={[50, 0, 0]} report={{ outcome: 'recalled', deposit: zero, overflow: zero,
      readyAt: null, readyReason: null, xp: { earned: 5, kept: 5, banked: 5 } }} />).container;
    expect(view.querySelector('.ss-lost')).toBeNull();
  });
  it('explains pooled cargo instead of reporting an empty solo deposit', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={NOW} hold={[0, 0, 0]} report={{ outcome: 'extracted',
      teamId: '00000000-0000-4000-8000-000000000001', deposit: zero, overflow: zero, readyAt: null, readyReason: null,
      xp: { earned: 10, kept: 10, banked: 10 } }} />);
    expect(view.getByText(teamCopy().pool)).toBeInTheDocument();
    expect(view.queryByText(arenaCopy().nothingLanded)).toBeNull();
  });
  it('lists what reached the capital and what the day\'s cap left out', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={NOW} hold={[0, 0, 0]} report={{ outcome: 'extracted',
      deposit: { alloy: 240, crystal: 112, deuterium: 10 }, overflow: { alloy: 0, crystal: 0, deuterium: 15 },
      readyAt: '2026-10-23T12:10:00.000Z', readyReason: 'service', xp: { earned: 62, kept: 62, banked: 62 } }} />).container;
    expect([...view.querySelectorAll('.ss-landed li')].map(li => li.textContent)).toEqual(['+240 Alaşım', '+112 Kristal', '+10 Döteryum']);
    expect(view.querySelector('.ss-overflow')?.textContent).toContain('15 Döteryum');
    expect(view.querySelector('.ss-ready')?.textContent).toContain('10:00');
  });

  it('lists a lost hold, and an hour of repair', () => {
    const view = render(<SortieSummary c={arenaCopy()} now={NOW} hold={[80.6, 0, 4]} report={{ outcome: 'dead', deposit: zero, overflow: zero,
      readyAt: '2026-10-23T13:00:00.000Z', readyReason: 'repair', xp: { earned: 60, kept: 24, banked: 24 } }} />).container;
    expect([...view.querySelectorAll('.ss-lost li')].map(li => li.textContent)).toEqual(['−80 Alaşım', '−4 Döteryum']);
    expect(view.querySelector('.ss-ready')?.textContent).toContain(arenaCopy().repairing);
    expect(view.querySelector('.ss-landed')).toBeNull();
  });
});

describe('the room\'s sortie report', () => {
  class FakeSocket {
    static last: FakeSocket | null = null; static readonly OPEN = 1;
    readyState = 0; bufferedAmount = 0; sent: unknown[] = [];
    onopen: (() => void) | null = null; onclose: (() => void) | null = null; onerror: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    constructor() { FakeSocket.last = this; }
    send(data: string): void { this.sent.push(JSON.parse(data)); }
    close(): void { this.readyState = 3; this.onclose?.(); }
    open(): void { this.readyState = 1; this.onopen?.(); }
    receive(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
  }
  const last = (): FakeSocket => { if (!FakeSocket.last) throw new Error('no socket'); return FakeSocket.last; };

  it('keeps the report for the result, and every flight from the hangar enters afresh', async () => {
    vi.stubGlobal('WebSocket', FakeSocket);
    const network = createArenaNetwork(createSandboxWorld({ bots: 0 }), { sensitivity: 1, invertPitch: false }, () => undefined, () => Promise.resolve('tok'));
    network.connect('kilavuz', 'smoke'); last().open();
    await vi.waitFor(() => { expect(last().sent).toHaveLength(1); });
    last().receive({ kind: 'welcome', v: ARENA_PROTOCOL, pilotId: 4, tick: 0, seq: 0, tickRate: 30, snapshotRate: 15, layoutVersion: ARENA_LAYOUT.version, pilots: [] });
    const report = { kind: 'sortie', outcome: 'extracted', deposit: { alloy: 5, crystal: 0, deuterium: 0 }, overflow: { alloy: 0, crystal: 0, deuterium: 0 },
      readyAt: '2026-10-23T12:10:00.000Z', readyReason: 'service', xp: { earned: 10, kept: 10, banked: 10 } };
    last().receive(report);
    expect(network.getSnapshot()).toMatchObject({ phase: 'online', sortie: { outcome: 'extracted', deposit: { alloy: 5 } } });
    network.stop();
    expect(network.getSnapshot().phase).toBe('idle');
    network.connect('kilavuz', 'smoke'); last().open();
    await vi.waitFor(() => { expect(last().sent).toHaveLength(1); });
    expect(last().sent[0]).toMatchObject({ kind: 'hello', mode: 'enter' });
    expect(network.getSnapshot().sortie).toBeNull();
    network.dispose();
  });
});

const bind: HudBind = { reticle: null, lead: null, hit: null, kill: null, enemies: () => null, threats: () => null, places: () => null, pings: () => null, exit: null,
  crystal: null, damage: null, landing: null, circle: null, incoming: null, radar: null, mapSelf: null, mapAltitude: null };
describe('the hold in flight', () => {
  it('reads in resources, as they will land', () => {
    const world = createSandboxWorld({ bots: 0, ship: 'muhafiz' as ShipClass });
    Object.assign(world.pilot, { cargo: 123.7, hold: [100.2, 20.5, 3] } satisfies Partial<Pilot>);
    const store = createHudStore(); store.publish(world, 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container;
    // A phone's gauge holds one figure: the total aboard against the hold; the bar's colours split it, the label names it.
    expect(view.querySelector('.ah-hold strong')?.textContent).toBe(`123/${String(CLASS_STATS.muhafiz.cargoCapacity)}`);
    expect(view.querySelectorAll('.ah-hold i b')).toHaveLength(3);
    expect(view.querySelector('.ah-hold strong')?.getAttribute('aria-label')).toBe('100 Alaşım · 20 Kristal · 3 Döteryum');
    expect(view.querySelector('.ah-hold')?.textContent).not.toContain(arenaCopy().pointsShort);
  });
});

describe('the ship\'s level (Y6b)', () => {
  let c = arenaCopy();
  beforeEach(() => { c = arenaCopy(); });

  it('buys a level at the hangar desk', async () => {
    const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
      expect([url, init?.method]).toEqual(['/arena/upgrade', 'POST']);
      return json(409, { error: 'XP_SHORT', params: { xp: 40, need: 150 } });
    });
    expect(await upgradeShip('tok', fetcher)).toEqual({ ok: false, error: 'XP_SHORT', params: { xp: 40, need: 150 } });
  });

  it('grows what the class grows, one level at a time', () => {
    const gains = levelGains('akinci', 1, c);
    expect(gains.map(gain => gain.key)).toEqual(['speed', 'hull', 'damage', 'fire', 'accuracy', 'cargo', 'fuel']);
    // Accuracy grows a little each level, in points of the share.
    expect(gains.find(gain => gain.key === 'accuracy')?.text).toBe('+1,1 yüzde puan');
    expect(gains.find(gain => gain.key === 'speed')?.text).toBe(`+${(40 / 19).toFixed(1).replace('.', ',')} m/s`);
    expect(levelGains('akinci', 20, c)).toEqual([]);
  });

  it('shows the XP a flight banked, and what a lost one kept', () => {
    const zero = { alloy: 0, crystal: 0, deuterium: 0 };
    const won = render(<SortieSummary c={c} now={NOW} hold={[0, 0, 0]} report={{ outcome: 'extracted', deposit: zero, overflow: zero, readyAt: null,
      readyReason: 'service', xp: { earned: 117, kept: 117, banked: 50 } }} />).container;
    expect(won.querySelector('.ss-xp b')?.textContent).toBe('+50 XP');
    expect(won.querySelector('.ss-xp small')?.textContent).toBe(c.xpUnbanked(67));
    const lost = render(<SortieSummary c={c} now={NOW} hold={[0, 0, 0]} report={{ outcome: 'dead', deposit: zero, overflow: zero, readyAt: null,
      readyReason: 'repair', xp: { earned: 60, kept: 24, banked: 24 } }} />).container;
    expect(lost.querySelector('.ss-xp small')?.textContent).toBe(c.xpKept(60));
  });

  it('reads the gauges against the ship\'s level', () => {
    const world = createSandboxWorld({ bots: 0, ship: 'muhafiz' });
    world.pilot.level = 12; world.pilot.cargo = 10; world.pilot.hold = [10, 0, 0];
    const store = createHudStore(); store.publish(world, 'flight', false, false);
    const view = render(<ArenaHud store={store} bind={bind} layout={ARENA_LAYOUT} onMenu={() => undefined} connection={null} />).container;
    expect(view.querySelector('.ah-hold strong')?.textContent).toBe(`10/${String(shipStats('muhafiz', 12).cargoCapacity)}`);
  });
});
