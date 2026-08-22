import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '../src/i18n/index.js';
import { DiscReadout } from '../src/screens/DiscReadout.jsx';

describe('disc readout', () => {
  it('shows the shard name and code while keeping the online count on the right', () => {
    render(
      <DiscReadout shardName="Vantage" shard="EU-1" online={6}>
        38 worlds
      </DiscReadout>,
    );
    expect(screen.getByText(/Vantage \(EU-1\)/)).toBeVisible();
    expect(screen.getByText('6 online')).toHaveClass('shrink-0');
  });

  it('hides server information when an old payload has no shard name', () => {
    render(
      <DiscReadout shard="EU-1" online={1}>
        38 worlds
      </DiscReadout>,
    );
    expect(screen.queryByText(/EU-1/)).not.toBeInTheDocument();
    expect(screen.getByText('The disc')).toBeVisible();
  });

  it('constrains and truncates long names on a portrait viewport', () => {
    const { container } = render(
      <DiscReadout shardName="The Extremely Long Vantage Galaxy" shard="EU-123" online={50}>
        50 worlds · 12 fleets away · 9 rocks
      </DiscReadout>,
    );
    expect(container.firstElementChild).toHaveClass('max-w-[calc(100vw-1.5rem)]');
    expect(screen.getByTitle('The Extremely Long Vantage Galaxy (EU-123)')).toHaveClass('truncate');
    expect(screen.getByText('50 online')).toHaveClass('shrink-0');
  });

  it('renders the Turkish disc and online labels', async () => {
    await i18n.changeLanguage('tr');
    render(
      <DiscReadout shardName="Vantage" shard="EU-1" online={6}>
        38 gezegen
      </DiscReadout>,
    );
    expect(screen.getByText('Disk')).toBeVisible();
    expect(screen.getByText('6 çevrimiçi')).toBeVisible();
  });
});
