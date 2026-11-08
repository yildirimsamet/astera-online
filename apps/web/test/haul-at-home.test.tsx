import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsteroidFocus, DebrisFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import { haulAtHome, type HaulHome } from '../src/lib/collect.js';
import { planetView } from './fixtures.js';

/**
 * THE ROOM A HAUL COMES HOME TO (plan F5, N5). A haul lands in the works, each resource against its
 * own ceiling, and whatever finds no room is lost. The works keep filling while the craft are out,
 * so the room that matters is the room at the moment they land, three legs' worth later (the way home
 * is flown laden, at half speed): said before the craft go, with the one fix that helps.
 */
const HOUR = 3_600_000;
const at = 1_800_000_000_000;
const works = (stock: Parameters<typeof planetView>[1]) => planetView({}, {
  bufferAlloy: 100, bufferAlloyCap: 1000, alloyPerHour: 600,
  bufferCrystal: 0, bufferCrystalCap: 500, crystalPerHour: 0,
  bufferDeuterium: 0, bufferDeuteriumCap: 200, deuteriumPerHour: 0,
  snapshotAt: new Date(at),
  ...stock,
}).planet;
const nothing = { alloy: 0, crystal: 0, deuterium: 0 };

describe('the room a haul comes home to', () => {
  it('counts what the works make while the craft are out and back', () => {
    // Ten minutes out, twenty home: thirty minutes at 600/h fill 300 more of the alloy vessel.
    expect(haulAtHome(works({}), at, at, { ...nothing, alloy: 500 }, 10)).toEqual({ room: 600, lost: nothing });
    expect(haulAtHome(works({}), at, at, { ...nothing, alloy: 700 }, 10)).toEqual({ room: 600, lost: { ...nothing, alloy: 100 } });
  });

  it('stops each resource at its own ceiling, and counts only the room the haul can use', () => {
    // Plenty of alloy room is no help to crystal that finds its vessel nearly full.
    const home = haulAtHome(works({ bufferCrystal: 450 }), at, at, { alloy: 100, crystal: 200, deuterium: 0 }, 10);
    expect(home).toEqual({ room: 650, lost: { ...nothing, crystal: 150 } });
  });

  it('loses the whole haul to a full works', () => {
    expect(haulAtHome(works({ bufferAlloy: 1000 }), at, at, { ...nothing, alloy: 300 }, 5)).toEqual({ room: 0, lost: { ...nothing, alloy: 300 } });
  });

  it('keeps a works without a plant where it is: no production, the same room', () => {
    expect(haulAtHome(works({ bufferDeuterium: 50 }), at, at, { ...nothing, deuterium: 200 }, 30)).toEqual({ room: 150, lost: { ...nothing, deuterium: 50 } });
  });

  it('reads the works as they will be, not as they were last fetched', () => {
    // Fetched an hour ago: 600 already in the alloy vessel before the craft leave.
    expect(haulAtHome(works({}), at, at + HOUR, { ...nothing, alloy: 400 }, 10)).toEqual({ room: 0, lost: { ...nothing, alloy: 400 } });
  });
});

const ROCK = {
  id: 'mJtQH0vR5cP8sN2xK7dL4A', level: 1, ore: 600, oreRemaining: 600, crystalShare: 0.4, radius: 400, period: 30, phase: 0.2,
  inclination: Math.PI / 3, ascendingNode: Math.PI / 4, speed: 9.2, appearsAt: 0, expiresAt: 999, active: true, isotopeRich: false, deuteriumShare: null,
};
const FIELD = { id: 'f1', alloy: 300, crystal: 100, deuterium: 0, minutesLeft: 120 };
const shell = { onClose: vi.fn(), busy: false, open: true, onToggle: vi.fn(), craftReadyAt: null, run: undefined, onSend: vi.fn() };

const rock = (atHome: (haul: { alloy: number; crystal: number; deuterium: number }) => HaulHome | null, onCollect?: () => void, storeFull = false) => render(
  <AsteroidFocus rock={ROCK} isotopeAccess={false} craftAvailable={1} craftHold={200} derrick={false} derrickHold={500}
    minutesLeft={400} reachMinutes={4} atHome={atHome} {...(onCollect ? { onCollect } : {})} storeFull={storeFull} {...shell} />,
);

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(() => { cleanup(); });

describe('the room, on the rock before the craft go', () => {
  it('splits the haul as the rock is made, and says it all fits', () => {
    const atHome = vi.fn(() => ({ room: 900, lost: nothing }));
    rock(atHome);
    expect(atHome).toHaveBeenCalledWith({ alloy: 120, crystal: 80, deuterium: 0 });
    expect(screen.getByTestId('haul-home').textContent).toMatch(/900 room in the works when they are home: the whole haul fits/i);
  });

  it('says what will be lost, and offers to collect first', () => {
    const onCollect = vi.fn();
    rock(() => ({ room: 50, lost: { alloy: 100, crystal: 50, deuterium: 0 } }), onCollect);
    const line = screen.getByTestId('haul-home');
    expect(line.getAttribute('data-lost')).toBe('true');
    // Named by resource: a full crystal store loses crystal however much alloy room there is.
    expect(line.textContent).toMatch(/only 50 room.*100 alloy and 50 crystal will not fit and are lost/i);
    fireEvent.click(screen.getByRole('button', { name: /collect first/i }));
    expect(onCollect).toHaveBeenCalledOnce();
  });

  it('names a single resource it loses', () => {
    rock(() => ({ room: 3300, lost: { ...nothing, crystal: 63 } }));
    expect(screen.getByTestId('haul-home').textContent).toMatch(/63 crystal will not fit and is lost/i);
  });

  // Collecting into a full store moves nothing: the way out is to spend first.
  it('says the store is full when collecting cannot make room', () => {
    rock(() => ({ room: 0, lost: { ...nothing, alloy: 120 } }), undefined, true);
    expect(screen.queryByRole('button', { name: /collect first/i })).toBeNull();
    expect(screen.getByTestId('haul-home').textContent).toMatch(/store is full too: spend some first/i);
  });

  it('offers no collect when there is nothing to collect', () => {
    rock(() => ({ room: 50, lost: { ...nothing, crystal: 150 } }));
    expect(screen.queryByRole('button', { name: /collect first/i })).toBeNull();
  });

  it('says nothing while the flight is still unknown', () => {
    rock(() => null);
    expect(screen.queryByTestId('haul-home')).toBeNull();
  });
});

describe('the room, on a wreck before the craft go', () => {
  it('splits the haul as the wreck holds it', () => {
    const atHome = vi.fn(() => ({ room: 20, lost: { ...nothing, alloy: 180 } }));
    render(<DebrisFocus field={FIELD} planetName={undefined} craftAvailable={1} craftHold={200} reachMinutes={4} atHome={atHome} {...shell} />);
    expect(atHome).toHaveBeenCalledWith({ alloy: 150, crystal: 50, deuterium: 0 });
    expect(screen.getByTestId('haul-home').getAttribute('data-lost')).toBe('true');
  });
});
