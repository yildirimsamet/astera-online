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

const TURKIYE = 'Europe/Istanbul';

/** Each lane's rows as [kind of day, its windows as printed, with the day shift when there is one]. */
const rowsIn = (heading: string): [string, string[]][] => {
  const card = screen.getByRole('heading', { name: heading }).closest('article');
  expect(card, `${heading} has no card`).not.toBeNull();
  return [...card!.querySelectorAll('[data-event-days]')].map((row) => [
    row.querySelector('[data-day-name]')?.textContent ?? '',
    [...row.querySelectorAll('[data-window-time]')].map((pill) => {
      const shift = pill.closest('.gk-window')?.getAttribute('data-shift');
      return `${pill.textContent}${shift ? ` (${shift})` : ''}`;
    }),
  ]);
};

beforeEach(async () => {
  await i18n.changeLanguage('tr');
  schedule.setNext(null);
});

describe('galaxy events guide', () => {
  it('leads with the next event countdown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T16:30:00.000Z'));
    schedule.setNext({ kind: 'ASTEROID_SHOWER', startsAt: new Date('2026-09-18T17:00:00.000Z') });
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone={TURKIYE} />);

    expect(screen.getByRole('status', { name: 'Sıradaki etkinlik' })).toHaveTextContent(
      /Asteroid Yağmuru.*30 dk sonra/i,
    );
    vi.useRealTimers();
  });

  it('does not invent a countdown when the server has no public upcoming event', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.queryByRole('status', { name: 'Sıradaki etkinlik' })).not.toBeInTheDocument();
  });

  it('shows every recurring event in Turkish and names the clock it reads', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone={TURKIYE} />);

    expect(screen.getByRole('dialog', { name: 'Galaksi etkinlikleri' })).toBeInTheDocument();
    expect(screen.getByText('Senin saatin (GMT+3)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Asteroid Yağmuru' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ticaret Gemisi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Galaksilerarası Konvoy' })).toBeInTheDocument();
  });

  it('renders the full fixed schedule from the live rules', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone={TURKIYE} />);

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
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone={TURKIYE} />);

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

  it('states the five-minute presence cap on drifting rocks and pirate fleets', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.getByText(/son 5 dakikada oyunda olan oyuncu sayısından fazla/i)).toBeInTheDocument();
    expect(screen.getByText(/korsan filoları için bu sınır her zaman geçerlidir/i)).toBeInTheDocument();
  });

  it('states the same cap in every language', () => {
    for (const language of ['en', 'de', 'es', 'fr', 'ja'] as const) {
      const text = i18n.t('galaxy.eventsGuide.asteroid.summary', { lng: language, rate: '0.75', frontMinutes: 30, window: 5 });
      expect(text).toContain('5');
      expect(text).not.toBe(i18n.t('galaxy.eventsGuide.asteroid.summary', { lng: language, rate: '0.75', frontMinutes: 30, window: 9 }));
    }
  });

  /** C10: the guide on the kit — a lit countdown, each event a plate, the signal's rules folded under their name. */
  it('counts down to the next event on a lit kit plate', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T16:30:00.000Z'));
    schedule.setNext({ kind: 'ASTEROID_SHOWER', startsAt: new Date('2026-09-18T17:00:00.000Z') });
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    expect(screen.getByRole('status', { name: 'Sıradaki etkinlik' })).toHaveClass('gk-nextevent');
    vi.useRealTimers();
  });

  it('lays each event on a kit plate and folds the unknown signal under its name', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);
    for (const heading of ['Asteroid Yağmuru', 'Ticaret Gemisi', 'Galaksilerarası Konvoy']) {
      expect(screen.getByRole('heading', { name: heading }).closest('article')).toHaveClass('gk-event');
    }
    const signal = screen.getByText('Bilinmeyen sinyal').closest('details');
    expect(signal).not.toBeNull();
    expect(signal).not.toHaveAttribute('open');
  });

  /**
   * EVERY PLAYER READS THEIR OWN CLOCK (owner 2026-11-14). The times are the device's zone,
   * as the primary times; there is no second "local" line. Days stay the galaxy's (Türkiye's)
   * weekdays and weekend, so a window whose start lands on the next or the previous day for
   * the player says so, and only then does the guide explain the mark.
   */
  it('prints every window on the player’s own clock, Tokyo six hours ahead', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T06:00:00.000Z'));
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone="Asia/Tokyo" />);

    expect(screen.getByText('Senin saatin (GMT+9)')).toBeInTheDocument();
    expect(screen.queryByText(/Yerel/)).not.toBeInTheDocument();
    expect(rowsIn('Asteroid Yağmuru')).toEqual([
      ['Hafta içi', ['18:30–19:00×2', '02:00–02:30×2 (1)']],
      ['Hafta sonu', ['19:00–19:30×2', '02:00–02:30×4 (1)']],
    ]);
    expect(rowsIn('Galaksilerarası Konvoy')).toEqual([
      ['Hafta içi', ['03:00–06:00 (1)']],
      ['Hafta sonu', ['18:00–21:00', '02:00–05:00 (1)']],
    ]);
    // An every-day window has no other day to land on: no mark, and the small hours read last.
    expect(rowsIn('Ticaret Gemisi')).toEqual([
      ['Her gün', ['07:00–10:00', '13:00–16:00', '21:00–24:00', '03:00–06:00']],
    ]);
    expect(screen.getAllByText('ertesi gün').length).toBeGreaterThan(0);
    expect(screen.getByText(/\+1 senin için ertesi gün/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('reads summer time off the zone: New York is seven hours behind in September, on the same days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T06:00:00.000Z'));
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone="America/New_York" />);

    expect(screen.getByText('Senin saatin (GMT-4)')).toBeInTheDocument();
    expect(rowsIn('Asteroid Yağmuru')).toEqual([
      ['Hafta içi', ['13:00–13:30×2', '05:30–06:00×2']],
      ['Hafta sonu', ['06:00–06:30×2', '13:00–13:30×4']],
    ]);
    expect(rowsIn('Galaksilerarası Konvoy')).toEqual([
      ['Hafta içi', ['14:00–17:00']],
      ['Hafta sonu', ['13:00–16:00', '05:00–08:00']],
    ]);
    expect(rowsIn('Ticaret Gemisi')).toEqual([
      ['Her gün', ['08:00–11:00', '14:00–17:00', '18:00–21:00', '00:00–03:00']],
    ]);
    vi.useRealTimers();
  });

  it('marks a window that starts the day before, Honolulu thirteen hours behind', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-16T06:00:00.000Z'));
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone="Pacific/Honolulu" />);

    expect(rowsIn('Asteroid Yağmuru')).toEqual([
      ['Hafta içi', ['07:00–07:30×2', '23:30–24:00×2 (-1)']],
      ['Hafta sonu', ['07:00–07:30×4', '00:00–00:30×2']],
    ]);
    expect(rowsIn('Galaksilerarası Konvoy')).toEqual([
      ['Hafta içi', ['08:00–11:00']],
      ['Hafta sonu', ['07:00–10:00', '23:00–02:00 (-1)']],
    ]);
    expect(screen.getAllByText('önceki gün').length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('says nothing about other days when the player’s clock is the galaxy’s', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} timeZone={TURKIYE} />);
    expect(document.querySelector('[data-shift]')).toBeNull();
    expect(screen.queryByText(/\+1 senin için ertesi gün/)).not.toBeInTheDocument();
  });

  it('explains the reward and interaction rules without technical language', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByText(/katsayısıyla çarpar/i)).toBeInTheDocument();
    expect(screen.getByText(/32 Alaşım = 16 Kristal = 1 Döteryum/i)).toBeInTheDocument();
    expect(screen.getByText(/filon kayıp vermez/i)).toBeInTheDocument();
  });
});
