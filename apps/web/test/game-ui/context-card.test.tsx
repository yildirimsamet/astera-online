import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextCard, ContextStrip, GameButton, RoundButton } from '../../src/game-ui/index.js';

/**
 * THE CARD AT THE FOOT OF THE GALAXY (G1-d, 2026-11-14). One card says the one thing that
 * matters now: an attack coming, a galaxy event, a suggestion. It is a cut plate in the
 * colour of whose it is — an enemy's red, yours, a warning's amber — with the thing's mark in
 * a ring that drains as its time runs out, a line of what, a clause of why, and what to do.
 * It closes with a round button; a suggestion also folds to one line the player can open again.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

const card = (props: Partial<Parameters<typeof ContextCard>[0]> = {}) => render(
  <ContextCard tone="hostile" glyph="siren" eyebrow="Gelen saldırı" title="Geliyor → Kestrel" dismissLabel="Kapat" onDismiss={() => undefined} {...props}>
    Yaklaşan tehdit · kaynak sisin ardında
  </ContextCard>,
);

describe('the context card', () => {
  it('is a region named by what it is, in the colour of whose it is', () => {
    card();
    const region = screen.getByRole('region', { name: 'Gelen saldırı' });
    expect(region).toHaveAttribute('data-tone', 'hostile');
    expect(region).toHaveTextContent('Geliyor → Kestrel');
    expect(region).toHaveTextContent('Yaklaşan tehdit · kaynak sisin ardında');
  });

  it('carries the mark of what it is in its ring', () => {
    const { container } = card({ glyph: 'asteroid', tone: 'self' });
    expect(container.querySelector('.gk-timer__ring')).toHaveAttribute('data-glyph', 'asteroid');
    expect(container.querySelector('.gk-timer')).toHaveAttribute('data-tone', 'self');
  });

  it('drains the ring over the whole of its clock and says the time large', () => {
    const { container } = card({ timer: { remaining: 540, total: 600, text: '9 dk 00 sn sonra iner' } });
    const arc = container.querySelector('.gk-timer__arc');
    const length = Number(arc?.getAttribute('stroke-dasharray'));
    expect(Number(arc?.getAttribute('stroke-dashoffset'))).toBeCloseTo(length * 0.1);
    expect(screen.getByText('9 dk 00 sn sonra iner')).toHaveClass('gk-ccard__time');
  });

  it('drains without words when its body already says the time', () => {
    const { container } = card({ tone: 'self', glyph: 'asteroid', timer: { remaining: 1800, total: 5400 } });
    expect(container.querySelector('.gk-timer__arc')).not.toBeNull();
    expect(container.querySelector('.gk-ccard__time')).toBeNull();
  });

  it('beats its ring only for an enemy: a card that always moves is not read', () => {
    const { container, rerender } = card({ tone: 'hostile' });
    expect(container.querySelector('.gk-timer')).toHaveAttribute('data-beat');
    rerender(<ContextCard tone="self" glyph="asteroid" eyebrow="Galaksi olayı" dismissLabel="Kapat" onDismiss={() => undefined} />);
    expect(container.querySelector('.gk-timer')).not.toHaveAttribute('data-beat');
  });

  it('closes with a round button of its own', () => {
    const onDismiss = vi.fn();
    card({ onDismiss });
    press(screen.getByRole('button', { name: 'Kapat' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('folds when asked to, and only then offers to', () => {
    const onFold = vi.fn();
    const { rerender } = card();
    expect(screen.queryByRole('button', { name: 'Gizle' })).toBeNull();
    rerender(
      <ContextCard tone="self" glyph="target" eyebrow="Fırsat" title="456 toplanamıyor" dismissLabel="Kapat" onDismiss={() => undefined} onFold={onFold} foldLabel="Gizle" />,
    );
    press(screen.getByRole('button', { name: 'Gizle' }));
    expect(onFold).toHaveBeenCalledOnce();
  });

  it('carries round presses of its own in its head, beside the close', () => {
    const onLook = vi.fn();
    card({ tools: <RoundButton small glyph="eye" label="Ona bak" onPress={onLook} /> });
    const look = screen.getByRole('button', { name: 'Ona bak' });
    expect(look.closest('.gk-ccard__head')).not.toBeNull();
    press(look);
    expect(onLook).toHaveBeenCalledOnce();
  });

  it('holds what to do on its own row', () => {
    const onPress = vi.fn();
    card({ actions: <GameButton tone="danger" size="sm" onPress={onPress}>Savunmayı hazırla</GameButton> });
    const region = screen.getByRole('region', { name: 'Gelen saldırı' });
    press(within(region).getByRole('button', { name: 'Savunmayı hazırla' }));
    expect(onPress).toHaveBeenCalledOnce();
    expect(region.querySelector('.gk-ccard__actions')).not.toBeNull();
  });
});

describe('the folded card', () => {
  it('is one line, one press: what it is and its title, in its colour', () => {
    const onPress = vi.fn();
    render(<ContextStrip tone="self" glyph="target" eyebrow="Fırsat" title="456 toplanamıyor" label="Göster" onPress={onPress} />);
    const strip = screen.getByRole('button', { name: 'Göster' });
    expect(strip).toHaveTextContent('Fırsat');
    expect(strip).toHaveTextContent('456 toplanamıyor');
    expect(strip).toHaveAttribute('data-tone', 'self');
    press(strip);
    expect(onPress).toHaveBeenCalledOnce();
  });
});
