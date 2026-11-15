/**
 * THE ACCOUNT PAGE AND ITS SHEETS (G10) for the gallery camera. Never shipped; nothing reaches a server.
 *   ?view=profile            the account page: commander card, Legacy, vacation, security, country, galaxy, season
 *   ?view=vacation           the vacation sheet, ready: two worlds priced, the store covers it
 *   ?view=vacation-blocked   the same with flights away and the store short
 *   ?view=vacation-active    on vacation: protected until, the early return
 */
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { WorldProvider } from '../../api/world.js';
import { ProfilePage } from '../../shell/ProfilePage.js';
import { VacationSheet } from '../../screens/VacationSheet.js';
import type { vacationSchema } from '../../api/schemas.js';
import type { z } from 'zod';
import { createCosmeticTrialClient } from './CosmeticTrialGallery.js';
import { legacyGalleryApi } from './LegacyGallery.js';

const HOUR = 3_600_000;

const PROFILE_VIEWS = ['profile', 'vacation', 'vacation-blocked', 'vacation-active'] as const;
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

type Vacation = z.infer<typeof vacationSchema>;

/** A commander with a capital and one colony: what a day costs each, what the capital holds. */
function vacationQuote(view: ProfileView, days: number): Vacation {
  const now = Date.now();
  const blocked = view === 'vacation-blocked';
  const capital = 25 * days, colony = 12.5 * days;
  return {
    active: view === 'vacation-active' ? { id: 'vacation-1', startedAt: new Date(now - 5 * HOUR), endsAt: new Date(now + 43 * HOUR), days: 2, cost: 75 } : null,
    days, maxDays: 5, seasonEndsAt: new Date(now + 6 * 24 * HOUR),
    worlds: [{ id: 'trial-home', name: 'Kestrel', kind: 'CAPITAL', coreLevel: 7 }, { id: 'trial-colony', name: 'Vega', kind: 'COLONY', coreLevel: 4 }],
    price: { total: capital + colony, worlds: [
      { id: 'trial-home', capital: true, coreLevel: 7, referenceLevel: 8, hours: 12 * days, rate: 2.08, cost: capital },
      { id: 'trial-colony', capital: false, coreLevel: 4, referenceLevel: 4, hours: 6 * days, rate: 2.08, cost: colony },
    ] },
    store: blocked ? 14 : 180, buffer: blocked ? 6 : 40, blocker: null, fingerprint: `quote-${String(days)}`,
    reasons: blocked ? ['VACATION_FLEET', 'VACATION_MINING', 'VACATION_FUNDS'] : view === 'vacation-active' ? ['VACATION_ACTIVE'] : [],
  };
}

function profileApi(view: ProfileView) {
  const api = legacyGalleryApi(true);
  api.security = () => Promise.resolve({ enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null });
  api.accountDeletion = () => Promise.resolve({ request: null });
  api.vacation = (days) => Promise.resolve(vacationQuote(view, days));
  return api;
}

export function ProfileGallery({ view }: { view: ProfileView }) {
  const [client] = useState(profileClient);
  const [api] = useState(() => profileApi(view));
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider>
          {view === 'profile'
            ? <ProfilePage name="Kestrel Sable" country="TR" onCountryChange={() => Promise.resolve()} onSignOut={() => undefined} onBack={() => undefined} />
            : <VacationSheet onClose={() => undefined} />}
        </WorldProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
