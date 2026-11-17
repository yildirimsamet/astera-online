import { STARTER, openingProgress, type VesselProgress } from '@astera/rules';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema, type VesselView } from '../src/api/starterSchemas.js';
import { HoldFullMoment } from '../src/starter/HoldFullMoment.js';
import { ShipHero } from '../src/starter/ShipHero.js';
import type * as Sound from '../src/lib/sound.js';
import { wireVessel } from './starterVesselFixture.js';

const sound = vi.hoisted(() => ({ playSound: vi.fn() }));
const haptics = vi.hoisted(() => ({ haptic: vi.fn() }));
vi.mock('../src/lib/sound.js', async (original) => ({ ...await original<typeof Sound>(), ...sound }));
vi.mock('../src/lib/haptics.js', () => haptics);

const LOOP: VesselProgress = {
  modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 },
  facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'],
};
const ship = (over: Record<string, unknown> = {}): VesselView => vesselSchema.parse(wireVessel({
  progress: LOOP, alloy: STARTER.carry.alloy, crystal: STARTER.carry.crystal, bufferAlloy: 0, ...over,
}));

beforeEach(() => { window.localStorage.clear(); sound.playSound.mockClear(); haptics.haptic.mockClear(); });
afterEach(() => { cleanup(); });

/**
 * THE HOLD FILLS (plan 2026-11-13 §4.5, a medium moment): the hatches close, a short sound, one card. From
 * here on what the ship earns does not go down with it; staying is still the player's to choose.
 */
describe('the hold fills', () => {
  it('says so once a ship, with a sound and a knock, and offers the jump', () => {
    const onLook = vi.fn();
    const view = render(<HoldFullMoment vessel={ship()} onLook={onLook} />);
    expect(screen.getByTestId('hold-full-moment')).toHaveTextContent(/hold is full/iu);
    expect(screen.getByTestId('hold-full-moment')).toHaveTextContent(/not carried down/iu);
    expect(sound.playSound).toHaveBeenCalledWith('cargo');
    expect(haptics.haptic).toHaveBeenCalledWith('thunk');
    fireEvent.click(screen.getByRole('button', { name: /See the jump/u }));
    expect(onLook).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('hold-full-moment')).toBeNull();
    view.unmount();
    render(<HoldFullMoment vessel={ship()} onLook={onLook} />);
    expect(screen.queryByTestId('hold-full-moment')).toBeNull();
    expect(sound.playSound.mock.calls.filter(([cue]) => cue === 'cargo')).toHaveLength(1);
  });

  it('closes without leaving the screen', () => {
    const onLook = vi.fn();
    render(<HoldFullMoment vessel={ship()} onLook={onLook} />);
    fireEvent.click(screen.getByRole('button', { name: /Close/u }));
    expect(screen.queryByTestId('hold-full-moment')).toBeNull();
    expect(onLook).not.toHaveBeenCalled();
  });

  // On the drive's own panel the jump is already under the card: no way there to offer, only the close.
  it('offers no way to the jump from the jump panel itself', () => {
    render(<HoldFullMoment vessel={ship()} />);
    expect(screen.getByTestId('hold-full-moment')).toHaveTextContent(/hold is full/iu);
    expect(screen.queryByRole('button', { name: /See the jump/u })).toBeNull();
    expect(screen.getByRole('button', { name: /Close/u })).toBeInTheDocument();
  });

  it('says nothing while the hold still takes more, or before the window opens', () => {
    // A ready crate counts towards the hold, so the gap is wider than any crate.
    render(<HoldFullMoment vessel={ship({ crystal: 0 })} onLook={vi.fn()} />);
    render(<HoldFullMoment vessel={ship({ progress: openingProgress() })} onLook={vi.fn()} />);
    expect(screen.queryByTestId('hold-full-moment')).toBeNull();
    expect(sound.playSound).not.toHaveBeenCalled();
  });

  // Never a stack of cards: the drive's own card comes first, this one after it.
  it('waits while a system card is still to be announced', () => {
    const view = render(<HoldFullMoment vessel={ship({ unlockToAnnounce: 'migration' })} onLook={vi.fn()} />);
    expect(screen.queryByTestId('hold-full-moment')).toBeNull();
    view.rerender(<HoldFullMoment vessel={ship()} onLook={vi.fn()} />);
    expect(screen.getByTestId('hold-full-moment')).toBeInTheDocument();
  });

  it('shows on the ship: the cargo hatches stay closed while the hold is full', () => {
    const draw = (sealed: boolean) => <ShipHero id="ship-1" progress={LOOP} selected="DRIVE" onSelect={() => undefined} sealed={sealed} />;
    const view = render(draw(false));
    const cargo = () => document.querySelector('[data-bay="CARGO"]');
    expect(cargo()).not.toHaveAttribute('data-sealed');
    view.rerender(draw(true));
    expect(cargo()).toHaveAttribute('data-sealed');
  });
});
