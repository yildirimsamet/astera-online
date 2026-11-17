import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsList, NewsRow, RoundButton } from '../../src/game-ui/index.js';

/**
 * THE NEWS (G1-e, 2026-11-14). What happened while the player was away, one row each: a coin
 * in the colour of what kind of news it is with its mark (an attack, a probe, ships home), the
 * sentence, how long ago. The row's ground says whether it went the player's way — thinly green,
 * thinly red, nothing for neither — and a new row is lit, its coin bright and a dot in its
 * corner. A press opens what the news is about; a round press beside it flies to whoever it names.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('a row of news', () => {
  it('wears the colour of its kind and the mark of what happened, then the sentence and its age', () => {
    const { container } = render(<NewsRow glyph="attack" tone="hostile" age="35 dk önce">Akın yedin · −1,1K gitti</NewsRow>);
    const row = container.querySelector('.gk-news');
    expect(row).toHaveAttribute('data-tone', 'hostile');
    expect(row?.querySelector('.gk-news__coin')).toHaveAttribute('data-glyph', 'attack');
    expect(row).toHaveTextContent('Akın yedin · −1,1K gitti');
    expect(row).toHaveTextContent('35 dk önce');
  });

  it('lies on the ground of how it went, and on none when it went neither way', () => {
    const { container, rerender } = render(<NewsRow glyph="attack" tone="hostile" outcome="loss">x</NewsRow>);
    expect(container.querySelector('.gk-news')).toHaveAttribute('data-outcome', 'loss');
    rerender(<NewsRow glyph="zoom" tone="warn">x</NewsRow>);
    expect(container.querySelector('.gk-news')).not.toHaveAttribute('data-outcome');
  });

  it('is lit while it is new, and says so only with light: the reader hears the sentence', () => {
    const { container, rerender } = render(<NewsRow glyph="eye" tone="good" fresh>x</NewsRow>);
    expect(container.querySelector('.gk-news')).toHaveAttribute('data-fresh');
    expect(container.querySelector('[data-unread]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    rerender(<NewsRow glyph="eye" tone="good">x</NewsRow>);
    expect(container.querySelector('.gk-news')).not.toHaveAttribute('data-fresh');
    expect(container.querySelector('[data-unread]')).toBeNull();
  });

  it('opens what it is about on a press', () => {
    const onOpen = vi.fn();
    render(<NewsRow glyph="attack" tone="hostile" open={{ label: 'İlgili raporu aç', onPress: onOpen }}>x</NewsRow>);
    press(screen.getByRole('button', { name: 'İlgili raporu aç' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('carries a round press of its own above the row, which does not open the row', () => {
    const onOpen = vi.fn();
    const onFly = vi.fn();
    const { container } = render(
      <NewsRow glyph="attack" tone="hostile" open={{ label: 'İlgili raporu aç', onPress: onOpen }}
        tool={<RoundButton small glyph="target" label="Haritada göster: Akıncı" onPress={onFly} />}>x</NewsRow>,
    );
    const fly = screen.getByRole('button', { name: 'Haritada göster: Akıncı' });
    expect(fly.closest('.gk-news__tool')).not.toBeNull();
    press(fly);
    expect(onFly).toHaveBeenCalledOnce();
    expect(onOpen).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  /**
   * THE RETURN STORY'S ROW (C1, 2026-11-14): what it came to sits under the sentence, quieter, and
   * the row can say where its press goes — the eye reads the door, the reader hears it once, on the press.
   */
  it('says what it came to under the sentence, quieter', () => {
    const { container } = render(<NewsRow glyph="target" tone="hostile" detail="Biri senin resmini çıkarıyor.">2 tarama seni buldu</NewsRow>);
    expect(container.querySelector('.gk-news__line')).toHaveTextContent('2 tarama seni buldu');
    expect(container.querySelector('.gk-news__detail')).toHaveTextContent('Biri senin resmini çıkarıyor.');
  });

  it('can show where its press goes under the sentence, said once to a reader', () => {
    const onOpen = vi.fn();
    const { container } = render(
      <NewsRow glyph="target" tone="hostile" open={{ label: 'Radarı aç', onPress: onOpen, shown: true }}>2 tarama seni buldu</NewsRow>,
    );
    const door = container.querySelector('.gk-news__door');
    expect(door).toHaveTextContent('Radarı aç');
    expect(door).toHaveAttribute('aria-hidden', 'true');
    press(screen.getByRole('button', { name: 'Radarı aç' }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('keeps its door to itself unless asked to show it', () => {
    const { container } = render(<NewsRow glyph="attack" tone="hostile" open={{ label: 'İlgili raporu aç', onPress: vi.fn() }}>x</NewsRow>);
    expect(container.querySelector('.gk-news__door')).toBeNull();
  });

  it('heads a galaxy-wide row with what it is, so it is never read as personal news', () => {
    render(<NewsRow glyph="star" tone="info" banner="Galaksi olayı">Galakside asteroid yağmuru başladı.</NewsRow>);
    expect(screen.getByText('Galaksi olayı')).toHaveClass('gk-news__banner');
  });
});

describe('a list of news', () => {
  it('is a list named by what it holds, under its head', () => {
    render(
      <NewsList title="Neler oldu">
        <li><NewsRow glyph="eye" tone="good">a</NewsRow></li>
        <li><NewsRow glyph="recall" tone="good">b</NewsRow></li>
      </NewsList>,
    );
    const list = screen.getByRole('list', { name: 'Neler oldu' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Neler oldu')).toHaveClass('gk-label');
  });

  it('can stand without a head, named for the reader only', () => {
    render(<NewsList label="Neler oldu"><li><NewsRow glyph="eye" tone="good">a</NewsRow></li></NewsList>);
    expect(screen.getByRole('list', { name: 'Neler oldu' })).toBeInTheDocument();
    expect(screen.queryByText('Neler oldu')).toBeNull();
  });
});
