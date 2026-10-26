import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEffect } from 'react';
import { COMBAT } from '@astera/rules';
import { BattleReplay } from '../src/battle-simulator/BattleReplay.js';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline, sampleReplay, type ShotEvent } from '../src/battle-simulator/timeline.js';

vi.mock('../src/battle-simulator/BattleStage.js', () => ({ BattleStage: ({ onReady, onUnavailable }: { onReady: () => void; onUnavailable?: () => void }) => {
  useEffect(onReady, [onReady]);
  return <div data-testid="battle-stage"><button onClick={onUnavailable}>Lose GPU</button><button onClick={onReady}>Restore GPU</button></div>;
} }));

describe('replay state follows navigation', () => {
  it('replaces a selected shot on stepping and clears its breakdown on restart', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO);
    const timeline = buildReplayTimeline(simulation.recording);
    const shots = timeline.events.filter((event): event is ShotEvent => event.kind === 'SHOT' && event.round === 1 && event.side === 'ATTACK');
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Show shot/ })[0]!);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(`#${shots[0]!.shot.sourceId}`);
    fireEvent.click(screen.getByRole('button', { name: 'Next shot' }));
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(`#${shots[1]!.shot.sourceId}`);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: '0' } });
    expect(screen.queryByRole('table', { name: 'Damage distribution' })).not.toBeInTheDocument();
  });

  it('snaps the native range last step to the exact finish, including mutual destruction', () => {
    const simulation = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 1, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 1 } }], defenders: [{ id: 'd', fleet: { DART: 1 } }] }));
    const timeline = buildReplayTimeline(simulation.recording);
    expect(timeline.recording.rounds.at(-1)?.after.every(ship => ship.hp === 0)).toBe(true);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(Math.floor(timeline.duration * 100) / 100) } });
    expect(screen.getByText('Both fleets were destroyed.')).toBeInTheDocument();
    expect(screen.getByLabelText('Battle timeline')).toHaveValue(String(timeline.duration));
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: '0' } });
    expect(screen.queryByText('Both fleets were destroyed.')).not.toBeInTheDocument();
  });

  // A raid that cannot crack the transports runs every round: the last one ends without retreats.
  it('does not label the last round end as a retreat phase', () => {
    const run = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 0, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 5 } }], defenders: [{ id: 'd', fleet: { ATLAS: 10 } }] }));
    const timeline = buildReplayTimeline(run.recording);
    expect(timeline.rounds.at(-1)?.round).toBe(COMBAT.rounds);
    expect(sampleReplay(timeline, timeline.rounds.at(-1)!.retreatAt + .1).phase).toBe('ROUND_END');
  });

  it('shows monument control separately when both fleets are destroyed', () => {
    const simulation = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, environment: 'MONUMENT', seed: 1, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { CATACLYSM: 1 } }], defenders: [{ id: 'd', fleet: { CATACLYSM: 1 } }] }));
    expect(simulation.control).toBe('EMPTY');
    const timeline = buildReplayTimeline(simulation.recording);
    render(<BattleReplay simulation={simulation} environment="MONUMENT" />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(timeline.duration) } });
    expect(screen.getByText('Both fleets were destroyed.')).toBeInTheDocument();
    expect(screen.getByText('Neither side controls the monument after the battle.')).toBeInTheDocument();
  });

  it('closes the overlay log on Escape and restores the opener focus', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    const opener = screen.getByRole('button', { name: 'Shot log' });
    opener.focus(); fireEvent.click(opener);
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(opener).toHaveFocus();
  });

  it('blocks playback while the stage is unavailable and preserves the inspected position on recovery', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: '12.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lose GPU' }));
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Restore GPU' }));
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeEnabled();
    expect(screen.getByLabelText('Battle timeline')).toHaveValue('12.5');
  });

  it('pauses while the player opens the round explanation', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    const guide = screen.getByText('Simultaneous round · shown shot by shot').closest('details')!;
    fireEvent(guide, new Event('toggle', { bubbles: true }));
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    guide.open = true; fireEvent(guide, new Event('toggle', { bubbles: true }));
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeInTheDocument();
  });
});
