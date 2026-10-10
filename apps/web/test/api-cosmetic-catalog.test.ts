import { COSMETIC_IDS } from '@astera/rules';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

const collection = { ownedSkinIds: [], planets: [], ownedCosmeticIds: ['ring-saturn'], equipment: { RING: 'ring-saturn' } };
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('client cosmetic catalogue declaration', () => {
  it('declares every known ID when reading inventory and parses new cosmetics', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, _init?: RequestInit) => response(collection));
    const api = new Api({ fetch: fetcher });
    const result = await api.skins();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('/api/skins');
    expect(new Headers(init?.headers).get('x-astera-cosmetics')?.split(',')).toEqual([...COSMETIC_IDS]);
    expect(result.ownedCosmeticIds).toEqual(['ring-saturn']);
    expect(result.equipment?.RING).toBe('ring-saturn');
  });

  it('keeps the declaration and authentication through a token refresh retry', async () => {
    const calls: { path: string; headers: Headers }[] = [];
    const fetcher = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const path = typeof url === 'string' ? url : url instanceof URL ? url.pathname : url.url;
      calls.push({ path, headers: new Headers(init?.headers) });
      if (calls.length === 1) return response({ error: 'UNAUTHORIZED' }, 401);
      if (path === '/api/auth/refresh') return response({ accountId: 'a1', username: 'vantage', displayName: 'Vantage', country: 'TR', accessToken: 'fresh-token' });
      return response(collection);
    });
    const api = new Api({ fetch: fetcher });
    expect((await api.skins()).ownedCosmeticIds).toEqual(['ring-saturn']);
    const inventoryCalls = calls.filter(call => call.path === '/api/skins');
    expect(inventoryCalls).toHaveLength(2);
    for (const call of inventoryCalls) expect(call.headers.get('x-astera-cosmetics')).toBe(COSMETIC_IDS.join(','));
    expect(inventoryCalls[1]?.headers.get('authorization')).toBe('Bearer fresh-token');
  });
});
