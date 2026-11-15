import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnknownSignalOutcome } from '@astera/rules';
import type { UnknownSignalView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { UnknownSignalSheet } from '../src/screens/UnknownSignalSheet.js';
import { planetView } from './fixtures.js';

/**
 * G4-k (2026-11-15): THE UNKNOWN SIGNAL ON THE GAME KIT. "Shall I send a ship to the signal?"
 * The departure world on the kit's plates (no browser select), the warship on hull plates, the
 * trip in a kit well, the five outcomes in a well with their rules one press away, and the send
 * on the kit's one-second hold — a refused hold says why on its face. Each outcome lands in a
 * kit well of its own colour.
 */

const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-control|(^|\s)text-(micro|body|caption|label)(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const now = Date.parse('2026-10-17T09:00:00Z');
const signal = (outcome: UnknownSignalOutcome | null = null): UnknownSignalView => ({
  id: '00000000-0000-4000-8000-000000000001', at: { x: 2000, y: 0, z: 0 }, status: outcome ? 'returning' : 'open',
  appearedAt: new Date(now), expiresAt: new Date(now + 3_600_000), originPlanetId: null, origin: null,
  fleet: null, damage: null, departAt: null, arriveAt: null, returnDepartAt: null, returnAt: null,
  recalledAt: null, outcome, deliveredAt: null, pirateFree: false,
});
const props = () => ({ signal: signal(), planet: planetView({ fleet: { DART: 1, PIKE: 1, RAMPART: 1, COURIER: 1 },
  buildings: { CORE: 3, REFINERY: 1, EXTRACTOR: 1, SHIPYARD: 1, VAULT: 0 } }, { deuterium: 1000 }),
  now, radar: { level: 2, range: 3200 }, tier: 1 as const,
  onClose: vi.fn(), onSend: vi.fn(), onBuild: vi.fn(), onSkins: vi.fn(),
});
beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the unknown signal on the kit', () => {
  it('is a kit sheet with none of the old look and no browser select', () => {
    const p = props();
    render(<UnknownSignalSheet {...p} origins={[{ id: p.planet.planet.id, name: 'Home' }, { id: 'c2', name: 'Vesta' }]} onOrigin={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('gk-sheet');
    expect(dialog.querySelector('select')).toBeNull();
    expect(oldPaint(dialog)).toEqual([]);
  });

  it('picks the departure world on the kit’s plates', () => {
    const p = props();
    const onOrigin = vi.fn();
    render(<UnknownSignalSheet {...p} origins={[{ id: p.planet.planet.id, name: 'Home' }, { id: 'c2', name: 'Vesta' }]} onOrigin={onOrigin} />);
    const worlds = screen.getByRole('radiogroup', { name: 'Departure world' });
    expect(within(worlds).getByRole('radio', { name: 'Home' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(within(worlds).getByRole('radio', { name: 'Vesta' }));
    expect(onOrigin).toHaveBeenCalledWith('c2');
  });

  it('lays the warship on hull plates, the trip in a kit well and the outcomes’ rules one press away', () => {
    render(<UnknownSignalSheet {...props()} />);
    expect(screen.getByRole('radio', { name: /Dart/ })).toHaveClass('gk-signal__hull');
    expect(document.querySelector('.gk-well.gk-figures')).not.toBeNull();
    expect(document.querySelector('[data-signal-odds]')).toHaveClass('gk-well');
    expect(document.querySelector('details.gk-rules')).not.toBeNull();
  });

  it('sends on the kit’s one-second hold', () => {
    const p = props();
    render(<UnknownSignalSheet {...p} />);
    const hold = screen.getByRole('button', { name: /Investigate signal/ });
    expect(hold).toHaveClass('gk-hold');
    expect(hold.style.getPropertyValue('--gk-hold-ms')).toBe('1000ms');
    fireEvent.keyDown(hold, { key: 'Enter' });
    fireEvent.keyDown(hold, { key: 'Enter' });
    expect(p.onSend).toHaveBeenCalledWith('DART');
  });

  it('says on the refused hold why it cannot go', () => {
    const p = props(); p.planet.planet.deuterium = 0;
    render(<UnknownSignalSheet {...p} />);
    const refused = document.querySelector<HTMLElement>('[data-hold-refused]')!;
    expect(refused).toBeDisabled();
    expect(refused).toHaveTextContent(/deuterium for this round trip/);
  });

  it.each([
    ['PIRATES', { kind: 'PIRATES' }, 'hostile'],
    ['SKIN', { kind: 'SKIN', cosmeticId: 'planet-lava' }, 'self'],
    ['DERELICT', { kind: 'DERELICT', hull: 'PIKE', damageBp: 3000 }, 'self'],
  ] as const)('lands a %s result in a kit well of its colour', (_kind, outcome, tone) => {
    const p = props(); p.signal = signal(outcome);
    render(<UnknownSignalSheet {...p} />);
    const result = screen.getByTestId('unknown-signal-result');
    expect(result).toHaveClass('gk-well');
    expect(result).toHaveAttribute('data-tone', tone);
    expect(oldPaint(screen.getByRole('dialog'))).toEqual([]);
  });
});
