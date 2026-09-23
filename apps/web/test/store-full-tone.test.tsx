import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/keys.js';
import { StatusBar } from '../src/shell/StatusBar.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * A FULL STORE IS NOT AN ATTACK. Spec H2 (docs/ui-v2/gozlemevi.md).
 *
 * The works row already draws "full" in the amber the header uses for every
 * capacity state; the one label beside it that says the store blocks a collection
 * was set in threat red — the colour this interface keeps for something being done
 * to you. A player learns to ignore a red that is not danger, and then misses the
 * one that is.
 */
const header = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(keys.planet, planetView({}, {
    alloy: 5000, alloyCap: 5000,
    crystal: 1000, crystalCap: 1000,
    deuterium: 800, deuteriumCap: 800,
    bufferAlloy: 400, bufferCrystal: 120, bufferDeuterium: 40,
  }));
  const api = new Api({ fetch: () => Promise.reject(new Error('unexpected fetch')) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>
          <StatusBar commander="Vantage" onOpen={vi.fn()} onFocusPlanet={vi.fn()} />
        </ToastProvider>
      </ApiProvider>
    </QueryClientProvider>,
  );
};

describe('the store-full warning in the works row', () => {
  it('uses the capacity amber, not the threat red', () => {
    header();
    const warning = screen.getByRole('button', { name: 'Store full' });
    expect(warning).not.toHaveClass('text-threat');
    expect(warning).toHaveClass('text-alloy');
  });
});
