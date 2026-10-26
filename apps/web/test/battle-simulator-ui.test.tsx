import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleSimulator } from '../src/battle-simulator/BattleSimulator.js';
import { runSimulation } from '../src/battle-simulator/runner.js';
import { HULLS, PIRATE } from '@astera/rules';
import { DEFAULT_SCENARIO, SIMULATION_UNIT_LIMIT, simulateScenario } from '../src/battle-simulator/scenario.js';

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
    expect(screen.getByRole('button', { name: 'Simulate again' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Simulate again' }));
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
    fireEvent.click(screen.getByRole('button', { name: /^Simulate (battle|again)$/ }));
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
    fireEvent.click(screen.getByRole('button', { name: /^Simulate (battle|again)$/ }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(vi.mocked(runSimulation).mock.calls.length).toBe(calls);
    fireEvent.change(input, { target: { value: '3' } });
    vi.mocked(runSimulation).mockRejectedValueOnce(new Error('worker failed'));
    fireEvent.click(screen.getByRole('button', { name: /^Simulate (battle|again)$/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Try again'));
  });

  it('keeps newer editor changes marked as unapplied when an older worker result arrives', async () => {
    let complete: ((output: ReturnType<typeof simulateScenario>) => void) | undefined;
    vi.mocked(runSimulation).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    render(<BattleSimulator onLeave={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Corsair · Quantity'), { target: { value: '8' } });
    complete!(simulateScenario(DEFAULT_SCENARIO));
    await screen.findByTestId('battle-stage');
    expect(screen.getByRole('button', { name: 'Simulate again' })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /^Simulate (battle|again)$/ }));
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

  it('turns a pirate into one crew in open space with no research, Aegis or second wing', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('tab', { name: 'Defender' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Add allied fleet' }));
    fireEvent.change(screen.getByLabelText('Defender pirate modifier'), { target: { value: '2' } });
    expect(screen.getByLabelText('Battlefield')).toHaveValue('MONUMENT');
    const defender = screen.getByRole('tabpanel', { name: 'Defender' });
    expect(within(defender).queryByLabelText('Aegis level')).toBeNull();
    expect(within(defender).queryByText('Research')).toBeNull();
    expect(within(defender).getByText(/Pirates hold no research/)).toBeInTheDocument();
    expect(within(defender).queryByRole('button', { name: '+ Add allied fleet' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Simulate (battle|again)$/ }));
    await waitFor(() => { expect(vi.mocked(runSimulation).mock.calls.at(-1)?.[0].pirateLevel).toBe(2); });
    const input = vi.mocked(runSimulation).mock.calls.at(-1)![0];
    expect(input.defenders).toHaveLength(1);
    expect(input.environment).toBe('MONUMENT');
    // Back to a planet: no pirate attacks one.
    fireEvent.change(screen.getByLabelText('Battlefield'), { target: { value: 'PLANET' } });
    expect(screen.getByLabelText('Defender pirate modifier')).toHaveValue('0');
  });

  it('states the balance the battle was fought with: each power, the ratio, the tempo and who may retreat', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const balance = screen.getByRole('region', { name: 'Battle balance' });
    const run = simulateScenario(DEFAULT_SCENARIO), b = run.result.balance!;
    const ratio = Math.max(b.attackerPower, b.defenderPower) / Math.min(b.attackerPower, b.defenderPower);
    expect(balance).toHaveTextContent(`1:${ratio.toLocaleString('en', { maximumFractionDigits: 1 })}`);
    expect(balance).toHaveTextContent(/Battle tempo ×/);
    expect(balance).toHaveTextContent(/Retreats below/);
    expect(balance).toHaveTextContent(/Never retreats|Retreats below/);
    // The ratio is always in view; the rest is one tap deep.
    expect(within(balance).getByText(/stronger · 1:|Even fight/)).toBeVisible();
    expect(within(balance).getByText(/matchup power/i)).not.toBeVisible();
    fireEvent.click(within(balance).getByText('Battle balance'));
    expect(within(balance).getByText(/matchup power/i)).toBeVisible();
  });

  it('says what a ship at or under 5% hull does in this battle', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const attacker = screen.getByRole('tabpanel', { name: 'Attacker' });
    fireEvent.change(within(attacker).getByLabelText('Corsair · Starting hull %'), { target: { value: '5' } });
    expect(within(attacker).getByText(/Grounded for repair/)).toHaveTextContent(/cannot fire/);
    fireEvent.change(within(attacker).getByLabelText('Corsair · Starting hull %'), { target: { value: '6' } });
    expect(within(attacker).queryByText(/Grounded for repair/)).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Defender' }));
    const defender = screen.getByRole('tabpanel', { name: 'Defender' });
    fireEvent.change(within(defender).getByLabelText('Dart · Starting hull %'), { target: { value: '3' } });
    expect(within(defender).getByText(/Grounded for repair/)).toHaveTextContent(/stays out of the planet's defence/);
  });

  it('shows a pirate ship at its real attack: the level multiplier, never research left from before', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('tab', { name: 'Defender' }));
    const defender = () => screen.getByRole('tabpanel', { name: 'Defender' });
    fireEvent.change(within(defender()).getByLabelText('Ship Power'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Defender pirate modifier'), { target: { value: '3' } });
    const row = within(defender()).getByLabelText('Dart · Quantity').closest('.sim-unit-row')!;
    expect(row).toHaveTextContent(`Base attack ${Math.round(HULLS.DART.atk * PIRATE.damageMult[3])} · ${HULLS.DART.hp} HP`);
  });

  it('steps a ship count with − and + inside the limit, and the fleet button counts both sides', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const attacker = screen.getByRole('tabpanel', { name: 'Attacker' });
    const field = within(attacker).getByLabelText('Corsair · Quantity');
    const start = Number((field as HTMLInputElement).value);
    fireEvent.click(within(attacker).getByRole('button', { name: 'More Corsair' }));
    expect(field).toHaveValue(start + 1);
    fireEvent.change(field, { target: { value: '0' } });
    fireEvent.click(within(attacker).getByRole('button', { name: 'Fewer Corsair' }));
    expect(field).toHaveValue(0);
    fireEvent.change(field, { target: { value: String(SIMULATION_UNIT_LIMIT) } });
    fireEvent.click(within(attacker).getByRole('button', { name: 'More Corsair' }));
    expect(field).toHaveValue(SIMULATION_UNIT_LIMIT);
    const total = within(attacker).getAllByLabelText(/· Quantity$/).reduce((sum, input) => sum + Number((input as HTMLInputElement).value), 0);
    expect(screen.getByRole('button', { name: 'Configure fleets' }).querySelector('.is-self')).toHaveTextContent(String(total));
  });

  it('folds research to one line that still states every level', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    const attacker = screen.getByRole('tabpanel', { name: 'Attacker' });
    fireEvent.change(within(attacker).getByLabelText('Ship Shields'), { target: { value: '4' } });
    const fold = within(attacker).getByText('Research').closest('details')!;
    expect(fold.open).toBe(false);
    expect(fold.querySelector('summary')).toHaveTextContent('0 · 0 · 4 · 0');
  });

  it('accepts a decimal Aegis charge from a phone keyboard', async () => {
    render(<BattleSimulator onLeave={vi.fn()} />);
    await screen.findByTestId('battle-stage');
    fireEvent.click(screen.getByRole('tab', { name: 'Defender' }));
    expect(screen.getByLabelText('Aegis charge %')).toHaveAttribute('inputmode', 'decimal');
    expect(within(screen.getByRole('tabpanel', { name: 'Defender' })).getByLabelText('Dart · Quantity')).toHaveAttribute('inputmode', 'numeric');
  });
});

