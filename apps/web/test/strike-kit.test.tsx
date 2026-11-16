import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GalaxyPlanet, PlanetView } from '../src/api/schemas.js';
import { DeathStarSection, StrikeSheet } from '../src/galaxy/FocusPanel.js';
import { ApiError } from '../src/api/client.js';
import { RadiationBombLaunchPanel } from '../src/screens/RadiationBombControls.js';
import { planetView } from './fixtures.js';

/**
 * G4-j (2026-11-15): THE TWO STRIKES ON THE GAME KIT. "Shall I fire it?" Both fold on the focus
 * panel under one kit head — the strike, its target, the weapons ready — and open on the facts
 * in a kit well, the Honor rule in the launch's Honor box, and the launch on the kit's FINAL
 * hold (1.5 s): a weapon fired is gone, and it cannot be called back.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|strike-launch|honor-note|(^|\s)text-(micro|body|caption|label)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const world: GalaxyPlanet = {
  id: 'p2', name: 'Grimhold', owner: 'Sable', position: { x: 200, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, intel: 'RESOLVED',
  kind: 'COLONY', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
};
const armed = (): PlanetView => ({
  ...planetView({ buildings: { CORE: 8, SHIPYARD: 4 }, fleet: { DART: 6 } }, { alloy: 40_000, crystal: 20_000 }),
  strategic: { id: 's1', status: 'READY', readyAt: new Date(), remainingSeconds: null },
});
const bombs = (): PlanetView => planetView({ radiationBombsAvailable: true, radiationBombs: [
  { id: 'l1', level: 1, status: 'READY', readyAt: null, remainingSeconds: 0 },
  { id: 'l3', level: 3, status: 'READY', readyAt: null, remainingSeconds: 0 },
], buildings: { CORE: 13, SHIPYARD: 5 } });

describe('the Death Star’s strike on the kit', () => {
  it('folds under the kit’s strike head and opens on a kit well, an Honor box and the final hold', () => {
    const onLaunch = vi.fn();
    const { container } = render(<DeathStarSection target={world} origin={armed()} disabledReason={null} onLaunch={onLaunch} />);
    const fold = container.querySelector<HTMLElement>('[data-strike-section]')!;
    expect(fold.tagName).toBe('DETAILS');
    expect(fold).toHaveClass('gk-strike');
    expect(oldPaint(fold)).toEqual([]);
    fireEvent.click(fold.querySelector('summary')!);
    expect(fold.querySelector('.gk-well.gk-strike__facts')).not.toBeNull();
    expect(fold.querySelector('[data-honor-weapon-rule]')).toHaveClass('gk-honor');
    const hold = container.querySelector<HTMLElement>('[data-death-star]')!;
    expect(hold).toHaveClass('gk-hold');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('1500ms');
    fireEvent.keyDown(hold, { key: 'Enter' });
    fireEvent.keyDown(hold, { key: 'Enter' });
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it('as a sheet: a kit sheet in the colour of harm with the final hold', () => {
    render(<StrikeSheet target={world} origin={armed()} onConfirm={vi.fn()} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(oldPaint(dialog)).toEqual([]);
    expect(dialog.querySelector('[data-hold]')).toHaveStyle({ '--gk-hold-ms': '1500ms' });
  });
});

describe('the radiation strike on the kit', () => {
  it('folds under the same head, names its ready bombs, and fires on the final hold', () => {
    render(<RadiationBombLaunchPanel origin={bombs()} target={{ kind: 'PLANET', id: 't' }} targetName="Grimhold" flightMs={60000}
      pending={false} onLaunch={vi.fn()} collapsible />);
    const fold = screen.getByTestId('radiation-launch');
    expect(fold).toHaveClass('gk-strike');
    expect(oldPaint(fold)).toEqual([]);
    expect(fold.querySelector('summary')).toHaveTextContent(/2 ready/);
    expect(fold.querySelector('[data-hold]')).toHaveStyle({ '--gk-hold-ms': '1500ms' });
    expect(fold.querySelector('[data-honor-weapon-rule]')).toHaveClass('gk-honor');
  });

  // The colony's long rule waits one press away; the payload itself stays on the face.
  it('keeps the colony payload on the face and its rules one press away', () => {
    render(<RadiationBombLaunchPanel origin={bombs()} target={{ kind: 'PLANET', id: 't' }} targetName="Grimhold" flightMs={60000}
      pending={false} onLaunch={vi.fn()} />);
    expect(screen.getByText(/Colonies: −5 loyalty points/)).toBeVisible();
    expect(screen.queryByText(/apply only to colonies/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'How it works' }));
    expect(screen.getByText(/apply only to colonies/)).toBeVisible();
  });

  it('stays an open kit section where it does not fold', () => {
    render(<RadiationBombLaunchPanel origin={bombs()} target={{ kind: 'MONUMENT', id: 'm' }} targetName="Station" flightMs={60000}
      pending={false} onLaunch={vi.fn()} />);
    const section = screen.getByTestId('radiation-launch');
    expect(section.tagName).toBe('SECTION');
    expect(oldPaint(section)).toEqual([]);
  });

  it('asks to drop the shield on the kit’s switch, and says the refusal in a warning note', () => {
    render(<RadiationBombLaunchPanel origin={bombs()} target={{ kind: 'PLANET', id: 't' }} targetName="Grimhold" flightMs={60000}
      pending={false} onLaunch={vi.fn()} error={new ApiError('SHIELD_WOULD_DROP', 'shield', 409)} />);
    const fold = screen.getByTestId('radiation-launch');
    expect(oldPaint(fold)).toEqual([]);
    const shield = screen.getByRole('switch');
    expect(shield).toHaveClass('gk-toggle');
    expect(screen.getByRole('alert')).toHaveClass('gk-inote');
  });
});
