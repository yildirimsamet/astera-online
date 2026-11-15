/**
 * THE ACCOUNT PAGE AND ITS SHEETS (G10) for the gallery camera. Never shipped; nothing reaches a server.
 *   ?view=profile   the account page: commander card, Legacy, vacation, security, country, galaxy, season
 */
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { WorldProvider } from '../../api/world.js';
import { ProfilePage } from '../../shell/ProfilePage.js';
import { createCosmeticTrialClient } from './CosmeticTrialGallery.js';
import { legacyGalleryApi } from './LegacyGallery.js';

const HOUR = 3_600_000;

const PROFILE_VIEWS = ['profile'] as const;
export type ProfileView = (typeof PROFILE_VIEWS)[number];
export const isProfileView = (view: string | null): view is ProfileView => PROFILE_VIEWS.some((id) => id === view);

function profileClient() {
  const client = createCosmeticTrialClient();
  const now = Date.now();
  const later = { updatedAt: now + 24 * HOUR };
  client.setQueryData(keys.season, {
    seasonId: 'trial-season', shard: 'EU-1', shardName: 'Vantage', seed: 11, status: 'live',
    startsAt: new Date(now - 8 * 24 * HOUR), endsAt: new Date(now + 6 * 24 * HOUR + 5 * HOUR), playerCap: 1_000, players: 212,
    rivals: [], shieldUntil: new Date(now + 9 * HOUR + 12 * 60_000), shieldKind: 'NEWCOMER',
  }, later);
  client.setQueryData(keys.leaderboard, {
    ranking: 'HONOR', honorEnabled: true, ladder: [],
    you: { rank: 14, playerId: 'trial-commander', username: 'Kestrel Sable', country: 'TR', planetId: 'trial-home', planetName: 'Kestrel',
      skinId: 'planet-ice', score: 12_500_000, honor: 12_500_000, dominion: 400, clan: { id: 'c1', name: 'Nova Kolektif', tag: 'NOVA', tier: 'SILVER' }, isBot: false },
  }, later);
  return client;
}

function profileApi() {
  const api = legacyGalleryApi(true);
  api.security = () => Promise.resolve({ enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null });
  api.accountDeletion = () => Promise.resolve({ request: null });
  return api;
}

export function ProfileGallery({ view }: { view: ProfileView }) {
  const [client] = useState(profileClient);
  const [api] = useState(profileApi);
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider>
          <ProfilePage key={view} name="Kestrel Sable" country="TR" onCountryChange={() => Promise.resolve()} onSignOut={() => undefined} onBack={() => undefined} />
        </WorldProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
