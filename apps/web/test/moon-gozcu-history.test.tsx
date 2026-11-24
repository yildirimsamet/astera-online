import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { moonT } from '../src/i18n/moon.js';
import { IntelScreen } from '../src/screens/IntelScreen.js';
import { planetView } from './fixtures.js';

/* Ay review W7: a Gözcü route to a world the commander cannot name reads "unknown world", never an id. */
it('names an unnamed world in the Gözcü history as unknown', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(['intel'], { watching: [], probeReports: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 0, crystal: 0 } });
  client.setQueryData(['galaxy'], { planets: [{ id: 'p-target', name: 'Gamma' }], sensors: [], moons: { list: [], rarity: {}, flashes: {} } });
  client.setQueryData(['planet'], planetView());
  client.setQueryData(['notifications'], { notifications: [] });
  client.setQueryData(['reports'], { reports: [], rivals: [] });
  client.setQueryData(['moon-scans'], { scans: [{
    id: 's1', scannedAt: new Date(), pierced: false, scannerPlanetId: 'p1', targetPlanetId: 'p-target',
    rows: [{ direction: 'IN', otherPlanetId: 'deadbeef-0000-0000-0000-000000000000', arriveAt: new Date(Date.now() + 60_000), size: 'LIGHT' }],
  }] });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api()}><IntelScreen open={{ stop: 'gozcu', request: 1 }} /></ApiProvider></QueryClientProvider>);
  const item = await screen.findByTestId('gozcu-history-item');
  expect(item.textContent).not.toContain('deadbeef');
  expect(item.textContent).toContain(moonT('scan.unknownWorld'));
});
