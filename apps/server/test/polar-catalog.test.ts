import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTRA_COSMETIC_IDS, cosmeticById } from '@astera/rules';
import { loadEnv } from '../src/env.js';
import { polarPricingForIp } from '../src/services/polar.js';

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const root = resolve(import.meta.dirname, '../../..');
const paid = EXTRA_COSMETIC_IDS.flatMap(id => {
  const item = cosmeticById(id);
  return item && !item.free ? [{ ...item, id }] : [];
});
const catalogue = async (environment: 'sandbox' | 'production') => loadEnv({
  ...base, POLAR_COSMETIC_PRODUCTS: await readFile(resolve(root, `config/polar-cosmetics.${environment}.json`), 'utf8'),
}).POLAR_COSMETIC_PRODUCTS;

afterEach(() => { vi.unstubAllGlobals(); });

describe('approved Polar cosmetic launch catalogue', () => {
  it.each(['sandbox', 'production'] as const)('prices every paid cosmetic exactly once in %s and excludes included flags', async environment => {
    const products = await catalogue(environment);
    expect(Object.keys(products).sort()).toEqual(paid.map(item => item.id).sort());
    expect(new Set(Object.values(products).map(item => item.productId)).size).toBe(paid.length);
    for (const item of paid) {
      const expected = item.category === 'SHIP' || item.category === 'PROBE'
        ? { eurAmount: 399, tryAmount: 9900 }
        : item.category === 'ENGINE' ? { eurAmount: 249, tryAmount: 6900 }
          : { eurAmount: 199, tryAmount: 4900 };
      expect(products[item.id]).toMatchObject(expected);
    }
    for (const id of ['flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian'] as const) expect(products[id]).toBeUndefined();
  });

  it.each(['flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian'])('rejects a paid provider mapping for included standard %s', id => {
    expect(() => loadEnv({ ...base, POLAR_COSMETIC_PRODUCTS: JSON.stringify({
      [id]: { productId: '17734747-6204-4a58-bec2-ff49c52e1aa1', eurAmount: 199, tryAmount: 4900 },
    }) })).toThrow(/Free cosmetics cannot have a price/);
  });

  it('never reuses a sandbox product in the live catalogue', async () => {
    const sandbox = await catalogue('sandbox');
    const production = await catalogue('production');
    const sandboxIds = new Set(Object.values(sandbox).map(item => item.productId));
    for (const item of Object.values(production)) expect(sandboxIds.has(item.productId)).toBe(false);
  });

  it.each([
    ['sandbox', '.env.example'], ['production', '.env.production.example'],
  ] as const)('ships the verified %s mapping in %s without secrets', async (environment, template) => {
    const values = parseEnv(await readFile(resolve(root, template), 'utf8'));
    const config = loadEnv({ ...values, ...base });
    expect(config.POLAR_COSMETIC_PRODUCTS).toEqual(await catalogue(environment));
    expect(config.POLAR_CHECKOUT_ENABLED).toBe(false);
    expect(config.POLAR_ACCESS_TOKEN).toBe('');
    expect(config.POLAR_WEBHOOK_SECRET).toBe('');
  });

  it('quotes the approved regional prices for every paid cosmetic without converting the visitor currency', async () => {
    const env = loadEnv({ ...base, POLAR_COSMETIC_PRODUCTS: JSON.stringify(await catalogue('production')) });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ country: 'TR' })))));
    const turkey = await polarPricingForIp('198.51.100.241', env);
    const abroad = await polarPricingForIp('127.0.0.1', env);
    for (const item of paid) {
      const entry = env.POLAR_COSMETIC_PRODUCTS[item.id];
      expect(turkey.prices[item.id]).toMatchObject({ currencyCode: 'TRY', amount: entry?.tryAmount });
      expect(abroad.prices[item.id]).toMatchObject({ currencyCode: 'EUR', amount: entry?.eurAmount });
    }
    expect(turkey.prices['flag-vanguard']).toBeUndefined();
    expect(turkey.prices['planet-lava']).toMatchObject({ currencyCode: 'TRY', amount: 9900 });
    expect(abroad.prices.bundle).toMatchObject({ currencyCode: 'EUR', amount: 849 });
  });

  it('forwards the cosmetic mapping through the shared production API and worker environment', async () => {
    const compose = await readFile(resolve(root, 'docker-compose.prod.yml'), 'utf8');
    expect(compose).toMatch(/^\s+POLAR_COSMETIC_PRODUCTS:.*\$\{POLAR_COSMETIC_PRODUCTS/m);
    expect(compose).toContain('<<: *api-environment');
  });

  it.each(['', '   '])('treats an unconfigured compose value as an empty optional catalogue (%j)', value => {
    expect(loadEnv({ ...base, POLAR_COSMETIC_PRODUCTS: value }).POLAR_COSMETIC_PRODUCTS).toEqual({});
  });
});
