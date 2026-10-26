import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { MenuPanel } from '../src/shell/MenuPanel.js';
import { ATMOSPHERE } from '../src/ui/atmosphere.js';
import i18n from '../src/i18n/index.js';

vi.mock('../src/battle-simulator/replayView.js', () => ({ loadBattleReplayView: vi.fn(), reloadReplayPage: vi.fn(),
  loadSimulatorView: async () => (await import('../src/battle-simulator/SimulatorDialog.js')).default }));
vi.mock('../src/battle-simulator/BattleSimulator.js', () => ({ BattleSimulator: ({ initialScenario, backLabel, onLeave }: { initialScenario?: unknown; backLabel?: string; onLeave: () => void }) =>
  <div>Free simulator · {initialScenario === undefined ? 'default' : 'loaded'}<button onClick={onLeave}>{backLabel}</button></div> }));

/**
 * THE SIMULATOR HAS A DOOR (owner 2026-10-26). It used to be reachable only through `?simulator=1`.
 * The menu's help group opens it over the menu, and closing it lands back on the menu.
 */
describe('the battle simulator in the menu', () => {
  const show = (onOpen = vi.fn()) => {
    const api = new Api({ fetch: (() => Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
    render(<MenuPanel galaxy="Vantage" shard="EU-1" endsAt={null} onOpen={onOpen} onSignOut={vi.fn()} />, { wrapper });
    return onOpen;
  };

  it('opens a free scenario over the menu with its own scene, and returns to the menu', async () => {
    const onOpen = show();
    const tile = screen.getByRole('button', { name: `${i18n.t('simulator.title')}. ${i18n.t('menu.simulatorHint')}` });
    expect(tile.querySelector(`img[src="${ATMOSPHERE.simulator.src}"]`)).not.toBeNull();
    tile.focus(); fireEvent.click(tile);
    expect(await screen.findByRole('dialog', { name: 'Battle simulator' })).toHaveTextContent('Free simulator · default');
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(tile).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
