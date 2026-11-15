import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { ServerRow } from '../src/api/schemas.js';
import { ServersScreen } from '../src/screens/ServersScreen.js';
import i18n from '../src/i18n/index.js';

/**
 * CHOOSING A GALAXY ON THE KIT (C29, 2026-11-15): "which galaxy do I enter?" Every galaxy with
 * its seats and who is online, the one open door lit, the account's doors with deletion last.
 */
const row = (over: Partial<ServerRow> = {}): ServerRow => ({
  code: 'EU-1', name: 'Vantage', ordinal: 1, planets: 38, capacity: 50, online: 6, status: 'open', endsAt: null, yours: false, ...over,
});

function show(servers: ServerRow[] | 'down', onChoose = vi.fn()) {
  const fetcher: typeof fetch = (input) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (path.endsWith('/servers') && servers === 'down') return Promise.resolve(new Response('{}', { status: 503 }));
    const body = path.endsWith('/servers') ? { servers, placement: null }
      : path.endsWith('/security') ? { enabled: true, loginMethod: 'username', email: null, maskedEmail: null, verifiedAt: null, pending: null }
      : { request: null };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ApiProvider api={new Api({ fetch: fetcher })}>
    <ServersScreen displayName="Sable" onChoose={onChoose} onSignOut={vi.fn()} />
  </ApiProvider></QueryClientProvider>);
  return { onChoose };
}

const classes = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].flatMap((node) => (node.getAttribute('class') ?? '').split(/\s+/)).filter(Boolean);

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('the galaxy choice on the kit', () => {
  it('wears none of the old plate language', async () => {
    show([row(), row({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 0, status: 'locked' })]);
    await screen.findByText('Kestrel');
    const main = screen.getByRole('main');
    expect(main).toHaveClass('gk');
    expect(classes(main).filter((name) => ['plate', 'plate-cut', 'legend', 'headline', 'text-bone', 'readout'].includes(name) || /(^|-)v2(-|$)/.test(name))).toEqual([]);
  });

  it('draws the seats as a bar against the whole, the open door lit', async () => {
    show([row(), row({ code: 'EU-2', name: 'Kestrel', ordinal: 2, planets: 0, status: 'locked' })]);
    const open = (await screen.findByText('Vantage')).closest('[data-galaxy]');
    expect(open).toHaveAttribute('data-status', 'open');
    expect(open?.querySelector('.gk-bar')).not.toBeNull();
    expect(open).toHaveTextContent('38/50');
    expect(screen.getByText('Kestrel').closest('[data-galaxy]')).toHaveAttribute('data-status', 'locked');
  });

  it('joins on a press that began on the button, and only once', async () => {
    const { onChoose } = show([row({ code: 'EU-4', name: 'Orrery' })]);
    const join = await screen.findByRole('button', { name: /^join$/i });
    fireEvent.click(join, { detail: 1 });
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.pointerDown(join, { button: 0 });
    fireEvent.click(join, { detail: 1 });
    expect(onChoose).toHaveBeenCalledWith('EU-4');
    const busy = screen.getByRole('button', { name: /…/ });
    fireEvent.pointerDown(busy, { button: 0 });
    fireEvent.click(busy, { detail: 1 });
    expect(onChoose).toHaveBeenCalledOnce();
  });

  it('keeps the account deletion at the foot', async () => {
    show([row()]);
    await screen.findByText('Vantage');
    const buttons = screen.getAllByRole('button');
    expect(buttons.at(-1)).toHaveAccessibleName(/Delete account/);
  });

  it('says plainly when the galaxies cannot be reached, with a way to retry', async () => {
    show('down');
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('servers.unreachable'));
    expect(screen.getByRole('button', { name: i18n.t('servers.retry') })).toBeInTheDocument();
  });
});
