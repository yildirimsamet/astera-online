import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { StrikeSheet } from '../src/galaxy/FocusPanel.js';
import { LaunchSheet } from '../src/screens/LaunchSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

const world: GalaxyPlanet = { id: 'honor-target', name: 'Tharsis', owner: 'Sable', position: { x: 120, y: 0, z: 80 },
  coreTier: 2, coreLevel: 6, intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false };
const urlOf = (input: RequestInfo | URL): string => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
const open = (fetch: typeof globalThis.fetch, target = world) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch })}><ToastProvider>
    <LaunchSheet target={{ kind: 'world', world: target }} planet={planetView({ fleet: { DART: 4 } }, { deuterium: 500_000 })}
      onClose={vi.fn()} onLaunched={vi.fn()} />
  </ToastProvider></ApiProvider></QueryClientProvider>);
};

describe('Honor guidance in the actual launch sheet', () => {
  it('loads the target contract and shows the weak-target price before any fleet is chosen', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(input => Promise.resolve(new Response(JSON.stringify(urlOf(input).includes('/honor/targets/')
      ? { enabled: true, eligible: true, kind: 'WEAK', militaryReturn: 'NONE', related: false, repeated: false, retaliation: false, soloCredit: true }
      : {}), { status: urlOf(input).includes('/honor/targets/') ? 200 : 500 })));
    open(fetch);
    expect(await screen.findByText(/Even a successful attack/)).toBeVisible();
    expect(screen.getByText(/Shared sides cannot earn positive Honor/)).toBeVisible();
    expect(screen.getByRole('button', { name: /choose a fleet/i })).toBeDisabled();
    expect(fetch.mock.calls.some(([input]) => urlOf(input).endsWith('/api/honor/targets/honor-target'))).toBe(true);
  });
  it('does not silently present an unavailable comparison as safe', async () => {
    open(vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}', { status: 500 }))));
    expect(await screen.findByText(/Honor comparison is unavailable/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Retry Honor comparison/ })).toBeVisible();
  });
  it('does not request human Honor guidance for a neutral world', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(new Response('{}', { status: 500 })));
    open(fetch, { ...world, kind: 'NEUTRAL' });
    await vi.waitFor(() => { expect(fetch).toHaveBeenCalled(); });
    expect(fetch.mock.calls.some(([input]) => urlOf(input).includes('/honor/targets/'))).toBe(false);
    expect(document.querySelector('[data-honor-target]')).toBeNull();
  });
});

it('explains real EMP Honor, ineffective hits and interception before dispatch', () => {
  render(<StrikeSheet target={world} origin={planetView({ honorTacticalCredit: true })} onClose={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByText(/new tactical effect.*small Honor/i)).toBeVisible();
  expect(screen.getByText(/weaker target can cost Honor/i)).toBeVisible();
  expect(screen.getByText(/stopped weapon.*attacking loss/i)).toBeVisible();
  expect(screen.getByText(/No effect earns no Honor/i)).toBeVisible();
});

it('does not promise tactical Honor when the season does not announce that policy', () => {
  render(<StrikeSheet target={world} origin={planetView()} onClose={vi.fn()} onConfirm={vi.fn()} />);
  expect(screen.getByText('Special weapons do not change Honor in this season.')).toBeVisible();
  expect(screen.queryByText(/new tactical effect.*small Honor/i)).toBeNull();
  expect(screen.queryByText(/weaker target can cost Honor/i)).toBeNull();
});
