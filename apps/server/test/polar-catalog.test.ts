import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXTRA_COSMETIC_IDS, cosmeticById, type CosmeticId } from '@astera/rules';
import { loadEnv } from '../src/env.js';
import { polarPricingForIp } from '../src/services/polar.js';

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const root = resolve(import.meta.dirname, '../../..');
const paid = EXTRA_COSMETIC_IDS.flatMap(id => {
  const item = cosmeticById(id);
  return item && !item.free ? [{ ...item, id }] : [];
});
/**
 * The second premium wave is catalogued before its provider products exist: without a
 * mapping it has no quote and the shop shows it as coming soon. The owner creates the
 * Polar products; remove an ID here in the same change that adds its mapping.
 */
const AWAITING_POLAR_PRODUCTS: readonly CosmeticId[] = [
  'ring-saturn', 'ring-prism', 'ring-inferno', 'ring-nebula', 'engine-tempest', 'engine-prism',
  'flag-sovereign', 'flag-kraken', 'flag-oni', 'flag-voideye', 'flag-valkyrie',
  'flag-scarab', 'flag-stag', 'flag-horizon', 'flag-tiger', 'flag-scorpion',
];
const launched = paid.filter(item => !AWAITING_POLAR_PRODUCTS.includes(item.id));
const catalogue = async (environment: 'sandbox' | 'production') => loadEnv({
  ...base, POLAR_COSMETIC_PRODUCTS: await readFile(resolve(root, `config/polar-cosmetics.${environment}.json`), 'utf8'),
}).POLAR_COSMETIC_PRODUCTS;

afterEach(() => { vi.unstubAllGlobals(); });

describe('approved Polar cosmetic launch catalogue', () => {
  it.each(['sandbox', 'production'] as const)('prices every launched paid cosmetic exactly once in %s and excludes included flags', async environment => {
    const products = await catalogue(environment);
    expect(Object.keys(products).sort()).toEqual(launched.map(item => item.id).sort());
    expect(new Set(Object.values(products).map(item => item.productId)).size).toBe(20);
    for (const item of launched) {
      const expected = item.category === 'SHIP' || item.category === 'PROBE'
        ? { eurAmount: 399, tryAmount: 9900 }
        : item.category === 'ENGINE' ? { eurAmount: 249, tryAmount: 6900 }
          : { eurAmount: 199, tryAmount: 4900 };
      expect(products[item.id]).toMatchObject(expected);
    }
    for (const id of ['flag-vanguard', 'flag-orbit', 'flag-bastion', 'flag-meridian'] as const) expect(products[id]).toBeUndefined();
  });

  it('lists only real paid catalogue items as awaiting their provider products', () => {
    for (const id of AWAITING_POLAR_PRODUCTS) expect(paid.map(item => item.id), id).toContain(id);
    expect(new Set(AWAITING_POLAR_PRODUCTS).size).toBe(AWAITING_POLAR_PRODUCTS.length);
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

  it('quotes the approved regional prices for all twenty skins without converting the visitor currency', async () => {
    const env = loadEnv({ ...base, POLAR_COSMETIC_PRODUCTS: JSON.stringify(await catalogue('production')) });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ country: 'TR' })))));
    const turkey = await polarPricingForIp('198.51.100.241', env);
    const abroad = await polarPricingForIp('127.0.0.1', env);
    for (const item of launched) {
      const entry = env.POLAR_COSMETIC_PRODUCTS[item.id];
      expect(turkey.prices[item.id]).toMatchObject({ currencyCode: 'TRY', amount: entry?.tryAmount });
      expect(abroad.prices[item.id]).toMatchObject({ currencyCode: 'EUR', amount: entry?.eurAmount });
    }
    expect(turkey.prices['flag-vanguard']).toBeUndefined();
    for (const id of AWAITING_POLAR_PRODUCTS) expect(turkey.prices[id], id).toBeUndefined();
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
