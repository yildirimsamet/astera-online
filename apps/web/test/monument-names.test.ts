import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { useSeason } from '../src/api/queries.js';
import i18n from '../src/i18n/index.js';
import { monumentName, setMonumentHonorees } from '../src/i18n/names.js';
import { monumentModelUrl } from '../src/galaxy/MonumentModel.js';

afterEach(async () => {
  setMonumentHonorees([]);
  await i18n.changeLanguage('en');
});

describe('named monument targets', () => {
  it('shows the supplied name for every model instead of a numbered label', () => {
    expect([1, 2, 3, 4, 5].map(monumentName)).toEqual([
      'Abandoned Space Wreckage', 'Abandoned Station', 'Ancient Observatory',
      'Ancient Stargate', 'Shattered World Ship',
    ]);
    expect(monumentName(4)).toBe('Ancient Stargate');
    expect(monumentModelUrl(4)).toContain('monument_ancient_stargate.glb');
  });

  it('uses localized names in Turkish and keeps missing identities readable', async () => {
    await i18n.changeLanguage('tr');
    expect([1, 2, 3, 4, 5].map(monumentName)).toEqual([
      'Terk Edilmiş Uzay Enkazı', 'Terk Edilmiş İstasyon', 'Kadim Gözlemevi',
      'Kadim Yıldız Geçidi', 'Parçalanmış Dünya Gemisi',
    ]);
    for (const ordinal of [undefined, 0, 1.5, 6]) expect(monumentName(ordinal)).toBe('Anıt');
  });

  it.each(['en', 'tr', 'de', 'es', 'fr', 'ja'])('has a complete name catalog in %s', async (language) => {
    await i18n.changeLanguage(language);
    for (let ordinal = 1; ordinal <= 5; ordinal += 1) {
      const key = ['one', 'two', 'three', 'four', 'five'][ordinal - 1];
      expect(i18n.exists(`monument.names.${key}`, { lng: language, fallbackLng: false })).toBe(true);
      expect(monumentName(ordinal)).not.toMatch(/^(?:Monument|Anıt) \d$|monument\./);
    }
  });
});

/**
 * LAST SEASON'S FIVE, IN FRONT OF THE FIVE NAMES. Owner decision, 2026-10-06: "Vantasia • Kadim
 * Yıldız Geçidi" everywhere a monument is named — rank N on monument N, from `/api/season`.
 */
describe('monuments named after last season\'s five', () => {
  it('puts the commander in front of the monument, and leaves an unclaimed rank plain', async () => {
    setMonumentHonorees(['Vantasia', null, 'Yasin', null, 'Nova']);
    expect(monumentName(1)).toBe('Vantasia • Abandoned Space Wreckage');
    expect(monumentName(2)).toBe('Abandoned Station');
    expect(monumentName(3)).toBe('Yasin • Ancient Observatory');
    await i18n.changeLanguage('tr');
    expect(monumentName(3)).toBe('Yasin • Kadim Gözlemevi');
    expect(monumentName(5)).toBe('Nova • Parçalanmış Dünya Gemisi');
    // A missing identity is still just a monument.
    expect(monumentName(undefined)).toBe('Anıt');
  });

  it('ignores a blank name rather than printing a bare bullet', () => {
    setMonumentHonorees(['  ', '']);
    expect(monumentName(1)).toBe('Abandoned Space Wreckage');
    expect(monumentName(2)).toBe('Abandoned Station');
  });

  it('learns the names from the season the client already reads', async () => {
    const season = { monumentHonorees: ['Vantasia', 'Yasin', null, null, null] };
    const api = { season: () => Promise.resolve(season) } as unknown as Api;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, createElement(ApiProvider, { api, children }));
    const { result } = renderHook(() => useSeason(), { wrapper });
    await waitFor(() => { expect(result.current.data).toBeDefined(); });
    expect(monumentName(2)).toBe('Yasin • Abandoned Station');
  });
});
