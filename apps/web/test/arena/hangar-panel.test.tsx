import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_STATS, remainingFlightSeconds, shipStats, shipTuning, type ShipClass } from '@astera/rules/arena';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import type { Hangar } from '../../src/arena/hangarDesk.js';

// The 3D stage is its own chunk; here it only says which ship it was asked to show.
vi.mock('../../src/arena/hangar/HangarStage.js', () => ({
  default: ({ ship, pulse }: { ship: ShipClass; pulse: number }) => <div data-testid="stage" data-ship={ship} data-pulse={pulse} />,
}));
const { HangarPanel, entryFacts, hangarCta } = await import('../../src/arena/hangar/HangarPanel.js');
const { AbilitiesBlock, CapBlock, ClassBlock, GrowthBlock, LevelBlock, LoadoutBlock, RulesBlock } = await import('../../src/arena/hangar/ShipDesk.js');
// The panel lazy-loads its team claims; a cold transform of that graph outlasts findBy's one second.
await import('../../src/arena/TeamPanel.js');

/**
 * The hangar (owner 2026-10-23): every ship chore lives in the Komutan gemisi tab, around the ship
 * itself standing in a 3D hangar. The first choice, the level, the repair clock and what the capital
 * can still take are read and done here; the Yarık's own screen keeps only the tactic and the zone.
 */
let previous = 'en';
beforeEach(async () => { previous = i18n.language; await i18n.changeLanguage('tr'); c = arenaCopy(); });
afterEach(async () => { await i18n.changeLanguage(previous); vi.unstubAllGlobals(); vi.useRealTimers(); });

const NOW = Date.parse('2026-10-23T12:00:00Z');
const hangar = (patch: Partial<Hangar> = {}, ship: Partial<NonNullable<Hangar['ship']>> | null = {}): Hangar => ({
  core: 11, minCore: 9,
  ship: ship === null ? null : { class: 'muhafiz', changeUntil: null, fuel: CLASS_STATS.muhafiz.fuelTank, ammo: CLASS_STATS.muhafiz.ammoCapacity,
    hold: [0, 0, 0], readyAt: null, readyReason: null, flying: false, away: null, homeAt: null,
    level: 3, xp: 150, xpNext: 150, levelCap: 11, abilities: {}, upgrade: { alloy: 450, crystal: 225, deuterium: 0 }, plan: { fuel: 100, ammo: 100 }, ...ship },
  refill: { fuel: 20, ammo: 3, total: 23 }, deuterium: 140, alloy: 5000, crystal: 2000,
  cap: { alloy: 5664, crystal: 2832, deuterium: 76 }, sent: { alloy: 664, crystal: 0, deuterium: 80 },
  resetsAt: '2026-10-24T00:00:00.000Z', entryClosesAt: '2026-11-01T00:00:00.000Z', ...patch,
});
const json = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
let c = arenaCopy();

/** A desk that answers `answers` in turn for each route, and records what was asked. */
function desk(routes: Record<string, unknown[]>) {
  const calls: { url: string; body: unknown }[] = [];
  const fetcher = vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const key = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: key, body: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined });
    const next = routes[key]?.shift();
    return next === undefined ? json(500, {}) : json(next instanceof Error ? 409 : 200, next instanceof Error ? { error: next.message } : next);
  });
  vi.stubGlobal('fetch', fetcher);
  return calls;
}
const el = (selector: string): HTMLElement => {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`no ${selector}`);
  return node;
};
const open = (onEnter = vi.fn()) => render(<HangarPanel credential={() => Promise.resolve('tok')} onEnter={onEnter} />);
/** A hold, as a keyboard gives it: Enter arms, Enter confirms (`HoldButton`). */
const hold = (button: HTMLElement): void => { fireEvent.keyDown(button, { key: 'Enter' }); fireEvent.keyDown(button, { key: 'Enter' }); };

describe('the hangar\'s way into the Yarık', () => {
  it('offers the flight with what filling the ship takes, when it may fly', () => {
    expect(hangarCta(hangar(), NOW, c)).toEqual({ line: c.enter(23), note: c.refillNote(20, 3, '140'), ready: true });
  });

  it('keeps practice open while the ship cannot fly, and says why', () => {
    const repair = hangar({}, { readyAt: new Date(NOW + 598_000).toISOString(), readyReason: 'repair' });
    expect(hangarCta(repair, NOW, c)).toEqual({ line: c.enter(0), note: `${c.repairing} · 9:58 · ${c.practiceOnly}`, ready: false });
    expect(hangarCta(hangar({}, null), NOW, c)).toEqual({ line: c.enter(0), note: `${c.blocked.ship} · ${c.practiceOnly}`, ready: false });
    // A hangar that did not answer still lets the pilot practise.
    expect(hangarCta(null, NOW, c)).toEqual({ line: c.enter(0), note: c.practiceOnly, ready: false });
  });
});

describe('a ship still in the air (F22)', () => {
  it('offers the way back to it while the room still holds it, and practice otherwise', () => {
    const away = hangar({ live: { pilots: 3, yours: true } }, { flying: true });
    expect(hangarCta(away, NOW, c)).toEqual({ line: c.resumeFlight, note: c.resumeNote, ready: true });
    expect(hangarCta(hangar({ live: { pilots: 3, yours: false } }, { flying: true }), NOW, c).ready).toBe(false);
  });
});

describe('the facts beside the way in (plan 14 §13: is it worth going in)', () => {
  it('names how many pilots fly the Yarık now and how long a full tank lasts at full throttle', () => {
    const tuning = shipTuning('muhafiz', 3);
    const minutes = Math.floor(remainingFlightSeconds(tuning.fuelTank, 1, false, tuning) / 60);
    expect(entryFacts(hangar({ live: { pilots: 4, yours: false } }), c)).toBe(`${c.livePilots(4)} · ${c.fullThrottle(minutes)}`);
    expect(entryFacts(hangar({ live: { pilots: 0, yours: false } }), c)).toBe(`${c.livePilots(0)} · ${c.fullThrottle(minutes)}`);
  });
  // Owner 2026-10-27: the flight time is the tank the launch puts aboard, not a full one.
  it('times the flight on the planned tank', () => {
    const tuning = shipTuning('muhafiz', 3);
    const minutes = Math.floor(remainingFlightSeconds(tuning.fuelTank / 2, 1, false, tuning) / 60);
    expect(entryFacts(hangar({}, { fuel: 0, plan: { fuel: 50, ammo: 100 } }), c)).toBe(c.fullThrottle(minutes));
  });
  it('keeps the tank line when the room did not say who flies, and says nothing without a ship', () => {
    const tuning = shipTuning('akinci', 1);
    const minutes = Math.floor(remainingFlightSeconds(tuning.fuelTank, 1, false, tuning) / 60);
    expect(entryFacts(hangar({}, { class: 'akinci', level: 1 }), c)).toBe(c.fullThrottle(minutes));
    expect(entryFacts(hangar({}, null), c)).toBeNull();
  });
  it('shows them above the way in', async () => {
    desk({ '/arena/hangar': [hangar({ live: { pilots: 3, yours: false } })] });
    open();
    expect(await screen.findByText(new RegExp(c.livePilots(3)))).toBeVisible();
  });
});

/** The panel's own sections (owner 2026-10-27: Progress · Abilities · Launch, one at a time). */
const section = (name: string): void => { fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) })); };

describe('the hangar panel', () => {
  it('refreshes capital stock after claiming team loot so an affordable upgrade becomes available immediately', async () => {
    const id = '00000000-0000-4000-8000-000000000001'; const share = { alloy: 100, crystal: 0, deuterium: 0 };
    const view = { playerId: id, clanId: null, canCreate: false, capacity: 5, team: null,
      claims: [{ teamId: id, share, finishedAt: '2026-10-24T12:00:00Z', autoAt: '2026-10-31T12:00:00Z' }] };
    desk({ '/arena/hangar': [hangar({ alloy: 400 }), hangar({ alloy: 500 })], '/arena/team': [view],
      '/arena/team/claim': [{ ...view, claims: [], receipt: { deposit: share, overflow: { alloy: 0, crystal: 0, deuterium: 0 } } }] });
    open();
    const claim = await screen.findByRole('button', { name: 'Payımı al' });
    expect(el('[data-hp-level]')).toBeDisabled(); fireEvent.click(claim);
    await waitFor(() => { expect(el('[data-hp-level]')).toBeEnabled(); });
  });

  it('keeps the ship\'s chores in three sections, one at a time, with a mark where a point waits', async () => {
    desk({ '/arena/hangar': [hangar({}, { level: 3, abilities: {} })] });
    open();
    const tabs = await screen.findByRole('tablist', { name: c.deskTabs });
    expect([...tabs.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual([c.tabGrow, expect.stringContaining(c.tabSkills), c.tabLaunch]);
    expect(document.querySelector('[data-part="level"]')).not.toBeNull();
    expect(document.querySelector('[data-part="abilities"]')).toBeNull();
    section(c.tabSkills);
    expect(document.querySelector('[data-part="abilities"]')).not.toBeNull();
    expect(document.querySelector('[data-part="level"]')).toBeNull();
    section(c.tabLaunch);
    expect(document.querySelector('[data-part="loadout"]')).not.toBeNull();
    expect(document.querySelector('[data-part="cap"]')).not.toBeNull();
  });

  it('spends a point on smoke alone, after a tap that shows what it buys and a hold that spends it', async () => {
    const first = hangar({}, { class: 'kilavuz', level: 3, abilities: {} });
    const after = hangar({}, { class: 'kilavuz', level: 3, abilities: { smoke: 1 } });
    const calls = desk({ '/arena/hangar': [first], '/arena/ability': [after] });
    open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    section(c.tabSkills);
    expect(el('[data-ability="radar"]').textContent).toContain('2/3');
    fireEvent.click(el('[data-ability="smoke"]'));
    expect(calls.some(call => call.url === '/arena/ability')).toBe(false);
    expect(el('[data-part="ability-detail"]').textContent).toContain('1,5 → 1,7');
    const confirm = el('[data-ability-confirm]');
    expect(confirm.textContent).toContain(c.abilityConfirm('Duman', 2));
    hold(confirm);
    await waitFor(() => { expect(calls.find(call => call.url === '/arena/ability')?.body).toEqual({ ability: 'smoke' }); });
    await waitFor(() => { expect(el('[data-ability="smoke"]').textContent).toContain('2/3'); });
    expect(el('[data-part="abilities"]').textContent).not.toContain('/5');
    expect(el('[data-part="abilities"]').textContent).toContain(c.pointsReady(1));
  });

  it('shows what an ability would buy without points, and says when the next point comes', async () => {
    desk({ '/arena/hangar': [hangar({}, { level: 1, abilities: {} })] });
    open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    section(c.tabSkills);
    fireEvent.click(el('[data-ability="smoke"]'));
    expect(el('[data-ability-confirm]')).toBeDisabled();
    expect(el('[data-ability-confirm]').textContent).toBe(c.pointAt(2));
  });

  it('keeps a flying ship\'s abilities as they are', async () => {
    desk({ '/arena/hangar': [hangar({}, { level: 5, abilities: {}, flying: true })] });
    open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    section(c.tabSkills);
    fireEvent.click(el('[data-ability="smoke"]'));
    expect(el('[data-ability-confirm]')).toBeDisabled();
    expect(el('[data-ability-confirm]').textContent).toBe(c.blocked.flying);
  });

  it('locks rank four behind Essence, counting the class affinity, and leaves other abilities open', async () => {
    const calls = desk({ '/arena/hangar': [hangar({}, { class: 'kilavuz', level: 10, abilities: { smoke: 2, radar: 1 } })] });
    open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    section(c.tabSkills);
    expect(el('[data-ability="smoke"]').textContent).toContain('3/3');
    fireEvent.click(el('[data-ability="smoke"]'));
    expect(el('[data-ability-confirm]')).toBeDisabled();
    expect(el('[data-part="ability-detail"]').textContent).toContain(c.abilityEssence);
    expect(el('[data-part="ability-detail"]').textContent).not.toContain('→');
    fireEvent.click(el('[data-ability="cloak"]'));
    expect(el('[data-ability-confirm]')).toBeEnabled();
    expect(calls.some(call => call.url === '/arena/ability')).toBe(false);
  });

  it('shows the repair wait and price, buys it with a hold once, then keeps only the shorter clock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    const full = hangar({}, { level: 1, readyReason: 'repair', readyAt: new Date(NOW + 60 * 60_000).toISOString() });
    const paid = hangar({ alloy: 4825, crystal: 1940 }, { level: 1, readyReason: 'repair', readyAt: new Date(NOW + 15 * 60_000).toISOString() });
    const calls = desk({ '/arena/hangar': [full], '/arena/repair': [paid] });
    open();
    const buy = await waitFor(() => el('[data-hp-repair]'));
    expect(buy.textContent).toContain(c.repairFaster(15));
    const part = el('[data-part="repair"]');
    expect(part.textContent).toContain('175');
    expect(part.textContent).toContain('60');
    expect(part.textContent).toContain('Ücretsiz');
    fireEvent.click(buy);
    expect(calls.some(call => call.url === '/arena/repair')).toBe(false);
    hold(buy);
    await waitFor(() => { expect(document.querySelector('[data-hp-repair]')).toBeNull(); });
    expect(calls.filter(call => call.url === '/arena/repair')).toHaveLength(1);
    expect(el('[data-status]').textContent).toContain('15:00');
    expect(el('[data-status]').textContent).toContain(c.repairing);
  });

  it('shows an unaffordable repair without enabling payment', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    desk({ '/arena/hangar': [hangar({ alloy: 174 }, { level: 1, readyReason: 'repair', readyAt: new Date(NOW + 60 * 60_000).toISOString() })] });
    open();
    const buy = await waitFor(() => el('[data-hp-repair]'));
    expect(buy).toBeDisabled();
    expect(buy.textContent).toBe(c.capitalShort);
  });

  it('reads the hangar with the session and stands the owned ship in it, with its name, role, level and state', async () => {
    const calls = desk({ '/arena/hangar': [hangar()] });
    const enter = vi.fn();
    open(enter);
    await waitFor(() => { expect(screen.getByTestId('stage').dataset.ship).toBe('muhafiz'); });
    expect(calls[0]?.url).toBe('/arena/hangar');
    const plate = el('.hp-plate');
    expect(plate.textContent).toContain(c.classes.muhafiz.name);
    expect(plate.textContent).toContain(c.classes.muhafiz.role);
    expect(plate.textContent).toContain(c.level(3));
    await waitFor(() => { expect(el('[data-status]').dataset.status).toBe('ready'); });
    expect(el('[data-status]').textContent).toBe(c.ready);
    // The class is set for the season: no class tabs, only a way to compare.
    expect(screen.queryByRole('tablist', { name: c.shipTitle })).toBeNull();
    expect(screen.getByRole('button', { name: c.compareClasses })).toBeTruthy();
    const cta = screen.getByTestId('hangar-enter');
    expect(cta.textContent).toContain(c.enter(23));
    fireEvent.click(cta);
    expect(enter).toHaveBeenCalledOnce();
  });

  it('compares the classes on a locked ship and goes back without changing anything', async () => {
    const calls = desk({ '/arena/hangar': [hangar()] });
    open();
    fireEvent.click(await screen.findByRole('button', { name: c.compareClasses }));
    expect(el('[data-part="compare"]').textContent).toContain(c.classes.akinci.name);
    fireEvent.click(screen.getByRole('tab', { name: c.classes.akinci.name }));
    expect(screen.getByTestId('stage').dataset.ship).toBe('akinci');
    expect(document.querySelector('[data-hp-change]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: c.backToShip }));
    expect(screen.getByTestId('stage').dataset.ship).toBe('muhafiz');
    expect(screen.getByTestId('hangar-enter')).toBeTruthy();
    expect(calls.some(call => call.url === '/arena/ship')).toBe(false);
  });

  it('shows each class in the hangar before the first choice, and claims the one shown', async () => {
    const calls = desk({ '/arena/hangar': [hangar({}, null)], '/arena/ship': [hangar({}, { class: 'akinci' })] });
    open();
    await waitFor(() => { expect(screen.getByText(c.chooseTitle)).toBeTruthy(); });
    expect((await screen.findByTestId('stage')).dataset.ship).toBe('kilavuz');
    // Each class wears its icon on its tab, and the hangar takes the class's colour (the HUD's A key).
    const classes = screen.getByRole('tablist', { name: c.shipTitle });
    for (const tab of classes.querySelectorAll('[role="tab"]')) expect(tab.querySelector('svg')).not.toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: c.classes.akinci.name }));
    expect(screen.getByTestId('stage').dataset.ship).toBe('akinci');
    expect(el('.hangar-root').dataset.ship).toBe('akinci');
    expect(screen.queryByTestId('hangar-enter')).toBeNull();
    expect(screen.queryByRole('tablist', { name: c.deskTabs })).toBeNull();
    const choose = el('[data-hp-choose]');
    expect(choose.textContent).toContain(c.choose(c.classes.akinci.name));
    fireEvent.click(choose);
    expect(calls.some(call => call.url === '/arena/ship')).toBe(false);
    hold(choose);
    await waitFor(() => { expect(document.querySelector('[data-part="level"]')).not.toBeNull(); });
    expect(calls.find(call => call.url === '/arena/ship')?.body).toEqual({ ship: 'akinci' });
    expect(screen.getByTestId('stage').dataset.ship).toBe('akinci');
  });

  it('opens the classes again while the free change lasts, and spends it on the class shown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    const calls = desk({ '/arena/hangar': [hangar({}, { changeUntil: '2026-10-24T08:00:00.000Z' })], '/arena/ship': [hangar({}, { class: 'akinci', changeUntil: null })] });
    open();
    const change = await screen.findByRole('button', { name: new RegExp(c.changeClass) });
    expect(change.textContent).toContain(`20 ${c.hours}`);
    fireEvent.click(change);
    expect(screen.getByRole('tablist', { name: c.shipTitle })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: c.classes.akinci.name }));
    // F7: a class tried on is a preview, never the ship that flies: no level, no state, no way in, no desk for it.
    expect(screen.getByTestId('stage').dataset.ship).toBe('akinci');
    expect(el('.hp-plate').textContent).toContain(c.preview);
    expect(el('.hp-plate').textContent).not.toContain(c.level(3));
    expect(document.querySelector('[data-status]')).toBeNull();
    expect(screen.queryByTestId('hangar-enter')).toBeNull();
    expect(document.querySelector('[data-part="level"]')).toBeNull();
    expect(el('[data-part="class"]').textContent).toContain(c.changeNote);
    fireEvent.click(screen.getByRole('button', { name: c.cancelPreview }));
    expect(screen.getByTestId('stage').dataset.ship).toBe('muhafiz');
    expect(screen.getByTestId('hangar-enter')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(c.changeClass) }));
    fireEvent.click(screen.getByRole('tab', { name: c.classes.akinci.name }));
    const commit = el('[data-hp-change]');
    expect(commit.textContent).toContain(c.changeTo(c.classes.akinci.name));
    fireEvent.click(commit);
    expect(calls.some(call => call.url === '/arena/ship')).toBe(false);
    hold(commit);
    await waitFor(() => { expect(screen.queryByRole('tablist', { name: c.shipTitle })).toBeNull(); });
    expect(calls.find(call => call.url === '/arena/ship')?.body).toEqual({ ship: 'akinci' });
  });

  it('buys the next level with a hold on a full bar, and the hangar answers it on the ship', async () => {
    const calls = desk({ '/arena/hangar': [hangar()], '/arena/upgrade': [hangar({ alloy: 4550, crystal: 1775 }, { level: 4, xp: 0, xpNext: 200 })] });
    open();
    const up = await waitFor(() => el('[data-hp-level]'));
    expect((await screen.findByTestId('stage')).dataset.pulse).toBe('0');
    fireEvent.click(up);
    expect(calls.some(call => call.url === '/arena/upgrade')).toBe(false);
    hold(up);
    await waitFor(() => { expect(el('.hp-plate').textContent).toContain(c.level(4)); });
    expect(calls.filter(call => call.url === '/arena/upgrade')).toHaveLength(1);
    expect(screen.getByTestId('stage').dataset.pulse).toBe('1');
  });

  /** F17: a level bought was a silent number change, and the resource bar paid it ten seconds later. */
  it('marks a level bought with what it gave, and has the capital\'s stock read again at once', async () => {
    desk({ '/arena/hangar': [hangar()], '/arena/upgrade': [hangar({ alloy: 4550, crystal: 1775 }, { level: 4, xp: 0, xpNext: 200 })] });
    const spent = vi.fn();
    render(<HangarPanel credential={() => Promise.resolve('tok')} onEnter={vi.fn()} onSpent={spent} />);
    hold(await waitFor(() => el('[data-hp-level]')));
    const moment = await waitFor(() => el('[data-part="level-up"]'));
    expect(moment.textContent).toContain(c.levelUp(4));
    expect(moment.textContent).toContain(c.classStats.hull);
    expect(spent).toHaveBeenCalledOnce();
  });

  it('sets the launch plan from the gauges and shows what it costs', async () => {
    const planned = hangar({ refill: { fuel: 0, ammo: 0, total: 0 } }, { plan: { fuel: 50, ammo: 100 } });
    const calls = desk({ '/arena/hangar': [hangar({}, { fuel: 0 })], '/arena/loadout': [planned] });
    open();
    await screen.findByRole('tablist', { name: c.deskTabs });
    section(c.tabLaunch);
    const loadout = el('[data-part="loadout"]');
    expect(loadout.textContent).toContain(c.aboard(0, Math.round(shipStats('muhafiz', 3).fuelTank)));
    expect(loadout.textContent).toContain(c.topUp(20));
    expect(screen.getByRole('radio', { name: c.planSet(c.fuelTitle, 100) })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: c.planSet(c.fuelTitle, 50) }));
    await waitFor(() => { expect(calls.find(call => call.url === '/arena/loadout')?.body).toEqual({ fuel: 50, ammo: 100 }); });
    await waitFor(() => { expect(screen.getByRole('radio', { name: c.planSet(c.fuelTitle, 50) })).toBeChecked(); });
    expect(screen.getByTestId('hangar-enter').textContent).toContain(c.enter(0));
  });

  /** CR8: a hangar left open across UTC midnight kept yesterday's full transfer cap and its stale warning. */
  it('reads the hangar again once the daily cap resets, without a tap', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse('2026-10-23T23:59:58Z') });
    const full = { alloy: 9000, crystal: 9000, deuterium: 9000 };
    const calls = desk({ '/arena/hangar': [hangar({ cap: full, sent: full, resetsAt: '2026-10-24T00:00:00.000Z' }),
      hangar({ cap: full, sent: { alloy: 0, crystal: 0, deuterium: 0 }, resetsAt: '2026-10-25T00:00:00.000Z' })] });
    open();
    await waitFor(() => { expect(calls.filter(call => call.url === '/arena/hangar')).toHaveLength(1); });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    await waitFor(() => { expect(calls.filter(call => call.url === '/arena/hangar')).toHaveLength(2); });
  });

  it('runs the repair clock on the ship and still lets the pilot in for practice', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    desk({ '/arena/hangar': [hangar({}, { readyAt: new Date(NOW + 10_000).toISOString(), readyReason: 'repair' })] });
    const enter = vi.fn();
    open(enter);
    await waitFor(() => { expect(screen.getByTestId('hangar-enter').textContent).toContain(c.practiceOnly); });
    expect(el('[data-status]').dataset.status).toBe('repair');
    expect(el('[data-status]').textContent).toContain(`${c.repairing} · 0:10`);
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
    expect(screen.getByTestId('hangar-enter').textContent).toContain(c.enter(23));
    expect(el('[data-status]').dataset.status).toBe('ready');
    fireEvent.click(screen.getByTestId('hangar-enter'));
    expect(enter).toHaveBeenCalledOnce();
  });

  it('says when the hangar refuses, without alarm, and still opens the Yarık for practice', async () => {
    desk({ '/arena/hangar': [new Error('NO_PLANET')] });
    const enter = vi.fn();
    open(enter);
    await waitFor(() => { expect(screen.getByRole('alert').textContent).toBe(c.kicks.NO_PLANET ?? c.hangarError); });
    // Red is for what can harm the player (ui-v2 K2); a desk that did not answer is not that.
    expect(screen.getByRole('alert').className).not.toMatch(/hostile|red/);
    fireEvent.click(screen.getByTestId('hangar-enter'));
    expect(enter).toHaveBeenCalledOnce();
  });
});

describe('the ship\'s desk', () => {
  const level = (h: Hangar, onUpgrade = () => undefined) => render(<LevelBlock c={c} hangar={h} busy={false} onUpgrade={onUpgrade} />).container;

  it('reads the level and the bar against the next level, how XP comes, and how much is left', () => {
    const view = level(hangar({}, { xp: 40 }));
    expect(view.textContent).toContain(c.level(3));
    expect(view.textContent).toContain(c.level(4));
    expect(view.textContent).toContain(c.xpBar(40, 150));
    expect(view.textContent).toContain(c.xpHow);
    expect(el('[data-part="level"] [data-bar]').style.width).toBe(`${String(40 / 150 * 100)}%`);
    expect(el('[data-hp-level]')).toBeDisabled();
    expect(el('[data-hp-level]').textContent).toBe(c.xpToGo(110));
  });

  it('offers the next level on a full bar as a hold, with its price against the capital', () => {
    const bought = vi.fn();
    const view = level(hangar(), bought);
    const button = el('[data-hp-level]');
    expect(button).toBeEnabled();
    expect(button.textContent).toContain(c.upgradeTo(4));
    expect(view.textContent).toContain('450');
    fireEvent.click(button);
    expect(bought).not.toHaveBeenCalled();
    hold(button);
    expect(bought).toHaveBeenCalledOnce();
  });

  it('marks the part a capital cannot pay, and does nothing', () => {
    const view = level(hangar({ crystal: 100 }));
    expect(el('[data-hp-level]')).toBeDisabled();
    expect(el('[data-hp-level]').textContent).toBe(c.capitalShort);
    const short = [...view.querySelectorAll('.text-v2-warn')];
    expect(short.map(node => node.textContent)).toEqual(['225']);
  });

  it('names the Komuta Çekirdeği when the ship has reached it, and the top at 20', () => {
    const capped = level(hangar({}, { level: 11, xp: 0, xpNext: 550 }));
    expect(capped.textContent).toContain(c.levelCapLine(11));
    expect(capped.querySelector('[data-hp-level]')).toBeNull();
    expect(level(hangar({ core: 22 }, { level: 20, xp: 0, xpNext: 0, levelCap: 20 })).textContent).toContain(c.topLevel);
  });

  it('draws each figure with what the next level adds on the same bar, and says which part that is', () => {
    const view = render(<GrowthBlock c={c} ship="muhafiz" level={3} />).container;
    const hull = el('[data-stat="hull"]');
    expect(hull.querySelector('[data-now]')).not.toBeNull();
    expect(hull.querySelector('[data-next]')).not.toBeNull();
    expect(hull.textContent).toMatch(/\+\d/);
    expect(view.textContent).toContain(c.growthKey(4));
    // No marks for the other classes here: comparing classes is its own table.
    expect(view.querySelector('[data-other]')).toBeNull();
    expect(view.querySelectorAll('[data-stat] svg')).toHaveLength(8);
  });

  it('reads today\'s room per resource, and when it fills again', () => {
    const view = render(<CapBlock c={c} hangar={hangar()} />).container;
    const room = [...view.querySelectorAll('li')].map(li => li.textContent);
    // Thousands go in narrow no-break spaces, so a figure never wraps on a phone.
    expect(room).toEqual([expect.stringContaining('5 000'), expect.stringContaining('2 832'), expect.stringContaining(c.capFull)]);
    expect(view.textContent).toContain(c.capTitle);
    expect(view.textContent).toContain(c.capResets);
  });

  it('opens one tap deeper onto the rules', () => {
    const view = render(<RulesBlock c={c} />).container;
    const toggle = view.querySelector('button[aria-expanded]');
    expect(view.querySelector('ul')).toBeNull();
    if (!toggle) throw new Error('no rules button');
    fireEvent.click(toggle);
    const rules = view.querySelector('ul')?.textContent ?? '';
    // Owner 2026-10-28: repair and maintenance are 3 min for now.
    for (const fact of ['Tamir 3 dk', '3 dk bakımda', '4', '24', '500 m']) expect(rules).toContain(fact);
  });

  it('compares the classes at the ship\'s own level in one table, the best of each row marked', () => {
    const view = render(<ClassBlock c={c} value="akinci" level={20} />).container;
    const speed = [...view.querySelectorAll('[data-stat="speed"] td')];
    expect(speed.map(cell => cell.textContent)).toEqual(['120 m/s', '72 m/s', '97 m/s']);
    expect(speed.map(cell => cell.hasAttribute('data-best'))).toEqual([true, false, false]);
    expect(view.querySelector('[data-stat="hull"] td[data-best]')?.getAttribute('data-ship')).toBe('muhafiz');
    expect(view.textContent).toContain(c.compareKey);
    expect(view.textContent).toContain(c.signatures.akinci.name);
  });

  it('describes the signature with its purchased power, rather than the old level-one value', () => {
    const view = render(<ClassBlock c={c} value="kilavuz" level={3} points={{ signature: 2 }} />).container;
    expect(view.querySelector('.hp-sig')?.textContent).toContain('144');
    expect(view.querySelector('.hp-sig')?.textContent).not.toContain('120');
  });

  it('offers the tank in quarters and the magazine from empty, priced and named', () => {
    const set = vi.fn();
    render(<LoadoutBlock c={c} hangar={hangar({ refill: { fuel: 25, ammo: 0, total: 25 } }, { fuel: 0, plan: { fuel: 50, ammo: 0 } })} busy={false} onPlan={set} />);
    expect(screen.getAllByRole('radio', { name: new RegExp(c.fuelTitle) })).toHaveLength(4);
    expect(screen.getAllByRole('radio', { name: new RegExp(c.ammoTitle) })).toHaveLength(5);
    expect(screen.getByRole('radio', { name: c.planSet(c.ammoTitle, 0) })).toBeChecked();
    expect(el('[data-part="loadout"]').textContent).toContain(c.ammoNoneNote);
    expect(el('[data-part="loadout"]').textContent).toContain(c.topUp(25));
    fireEvent.click(screen.getByRole('radio', { name: c.planSet(c.ammoTitle, 75) }));
    expect(set).toHaveBeenCalledWith({ fuel: 50, ammo: 75 });
  });

  /** Review 2026-10-27: 273 of 284 aboard (96 %) drew its last quarter empty, so the gauge read 75 %. */
  it('draws a quarter aboard once more than half of it is', () => {
    const tank = Math.round(shipStats('muhafiz', 3).fuelTank);
    render(<LoadoutBlock c={c} hangar={hangar({}, { fuel: tank * 0.96, plan: { fuel: 50, ammo: 100 } })} busy={false} onPlan={vi.fn()} />);
    const cells = [...document.querySelectorAll('[data-gauge="fuel"] [role="radio"]')];
    expect(cells.map(cell => cell.classList.contains('is-aboard'))).toEqual([true, true, true, true]);
  });

  it('lists the abilities with their ranks, and the points ready', () => {
    render(<AbilitiesBlock c={c} hangar={hangar({}, { class: 'kilavuz', level: 3, abilities: { smoke: 1 } })} busy={false} onSpend={vi.fn()} />);
    expect(el('[data-part="abilities"]').textContent).toContain(c.pointsReady(1));
    expect(document.querySelectorAll('[data-ability]')).toHaveLength(6);
    expect(el('[data-ability="smoke"]').textContent).toContain('2/3');
  });
});

describe('skins deferred, ship logic retained', () => {
  it('keeps ship progression and repair while omitting cosmetic controls', async () => {
    desk({ '/arena/hangar': [hangar()] }); open();
    await screen.findByTestId('stage');
    await waitFor(() => { expect(document.querySelector('[data-part="level"]')).not.toBeNull(); });
    expect(screen.queryByTestId('appearance-block')).not.toBeInTheDocument();
  });
});
