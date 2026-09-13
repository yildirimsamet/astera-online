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
      '01:00–03:00', '07:00–09:00', '15:00–17:00', '21:00–23:00',
      '19:00–21:00',
    ]) {
      expect(screen.getAllByText(time).length).toBeGreaterThan(0);
    }
  });

  it('explains the reward and interaction rules without technical language', () => {
    render(<GalaxyEventsGuide onClose={vi.fn()} />);

    expect(screen.getByText(/yeni asteroid oluşma hızını artırır/i)).toBeInTheDocument();
    expect(screen.getByText(/32 Alaşım = 16 Kristal = 1 Döteryum/i)).toBeInTheDocument();
    expect(screen.getByText(/filon kayıp vermez/i)).toBeInTheDocument();
  });
});
