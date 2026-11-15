import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../src/api/context.js';
import { legacyGalleryApi } from '../src/v2/gallery/LegacyGallery.js';
import { AwardSheet } from '../src/legacy/AwardSheet.js';
import i18n from '../src/i18n/index.js';

vi.mock('../src/legacy/snapshot.js', () => ({ useAwardSnapshot: () => null }));

async function context(self: boolean) {
  const api = legacyGalleryApi(self), profile = await api.legacyMe();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  const award = profile.showcase[0]!.award;
  const show = () => render(<AwardSheet profile={profile} award={award} live={false} onClose={() => undefined} />, { wrapper });
  return { api, profile, award, show };
}

describe('the piece opened from another commander', () => {
  it('moves keyboard focus into the award, wraps its actions, and restores the opener on close', async () => {
    render(<button type="button">Open award</button>);
    const opener = screen.getByRole('button', { name: 'Open award' }); opener.focus();
    const { show } = await context(true);
    const view = show(), dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    const last = screen.getByRole('button', { name: i18n.t('legacy.award.clearTitle') }); last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(screen.getByRole('button', { name: i18n.t('handle.collapse') })).toHaveFocus();
    view.unmount();
    expect(opener).toHaveFocus();
  });
  it('labels their active title correctly and never reads private progress or offers owner actions', async () => {
    const { api, show } = await context(false);
    const progress = vi.spyOn(api, 'legacyProgress');
    show();
    expect(screen.queryByText(i18n.t('legacy.award.activeTitle'))).toBeNull();
    expect(screen.getByText('Active title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('legacy.award.setTitle') })).toBeNull();
    expect(screen.queryByRole('button', { name: i18n.t('legacy.award.showOnShelf') })).toBeNull();
    await waitFor(() => { expect(screen.getByText('Season 12 · Andromeda')).toBeInTheDocument(); });
    expect(progress).not.toHaveBeenCalled();
  });
  it('states a failed details read and can retry without closing the piece', async () => {
    const { api, show } = await context(false);
    const read = api.legacyAward;
    api.legacyAward = vi.fn().mockRejectedValueOnce(new Error('offline')).mockImplementation(read);
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Award details could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('surface.retry') }));
    expect(await screen.findByText('Season 12 · Andromeda')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('shows a failed title write and leaves the existing title available', async () => {
    const { api, show } = await context(true);
    vi.spyOn(api, 'setLegacyTitle').mockRejectedValueOnce(new Error('offline'));
    show();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('legacy.award.clearTitle') }));
    expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('legacy.award.failed'));
    expect(screen.getByRole('button', { name: i18n.t('legacy.award.clearTitle') })).toBeEnabled();
  });
});

/** C32 (2026-11-15): one piece on the kit — its metal named in chips, the facts in glass, the owner's two moves. */
describe('the piece on the kit', () => {
  const oldLook = (root: Element): string[] =>
    [root, ...root.querySelectorAll('[class]')].flatMap(node => (node.getAttribute('class') ?? '').split(/\s+/))
      .filter(name => /(^|-)v2(-|$)/.test(name) || ['text-micro', 'text-label', 'text-caption', 'text-body'].includes(name));

  it('wears none of the old surface language on a kit sheet', async () => {
    const { show } = await context(true);
    show();
    await screen.findByText('Season 12 · Andromeda');
    const award = document.querySelector('[data-legacy-award]');
    expect(screen.getByRole('dialog')).toHaveClass('gk-sheet');
    expect(oldLook(award ?? document.body)).toEqual([]);
    expect(screen.getByRole('button', { name: i18n.t('legacy.award.clearTitle') })).toHaveClass('gk-btn');
  });

  it('says on the button why a full shelf takes no more', async () => {
    const { api, profile } = await context(true);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const spare = (await api.legacyCollection(profile.publicId)).awards.find(row => !profile.showcase.some(slot => slot.awardId === row.id));
    if (!spare || profile.showcase.length < 6) throw new Error('fixture needs a full shelf and a spare piece');
    render(<QueryClientProvider client={client}><ApiProvider api={api}><AwardSheet profile={profile} award={spare} live={false} onClose={() => undefined} /></ApiProvider></QueryClientProvider>);
    expect(screen.getByRole('button', { name: i18n.t('legacy.award.shelfFullShort') })).toBeDisabled();
  });

  it('draws a locked goal on the kit with its progress as a bar', async () => {
    const { LockedAwardSheet } = await import('../src/legacy/AwardSheet.js');
    const { LEGACY_CATALOGUE } = await import('@astera/rules');
    const { fixtureAward } = await import('../src/v2/gallery/LegacyGallery.js');
    const definition = LEGACY_CATALOGUE.find(row => row.id === 'pirate-hunter');
    if (!definition) throw new Error('no pirate hunter');
    render(<LockedAwardSheet award={fixtureAward('pirate-hunter')} definition={definition} goal={10} value={7} live={false} onClose={() => undefined} />);
    const locked = document.querySelector('[data-legacy-locked]');
    expect(oldLook(locked ?? document.body)).toEqual([]);
    expect(screen.getByRole('progressbar', { name: i18n.t('legacy.award.progress') }).closest('.gk-bar, [class*="gk-bar"]')).not.toBeNull();
  });
});
