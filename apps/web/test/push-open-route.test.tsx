import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PushDestination } from '../src/platform/push.js';
import { PushOpenRoute } from '../src/shell/PushOpenRoute.js';

/**
 * A TAP THAT OPENED THE APP WAITS FOR THE WORLDS (owner 2026-11-10). Handed over before the
 * world list loads, the attacked colony could not be selected and the capital opened instead.
 */
const state = vi.hoisted(() => ({ worlds: [] as { planet: { id: string } }[], listener: null as ((to: PushDestination) => void) | null }));
vi.mock('../src/api/world.js', () => ({ useWorld: () => ({ worlds: state.worlds }) }));
vi.mock('../src/platform/push.js', () => ({
  onPushOpened: (listener: (to: PushDestination) => void) => { state.listener = listener; return () => { state.listener = null; }; },
}));
afterEach(() => { state.worlds = []; state.listener = null; });

const to: PushDestination = { panel: 'planet', planetId: '7b0c8a52-2d7e-4f5e-9c43-3f0a0b8d1e21' };

it('takes no tap until the commander\'s worlds are loaded', () => {
  const onOpen = vi.fn();
  const view = render(<PushOpenRoute onOpen={onOpen} />);
  expect(state.listener).toBeNull();
  state.worlds = [{ planet: { id: to.planetId } }];
  view.rerender(<PushOpenRoute onOpen={onOpen} />);
  state.listener?.(to);
  expect(onOpen).toHaveBeenCalledWith(to);
});

it('stops taking taps when it leaves the screen', () => {
  state.worlds = [{ planet: { id: to.planetId } }];
  const view = render(<PushOpenRoute onOpen={vi.fn()} />);
  expect(state.listener).not.toBeNull();
  view.unmount();
  expect(state.listener).toBeNull();
});
