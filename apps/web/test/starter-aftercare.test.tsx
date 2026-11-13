import type { VesselModules } from '@astera/rules';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { StarterAftercare } from '../src/starter/tutorial/StarterAftercare.js';
import { vesselSchema } from '../src/api/starterSchemas.js';
import { wireVessel } from './starterVesselFixture.js';
const state = vi.hoisted(() => ({ native: false, ask: vi.fn(() => Promise.resolve('denied')), observe: vi.fn() }));
vi.mock('../src/platform/runtime.js', () => ({ capabilities: () => ({ nativePush: state.native }) }));
vi.mock('../src/platform/push.js', () => ({ connectPush: state.ask }));
vi.mock('../src/api/context.js', () => ({ useApi: () => ({}) }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe: state.observe }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); state.native = false; state.ask.mockClear(); });
const ship = () => vesselSchema.parse(wireVessel({ modules: { REFINERY: 3, SHIPYARD: 1, SURVEY: 1, EXTRACTOR: 3 }, facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] }));
it('never offers phone permission on web', () => {
  render(<StarterAftercare vessel={ship()} farewelled guided />);
  expect(screen.queryByText(/may i let you know/i)).toBeNull();
  expect(state.ask).not.toHaveBeenCalled();
});
it('asks at farewell, retries only on a later long repair, and then stops', async () => {
  state.native = true;
  const vessel = ship();
  const { rerender, unmount } = render(<StarterAftercare vessel={vessel} farewelled guided />);
  fireEvent.click(screen.getByRole('button', { name: /notify me/i }));
  await waitFor(() => { expect(state.ask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ ask: true })); });
  await waitFor(() => { expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull(); });
  const startedAt = new Date(Date.now() + 1000);
  const queue = [{ id: 'long', queue: 'CONSTRUCTION' as const, subject: 'SURVEY', stage: 2, count: 1, startedAt, readyAt: new Date(startedAt.getTime() + 20 * 60000), cost: { alloy: 600, crystal: 350, deuterium: 0 } }];
  rerender(<StarterAftercare vessel={{ ...vessel, queue }} farewelled guided />);
  fireEvent.click(screen.getByRole('button', { name: /later/i }));
  unmount();
  render(<StarterAftercare vessel={{ ...vessel, queue }} farewelled guided />);
  expect(screen.queryByRole('button', { name: /notify me/i })).toBeNull();
});
// The one deed a required repair waits on (plan 2026-11-13 §5.1): the radar waits for a Prospector sent out.
const beforeRadar = () => ({ ...ship(), modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1 }, facts: [] });
it('offers one optional visit hint with the deed the next repair waits on, and dismisses on one tap', () => {
  const { rerender } = render(<StarterAftercare vessel={beforeRadar()} farewelled guided />);
  expect(screen.getByText(/Send a Prospector to an asteroid\./u)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /understood/i }));
  rerender(<StarterAftercare vessel={beforeRadar()} farewelled guided />);
  expect(document.querySelector('[data-starter-aftercare]')).toBeNull();
});
it('remembers dismissal across mounts, and says nothing once no repair waits on a deed', () => {
  const { unmount } = render(<StarterAftercare vessel={beforeRadar()} farewelled guided />);
  fireEvent.click(screen.getByRole('button', { name: /understood/i })); unmount();
  const { unmount: again } = render(<StarterAftercare vessel={beforeRadar()} farewelled guided />);
  expect(document.querySelector('[data-starter-aftercare]')).toBeNull();
  again(); sessionStorage.clear();
  render(<StarterAftercare vessel={{ ...beforeRadar(), facts: ['FIRST_MINING_SENT'] }} farewelled guided />);
  expect(document.querySelector('[data-starter-aftercare]')).toBeNull();
});

/** Plan F3: the phone permission does not hang on the guide; without it, the ask comes at the same point. */
it('asks a commander without the guide once the first haul is home, and gives no hint', async () => {
  const { REPAIR_LADDER } = await import('@astera/rules');
  const modules: VesselModules = {};
  for (const step of REPAIR_LADDER.filter(step => step.required)) modules[step.module] = Math.max(modules[step.module] ?? 0, step.stage);
  const away = { ...ship(), facts: ['FIRST_PROBE_REPORT' as const] };
  const { rerender } = render(<StarterAftercare vessel={away} farewelled={false} guided={false} />);
  expect(document.querySelector('[data-starter-aftercare]')).toBeNull();
  rerender(<StarterAftercare vessel={{ ...ship(), modules, parts: 1 }} farewelled={false} guided={false} />);
  expect(document.querySelector('[data-starter-aftercare]')).toBeNull();
  state.native = true;
  rerender(<StarterAftercare vessel={{ ...ship(), modules, parts: 1 }} farewelled={false} guided={false} />);
  expect(screen.getByRole('button', { name: /notify me/i })).toBeTruthy();
  expect(screen.queryByText(/Send a/u)).toBeNull();
});
