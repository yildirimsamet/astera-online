import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { planetView } from './fixtures.js';
import { RadiationBombForge, RadiationBombLaunchPanel } from '../src/screens/RadiationBombControls.js';

const origin = () => planetView({ radiationBombsAvailable: true,
  radiationBombs: [
    { id: 'l1', level: 1, status: 'READY', readyAt: null, remainingSeconds: 0 },
    { id: 'l2', level: 2, status: 'LAUNCHED', readyAt: null, remainingSeconds: 0 },
  ], buildings: { CORE: 13, SHIPYARD: 5 } });

it('presents each level as a cinematic production scene with visible effect duration', () => {
  render(<RadiationBombForge planet={origin()} held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }}
    now={0} pending={false} onBuild={vi.fn()} />);
  for (const level of [1, 2, 3]) {
    const card = screen.getByTestId(`radiation-product-${String(level)}`);
    expect(card.querySelector('.radiation-product__scene img')?.getAttribute('src'))
      .toBe(`/assets/images/tactical/radiation-bomb-forge-l${String(level)}.webp`);
    expect(within(card).getByText('Effect duration')).toBeTruthy();
    expect(within(card).getByText('30m 00s')).toBeTruthy();
  }
});

it('explains Core 13 and refuses production at command tier four', () => {
  const view = render(<RadiationBombForge planet={{ ...origin(), radiationBombs: [], buildings: { ...origin().buildings, CORE: 12 } }}
    held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }} now={0} pending={false} onBuild={vi.fn()} />);
  const blocked = screen.getAllByRole('button', { name: /Requires Core 13 and Shipyard 5/ });
  expect(blocked).toHaveLength(3);
  for (const button of blocked) expect(button).toBeDisabled();
  view.rerender(<RadiationBombForge planet={{ ...origin(), radiationBombs: [] }}
    held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }} now={0} pending={false} onBuild={vi.fn()} />);
  expect(screen.getByRole('button', { name: /Build L1/ })).not.toBeDisabled();
});

it('shows three separate products, their actual durations and an occupied slot during flight', () => {
  render(<RadiationBombForge planet={origin()} held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }}
    now={0} pending={false} onBuild={vi.fn()} />);
  expect(screen.getByText('Ready to launch')).toBeTruthy();
  expect(screen.getByText('In flight · stock occupied')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Build L1/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Build L2/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Build L3/ })).toBeTruthy();
  expect(screen.getByTestId('radiation-product-3').textContent).toContain('1h 13m');
});

it('uses radiation symbols for level and one stock cell per bomb level', () => {
  render(<RadiationBombForge planet={origin()} held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }}
    now={0} pending={false} onBuild={vi.fn()} />);
  for (const level of [1, 2, 3]) {
    const card = screen.getByTestId(`radiation-product-${String(level)}`);
    expect(card.querySelectorAll('[data-radiation-level] svg')).toHaveLength(level);
    expect(card.querySelector('[data-tally]')).toHaveAttribute('data-total', '1');
    expect(card.querySelector('[data-tally]')).toHaveAttribute('data-used', level === 3 ? '0' : '1');
    expect(card.querySelector('[data-stock-counter]')).toHaveTextContent(`Stock ${level === 3 ? '0' : '1'}/1`);
  }
  expect(screen.getByTestId('radiation-product-1').querySelector('[data-cell]')).toHaveAttribute('data-cell', 'ready');
  expect(screen.getByTestId('radiation-product-2').querySelector('[data-cell]')).toHaveAttribute('data-cell', 'flight');
  expect(screen.getByTestId('radiation-product-3').querySelector('[data-cell]')).toHaveAttribute('data-cell', 'empty');
});

it.each(['BUILDING', 'PAUSED'] as const)('keeps a %s bomb in its stock slot and does not offer duplicate production', status => {
  render(<RadiationBombForge planet={{ ...origin(), radiationBombs: [{ id: 'busy', level: 1, status,
    readyAt: status === 'BUILDING' ? new Date(60000) : null, remainingSeconds: 60 }] }}
    held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }} now={0} pending={false} onBuild={vi.fn()} />);
  const card = screen.getByTestId('radiation-product-1');
  expect(card.querySelector('[data-tally]')).toHaveAttribute('data-used', '1');
  expect(card.querySelector('[data-cell]')).toHaveAttribute('data-cell', status === 'BUILDING' ? 'loading' : 'paused');
  expect(within(card).queryByRole('button', { name: /Build L1/ })).toBeNull();
});

it('requires a deliberate confirmation of the selected ready level and keeps its key on retry', () => {
  const send = vi.fn();
  const view = render(<RadiationBombLaunchPanel origin={origin()} target={{ kind: 'MONUMENT', id: 'monument' }}
    targetName="Monument 4" flightMs={60000} pending={false} onLaunch={send} />);
  expect(screen.getByText('Target: Monument 4')).toBeTruthy();
  const button = screen.getByRole('button', { name: /Launch L1/ });
  fireEvent.click(button);
  expect(send).not.toHaveBeenCalled();
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.keyDown(button, { key: 'Enter' });
  expect(send).toHaveBeenCalledWith(1, expect.any(String), false);
  const first = send.mock.calls[0];
  view.rerender(<RadiationBombLaunchPanel origin={origin()} target={{ kind: 'MONUMENT', id: 'monument' }}
    targetName="Monument 4" flightMs={60000} pending={false} onLaunch={send} />);
  const retry = screen.getByRole('button', { name: /Launch L1/ });
  fireEvent.keyDown(retry, { key: 'Enter' }); fireEvent.keyDown(retry, { key: 'Enter' });
  expect(send.mock.calls[1]).toEqual(first);
  expect(within(screen.getByTestId('radiation-launch')).getByText(/Cannot be recalled/)).toBeTruthy();
});

it('explains missing stock and a protected target without offering an active launch', () => {
  render(<RadiationBombLaunchPanel origin={{ ...origin(), radiationBombs: [] }} target={{ kind: 'PLANET', id: 'protected' }}
    targetName="Asterion" flightMs={60000} pending={false} disabledReason="Protected" onLaunch={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Protected' }).hasAttribute('disabled')).toBe(true);
});

it('explains the small Honor cap and weak-target risk before a missile is committed', () => {
  render(<RadiationBombLaunchPanel origin={{ ...origin(), honorTacticalCredit: true }} target={{ kind: 'PLANET', id: 'target' }}
    targetName="Asterion" flightMs={60000} pending={false} onLaunch={vi.fn()} />);
  expect(screen.getByText(/at most 2.5 Honor per bomb/)).toBeTruthy();
  expect(screen.getByText(/Pressuring weak targets can cost Honor/)).toBeTruthy();
});

it('does not promise radiation Honor in a season without the tactical policy', () => {
  render(<RadiationBombLaunchPanel origin={origin()} target={{ kind: 'PLANET', id: 'target' }}
    targetName="Asterion" flightMs={60000} pending={false} onLaunch={vi.fn()} />);
  expect(screen.getByText('Special weapons do not change Honor in this season.')).toBeVisible();
  expect(screen.queryByText(/at most 2.5 Honor per bomb/)).toBeNull();
});

it('keeps the forge help consistent with the current season instead of advertising an unavailable Honor gain', () => {
  render(<RadiationBombForge planet={origin()} held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }}
    now={0} pending={false} onBuild={vi.fn()} />);
  fireEvent.click(screen.getByText('How it works'));
  expect(screen.getByText('Special weapons do not change Honor in this season.')).toBeVisible();
  expect(screen.queryByText(/at most 2.5 Honor per bomb/)).toBeNull();
});


it('shows the colony loyalty and maximum fault payload on each product', () => {
  render(<RadiationBombForge planet={origin()} held={{ alloy: 100000, crystal: 100000, deuterium: 100000 }}
    now={0} pending={false} onBuild={vi.fn()} />);
  for (const [level, loss, faults] of [[1, 5, 0], [2, 10, 1], [3, 15, 2]]) {
    const card = screen.getByTestId(`radiation-product-${String(level)}`);
    expect(within(card).getByText(`Colonies: −${String(loss)} loyalty points · up to ${String(faults)} new faults.`)).toBeTruthy();
  }
});

it.each(['PLANET', 'MONUMENT'] as const)('shows the selected colony payload only for a %s launch', kind => {
  render(<RadiationBombLaunchPanel origin={origin()} target={{ kind, id: 'target' }} targetName="Target"
    flightMs={60000} pending={false} onLaunch={vi.fn()} />);
  const text = 'Colonies: −5 loyalty points · up to 0 new faults.';
  if (kind === 'PLANET') expect(screen.getByText(text)).toBeTruthy();
  else expect(screen.queryByText(text)).toBeNull();
});

it('updates the colony payload when the selected launch level changes', () => {
  const ready = origin();
  ready.radiationBombs.push({ id: 'l3', level: 3, status: 'READY', readyAt: null, remainingSeconds: 0 });
  render(<RadiationBombLaunchPanel origin={ready} target={{ kind: 'PLANET', id: 'target' }} targetName="Colony"
    flightMs={60000} pending={false} onLaunch={vi.fn()} />);
  fireEvent.click(screen.getByRole('radio', { name: /L3/ }));
  expect(screen.getByText('Colonies: −15 loyalty points · up to 2 new faults.')).toBeTruthy();
});
