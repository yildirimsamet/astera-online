import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusChip } from '../../src/game-ui/readouts.js';

/**
 * AN EFFECT ON A FLEET OR A WORLD. A small coin of colour with its mark, the size of the
 * change, and how long it has left: green helps you, red hurts you, yellow is a risk.
 * The name is read aloud; on screen the mark carries it.
 */

describe('the status chip', () => {
  it('shows the size of the effect and names it for a screen reader', () => {
    const { container } = render(<StatusChip glyph="speed_up" tone="good" label="Hız artışı" value="+20%" />);
    const chip = screen.getByText('+20%').closest('.gk-status');
    expect(chip).toHaveTextContent('Hız artışı');
    expect(chip).toHaveAttribute('data-tone', 'good');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('says how long a timed effect has left', () => {
    render(<StatusChip glyph="radiation" tone="warn" label="Radyasyon" value="−50% üretim" until="2 sa 10 dk" />);
    expect(screen.getByText('2 sa 10 dk')).toBeInTheDocument();
  });

  it('marks harm apart from help', () => {
    render(<StatusChip glyph="defense_down" tone="hostile" label="Savunma düşüşü" value="−15%" />);
    expect(screen.getByText('−15%').closest('.gk-status')).toHaveAttribute('data-tone', 'hostile');
  });
});
