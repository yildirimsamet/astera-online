import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BattleRecording } from '@astera/rules';
import { BattleReplay } from '../src/battle-simulator/BattleReplay.js';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline } from '../src/battle-simulator/timeline.js';

vi.mock('../src/battle-simulator/BattleStage.js', () => ({ BattleStage: ({ timeline, viewer, onReady, onSelect }: {
  timeline: { recording: BattleRecording }; viewer: string; onReady: () => void; onSelect: (id: string) => void;
}) => <div data-testid="battle-stage" data-viewer={viewer} ref={() => { onReady(); }}>
  {timeline.recording.ships.slice(0, 2).map(ship => <button key={ship.id} onClick={() => { onSelect(ship.id); }}>Pick {ship.id}</button>)}
</div> }));

const timelineInput = () => screen.getByLabelText('Battle timeline');
const seekTo = (value: number) => { fireEvent.change(timelineInput(), { target: { value: String(value) } }); };

/**
 * THE PHONE REPLAY (owner 2026-10-26, docs/simulator-mobile-ux-plan-2026-10-26.md). One screen:
 * the force strip, the field, one playback row and two tabs. Each control does one thing that
 * no other control already does.
 */
describe('the replay screen', () => {
  it('switches the camera to a side when its force header is tapped', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    const attacker = screen.getByRole('button', { name: /^Attacker Active/ }), defender = screen.getByRole('button', { name: /^Defender Active/ });
    expect(attacker).toHaveAttribute('aria-pressed', 'true');
    expect(defender).toHaveAttribute('aria-pressed', 'false');
    expect(defender).toHaveAccessibleDescription('View from Defender');
    fireEvent.click(defender);
    expect(screen.getByTestId('battle-stage')).toHaveAttribute('data-viewer', 'DEFENCE');
    expect(defender).toHaveAttribute('aria-pressed', 'true');
  });

  it('marks every round on the timeline in proportion to its length, and a mark jumps to that round', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO), timeline = buildReplayTimeline(simulation.recording);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    const total = simulation.recording.roundLimit;
    const marks = timeline.rounds.map(round => screen.getByRole('button', { name: `Round ${round.round} / ${total}` }));
    expect(marks).toHaveLength(timeline.rounds.length);
    const second = timeline.rounds[1]!;
    const share = (mark: HTMLElement) => Number(mark.style.flexGrow);
    expect(share(marks[1]!)).toBeCloseTo((timeline.rounds[2]?.start ?? timeline.duration) - second.start);
    fireEvent.click(marks[1]!);
    expect(timelineInput()).toHaveValue(String(second.start));
    expect(marks[1]).toHaveAttribute('aria-pressed', 'true');
    expect(marks[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('cycles the playback speed with one chip', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    const chip = screen.getByRole('button', { name: /Playback speed/ });
    const seen = [chip.textContent];
    for (let i = 0; i < 5; i++) { fireEvent.click(chip); seen.push(chip.textContent); }
    expect(seen).toEqual(['1×', '2×', '4×', '8×', '½×', '1×']);
  });

  it('keeps no control that another control already covers', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    for (const name of ['Replay from start', 'Switch perspective', 'Zoom in', 'Zoom out', 'Round end']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Drag to orbit · pinch to zoom')).toBeNull();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
  });

  it('opens the summary and the shot log from the same two tabs, and closes on a second tap', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" hint="Attacker stronger · 1:1.9"
      footer={<section aria-label="Battle balance">balance</section>} />);
    const summary = screen.getByRole('button', { name: 'Summary' }), shots = screen.getByRole('button', { name: 'Shot log' });
    expect(screen.getByText('Attacker stronger · 1:1.9')).toBeInTheDocument();
    fireEvent.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    const panel = screen.getByRole('dialog', { name: 'Summary' });
    expect(within(panel).getByRole('region', { name: 'Battle balance' })).toBeInTheDocument();
    expect(within(panel).getByText('Simultaneous round · shown shot by shot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeInTheDocument();
    fireEvent.click(shots);
    expect(shots).toHaveAttribute('aria-expanded', 'true');
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('dialog', { name: 'Shot log' })).toBeInTheDocument();
    fireEvent.click(shots);
    expect(shots).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('counts the ships that left on the field and opens the summary that names them', () => {
    const simulation = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 0, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 36 } }], defenders: [{ id: 'd', fleet: { DART: 18 } }] }));
    const timeline = buildReplayTimeline(simulation.recording), event = timeline.events.find(item => item.kind === 'RETREAT')!;
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    expect(screen.queryByRole('button', { name: /retreated, show the list/ })).toBeNull();
    seekTo(event.at + .5);
    const count = timeline.events.filter(item => item.kind === 'RETREAT' && item.at <= event.at + .5).length;
    const chip = screen.getByRole('button', { name: `${count} retreated, show the list` });
    expect(chip).toHaveTextContent(`↗${count}`);
    fireEvent.click(chip);
    const panel = screen.getByRole('dialog', { name: 'Summary' });
    expect(within(panel).getByRole('region', { name: 'Retreated · alive, out of combat' })).toHaveTextContent(`#${event.shipId}`);
  });

  it('ends on a result card that can play the battle again', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO), timeline = buildReplayTimeline(simulation.recording);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    expect(screen.queryByRole('region', { name: 'Battle result' })).toBeNull();
    seekTo(timeline.duration);
    const card = screen.getByRole('region', { name: 'Battle result' });
    expect(card.querySelector('.sim-result')).not.toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Watch again' }));
    expect(timelineInput()).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Battle result' })).toBeNull();
  });

  it('opens the summary from the result card', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO), timeline = buildReplayTimeline(simulation.recording);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    seekTo(timeline.duration);
    fireEvent.click(within(screen.getByRole('region', { name: 'Battle result' })).getByRole('button', { name: 'Summary' }));
    expect(screen.getByRole('dialog', { name: 'Summary' })).toBeInTheDocument();
  });
});
