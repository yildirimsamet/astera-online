import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CoachMark, Dialog } from '../../src/game-ui/index.js';

/** The guiding hand's line stays on the screen wherever the thing to press is. */
describe('the guiding hand', () => {
  it('keeps its line inside its frame, at either edge', () => {
    for (const x of [8, 50, 92]) {
      const { container, unmount } = render(<CoachMark x={x} y={40} text="Tap the Core" hand="/hand.webp" />);
      const bubble = container.querySelector<HTMLElement>('.gk-coach__bubble');
      expect(bubble?.style.left).toBe('0px');
      // Its own width, shifted by the same share as the point it hangs from: never past either edge.
      expect(bubble?.style.translate).toBe(`-${String(x)}% 0`);
      unmount();
    }
  });
});

describe('the dialog', () => {
  it('takes the focus as it opens, so a keyboard or a reader starts inside it', () => {
    render(<Dialog ribbon="Rank up">Captain</Dialog>);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });
});
