import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { arenaCopy } from '../../src/arena/copy.js';
import { GraphicsPicker } from '../../src/arena/GraphicsPicker.js';

/** The menu's graphics row: four choices on one line, the chosen one says what it costs. */
describe('the arena graphics picker', () => {
  const c = arenaCopy();

  it('offers Yüksek, Dengeli, Düşük, Otomatik and marks the current one', () => {
    const view = render(<GraphicsPicker c={c} value="balanced" onPick={() => undefined} />);
    const radios = view.getAllByRole('radio');
    expect(radios.map(r => r.textContent)).toEqual([c.graphicsChoices.high, c.graphicsChoices.balanced, c.graphicsChoices.low, c.graphicsChoices.auto]);
    expect(radios.map(r => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    expect(view.container.textContent).toContain(c.graphicsNotes.balanced);
  });

  it('hands a tapped choice to the caller', () => {
    const onPick = vi.fn();
    const view = render(<GraphicsPicker c={c} value="balanced" onPick={onPick} />);
    fireEvent.click(view.getByRole('radio', { name: c.graphicsChoices.auto }));
    expect(onPick).toHaveBeenCalledWith('auto');
  });
});
