import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { keys } from '../../api/keys.js';
import { ApiProvider } from '../../api/context.js';
import { WorldProvider } from '../../api/world.js';
import { GalaxyView, type Panel } from '../../screens/GalaxyView.js';
import { GameShell } from '../shell/GameShell.js';
import { createCosmeticTrialClient } from './CosmeticTrialGallery.js';
import { createStoreDiscoveryApi } from './storeDiscoveryApi.js';

/** Review the real HUD, menu and cosmetic screens without a login or a payment. */
export function StoreDiscoveryGallery() {
  const [client] = useState(() => {
    const next = createCosmeticTrialClient();
    const updatedAt = Date.now() + 86_400_000;
    next.setQueryData(keys.notifications, { notifications: [] }, { updatedAt });
    next.setQueryData(keys.rewards, { chains: [], claimable: 0 }, { updatedAt });
    next.setQueryData(keys.announcements, { announcements: [] }, { updatedAt });
    next.setQueryData(keys.leaderboard, { ladder: [], you: null }, { updatedAt });
    return next;
  });
  const [api] = useState(() => createStoreDiscoveryApi(client));
  const [panel, setPanel] = useState<Panel>(() => {
    const initial = new URLSearchParams(window.location.search).get('panel');
    return initial === 'menu' ? 'menu' : initial === 'shop' ? 'skin-shop' : initial === 'inventory' ? 'skin-inventory' : null;
  });

  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <WorldProvider>
          <GameShell commander="Orion" panel={panel} onPanel={setPanel} onFocusPlanet={() => undefined} onFocusCraft={() => undefined}
            galaxy={(shell) => (
              <GalaxyView panel={panel} onPanel={shell.onPanel} commander="Orion" onSignOut={() => undefined}
                homeRequest={shell.homeRequest} worldsRequest={shell.worldsRequest} centerRequest={shell.centerRequest}
                onOpenChat={shell.onOpenChat} showChat={false} showGuidance={false} />
            )}
          />
        </WorldProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
