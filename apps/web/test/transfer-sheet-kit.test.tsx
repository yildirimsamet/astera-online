import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Choices } from '../src/game-ui/index.js';
import { TransferSheet } from '../src/screens/TransferSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * G4-f1 (2026-11-15): A TRANSFER ON THE GAME KIT. "Move ships and stores between my worlds."
 * The sheet is the kit's in my colour; what the origin keeps is a kit bar; each hull a kit row
 * and counter; what the ships do after delivery is the kit's choice plates; the flight in kit
 * figures; and the send is the kit's hold, weighed as a spend.
 */

vi.mock('../src/api/queries.js', () => ({
  useTransfer: () => ({ mutate: vi.fn(), isPending: false }),
  useGalaxy: () => ({ data: { radiation: [], hpRadiation: [] } }),
}));

const V2_LOOK = /(^|\s)(text|bg|border|font|accent)-v2-|rounded-(control|chip|cell|full)|v2-legend|(^|\s)text-(micro|caption|body)(\s|$)|(^|\s)truncate(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const target = {
  id: 'colony-1', name: 'Haven', owner: 'Commander', kind: 'COLONY' as const,
  controller: { kind: 'PLAYER' as const, playerId: 'player-1', displayName: 'Commander' },
  position: { x: 100, y: 0, z: 0 }, coreTier: 2, coreLevel: 6, intel: 'RESOLVED' as const, satellites: [],
  shielded: false, isSelf: false, state: { kind: 'NORMAL' as const }, isOwned: true, isCapital: false,
};

const open = () => render(<ToastProvider><TransferSheet target={target}
  planet={planetView({ fleet: { COURIER: 2, DART: 2 } }, { id: 'capital-1', deuterium: 50_000 })}
  onClose={vi.fn()} onLaunched={vi.fn()} /></ToastProvider>);

describe('a transfer on the kit', () => {
  it('is a kit sheet in my colour', () => {
    open();
    expect(screen.getByRole('dialog')).toHaveClass('gk-sheet');
  });

  it('draws what the origin keeps, the hulls and the return plan on the kit', () => {
    open();
    const keeps = document.querySelector<HTMLElement>('[data-origin-defence]')!.parentElement!;
    expect(oldPaint(keeps)).toEqual([]);
    const dart = document.querySelector<HTMLElement>('[data-hull-row="DART"]')!;
    expect(dart).toHaveClass('gk-lrow');
    expect(dart.querySelector('.gk-qty')).not.toBeNull();
    expect(oldPaint(dart.closest('section')!)).toEqual([]);
    const plan = document.querySelector<HTMLElement>('[data-transfer-return-plan]')!;
    expect(oldPaint(plan)).toEqual([]);
    expect(plan.querySelectorAll('.gk-choices')).toHaveLength(2);
    expect(within(plan).getByRole('radio', { name: /haulers.*stay/i })).toHaveClass('gk-tab');
  });

  it('reads the flight in kit figures and sends on the kit’s one-second hold', () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'More Dart' }));
    const eta = document.querySelector<HTMLElement>('[data-transfer-eta]')!;
    expect(eta).toHaveClass('gk-figure');
    expect(oldPaint(eta.parentElement!)).toEqual([]);
    const commit = document.querySelector<HTMLElement>('[data-transfer-commit]')!;
    expect(oldPaint(commit)).toEqual([]);
    const send = within(commit).getByRole('button');
    expect(send).toHaveClass('gk-hold');
    expect(send.style.getPropertyValue('--gk-hold-ms')).toBe('1000ms');
  });
});

describe('the kit’s choice plates', () => {
  it('may name a plate fully for a reader while its face stays short', async () => {
    const onChange = vi.fn();
    render(<Choices label="Haulers" value="STAY" onChange={onChange}
      options={[{ id: 'STAY', label: 'Stay', spoken: 'Haulers stay' }, { id: 'RETURN', label: 'Return', spoken: 'Haulers return' }]} />);
    const back = screen.getByRole('radio', { name: 'Haulers return' });
    expect(back).toHaveTextContent('Return');
    await userEvent.setup().click(back);
    expect(onChange).toHaveBeenCalledWith('RETURN');
  });
});
