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

  it('renders the full fixed schedule from the live rules', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    for (const time of [
      '12:30–13:30', '20:00–21:00', '13:00–14:00',
      '01:00–03:00', '07:00–09:00', '15:00–17:00', '21:00–23:00',
      '12:00–14:00', '20:00–22:00',
    ]) {
      expect(screen.getAllByText(time).length).toBeGreaterThan(0);
    }
  });

  /**
   * A WORKING WEEK AND A WEEKEND, READ AS TWO ROWS. Owner instruction, 2026-09-16.
   *
   * The same 20:00 hour is a x10 shower on a Wednesday and a x15 one on a Saturday,
   * so a flat list of pills could not say which is which. Each lane now states the
   * kind of day beside its windows; the merchant, which runs every day, says so.
   */
  it('groups each lane by the kind of day it runs on', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    const rowsIn = (heading: string): [string, string[]][] => {
      const card = screen.getByRole('heading', { name: heading }).closest('article');
      expect(card, `${heading} has no card`).not.toBeNull();
      return [...card!.querySelectorAll('[data-event-days]')].map((row) => [
        row.querySelector('.legend')?.textContent ?? '',
        [...row.querySelectorAll('.num')].map((pill) => pill.textContent),
      ]);
    };

    expect(rowsIn('Asteroid Yağmuru')).toEqual([
      ['Hafta içi', ['12:30–13:30×3', '20:00–21:00×10']],
      ['Hafta sonu', ['13:00–14:00×5', '20:00–21:00×15']],
    ]);
    expect(rowsIn('Galaksilerarası Konvoy')).toEqual([
      ['Hafta içi', ['21:00–23:00']],
      ['Hafta sonu', ['12:00–14:00', '20:00–22:00']],
    ]);
    // The small hours still read last, after the evening.
    expect(rowsIn('Ticaret Gemisi')).toEqual([
      ['Her gün', ['07:00–09:00', '15:00–17:00', '21:00–23:00', '01:00–03:00']],
    ]);
  });

  it('states the per-commander spawn rule and the convoy’s four-hour prize', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.getByText(/son bir saatte oynayan her komutan için 2 asteroid/i))
      .toBeInTheDocument();
    expect(screen.getByText(/4 saatlik üretimine kadar/i)).toBeInTheDocument();
  });

  it('explains the reward and interaction rules without technical language', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByText(/katsayısıyla çarpar/i)).toBeInTheDocument();
    expect(screen.getByText(/32 Alaşım = 16 Kristal = 1 Döteryum/i)).toBeInTheDocument();
    expect(screen.getByText(/filon kayıp vermez/i)).toBeInTheDocument();
  });
});
