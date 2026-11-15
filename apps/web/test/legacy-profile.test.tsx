import { LEGACY_CATALOGUE } from '@astera/rules';
import type { ReactNode } from 'react';
import { fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../src/api/context.js';
import { legacyGalleryApi, fixtureAward } from '../src/v2/gallery/LegacyGallery.js';
import { LegacyProfileView } from '../src/legacy/LegacyProfile.js';
import { useLegacyCollection } from '../src/legacy/queries.js';
import i18n from '../src/i18n/index.js';

vi.mock('../src/legacy/AwardStage.js', () => ({ AwardStage: () => <div data-testid="award-stage" /> }));

vi.mock('../src/legacy/snapshot.js', () => ({ useAwardSnapshot: () => null }));

function context() {
  const api = legacyGalleryApi(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}><ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  return { api, wrapper };
}

describe('a permanent commander profile', () => {
  it('keeps every collection page, including a career longer than twelve pages', async () => {
    const { api, wrapper } = context();
    const calls: (string | undefined)[] = [];
    api.legacyCollection = (_, cursor) => {
      calls.push(cursor);
      const page = Number(cursor ?? 0);
      return Promise.resolve({ awards: [{ ...fixtureAward('season-memento'), owners: 1 }], nextCursor: page < 12 ? String(page + 1) : null });
    };
    const { result } = renderHook(() => useLegacyCollection('commander'), { wrapper });
    await waitFor(() => { expect(result.current.isSuccess).toBe(true); });
    expect(result.current.data).toHaveLength(13);
    expect(calls).toHaveLength(13);
  });

  it('keeps shelf editing unavailable until the existing collection has loaded', async () => {
    const { api, wrapper } = context();
    api.legacyCollection = () => new Promise(() => undefined);
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    // A dead edit says why (C27): the collection is still on its way.
    expect(screen.getByRole('button', { name: i18n.t('legacy.collection.loading') })).toBeDisabled();
    // Empty slots are another entry to the same editor and must obey the same guard.
    expect(screen.queryAllByRole('button', { name: i18n.t('legacy.shelf.edit') }).every(button => button.hasAttribute('disabled'))).toBe(true);
  });

  it('explains a season history failure instead of leaving a blank heading', async () => {
    const { api, wrapper } = context();
    api.legacySeasons = () => Promise.reject(new Error('offline'));
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    expect(await screen.findByRole('alert')).toHaveTextContent('Season history could not be loaded.');
  });

  it('states when season history is still loading', async () => {
    const { api, wrapper } = context();
    api.legacySeasons = () => new Promise(() => undefined);
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('Loading season history…');
  });
});


it('opens a locked goal in a dialog with its tier, condition and remaining progress, without owned-award requests or actions', async () => {
  const { api, wrapper } = context();
  api.legacyProgress = () => Promise.resolve({ achievements: LEGACY_CATALOGUE.filter(row => row.id === 'pirate-hunter').map(row => ({ ...row, goals: [...row.goals], progress: 7 })) });
  const detail = vi.spyOn(api, 'legacyAward');
  render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
  fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
  const tile = await screen.findByRole('button', { name: /Pirate Hunter.*7\/10/ });
  tile.focus();
  fireEvent.click(tile);
  const dialog = screen.getByRole('dialog', { name: 'Pirate Hunter I' });
  expect(within(dialog).getByText(/10 different pirates/)).toBeVisible();
  expect(within(dialog).getByText('7/10')).toBeVisible();
  expect(within(dialog).getByText(/3 remaining/)).toBeVisible();
  expect(within(dialog).getByText(/automatically/i)).toBeVisible();
  expect(within(dialog).queryByRole('button', { name: 'Add to showcase' })).toBeNull();
  expect(within(dialog).queryByRole('button', { name: 'Use as title' })).toBeNull();
  expect(detail).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => { expect(screen.queryByRole('dialog')).toBeNull(); });
  expect(tile).toHaveFocus();
});


it('shows the actual remaining seconds on a nearly complete monument tier', async () => {
  const { api, wrapper } = context();
  api.legacyProgress = () => Promise.resolve({ achievements: LEGACY_CATALOGUE.filter(row => row.id === 'monument-warden')
    .map(row => ({ ...row, goals: [...row.goals], progress: 3599 })) });
  render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
  fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
  fireEvent.click(await screen.findByRole('button', { name: /Monument Warden.*0\/1/ }));
  const dialog = screen.getByRole('dialog', { name: 'Monument Warden I' });
  expect(within(dialog).getByText('1s remaining')).toBeVisible();
});

/**
 * THE LEGACY ON THE KIT (C27, 2026-11-15): the commander's plate, the shelf, the seasons and the
 * collection in the kit's metal — tabs a thumb presses, a dead edit button that says why.
 */
describe('the legacy profile on the kit', () => {
  const oldLook = (root: Element): string[] =>
    [root, ...root.querySelectorAll('[class]')].flatMap(node => (node.getAttribute('class') ?? '').split(/\s+/))
      .filter(name => /(^|-)v2(-|$)/.test(name) || ['text-micro', 'text-label', 'text-caption', 'text-body', 'text-title'].includes(name));

  it('wears none of the old surface language, the seasons included', async () => {
    const { api, wrapper } = context();
    const { container } = render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    await screen.findAllByText(/Season 12/);
    const profile = container.querySelector('[data-legacy-profile]');
    expect(profile).toHaveClass('gk-legacy');
    expect(oldLook(profile ?? container)).toEqual([]);
  });

  it('switches with the kit tabs', async () => {
    const { api, wrapper } = context();
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    const tabs = screen.getByRole('tablist');
    expect(tabs).toHaveClass('gk-tabs');
    expect(screen.getByRole('tab', { name: 'Legacy' })).toHaveAttribute('aria-selected', 'true');
  });

  it('says why the shelf cannot be edited yet, then opens the editor on a press', async () => {
    const { api, wrapper } = context();
    const real = api.legacyCollection.bind(api);
    let release: () => void = () => undefined;
    api.legacyCollection = (...args) => new Promise(resolve => { release = () => { void real(...args).then(resolve); }; });
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    expect(screen.getByRole('button', { name: i18n.t('legacy.collection.loading') })).toBeDisabled();
    release();
    const edit = await screen.findByRole('button', { name: i18n.t('legacy.shelf.edit') });
    expect(edit).toHaveClass('gk-btn');
    fireEvent.click(edit, { detail: 1 });
    expect(document.querySelector('[data-legacy-editor]')).toBeNull();
    fireEvent.pointerDown(edit, { button: 0 });
    fireEvent.click(edit, { detail: 1 });
    const editor = await waitFor(() => { const node = document.querySelector('[data-legacy-editor]'); expect(node).not.toBeNull(); return node; });
    expect(oldLook(editor ?? document.body)).toEqual([]);
    expect(screen.getByRole('button', { name: i18n.t('legacy.editor.save') })).toHaveClass('gk-btn');
  });

  it('filters the collection with kit chips', async () => {
    const { api, wrapper } = context();
    render(<LegacyProfileView profile={await api.legacyMe()} live={false} />, { wrapper });
    fireEvent.click(screen.getByRole('tab', { name: 'Collection' }));
    const all = await screen.findByRole('button', { name: i18n.t('legacy.collection.all') });
    expect(all).toHaveAttribute('aria-pressed', 'true');
    expect(all.querySelector('.gk-chip')).not.toBeNull();
  });
});

describe('the shelf on the kit', () => {
  it('names a piece on a kit plate and invites an empty plinth with a thumb-sized mark', async () => {
    const { ShowcaseShelf } = await import('../src/legacy/ShowcaseShelf.js');
    const onEmpty = vi.fn();
    render(<ShowcaseShelf live={false} slots={[fixtureAward('season-memento'), null, null, null, null, null]} onOpen={vi.fn()} onEmpty={onEmpty} />);
    const plate = document.querySelector('[data-legacy-plate]');
    expect(plate).toHaveClass('gk-shelf__plate');
    expect(plate?.className).not.toMatch(/text-micro|v2-/);
    const empty = screen.getAllByRole('button', { name: i18n.t('legacy.shelf.edit') })[0];
    expect(empty?.querySelector('.gk-shelf__add')).not.toBeNull();
    if (!empty) throw new Error('no empty plinth');
    fireEvent.click(empty, { detail: 1 });
    expect(onEmpty).not.toHaveBeenCalled();
    fireEvent.pointerDown(empty, { button: 0 });
    fireEvent.click(empty, { detail: 1 });
    expect(onEmpty).toHaveBeenCalledOnce();
  });
});
