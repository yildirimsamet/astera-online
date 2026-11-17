import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import BattleReplayDialog from '../../battle-simulator/BattleReplayDialog.js';
import { battleReplayQuery } from '../../battle-simulator/replayQuery.js';
import { DEFAULT_SCENARIO, simulateScenario } from '../../battle-simulator/scenario.js';

/**
 * THE REPLAY'S SHELL IN THE GALLERY (C16b, 2026-11-15): the full-screen layer while the recording
 * is on its way, when it could not come, and (`replay-stage`) around the 3D stage, which is the
 * simulator's own and not measured here.
 *
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */
const noop = (): void => undefined;
const ID = 'gallery-replay';

function answer(view: string): typeof fetch {
  return () => view === 'replay-failed'
    ? Promise.resolve(new Response('{}', { status: 500 }))
    : new Promise<Response>(noop);
}

export function GalleryReplay({ view }: { view: string }) {
  const [api] = useState(() => new Api({ fetch: answer(view) }));
  const [client] = useState(() => {
    const seeded = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (view === 'replay-stage') seeded.setQueryData(battleReplayQuery(api, 'BATTLE', ID).queryKey, { viewer: 'ATTACK', replay: simulateScenario(DEFAULT_SCENARIO) });
    return seeded;
  });
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReplayDialog kind="BATTLE" id={ID} onClose={noop} />
      </ApiProvider>
    </QueryClientProvider>
  );
}
