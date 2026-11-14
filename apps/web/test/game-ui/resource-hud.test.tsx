import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Medallion, ResourceHud, RoundButton, StatusChip, type HudResource } from '../../src/game-ui/index.js';

/**
 * THE GAME'S TOP BAR, ON THE KIT (G1-b, 2026-11-14). The resource pill is the press that
 * deals with its resource — it says what waits in the works, in the colour of what a press
 * does — the round buttons carry a face, a painting and a count, and an effect can be
 * asked about.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

const alloy: HudResource = { id: 'alloy', art: '/a.webp', amount: '12,4K', store: 0.62, tone: 'alloy', label: 'Alloy 12,400 / 20,000' };

describe('the resource pill', () => {
  it('is a reading until it is given a press', () => {
    render(<ResourceHud items={[alloy]} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('group', { name: /Alloy/ })).toHaveTextContent('12,4K');
  });

  it('becomes one press named for what it holds and what a press does', () => {
    const onPress = vi.fn();
    render(<ResourceHud items={[{ ...alloy, label: 'Alloy 12,400 / 20,000 · +2,200 waiting · Collect', onPress }]} />);
    const pill = screen.getByRole('button', { name: 'Alloy 12,400 / 20,000 · +2,200 waiting · Collect' });
    press(pill);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says what waits in the works in the colour of what a press does', () => {
    const { container, rerender } = render(<ResourceHud items={[{ ...alloy, pool: { text: '+2,2K', tone: 'good' } }]} />);
    expect(container.querySelector('[data-pool]')).toHaveTextContent('+2,2K');
    expect(container.querySelector('[data-pool]')).toHaveAttribute('data-tone', 'good');
    rerender(<ResourceHud items={[{ ...alloy, pool: { text: '+4K', tone: 'warn' } }]} />);
    expect(container.querySelector('[data-pool]')).toHaveAttribute('data-tone', 'warn');
  });

  it('breathes while a press is worth it', () => {
    const { container } = render(<ResourceHud items={[{ ...alloy, ripe: true, onPress: vi.fn() }]} />);
    expect(container.querySelector('.gk-res')).toHaveAttribute('data-ripe');
  });

  it('marks on the store bar the share a raid cannot take', () => {
    const { container } = render(<ResourceHud items={[{ ...alloy, safe: 0.3 }]} />);
    expect(container.querySelector<HTMLElement>('[data-safe]')?.style.left).toBe('30%');
  });

  it('keeps a hidden resource’s place so the others never move, and draws nothing in it', () => {
    const { container } = render(<ResourceHud items={[alloy, { ...alloy, id: 'deut', tone: 'deut', label: 'Deuterium', hidden: true }]} />);
    expect(container.querySelectorAll('.gk-res')).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Deuterium' })).toBeNull();
  });

  it('flies the art in and bumps the figure when a collection lands', () => {
    const { container, rerender } = render(<ResourceHud items={[alloy]} />);
    expect(container.querySelector('[data-collect-particle]')).toBeNull();
    rerender(<ResourceHud items={[{ ...alloy, flight: 7 }]} />);
    expect(container.querySelectorAll('[data-collect-particle]')).toHaveLength(3);
    expect(container.querySelector('.gk-res__amount')).toHaveAttribute('data-bump');
  });
});

describe('the status chip as a question', () => {
  it('answers a press when it is given one, named for the whole effect', () => {
    const onPress = vi.fn();
    render(<StatusChip glyph="shield" tone="info" label="Newcomer shield" value="6 h" onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Newcomer shield · 6 h' });
    press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('the round button’s face and count', () => {
  it('can wear letters instead of a glyph', () => {
    render(<RoundButton face="YI" label="Commander" onPress={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Commander' })).toHaveTextContent('YI');
  });

  it('counts news in red and beats only for something urgent', () => {
    const { rerender } = render(<RoundButton glyph="bell" label="Signals" onPress={vi.fn()} count={3} />);
    const bell = screen.getByRole('button', { name: 'Signals' });
    expect(bell.querySelector('.gk-dot')).toHaveTextContent('3');
    expect(bell).not.toHaveAttribute('data-urgent');
    rerender(<RoundButton glyph="bell" label="Signals" onPress={vi.fn()} count={3} urgent />);
    expect(screen.getByRole('button', { name: 'Signals' })).toHaveAttribute('data-urgent');
  });

  it('draws no count at zero', () => {
    render(<RoundButton glyph="bell" label="Signals" onPress={vi.fn()} count={0} />);
    expect(screen.getByRole('button').querySelector('.gk-dot')).toBeNull();
  });
});

describe('the round button’s painting', () => {
  it('wears a painting at its full size instead of a steel face, with its count', () => {
    render(<RoundButton art="/gift.webp" label="Rewards · 7 ready" onPress={vi.fn()} count={7} />);
    const gift = screen.getByRole('button', { name: 'Rewards · 7 ready' });
    expect(gift.querySelector('img')).toHaveAttribute('src', '/gift.webp');
    expect(gift.querySelector('.gk-round__face')).toBeNull();
    expect(gift.querySelector('.gk-dot')).toHaveTextContent('7');
  });
});

describe('the round button rings for news', () => {
  /** A count that rises is news arriving: the painting swings once, and a falling count is quiet. */
  it('rings once each time its count rises, and not when it falls', () => {
    const at = (count: number) => <RoundButton art="/bell.webp" label="Signals" onPress={vi.fn()} count={count} />;
    const { rerender } = render(at(0));
    const bell = () => screen.getByRole('button', { name: 'Signals' });
    expect(bell()).not.toHaveAttribute('data-rang');
    rerender(at(2));
    expect(bell()).toHaveAttribute('data-rang', '1');
    rerender(at(1));
    expect(bell()).toHaveAttribute('data-rang', '1');
    rerender(at(3));
    expect(bell()).toHaveAttribute('data-rang', '2');
  });
});

describe('the commander’s medallion', () => {
  it('wears the initials inside the painted ring, and opens the menu', () => {
    const onPress = vi.fn();
    render(<Medallion initials="YI" label="Commander Yildirim — menu" onPress={onPress} />);
    const medal = screen.getByRole('button', { name: 'Commander Yildirim — menu' });
    expect(medal).toHaveTextContent('YI');
    expect(medal.querySelector('img')?.getAttribute('src')).toMatch(/hud-medallion\.webp$/);
    press(medal);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
