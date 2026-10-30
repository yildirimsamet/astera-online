import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { keys } from '../../api/keys.js';
import { ApiProvider } from '../../api/context.js';
import { WorldProvider } from '../../api/world.js';
import { GalaxyView, type Panel } from '../../screens/GalaxyView.js';
import { GameShell } from '../shell/GameShell.js';
import { createCosmeticTrialClient } from './CosmeticTrialGallery.js';
import { createStoreDiscoveryApi } from './storeDiscoveryApi.js';
import { ProfilePage } from '../../shell/ProfilePage.js';
import { dismissProfile, leaveProfile, useProfileRoute } from '../../shell/profileRoute.js';

/** Review the real HUD, menu and cosmetic screens without a login or a payment. */
export function StoreDiscoveryGallery() {
  const profileOpen = useProfileRoute();
  const waiting = new URLSearchParams(window.location.search).get('menu-state') === 'waiting';
  const commander = waiting ? 'Kestrel Sable Andromeda' : 'Orion';
  const [client] = useState(() => {
    const next = createCosmeticTrialClient();
    const updatedAt = Date.now() + 86_400_000;
    next.setQueryData(keys.notifications, { notifications: [] }, { updatedAt });
    next.setQueryData(keys.rewards, { chains: [], claimable: waiting ? 3 : 0 }, { updatedAt });
    next.setQueryData(keys.announcements, { announcements: waiting ? [{
      id: '00000000-0000-4000-8000-000000000001', title: 'Astera Online', bodyHtml: '<p>Astera Online</p>', publishedAt: new Date(), seen: false,
    }] : [] }, { updatedAt });
    next.setQueryData(keys.leaderboard, { ladder: [], you: null }, { updatedAt });
    return next;
  });
  const [api] = useState(() => createStoreDiscoveryApi(client));
  const [panel, setPanel] = useState<Panel>(() => {
    const initial = new URLSearchParams(window.location.search).get('panel');
    return initial === 'menu' ? 'menu' : initial === 'shop' ? 'skin-shop' : initial === 'inventory' ? 'skin-inventory' : null;
  });

  const route = (next: Panel): void => {
    dismissProfile();
    setPanel(next);
  };

  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider>
          <GameShell commander={commander} panel={profileOpen ? 'profile' : panel} onPanel={route} onFocusPlanet={() => undefined} onFocusCraft={() => undefined}
            galaxy={(shell) => (
              <>
              <GalaxyView panel={profileOpen ? 'profile' : panel} onPanel={shell.onPanel} commander={commander} onSignOut={() => undefined}
                homeRequest={shell.homeRequest} worldsRequest={shell.worldsRequest} centerRequest={shell.centerRequest}
                onOpenChat={shell.onOpenChat} showChat={false} showGuidance={false} />
              {profileOpen && <ProfilePage name={commander} country="TR" onCountryChange={() => Promise.resolve()} onSignOut={() => undefined} onBack={leaveProfile} />}
              </>
            )}
          />
        </WorldProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
