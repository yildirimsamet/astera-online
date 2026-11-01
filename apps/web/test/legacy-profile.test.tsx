import type { ReactNode } from 'react';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../src/api/context.js';
import { legacyGalleryApi, fixtureAward } from '../src/v2/gallery/LegacyGallery.js';
import { LegacyProfileView } from '../src/legacy/LegacyProfile.js';
import { useLegacyCollection } from '../src/legacy/queries.js';
import i18n from '../src/i18n/index.js';

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
    expect(screen.getByRole('button', { name: i18n.t('legacy.shelf.edit') })).toBeDisabled();
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
