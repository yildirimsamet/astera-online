import { act, cleanup, render, screen } from '@testing-library/react';
import { openingProgress, type VesselProgress } from '@astera/rules';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bayCondition, repairMoment } from '../src/starter/shipScreen.js';
import { ShipHero } from '../src/starter/ShipHero.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
const haptics = vi.hoisted(() => ({ haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', () => sound);
vi.mock('../src/lib/haptics.js', () => haptics);

/**
 * THREE WEIGHTS OF "IT IS FIXED" (plan F8). A routine repair answers at its own bay; a repair that opens
 * something leaves the sound to the card that names it; the engines take the whole ship. One event is
 * celebrated once.
 */
const base = openingProgress();
const ship = (modules: Record<string, number>): VesselProgress => ({ ...base, modules: { ...base.modules, ...modules } });
const road = { REFINERY: 2, EXTRACTOR: 1 };

describe('the weight of a repair', () => {
  it('is nothing when no repair came in', () => {
    expect(repairMoment(ship(road), ship(road))).toBeNull();
  });
  it('is routine when it only makes a machine better', () => {
    expect(repairMoment(ship({ REFINERY: 2 }), ship({ REFINERY: 3 }))).toEqual({ system: 'REFINERY', tier: 'routine' });
  });
  it('is a capability when it opens something new', () => {
    expect(repairMoment(ship(road), ship({ ...road, TELESCOPE: 1 }))).toEqual({ system: 'DEFENCE', tier: 'capability' });
  });
  it('is the big one when the engines are in', () => {
    expect(repairMoment(ship({ DRIVE_HULL: 1 }), ship({ DRIVE_HULL: 1, DRIVE_THRUST: 1 }))).toEqual({ system: 'DRIVE', tier: 'big' });
  });
  it('takes the heaviest of several that landed together', () => {
    expect(repairMoment(ship({ REFINERY: 2, DRIVE_HULL: 1 }), ship({ REFINERY: 3, DRIVE_HULL: 1, DRIVE_THRUST: 1 }))?.tier).toBe('big');
  });
});

describe('a bay\'s condition', () => {
  it('reads from that system alone', () => {
    expect(bayCondition(0)).toBe('dead');
    expect(bayCondition(40)).toBe('mending');
    expect(bayCondition(100)).toBe('whole');
  });
});

describe('the ship on screen', () => {
  const draw = (progress: VesselProgress) => <ShipHero id="ship-1" progress={progress} selected="REFINERY" onSelect={() => undefined} />;
  const moment = () => screen.getByTestId('ship-hero').getAttribute('data-moment');
  beforeEach(() => { vi.useFakeTimers(); sound.playSound.mockClear(); haptics.haptic.mockClear(); window.localStorage.clear(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('marks each bay with its own state', () => {
    render(draw(ship({ REFINERY: 2 })));
    expect(document.querySelector('[data-bay="DRIVE"]')?.getAttribute('data-condition')).toBe('dead');
    expect(document.querySelector('[data-bay="REFINERY"]')?.getAttribute('data-condition')).toBe('mending');
  });
  it('lights the engines once for a player who was away when they came in', () => {
    const lit = ship({ DRIVE_HULL: 1, DRIVE_THRUST: 1 });
    render(draw(lit));
    expect(moment()).toBe('big');
    expect(sound.playSound).toHaveBeenCalledTimes(1);
    expect(sound.playSound).toHaveBeenCalledWith('ignite');
    cleanup();
    render(draw(lit));
    expect(moment()).toBeNull();
    expect(sound.playSound).toHaveBeenCalledTimes(1);
  });
  it('does not light them again for a player who watched them come in', () => {
    const { rerender } = render(draw(ship({ DRIVE_HULL: 1 })));
    rerender(draw(ship({ DRIVE_HULL: 1, DRIVE_THRUST: 1 })));
    expect(moment()).toBe('big');
    cleanup();
    render(draw(ship({ DRIVE_HULL: 1, DRIVE_THRUST: 1 })));
    expect(moment()).toBeNull();
  });
  it('says nothing on opening a ship already repaired', () => {
    render(draw(ship({ REFINERY: 3 })));
    expect(moment()).toBeNull();
    expect(sound.playSound).not.toHaveBeenCalled();
  });
  it('answers a routine repair at its bay, once, and comes to rest', () => {
    const view = render(draw(ship({ REFINERY: 2 })));
    view.rerender(draw(ship({ REFINERY: 3 })));
    expect(moment()).toBe('routine');
    expect(document.querySelector('[data-bay="REFINERY"]')?.getAttribute('data-just')).not.toBeNull();
    expect(sound.playSound).toHaveBeenCalledTimes(1);
    view.rerender(draw({ ...ship({ REFINERY: 3 }) }));
    expect(sound.playSound).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(moment()).toBeNull();
  });
  it('leaves a new capability\'s sound to the card that announces it', () => {
    const view = render(draw(ship(road)));
    view.rerender(draw(ship({ ...road, TELESCOPE: 1 })));
    expect(moment()).toBe('capability');
    expect(sound.playSound).not.toHaveBeenCalled();
  });
  it('lights the engines with the whole ship', () => {
    const view = render(draw(ship({ DRIVE_HULL: 1 })));
    view.rerender(draw(ship({ DRIVE_HULL: 1, DRIVE_THRUST: 1 })));
    expect(moment()).toBe('big');
    expect(sound.playSound).toHaveBeenCalledWith('ignite');
    expect(haptics.haptic).toHaveBeenCalledWith('rumble');
  });
});
