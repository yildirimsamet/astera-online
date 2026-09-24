import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { duration } from '../../src/lib/time.js';
import { CommanderCard, initials, seasonDay, type CommanderCardProps } from '../../src/v2/hud/CommanderCard.js';

/**
 * THE COMMANDER PAGE OPENS ON THE COMMANDER (owner, 2026-09-24).
 *
 * "Sol üstteki menüyü açan buton bir profil sayfası butonu gibi tasarlanmış ancak
 * asıl yaptığı iş menüyü açmak?!" The chip is the mock's avatar, and the mock says
 * what it opens: the profile, the ranking, the rewards, the settings. The sheet had
 * the last three and nothing of the first — a title with a name and then tiles.
 */

const NOW = Date.parse('2026-09-24T12:00:00Z');

const props = (over: Partial<CommanderCardProps> = {}): CommanderCardProps => ({
  name: 'Kestrel Sable',
  clan: { tag: 'NOVA', name: 'Nova Kolektif' },
  galaxy: 'Vantage',
  seasonDay: 9,
  rank: { place: 14, of: 212 },
  worlds: { held: 2, max: 4 },
  shield: { until: NOW + (9 * 60 + 12) * 60_000, kind: 'NEWCOMER' },
  now: NOW,
  ...over,
});

/** The value printed under a cell's label. */
const cell = (label: string): string | null | undefined => screen.getByText(label).nextElementSibling?.textContent;

describe('the commander card', () => {
  it('is the avatar, the clan, and where and when this season is', () => {
    render(<CommanderCard {...props()} />);
    expect(screen.getByText('KS')).toBeInTheDocument();
    expect(screen.getByText('NOVA')).toBeInTheDocument();
    expect(screen.getByText('Nova Kolektif')).toBeInTheDocument();
    expect(screen.getByText('Vantage · Season day 9')).toBeInTheDocument();
  });

  /** A place means nothing without the field it was taken in. */
  it('reads the rank against the field, the worlds against the most one can hold, and the shield left', () => {
    render(<CommanderCard {...props()} />);
    expect(cell('Rank')).toBe('14 / 212');
    expect(cell('Worlds')).toBe('2 / 4');
    expect(cell('Shield')).toBe(duration(9 * 60 + 12));
  });

  it('says what is missing rather than drawing nothing', () => {
    render(<CommanderCard {...props({ clan: null, rank: null, shield: null, seasonDay: null })} />);
    expect(screen.getByText('No clan')).toBeInTheDocument();
    expect(screen.getByText('Vantage')).toBeInTheDocument();
    expect(cell('Rank')).toBe('—');
    expect(cell('Shield')).toBe('None');
  });

  it('treats a shield already run out as none', () => {
    render(<CommanderCard {...props({ shield: { until: NOW - 1, kind: 'RECOVERY' } })} />);
    expect(cell('Shield')).toBe('None');
  });
});

describe('initials', () => {
  it('takes the first letter of two words, or the first two of one', () => {
    expect(initials('Kestrel Sable')).toBe('KS');
    expect(initials('shell83807481')).toBe('SH');
    expect(initials('  ')).toBe('?');
    expect(initials('Ö')).toBe('Ö');
  });
});

describe('the season day', () => {
  it('counts the first day as day one and never goes below it', () => {
    const start = Date.parse('2026-09-16T00:00:00Z');
    expect(seasonDay(start, start)).toBe(1);
    expect(seasonDay(start, start + 86_400_000 - 1)).toBe(1);
    expect(seasonDay(start, start + 8 * 86_400_000)).toBe(9);
    expect(seasonDay(start, start - 5_000)).toBe(1);
  });
});

describe('the commander page', () => {
  const galaxy = readFileSync('src/screens/GalaxyView.tsx', 'utf8');

  it('opens on the card, above the menu', () => {
    const sheet = galaxy.slice(galaxy.indexOf("panel === 'menu' && ("), galaxy.indexOf('<MenuPanel'));
    expect(sheet).toMatch(/<CommanderHost name={commander} \/>/);
  });
});
