import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';
import { MoonProbeSection, OriginBodyPicker, RetargetButton, TargetBodyPicker } from '../src/screens/MoonControls.js';

describe('Moon F9c surfaces', () => {
  it('TargetBodyPicker toggles between PLANET and MOON and shows rules + unknown rarity hint (S53)', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <TargetBodyPicker value="MOON" hasMoon knownRarity={undefined} onChange={onChange} />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('moon-attack-hint')).toBeDefined();
    expect(screen.getByTestId('moon-unknown-rarity')).toBeDefined();
    fireEvent.click(screen.getByTestId('body-opt-PLANET'));
    expect(onChange).toHaveBeenCalledWith('PLANET');
  });

  it('OriginBodyPicker hides when moon has no ships and renders when ships are docked', () => {
    const { container, rerender } = render(
      <I18nextProvider i18n={i18n}>
        <OriginBodyPicker value="PLANET" hasMoonShips={false} onChange={vi.fn()} />
      </I18nextProvider>,
    );
    expect(container.firstChild).toBeNull();

    const onChange = vi.fn();
    rerender(
      <I18nextProvider i18n={i18n}>
        <OriginBodyPicker value="PLANET" hasMoonShips onChange={onChange} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('origin-opt-MOON'));
    expect(onChange).toHaveBeenCalledWith('MOON');
  });

  it('MoonProbeSection renders probed moon rarity, cracks, fleet band, and hopping flag', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MoonProbeSection
          moon={{
            rarity: 'EPIC',
            cracks: 3,
            lastHitAt: null,
            closedUntil: null,
            gateReadyAt: null,
            fleetSize: { low: 12, high: 18 },
            hopping: true,
          }}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('probe-moon-section').textContent).toMatch(/Epic|Epik/i);
    expect(screen.getByTestId('probe-moon-section').textContent).toContain('12–18');
    expect(screen.getByTestId('probe-moon-hopping')).toBeDefined();
  });

  it('RetargetButton toggles an in-flight raid between PLANET and MOON', () => {
    const onRetarget = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <RetargetButton missionId="m-1" currentBody="PLANET" onRetarget={onRetarget} />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('retarget-body-btn'));
    expect(onRetarget).toHaveBeenCalledWith('m-1', 'MOON');
  });

  it('describeNotification highlights targetBody MOON on incoming_fleet (S24) and handles moon_gate_ready (V46)', () => {
    const now = Date.now();
    const incoming = describeNotification({
      id: 'n1',
      kind: 'incoming_fleet',
      payload: {
        arriveAt: new Date(now + 9 * 60_000).toISOString(),
        etaMinutes: 9,
        targetPlanetName: 'Alpha',
        targetBody: 'MOON',
      },
      refId: 'm-1',
      seen: false,
      at: new Date(now),
    }, now);
    expect(incoming).toMatch(/MOON|AYINA/i);

    const gateReady = describeNotification({
      id: 'n2',
      kind: 'moon_gate_ready',
      payload: { planetName: 'Alpha' },
      refId: 'p-1',
      seen: false,
      at: new Date(now),
    }, now);
    expect(gateReady).toContain('Alpha');
  });
});
