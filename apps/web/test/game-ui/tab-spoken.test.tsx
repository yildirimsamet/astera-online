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
