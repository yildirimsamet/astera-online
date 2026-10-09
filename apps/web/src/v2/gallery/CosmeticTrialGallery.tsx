import { useState, type CSSProperties } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { keys } from '../../api/keys.js';
import { galaxySchema, seasonSchema } from '../../api/schemas.js';
import { WorldProvider } from '../../api/world.js';
import { GalaxyView, type Panel } from '../../screens/GalaxyView.js';
import { planetView } from '../../../test/fixtures.js';

/** The actual galaxy and shop, with two owned worlds and no server/payment dependency. */
export function createCosmeticTrialClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const now = Date.now();
  const worlds = [
    planetView({ academyStep: null }, { id: 'trial-home', name: 'Kestrel', position: { x: 520, y: 0, z: 420 } }),
    planetView({ academyStep: null }, { id: 'trial-colony', name: 'Vega', position: { x: 1020, y: 0, z: 870 } }),
  ];
  const seed = (key: readonly string[], data: unknown) => { client.setQueryData(key, data, { updatedAt: now + 24 * 60 * 60_000 }); };
  seed(keys.planets, { seasonId: 'trial-season', playerId: 'trial-commander', capitalPlanetId: 'trial-home', planets: worlds });
  for (const world of worlds) {
    seed(keys.planetById(world.planet.id), world);
    seed(keys.miningStatusById(world.planet.id), { derrick: false, craftSpeed: 1, craftHold: 100, derrickHold: 100, craftReadyAt: null, runs: [], isotopes: [] });
  }
  seed(keys.galaxy, galaxySchema.parse({
    you: { planetId: 'trial-home', playerId: 'trial-commander', planetIds: worlds.map(world => world.planet.id) },
    sensors: [], planets: worlds.map((world, index) => ({
      id: world.planet.id, name: world.planet.name, position: world.planet.position,
      owner: 'Orion', intel: 'RESOLVED', kind: index === 0 ? 'CAPITAL' : 'COLONY',
      controller: { kind: 'PLAYER', playerId: 'trial-commander', displayName: 'Orion' },
      isOwned: true, isSelf: index === 0, coreLevel: 1, state: { kind: 'NORMAL' },
      skin: { id: index === 0 ? 'planet-ice' : 'planet-lava', status: 'NORMAL' }, ringId: 'ring-helios',
    })),
  }));
  seed(keys.season, seasonSchema.parse({ seasonId: 'trial-season', shard: 'EU-1', seed: 11, status: 'live',
    startsAt: new Date(now - 60_000), endsAt: new Date(now + 24 * 60 * 60_000), playerCap: 300, players: 2 }));
  seed(keys.skins, { ownedSkinIds: ['planet-ice', 'planet-lava'], ownedCosmeticIds: ['planet-ice', 'planet-lava', 'ring-helios'],
    equipment: { RING: 'ring-helios' }, planets: worlds.map((world, index) => ({ id: world.planet.id, name: world.planet.name, skinId: index === 0 ? 'planet-ice' : 'planet-lava' })) });
  seed(keys.polarShop, { enabled: false });
  seed(keys.polarPricing, { countryCode: 'TR', prices: {} });
  seed(keys.miningField, { asteroids: [], debris: [], nextFieldChangeAt: null });
  seed(keys.pending, { pending: [] });
  seed(keys.traffic, { contacts: [], interceptions: [] });
  seed(keys.reports, { reports: [], rivals: [] });
  seed(keys.intel, { watching: [], radarLog: [], probeCooldowns: [], probeReports: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 } });
  seed(keys.clanBadge, { available: false, membership: null, attention: false, attentionCount: 0, clanChatUnread: 0 });
  seed(keys.galaxyEvents, { events: [] });
  return client;
}

export function CosmeticTrialGallery({ client: suppliedClient }: { client?: QueryClient }) {
  const [client] = useState(() => suppliedClient ?? createCosmeticTrialClient());
  const [panel, setPanel] = useState<Panel>('skin-shop');
  return <QueryClientProvider client={client}><WorldProvider>
    <div className="relative h-dvh bg-v2-void" style={{ '--v2-dock-h': '0px', '--v2-top-h': '0px' } as CSSProperties}>
      <GalaxyView panel={panel} onPanel={setPanel} commander="Orion" onSignOut={() => undefined} showChat={false} showGuidance={false} />
    </div>
  </WorldProvider></QueryClientProvider>;
}
