import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { MonumentSheet } from '../../screens/MonumentSheet.js';
import { planetView } from '../../../test/fixtures.js';

/**
 * THE MONUMENT SHEET (C22) against a stub server: a Hard monument held by another
 * commander, the reader's own wave holding there, a probe in flight and its last report.
 * `monument-sheet-quote` is the same sheet after one Citadel is picked (the audit presses
 * the stepper): the priced flight with both consents. Development only.
 */
const NOW = Date.now();
const MIN = 60_000;
const iso = (minutes: number): string => new Date(NOW + minutes * MIN).toISOString();
const ID = '00000000-0000-4000-8000-0000000000c1';
const WAVE = '00000000-0000-4000-8000-0000000000c2';
const LOT = '00000000-0000-4000-8000-0000000000c3';
const position = { x: 6000, y: 0, z: 0 };
const lot = { id: LOT, hull: 'ARGOSY', count: 4, damageBp: 2500, remainderBp: 0, maxHp: 1350, remainingHp: 1012.5, deuterium: 600, cargoCapacity: 1200 };
const catalog = {
  serverNow: iso(0),
  monuments: [{
    id: ID, ordinal: 3, position, controller: { kind: 'PLAYER', playerId: 'rival', name: 'Kestrel Sable' },
    capacity: 7270, used: 2_410, reserved: 300, productionPerMinute: 60, emptySince: null, difficulty: 'HARD', radiationHpPerMinute: 5,
  }],
  waves: [{
    id: WAVE, monumentId: ID, playerId: 'self', originPlanetId: 'home', rootWaveId: null, jointOperationId: null,
    status: 'HOLD', purpose: 'ATTACK', sentAt: iso(-90), heldAt: iso(-30), arriveAt: null, position, route: [], tech: { RADIATION_SHIELDING: 3 },
    fleet: { ARGOSY: 4 }, lots: [lot], deuterium: 600, productionPerMinute: 15, radiationHpPerMinute: 3.75, fillsAt: iso(40), nextLossAt: iso(95),
    returnForecast: { homePlanetId: 'home', arriveAt: iso(60), minutes: 60, doseHp: 100, destroyed: 0, deuterium: 600, lostDeuterium: 0, lots: [lot], fuelRefund: 42 },
  }],
  probes: [{ id: '00000000-0000-4000-8000-0000000000c4', monumentId: ID, status: 'OUTBOUND', departAt: iso(-4), arriveAt: iso(11), homeAt: null, originPlanetId: 'home', route: [] }],
  probeReports: [{ id: '00000000-0000-4000-8000-0000000000c5', monumentId: ID, observedAt: iso(-120), deliveredAt: iso(-110), fleet: { CITADEL: 12, PIKE: 40 }, accuracy: 1 }],
};
const quote = {
  fuel: 920, outboundFuel: 120, returnFuelReserve: 800, arriveAt: iso(48), travelMinutes: 48,
  room: { used: 2_410, reserved: 300, total: 7270, after: 2_900 }, bays: { used: 2, total: 5 }, shieldWouldDrop: true,
  radiationProtection: { level: 3, hpPerMinute: 3.75, nextLossAt: iso(140), cargoLossAt: iso(120) },
  outboundForecast: { doseHp: 240, destroyed: 1, fleet: { CITADEL: 1 },
    health: [{ hull: 'CITADEL', count: 2, maxHp: 2000, remainingHp: 1760, damageBp: 1200, remainderBp: 0 }] },
};

const json = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export function GalleryMonument() {
  const [api] = useState(() => new Api({
    fetch: (url: string | URL | Request) => {
      const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
      if (path.endsWith('/api/commander-ship')) return Promise.resolve(json({ capitalPlanetId: 'home', rulesetVersion: 18, ship: null }));
      if (path.endsWith('/recall/quote')) return Promise.resolve(json({ fleet: { ARGOSY: 1 }, deuterium: 150, arriveAt: iso(60), minutes: 60,
        doseHp: 100, destroyed: 0, arrivalDeuterium: 150, lots: [lot], arrivalLots: [] }));
      if (path.endsWith('/quote')) return Promise.resolve(json(quote));
      if (path.includes('notifications')) return Promise.resolve(json({ notifications: [] }));
      return Promise.resolve(json(catalog));
    },
  }));
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [origin] = useState(() => planetView({ fleet: { CITADEL: 6, PIKE: 24, ARGOSY: 4 } }, { id: 'home', name: 'Vantage', deuterium: 12_000 }));
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <MonumentSheet monumentId={ID} origin={origin} playerId="self" clanId={null} onClose={() => undefined} onClanTarget={() => undefined} />
      </ApiProvider>
    </QueryClientProvider>
  );
}
