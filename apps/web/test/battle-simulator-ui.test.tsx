import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleSimulator } from '../src/battle-simulator/BattleSimulator.js';
import { runSimulation } from '../src/battle-simulator/runner.js';
import { DEFAULT_SCENARIO, simulateScenario } from '../src/battle-simulator/scenario.js';

vi.mock('../src/battle-simulator/BattleStage.js', () => ({ BattleStage: () => <div data-testid="battle-stage" /> }));
vi.mock('../src/battle-simulator/runner.js', () => ({ runSimulation: vi.fn() }));
beforeEach(() => { vi.mocked(runSimulation).mockImplementation(input => Promise.resolve(simulateScenario(input))); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('battle simulator editor and replay', () => {
  it('allows clearing a fleet quantity and entering a replacement without restoring zero during typing', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const field = screen.getByLabelText('Corsair · Quantity');
    fireEvent.focus(field); fireEvent.change(field, { target: { value: '' } });
    expect(field).toHaveDisplayValue('');
    fireEvent.change(field, { target: { value: '5' } }); fireEvent.blur(field);
    expect(field).toHaveDisplayValue('5');
  });
  it('runs independently of player APIs, accepts fleet and owner research changes and keeps the last battle immutable', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const attacker = screen.getByRole('tabpanel', { name: 'Attacker' });
    fireEvent.change(within(attacker).getByLabelText('Corsair · Quantity'), { target: { value: '7' } });
    fireEvent.change(within(attacker).getByLabelText('Ship Shields'), { target: { value: '4' } });
    expect(screen.getByText('Settings changed. Simulate again to apply them.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate battle' }));
    await waitFor(() => { expect(vi.mocked(runSimulation).mock.calls.at(-1)?.[0].attackers[0]?.fleet.CORSAIR).toBe(7); });
    expect(vi.mocked(runSimulation).mock.calls.at(-1)?.[0].attackers[0]?.tech.SHIP_SHIELDS).toBe(4);
    expect(DEFAULT_SCENARIO.attackers[0]?.fleet.CORSAIR).toBe(4);
  });

  it('lets the defender configure ground guns and Aegis, and clears incompatible planet settings on switching to space', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('tab', { name: 'Defender' }));
    const defender = screen.getByRole('tabpanel', { name: 'Defender' });
    expect(within(defender).getByLabelText('Bastion · Quantity')).toBeInTheDocument();
    expect(within(defender).getByLabelText('Aegis level')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Battlefield'), { target: { value: 'MONUMENT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate battle' }));
    await waitFor(() => { expect(vi.mocked(runSimulation).mock.calls.at(-1)?.[0].environment).toBe('MONUMENT'); });
    const input = vi.mocked(runSimulation).mock.calls.at(-1)![0];
    expect(input.aegisLevel).toBe(0);
    expect(input.defenders[0]?.fleet.BASTION ?? 0).toBe(0);
  });

  it('shows the actual per-shot target breakdown and supports stepping and seeking', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next shot' }));
    const timeline = screen.getByLabelText('Battle timeline');
    expect(timeline).toBeInstanceOf(HTMLInputElement);
    if (timeline instanceof HTMLInputElement) expect(timeline.valueAsNumber).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Show shot/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /Show shot/ })[0]!);
    expect(screen.getByRole('table', { name: 'Damage distribution' })).toBeInTheDocument();
  });

  it('rejects excessive fleets before starting work and offers a retry after computation failure', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const input = screen.getByLabelText('Corsair · Quantity');
    fireEvent.change(input, { target: { value: '9999' } });
    const calls = vi.mocked(runSimulation).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Simulate battle' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(vi.mocked(runSimulation).mock.calls.length).toBe(calls);
    fireEvent.change(input, { target: { value: '3' } });
    vi.mocked(runSimulation).mockRejectedValueOnce(new Error('worker failed'));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate battle' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Try again'));
  });

  it('keeps newer editor changes marked as unapplied when an older worker result arrives', async () => {
    let complete: ((output: ReturnType<typeof simulateScenario>) => void) | undefined;
    vi.mocked(runSimulation).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    render(<BattleSimulator onLeave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Corsair · Quantity'), { target: { value: '8' } });
    complete!(simulateScenario(DEFAULT_SCENARIO));
    await screen.findByTestId('battle-stage');
    expect(screen.getByText('Settings changed. Simulate again to apply them.')).toBeInTheDocument();
  });

  it('pauses the battle while mobile fleet settings cover the battlefield', async () => {
    vi.stubGlobal('innerWidth', 390);
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('button', { name: 'Configure fleets' }));
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeInTheDocument();
  });

  it('pauses when an open desktop editor becomes a mobile overlay on resize', async () => {
    vi.stubGlobal('innerWidth', 1400);
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    vi.stubGlobal('innerWidth', 350); fireEvent(window, new Event('resize'));
    expect(screen.getByRole('button', { name: 'Play battle' })).toBeInTheDocument();
  });

  it('identifies the invalid starting-health field and its valid range', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const health = screen.getByLabelText('Corsair · Starting hull %');
    fireEvent.change(health, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simulate battle' }));
    expect(health).toHaveAttribute('aria-invalid', 'true');
    expect(health).toHaveAccessibleDescription('Enter a whole number from 1 to 100.');
    expect(health).toHaveFocus();
  });

  it('marks manual edits as a custom scenario and lets a preset replace them', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.change(screen.getByLabelText('Corsair · Quantity'), { target: { value: '5' } });
    expect(screen.getByLabelText('Example battle')).toHaveDisplayValue('Custom scenario');
    fireEvent.change(screen.getByLabelText('Example battle'), { target: { value: 'shieldDuel' } });
    expect(screen.getByLabelText('Example battle')).toHaveDisplayValue('Aegis vs Nullifiers');
    expect(screen.getByLabelText('Nullifier · Quantity')).toHaveDisplayValue('8');
  });

  it('replaces initial loading with a recoverable computation error', async () => {
    vi.mocked(runSimulation).mockRejectedValueOnce(new Error('worker failed'));
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.queryByText('Preparing the battlefield…')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByTestId('battle-stage');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
