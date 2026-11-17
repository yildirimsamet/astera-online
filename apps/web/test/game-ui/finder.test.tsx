import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DropPanel, GLYPH_IDS, PickRow, Tally } from '../../src/game-ui/index.js';

/**
 * THE FINDER (G1-d2, 2026-11-14). What is out there in the galaxy, counted at a glance at the
 * top right: each thing a count in its own colour with its mark, the figure large enough to
 * read over the stars. A press on a count drops the list of those things, each a row that flies
 * the camera there. The words are for the reader and on the list's head; the eye reads marks.
 */

const press = (element: HTMLElement): void => {
  fireEvent.pointerDown(element, { button: 0 });
  fireEvent.pointerUp(element);
  fireEvent.click(element, { detail: 1 });
};

describe('a count of something out there', () => {
  it('shows its figure and mark in its colour, and says what it counts in words', () => {
    const { container } = render(<Tally glyph="asteroid" paint="crystal" value="12" label="12 rocks" />);
    const tally = container.querySelector('.gk-tally');
    expect(tally).toHaveAttribute('data-paint', 'crystal');
    expect(tally).toHaveTextContent('12');
    expect(screen.getByText('12 rocks')).toHaveClass('sr-only');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('becomes a press that opens its list, and says whether the list is open', () => {
    const onPress = vi.fn();
    const { rerender } = render(<Tally glyph="pirate" paint="hostile" value="3" label="3 pirates" onPress={onPress} expanded={false} />);
    const button = screen.getByRole('button', { name: '3 pirates' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(button).not.toHaveAttribute('aria-controls');
    press(button);
    expect(onPress).toHaveBeenCalledOnce();
    rerender(<Tally glyph="pirate" paint="hostile" value="3" label="3 pirates" onPress={onPress} expanded controls="list" />);
    expect(screen.getByRole('button', { name: '3 pirates' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '3 pirates' })).toHaveAttribute('aria-controls', 'list');
  });
});

describe('the list a count drops', () => {
  it('is a list named by what it holds, under a head in the colour of the count', () => {
    const { container } = render(
      <DropPanel id="targets" label="12 rocks" title="12 rocks" paint="crystal">
        <li><PickRow glyph="target" tone="self" index="01" title="Rock L2" detail="2,400 ore" onPress={() => undefined} /></li>
      </DropPanel>,
    );
    const list = screen.getByRole('list', { name: '12 rocks' });
    expect(list).toHaveAttribute('id', 'targets');
    expect(container.querySelector('.gk-drop')).toHaveAttribute('data-paint', 'crystal');
    expect(within(list).getAllByRole('button')).toHaveLength(1);
  });

  it('reads a row as its place, its name and its clause, and flies on a press', () => {
    const onPress = vi.fn();
    render(<PickRow glyph="target" tone="hostile" index="05" title="First • Citadel" detail="4,0K away" onPress={onPress} />);
    const row = screen.getByRole('button', { name: /First • Citadel/ });
    expect(row.textContent).toMatch(/^05First • Citadel4,0K away$/);
    expect(row).toHaveAttribute('data-tone', 'hostile');
    press(row);
    expect(onPress).toHaveBeenCalledOnce();
  });
});

describe('the pirate mark', () => {
  it('is in the kit', () => {
    expect(GLYPH_IDS).toContain('pirate');
  });
});
