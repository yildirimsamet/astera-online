import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { shopierProductUrl, shopierReady } from '../src/services/shopier.js';

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const products = JSON.stringify({
  'planet-lava': { productId: '51278662', tryAmount: 9900 },
  bundle: { productId: '51278911', tryAmount: 27900 },
});
const ready = { SHOPIER_CHECKOUT_ENABLED: 'true', SHOPIER_ACCESS_TOKEN: 'pat', SHOPIER_WEBHOOK_TOKEN: 'hook', SHOPIER_PRODUCTS: products };

describe('Shopier environment gate', () => {
  it('stays closed until the flag, both secrets and at least one product are present', () => {
    expect(shopierReady(loadEnv({ ...base }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_CHECKOUT_ENABLED: 'false' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_ACCESS_TOKEN: '' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_WEBHOOK_TOKEN: ' ' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_PRODUCTS: '{}' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready }))).toBe(true);
  });

  it('accepts the owner\'s shopier_prod_access_token name and prefers the explicit one', () => {
    expect(loadEnv({ ...base, shopier_prod_access_token: 'from-alias' }).SHOPIER_ACCESS_TOKEN).toBe('from-alias');
    expect(loadEnv({ ...base, SHOPIER_ACCESS_TOKEN: 'explicit', shopier_prod_access_token: 'from-alias' })
      .SHOPIER_ACCESS_TOKEN).toBe('explicit');
  });

  it('parses the product map in kuruş and builds the short product link', () => {
    const env = loadEnv({ ...base, SHOPIER_PRODUCTS: products });
    expect(env.SHOPIER_PRODUCTS).toEqual({
      'planet-lava': { productId: '51278662', tryAmount: 9900 },
      bundle: { productId: '51278911', tryAmount: 27900 },
    });
    expect(shopierProductUrl('51278662')).toBe('https://www.shopier.com/51278662');
  });

  it.each([
    ['broken JSON', '{'],
    ['an unknown item', JSON.stringify({ 'planet-mars': { productId: '1', tryAmount: 9900 } })],
    ['a free standard', JSON.stringify({ 'flag-vanguard': { productId: '1', tryAmount: 4900 } })],
    ['a non-numeric product', JSON.stringify({ 'planet-lava': { productId: 'abc', tryAmount: 9900 } })],
    ['a zero price', JSON.stringify({ 'planet-lava': { productId: '1', tryAmount: 0 } })],
    ['a fractional price', JSON.stringify({ 'planet-lava': { productId: '1', tryAmount: 99.5 } })],
    ['an extra field', JSON.stringify({ 'planet-lava': { productId: '1', tryAmount: 9900, url: 'x' } })],
    ['one product for two items', JSON.stringify({
      'planet-lava': { productId: '7', tryAmount: 9900 }, 'planet-ice': { productId: '7', tryAmount: 9900 } })],
  ])('rejects %s', (_label, value) => {
    expect(() => loadEnv({ ...base, SHOPIER_PRODUCTS: value })).toThrow(/SHOPIER_PRODUCTS/);
  });

  it('ships both templates closed and without secrets', async () => {
    for (const template of ['.env.example', '.env.production.example']) {
      const content = await readFile(resolve(process.cwd(), '../..', template), 'utf8');
      expect(content).toMatch(/^SHOPIER_CHECKOUT_ENABLED=false$/m);
      expect(content).toMatch(/^SHOPIER_ACCESS_TOKEN=$/m);
      expect(content).toMatch(/^SHOPIER_WEBHOOK_TOKEN=$/m);
      expect(content).toMatch(/^SHOPIER_PRODUCTS=/m);
    }
  });

  it('passes the Shopier settings to production containers and clears them on stage', async () => {
    const root = resolve(process.cwd(), '../..');
    const prod = await readFile(resolve(root, 'docker-compose.prod.yml'), 'utf8');
    for (const key of ['SHOPIER_CHECKOUT_ENABLED', 'SHOPIER_ACCESS_TOKEN', 'shopier_prod_access_token',
      'SHOPIER_WEBHOOK_TOKEN', 'SHOPIER_PRODUCTS']) {
      expect(prod).toContain(`${key}: \${${key}:-`);
    }
    const stage = await readFile(resolve(root, 'docker-compose.stage.yml'), 'utf8');
    expect(stage).toMatch(/^ {2}SHOPIER_CHECKOUT_ENABLED: 'false'$/m);
    expect(stage).toMatch(/^ {2}SHOPIER_ACCESS_TOKEN: ''$/m);
    expect(stage).toMatch(/^ {2}shopier_prod_access_token: ''$/m);
    expect(stage).toMatch(/^ {2}SHOPIER_WEBHOOK_TOKEN: ''$/m);
  });
});
