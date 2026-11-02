import { render, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ArenaGate } from '../src/arena/ArenaGate.js';
const telemetry = vi.hoisted(() => ({ observe: vi.fn() }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ ...telemetry, ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/arena/Sandbox.js', () => ({ default: () => <main>Pilot arena</main> }));
vi.mock('../src/lib/music.js', () => ({ suppressMusic: () => () => undefined }));
it('keeps the arena entry and its activity distinct from a prepared strategy game', async () => {
  render(<ArenaGate onLeave={() => undefined} />);
  await waitFor(() => { expect(telemetry.observe).toHaveBeenCalledWith('load_phase', { phase: 'arena' }, 'arena'); });
  expect(telemetry.observe).toHaveBeenCalledWith('surface_visible', { surface: 'arena_entry' }, 'arena');
  expect(telemetry.observe.mock.calls.some(([name]) => name === 'game_ready')).toBe(false);
});
