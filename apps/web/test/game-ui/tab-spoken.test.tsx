import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GameTabs } from '../../src/game-ui/controls.js';

/**
 * A TAB'S NEWS, SAID (C2, 2026-11-14). A count on a tab is a red number to the eye; a reader
 * hears the tab's name with what the number means ("Clan — 2 unread"). A fact under the tab
 * (`mark`) still speaks first: it is what the tab is about right now.
 */
describe('a tab with news', () => {
  it('is named for a reader with what its count means', () => {
    render(<GameTabs label="Odalar" value="general" onChange={vi.fn()} tabs={[
      { id: 'general', label: 'Genel' },
      { id: 'clan', label: 'Klan', badge: 2, spoken: 'Klan — 2 okunmamış' },
    ]} />);
    const clan = screen.getByRole('tab', { name: 'Klan — 2 okunmamış' });
    expect(clan.querySelector('.gk-dot')).toHaveTextContent('2');
    expect(screen.getByRole('tab', { name: 'Genel' })).toBeInTheDocument();
  });

  it('lets a fact under the tab speak before its news', () => {
    render(<GameTabs label="Odalar" value="general" onChange={vi.fn()} tabs={[
      { id: 'general', label: 'Genel', spoken: 'Genel — 1 okunmamış', mark: { glyph: 'warn', hint: 'Genel: arıza var' } },
    ]} />);
    expect(screen.getByRole('tab', { name: 'Genel: arıza var' })).toBeInTheDocument();
  });
});

/** G12-d2 (2026-11-16): a tab can wear a drawing of its own (a ship class's signature) where the glyph set has no word. */
describe('a tab with its own picture', () => {
  it('draws the picture beside its name, hidden from a reader', () => {
    render(<GameTabs label="Sınıf" value="a" onChange={vi.fn()} tabs={[
      { id: 'a', label: 'Akıncı', art: <svg data-testid="sig" /> },
    ]} />);
    const tab = screen.getByRole('tab', { name: 'Akıncı' });
    expect(tab.querySelector('.gk-tab__glyph [data-testid="sig"]')).not.toBeNull();
    expect(tab.querySelector('.gk-tab__glyph')).toHaveAttribute('aria-hidden', 'true');
  });
});

