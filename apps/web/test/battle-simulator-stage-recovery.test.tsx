import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as Fiber from '@react-three/fiber';
import { BattleStage } from '../src/battle-simulator/BattleStage.js';
import { DEFAULT_SCENARIO, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline } from '../src/battle-simulator/timeline.js';

const gpu = vi.hoisted(() => ({ live: true, epoch: 0, watch: vi.fn(), crash: true }));
vi.mock('../src/galaxy/gpuContext.js', () => ({ useGpuContext: () => gpu }));
vi.mock('@react-three/fiber', async importOriginal => ({
  ...await importOriginal<typeof Fiber>(),
  Canvas: () => { if (gpu.crash) throw new Error('lost GPU'); return <div data-testid="recovered-canvas" />; },
}));

describe('battle stage recovery', () => {
  it('suspends on a scene failure and can rebuild the same battle without resetting playback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    gpu.crash = true; gpu.live = true; gpu.epoch = 0;
    const clock = { current: { time: 12.75, playing: false, speed: 2 } };
    const onSuspend = vi.fn();
    render(<BattleStage timeline={buildReplayTimeline(simulateScenario(DEFAULT_SCENARIO).recording)}
      clock={clock} viewer="ATTACK" selected="A1" onSelect={vi.fn()} environment="PLANET"
      time={12.75} playing={false} onReady={vi.fn()} onSuspend={onSuspend} />);
    expect(onSuspend).toHaveBeenCalled();
    gpu.crash = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reopen 3D view' }));
    expect(screen.getByTestId('recovered-canvas')).toBeInTheDocument();
    expect(clock.current).toEqual({ time: 12.75, playing: false, speed: 2 });
  });

  it('clears a latched render failure when the browser restores the GPU context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    gpu.crash = true; gpu.live = true; gpu.epoch = 0;
    const props = { timeline: buildReplayTimeline(simulateScenario(DEFAULT_SCENARIO).recording),
      clock: { current: { time: 3, playing: false, speed: 1 } }, viewer: 'ATTACK' as const, selected: null,
      onSelect: vi.fn(), environment: 'PLANET' as const, time: 3, playing: false, onReady: vi.fn(), onSuspend: vi.fn() };
    const { rerender } = render(<BattleStage {...props} />);
    gpu.crash = false; gpu.epoch = 1;
    rerender(<BattleStage {...props} />);
    expect(screen.getByTestId('recovered-canvas')).toBeInTheDocument();
  });
});
