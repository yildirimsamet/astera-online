import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n/index.js';
import { arenaCopy } from '../../src/arena/copy.js';
import { ModePicker } from '../../src/arena/ModePicker.js';

let language: string;
beforeEach(async () => { language = i18n.language; await i18n.changeLanguage('tr'); });
afterEach(async () => { await i18n.changeLanguage(language); });

/**
 * F8 (S22 review, 2026-10-26): "Solo uçuş / Ortak alan" read as alone or with a team. The real
 * difference is that one is practice with nothing at stake and the other is the live room where
 * the hold, the loot and the XP are real. F3: a commander below the Core the ship needs was offered
 * the live room, and learned at the launch button that it was shut.
 */
describe('the flight\'s mode', () => {
  it('names each mode with what it is worth', () => {
    const c = arenaCopy();
    render(<ModePicker c={c} mode="online" onPick={vi.fn()} lock={null} />);
    const real = screen.getByRole('radio', { name: new RegExp(c.shared) });
    const practice = screen.getByRole('radio', { name: new RegExp(c.solo) });
    expect(real.textContent).toContain(c.sharedNote);
    expect(practice.textContent).toContain(c.soloNote);
    expect(real.getAttribute('aria-checked')).toBe('true');
    expect(c.shared).toBe('Gerçek uçuş'); expect(c.solo).toBe('Antrenman');
  });

  it('shuts the live room below the Core, with the Core it waits for, and leaves practice open', () => {
    const c = arenaCopy();
    const pick = vi.fn();
    render(<ModePicker c={c} mode="solo" onPick={pick} lock={{ core: 7, need: 9 }} />);
    const real = screen.getByRole('radio', { name: new RegExp(c.shared) });
    expect(real).toBeDisabled();
    expect(real.textContent).toContain(c.coreShort(7, 9));
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(c.solo) }));
    expect(pick).toHaveBeenCalledWith('solo');
  });
});
