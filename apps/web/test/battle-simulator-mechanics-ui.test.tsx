import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BattleRecording } from '@astera/rules';
import { BattleReplay } from '../src/battle-simulator/BattleReplay.js';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';
import { buildReplayTimeline } from '../src/battle-simulator/timeline.js';

vi.mock('../src/battle-simulator/BattleStage.js', () => ({ BattleStage: ({ timeline, onSelect, cameraRequest }: {
  timeline: { recording: BattleRecording }; onSelect: (id: string) => void; cameraRequest?: { kind: string; unitId?: string };
}) => <div><output data-testid="camera-request">{cameraRequest?.kind}:{cameraRequest?.unitId}</output>{timeline.recording.ships.map(ship => <button key={ship.id} onClick={() => { onSelect(ship.id); }}>Pick {ship.id}</button>)}</div> }));

describe('players can identify roles, fleets and the state being shown', () => {
  it('identifies the selected ground unit, attack and absence of a personal shield', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO);
    const ground = simulation.recording.ships.find(ship => ship.hull === 'BASTION')!;
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.click(screen.getByRole('button', { name: `Pick ${ground.id}` }));
    const card = screen.getByRole('region', { name: 'Selected unit' });
    expect(card).toHaveTextContent('Defender'); expect(card).toHaveTextContent('Fleet 1');
    expect(card).toHaveTextContent('Base attack');
    expect(card).toHaveTextContent('No personal shield');
    expect(within(card).getByRole('button', { name: 'Focus unit' })).toBeInTheDocument();
    expect(screen.getByTestId('camera-request')).toHaveTextContent(`FOCUS:${ground.id}`);
  });

  it('shows the owner research and support role instead of implying a collector fires', () => {
    const scenario = scenarioSchema.parse(DEFAULT_SCENARIO);
    scenario.attackers.push({ ...structuredClone(scenario.attackers[0]!), id: 'ally', fleet: { GARBAGE_COLLECTOR: 1 }, tech: { SHIP_POWER: 3, SHIP_ARMOR: 4, SHIP_SHIELDS: 2, EMPLACEMENT_DOCTRINE: 0 } });
    const simulation = simulateScenario(scenario);
    const collector = simulation.recording.ships.find(ship => ship.hull === 'GARBAGE_COLLECTOR')!;
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.click(screen.getByRole('button', { name: `Pick ${collector.id}` }));
    const card = screen.getByRole('region', { name: 'Selected unit' });
    expect(card).toHaveTextContent('Fleet 2'); expect(card).toHaveTextContent('Protected while armed units remain');
    expect(card).toHaveTextContent('Wreck collection and loot are settled after battle');
    expect(card).toHaveTextContent('Ship Shields 2');
  });

  it('explains offline ground units even with no Aegis capacity', () => {
    const simulation = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, aegisLevel: 0, defenceOffline: true }));
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    expect(screen.getByText('Aegis and ground defences are offline. Mobile ships still fight.')).toBeInTheDocument();
  });

  it('labels future shots and hides their result until the user seeks to them', () => {
    render(<BattleReplay simulation={simulateScenario(DEFAULT_SCENARIO)} environment="PLANET" />);
    const button = screen.getAllByRole('button', { name: /Show shot/ })[0]!;
    expect(button).toHaveAttribute('data-shot-state', 'upcoming');
    expect(button).toHaveTextContent('Upcoming');
    fireEvent.click(button);
    expect(screen.getAllByRole('button', { name: /Show shot/ })[0]).toHaveAttribute('data-shot-state', 'completed');
  });

  it('does not present a flying projectile’s future target damage as an impact that already happened', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO), timeline = buildReplayTimeline(simulation.recording);
    const shot = timeline.events.find(event => event.kind === 'SHOT')!;
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(shot.at + .1) } });
    const table = screen.getByRole('table', { name: 'Damage distribution' });
    for (const row of within(table).getAllByRole('row').slice(1)) {
      expect(row).toHaveAttribute('data-hit-state', 'upcoming');
      for (const cell of within(row).getAllByRole('cell').slice(1)) expect(cell).toHaveTextContent('—');
    }
  });

  it('keeps a named retreat roster and removes it on rewinding', () => {
    const simulation = simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, seed: 0, aegisLevel: 0,
      attackers: [{ id: 'a', fleet: { DART: 36 } }], defenders: [{ id: 'd', fleet: { DART: 18 } }] }));
    const timeline = buildReplayTimeline(simulation.recording), event = timeline.events.find(item => item.kind === 'RETREAT')!;
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(event.at + .5) } });
    const roster = screen.getByRole('region', { name: 'Retreated · alive, out of combat' });
    expect(roster).toHaveTextContent(`#${event.shipId}`);
    expect(roster).toHaveTextContent('Fleet 1');
    fireEvent.click(within(roster).getAllByRole('button', { name: /Inspect/ })[0]!);
    expect(screen.getByRole('region', { name: 'Selected unit' })).toHaveTextContent('Retreated');
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: '0' } });
    expect(screen.queryByRole('region', { name: 'Retreated · alive, out of combat' })).not.toBeInTheDocument();
  });

  it('multiplies a v3 shot by the battle balance, so the shown factors give the shot budget', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO);
    const scale = simulation.recording.damageScale!.attacker;
    expect(scale).not.toBe(1);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Show shot/ })[0]!);
    const detail = screen.getByRole('table', { name: 'Damage distribution' }).closest('.sim-shot-detail')!;
    expect(detail).toHaveTextContent(`battle balance ${scale.toLocaleString('en', { maximumFractionDigits: 2 })}`);
    expect(detail).toHaveTextContent(/One target per shot/);
    expect(detail).not.toHaveTextContent(/Up to 10/);
  });

  it('keeps the ten-target rule and no balance factor for a replay recorded before combat v3', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO);
    const old = { ...simulation, recording: { ...simulation.recording, damageScale: undefined } };
    render(<BattleReplay simulation={old} environment="PLANET" />);
    fireEvent.click(screen.getAllByRole('button', { name: /Show shot/ })[0]!);
    const detail = screen.getByRole('table', { name: 'Damage distribution' }).closest('.sim-shot-detail')!;
    expect(detail).toHaveTextContent(/Up to 10/);
    expect(detail).not.toHaveTextContent(/battle balance/);
  });

  it('names the round once in the status strip, and says the battle is complete only once', () => {
    const simulation = simulateScenario(DEFAULT_SCENARIO);
    const timeline = buildReplayTimeline(simulation.recording);
    render(<BattleReplay simulation={simulation} environment="PLANET" />);
    const banner = () => document.querySelector('[data-combat-phase]')!;
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(timeline.rounds[0]!.openingEnd + .1) } });
    expect(banner().textContent.match(/Round 1 \/ 8/g)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Battle timeline'), { target: { value: String(timeline.duration) } });
    expect(banner().textContent.match(/Battle complete/g)).toHaveLength(1);
  });
});

