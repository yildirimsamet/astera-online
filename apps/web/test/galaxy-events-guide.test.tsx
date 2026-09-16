import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GalaxyEventsGuide } from '../src/screens/GalaxyEventsGuide.js';
import i18n from '../src/i18n/index.js';

beforeEach(async () => {
  await i18n.changeLanguage('tr');
});

describe('galaxy events guide', () => {
  it('shows every recurring event in Turkish and labels the Türkiye clock', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Galaksi etkinlikleri' })).toBeInTheDocument();
    expect(screen.getByText('Türkiye saati (UTC+3)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asteroid Yağmuru' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ticaret Gemisi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Galaksilerarası Konvoy' })).toBeInTheDocument();
  });

  it('renders the full fixed daily schedule from the live rules', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    for (const time of [
      '02:00–03:00', '10:00–11:00', '13:00–14:00', '16:00–17:00', '20:00–21:00',
      '23:00–24:00',
      '01:00–03:00', '07:00–09:00', '15:00–17:00', '21:00–23:00',
      '12:00–14:00', '19:00–21:00',
    ]) {
      expect(screen.getAllByText(time).length).toBeGreaterThan(0);
    }
  });

  /**
   * THE DAY IS READ FORWARD, AND IT DOES NOT RESTART AT MIDNIGHT. Owner
   * instruction, 2026-09-16: *"modal'da gece 24:00'dan sonraki eventlerin
   * gösterimini en son'a koy."*
   *
   * The windows are authored in ascending local minutes and the guide printed them
   * in exactly that order, so the list opened on 01:00 and 02:00 — the two windows
   * a player is least likely to be awake for — and buried the evening under them.
   * Worse, it read as a day that ENDS at 02:00, which is the opposite of what those
   * two windows are: the tail of the night the player has just slept through.
   *
   * A pure presentation rule. The authored order in `packages/rules` decides which
   * sequence number each occurrence is dealt, and therefore the index every
   * asteroid id is an HMAC of — so nothing here may reorder that array, and this
   * sorts a copy.
   */
  it('reads the day forward and puts the small hours last', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    const timesIn = (heading: string): string[] => {
      const card = screen.getByRole('heading', { name: heading }).closest('article');
      expect(card, `${heading} has no card`).not.toBeNull();
      return [...card!.querySelectorAll('.num')].map((pill) => pill.textContent.slice(0, 11));
    };

    expect(timesIn('Asteroid Yağmuru')).toEqual([
      '10:00–11:00', '13:00–14:00', '16:00–17:00', '20:00–21:00', '23:00–24:00',
      '02:00–03:00',
    ]);
    // The owner's own example: 01:00 sits after the window that ends at midnight.
    expect(timesIn('Ticaret Gemisi')).toEqual([
      '07:00–09:00', '15:00–17:00', '21:00–23:00', '01:00–03:00',
    ]);
    // A lane with nothing in the small hours is left exactly as authored.
    expect(timesIn('Galaksilerarası Konvoy'))
      .toEqual(['07:00–09:00', '12:00–14:00', '19:00–21:00']);
  });

  it('explains the reward and interaction rules without technical language', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByText(/yeni asteroid oluşma hızını artırır/i)).toBeInTheDocument();
    expect(screen.getByText(/32 Alaşım = 16 Kristal = 1 Döteryum/i)).toBeInTheDocument();
    expect(screen.getByText(/filon kayıp vermez/i)).toBeInTheDocument();
  });
});
