import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntergalacticConvoyFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import type { IntergalacticConvoyEvent } from '../src/lib/intergalacticConvoy.js';

const NOW = Date.now();
const convoy: IntergalacticConvoyEvent = {
  id: '3f0a2e0e-6e64-4b1e-9c0e-3b3a5f6f4d12',
  kind: 'INTERGALACTIC_CONVOY',
  startsAt: new Date(NOW - 10 * 60_000),
  endsAt: new Date(NOW + 110 * 60_000),
  appearsAtMinute: 420,
  expiresAtMinute: 540,
  route: {
    from: { x: -2_000, y: 0, z: 0 },
    to: { x: 2_000, y: 0, z: 0 },
    velocity: { x: 100 / 3, y: 0, z: 0 },
    speed: 100 / 3,
  },
  visual: { formationVersion: 1 },
  rewardPolicy: {
    resourceCapHours: 2,
    fullRewardForceRatio: 1,
    shipDropFullFirepower: 5_780,
    shipDropChanceAtFullQuality: 0.15,
    maxAwardedShips: 3,
  },
};

const rail = (over: Partial<{
  hasCombatCraft: boolean;
  launchLocked: boolean;
  occurrenceSpent: boolean;
  reachMinutes: number | null;
}> = {}) => {
  const onRaid = vi.fn();
  const view = render(
    <IntergalacticConvoyFocus
      convoy={convoy}
      minutesLeft={42}
      reachMinutes={over.reachMinutes === undefined ? 12 : over.reachMinutes}
      hasCombatCraft={over.hasCombatCraft ?? true}
      launchLocked={over.launchLocked ?? false}
      occurrenceSpent={over.occurrenceSpent ?? false}
      onClose={vi.fn()}
      onRaid={onRaid}
      open
      onToggle={vi.fn()}
    />,
  );
  return { ...view, onRaid };
};

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('the Intergalactic Convoy rail', () => {
  it('states the reach, no-loss rule, five-second window and maximum ship chance', async () => {
    const { onRaid } = rail();
    expect(document.body).toHaveTextContent(/42m/);
    expect(document.body).toHaveTextContent(/best reach 12m/i);
    expect(document.body).toHaveTextContent(/does not return fire/i);
    expect(document.body).toHaveTextContent(/5 sec/i);
    expect(document.body).toHaveTextContent('15%');
    await userEvent.setup().click(screen.getByTestId('convoy-open'));
    expect(onRaid).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ occurrenceSpent: true }, /already struck this crossing/i],
    [{ launchLocked: true }, /already away/i],
    [{ hasCombatCraft: false }, /no combat craft/i],
    [{ reachMinutes: null }, /complete the strike in time/i],
  ])('keeps a refused action visible with its reason', (props, reason) => {
    rail(props);
    const action = screen.getByTestId('convoy-open');
    expect(action).toBeDisabled();
    expect(action).toHaveTextContent(reason);
  });

  /**
   * A WORLD THAT HAS SPENT ITS ONE STRIKE SAYS SO ON THE CONTROL. D124 · D201.
   *
   * A crossing lasts two hours and a round trip rarely lasts one, so the ordinary
   * case is a commander whose fleet is home again inside the same window.
   * `launchLocked` clears on landing and knows nothing about the quota, so the
   * control re-armed and invited a launch the server was always going to refuse.
   */
  it('states the spent quota ahead of a cleared flight lock', () => {
    rail({ occurrenceSpent: true, launchLocked: false });
    const action = screen.getByTestId('convoy-open');
    expect(action).toBeDisabled();
    expect(action).toHaveTextContent(/already struck this crossing/i);
  });

  it('uses the public Turkish name and action', async () => {
    await i18n.changeLanguage('tr');
    rail();
    expect(document.body).toHaveTextContent('Galaksilerarası Konvoy');
    expect(screen.getByTestId('convoy-open')).toHaveTextContent('Akın planla');
  });
});
