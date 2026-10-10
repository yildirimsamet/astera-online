import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GalaxyEventsGuide } from '../src/screens/GalaxyEventsGuide.js';
import i18n from '../src/i18n/index.js';

const schedule = vi.hoisted(() => {
  let next: { kind: 'ASTEROID_SHOWER'; startsAt: Date } | null = null;
  return {
    getNext: () => next,
    setNext: (value: typeof next) => { next = value; },
  };
});
vi.mock('../src/api/queries.js', () => ({
  useGalaxyEvents: () => ({ data: { events: [], next: schedule.getNext() } }),
}));

beforeEach(async () => {
  await i18n.changeLanguage('tr');
  schedule.setNext(null);
});

describe('galaxy events guide', () => {
  it('leads with the next event countdown and labels device-local clock times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T16:30:00.000Z'));
    schedule.setNext({ kind: 'ASTEROID_SHOWER', startsAt: new Date('2026-09-18T17:00:00.000Z') });
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Sıradaki etkinlik' })).toHaveTextContent(
      /Asteroid Yağmuru.*30 dk sonra/i,
    );
    expect(screen.getAllByText(/Yerel/i).length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('does not invent a countdown when the server has no public upcoming event', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.queryByRole('status', { name: 'Sıradaki etkinlik' })).not.toBeInTheDocument();
  });

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
      '12:30–13:00', '20:00–20:30', '13:00–13:30',
      '01:00–04:00', '07:00–10:00', '15:00–18:00', '21:00–24:00',
      '21:00–24:00', '12:00–15:00', '20:00–23:00',
    ]) {
      expect(screen.getAllByText(time).length).toBeGreaterThan(0);
    }
  });

  /**
   * A WORKING WEEK AND A WEEKEND, READ AS TWO ROWS. Owner instruction, 2026-09-16.
   *
   * The same 20:00 start is a x2 shower on a Wednesday and a x4 one on a Saturday,
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
      ['Hafta içi', ['12:30–13:00×2', '20:00–20:30×2']],
      ['Hafta sonu', ['13:00–13:30×2', '20:00–20:30×4']],
    ]);
    expect(rowsIn('Galaksilerarası Konvoy')).toEqual([
      ['Hafta içi', ['21:00–24:00']],
      ['Hafta sonu', ['12:00–15:00', '20:00–23:00']],
    ]);
    // The small hours still read last, after the evening.
    expect(rowsIn('Ticaret Gemisi')).toEqual([
      ['Her gün', ['07:00–10:00', '15:00–18:00', '21:00–24:00', '01:00–04:00']],
    ]);
  });

  it('states the per-commander spawn rule and the convoy’s four-hour prize', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.getByText(/saatte 0,75 asteroid/i))
      .toBeInTheDocument();
    expect(screen.getByText(/ilk 10 dakikaya/i)).toBeInTheDocument();
    expect(screen.getByText(/4 saatlik üretimine kadar/i)).toBeInTheDocument();
  });

  it('explains the reward and interaction rules without technical language', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByText(/katsayısıyla çarpar/i)).toBeInTheDocument();
    expect(screen.getByText(/32 Alaşım = 16 Kristal = 1 Döteryum/i)).toBeInTheDocument();
    expect(screen.getByText(/filon kayıp vermez/i)).toBeInTheDocument();
  });
});
