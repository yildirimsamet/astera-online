import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { DiscReadout } from '../src/screens/DiscReadout.jsx';

describe('disc readout', () => {
  it('names the galaxy by its short code alone, with no word for the disc', async () => {
    await i18n.changeLanguage('en');
    render(
      <DiscReadout shard="EU-1" online={6} onlineToday={41}>
        38 worlds
      </DiscReadout>,
    );
    expect(screen.getByText('EU-1')).toBeVisible();
    expect(screen.queryByText(/The disc/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vantage/)).not.toBeInTheDocument();
  });

  it('puts the day figure beside the live one, both on the right', () => {
    const { container } = render(
      <DiscReadout shard="EU-1" online={6} onlineToday={41}>
        38 worlds
      </DiscReadout>,
    );
    expect(screen.getByText('6 online')).toBeVisible();
    expect(screen.getByText('41 in 24h')).toBeVisible();
    expect(container.querySelector('[data-population]')).toHaveClass('shrink-0');
  });

  it('omits the day figure when an older server does not send one', () => {
    render(
      <DiscReadout shard="EU-1" online={6}>
        38 worlds
      </DiscReadout>,
    );
    expect(screen.getByText('6 online')).toBeVisible();
    expect(screen.queryByText(/24h/)).not.toBeInTheDocument();
  });

  it('constrains itself to a portrait viewport', () => {
    const { container } = render(
      <DiscReadout shard="EU-123" online={50} onlineToday={280}>
        50 worlds · 12 fleets away · 9 rocks
      </DiscReadout>,
    );
    expect(container.firstElementChild).toHaveClass('max-w-[calc(100vw-1.5rem)]');
  });

  it('renders the Turkish online labels', async () => {
    await i18n.changeLanguage('tr');
    render(
      <DiscReadout shard="EU-1" online={6} onlineToday={41}>
        38 gezegen
      </DiscReadout>,
    );
    expect(screen.getByText('6 çevrimiçi')).toBeVisible();
    expect(screen.getByText('24 saatte 41')).toBeVisible();
    await i18n.changeLanguage('en');
  });
});
