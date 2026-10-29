import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { shopierReady } from '../src/services/shopier.js';

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(jpg: Buffer): { width: number; height: number } | null {
  for (let at = 2; at + 9 < jpg.length; at += 2 + jpg.readUInt16BE(at + 2)) {
    const marker = jpg[at + 1]!;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: jpg.readUInt16BE(at + 5), width: jpg.readUInt16BE(at + 7) };
    }
  }
  return null;
}

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const prices = JSON.stringify({ 'planet-lava': 9900, bundle: 27900 });
const ready = { SHOPIER_CHECKOUT_ENABLED: 'true', SHOPIER_ACCESS_TOKEN: 'pat', SHOPIER_WEBHOOK_TOKENS: 'orders,refunds',
  SHOPIER_PRICES: prices, SHOPIER_IMAGE_BASE_URL: 'https://asteraonline.space/assets/images/shopier' };

describe('Shopier environment gate', () => {
  it('stays closed until the flag, both secrets, a price and the image address are present', () => {
    expect(shopierReady(loadEnv({ ...base }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_CHECKOUT_ENABLED: 'false' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_ACCESS_TOKEN: '' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_WEBHOOK_TOKENS: ' , ' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_PRICES: '{}' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready, SHOPIER_IMAGE_BASE_URL: '' }))).toBe(false);
    expect(shopierReady(loadEnv({ ...base, ...ready }))).toBe(true);
  });

  it('accepts the owner\'s shopier_prod_access_token name and prefers the explicit one', () => {
    expect(loadEnv({ ...base, shopier_prod_access_token: 'from-alias' }).SHOPIER_ACCESS_TOKEN).toBe('from-alias');
    expect(loadEnv({ ...base, SHOPIER_ACCESS_TOKEN: 'explicit', shopier_prod_access_token: 'from-alias' })
      .SHOPIER_ACCESS_TOKEN).toBe('explicit');
  });

  it('reads one webhook token per subscription, the prices in kuruş and the image address without a trailing slash', () => {
    const env = loadEnv({ ...base, ...ready, SHOPIER_WEBHOOK_TOKENS: ' orders , refunds ,', SHOPIER_IMAGE_BASE_URL: 'https://x.test/img/' });
    expect(env.SHOPIER_WEBHOOK_TOKENS).toEqual(['orders', 'refunds']);
    expect(env.SHOPIER_PRICES).toEqual({ 'planet-lava': 9900, bundle: 27900 });
    expect(env.SHOPIER_IMAGE_BASE_URL).toBe('https://x.test/img');
  });

  it('ignores the retired product map a production .env may still carry', () => {
    const env = loadEnv({ ...base, ...ready, SHOPIER_PRODUCTS: '{"planet-lava":{"productId":"1","tryAmount":9900}}' });
    expect(shopierReady(env)).toBe(true);
    expect(env).not.toHaveProperty('SHOPIER_PRODUCTS');
  });

  it.each([
    ['broken JSON', '{'],
    ['an unknown item', JSON.stringify({ 'planet-mars': 9900 })],
    ['a free standard', JSON.stringify({ 'flag-vanguard': 4900 })],
    ['a zero price', JSON.stringify({ 'planet-lava': 0 })],
    ['a fractional price', JSON.stringify({ 'planet-lava': 99.5 })],
    ['a price in an object', JSON.stringify({ 'planet-lava': { tryAmount: 9900 } })],
  ])('rejects %s', (_label, value) => {
    expect(() => loadEnv({ ...base, SHOPIER_PRICES: value })).toThrow(/SHOPIER_PRICES/);
  });

  it('rejects an image address Shopier cannot fetch safely', () => {
    expect(() => loadEnv({ ...base, SHOPIER_IMAGE_BASE_URL: 'http://asteraonline.space/img' })).toThrow(/SHOPIER_IMAGE_BASE_URL/);
    expect(() => loadEnv({ ...base, SHOPIER_IMAGE_BASE_URL: 'not a url' })).toThrow(/SHOPIER_IMAGE_BASE_URL/);
  });

  it('ships both templates closed and without secrets', async () => {
    for (const template of ['.env.example', '.env.production.example']) {
      const content = await readFile(resolve(process.cwd(), '../..', template), 'utf8');
      expect(content).toMatch(/^SHOPIER_CHECKOUT_ENABLED=false$/m);
      expect(content).toMatch(/^SHOPIER_ACCESS_TOKEN=$/m);
      expect(content).toMatch(/^SHOPIER_WEBHOOK_TOKENS=$/m);
      expect(content).toMatch(/^SHOPIER_PRICES=/m);
      expect(content).toMatch(/^SHOPIER_IMAGE_BASE_URL=/m);
      expect(content).not.toMatch(/^SHOPIER_PRODUCTS=/m);
      expect(content).not.toMatch(/^SHOPIER_WEBHOOK_TOKEN=/m);
    }
  });

  it('ships a jpg beside every price, because Shopier fetches the product image from it', async () => {
    const template = await readFile(resolve(process.cwd(), '../..', '.env.production.example'), 'utf8');
    const env = loadEnv({ ...base, SHOPIER_PRICES: /^SHOPIER_PRICES='(.*)'$/m.exec(template)?.[1] ?? '{}' });
    const items = Object.keys(env.SHOPIER_PRICES);
    expect(items.length).toBeGreaterThan(30);
    for (const item of items) {
      const jpg = await readFile(resolve(process.cwd(), '../web/public/assets/images/shopier', `${item}.jpg`));
      expect(jpg.subarray(0, 3).toString('hex'), item).toBe('ffd8ff');
      // Shopier shows the image large on its product page: a 1200 px render, not a thumbnail.
      expect(jpegSize(jpg), item).toEqual({ width: 1200, height: 1200 });
    }
  });

  it('passes the Shopier settings to production containers and clears them on stage', async () => {
    const root = resolve(process.cwd(), '../..');
    const prod = await readFile(resolve(root, 'docker-compose.prod.yml'), 'utf8');
    for (const key of ['SHOPIER_CHECKOUT_ENABLED', 'SHOPIER_ACCESS_TOKEN', 'shopier_prod_access_token',
      'SHOPIER_WEBHOOK_TOKENS', 'SHOPIER_PRICES', 'SHOPIER_IMAGE_BASE_URL']) {
      expect(prod).toContain(`${key}: \${${key}:-`);
    }
    expect(prod).not.toContain('SHOPIER_PRODUCTS');
    const stage = await readFile(resolve(root, 'docker-compose.stage.yml'), 'utf8');
    expect(stage).toMatch(/^ {2}SHOPIER_CHECKOUT_ENABLED: 'false'$/m);
    expect(stage).toMatch(/^ {2}SHOPIER_ACCESS_TOKEN: ''$/m);
    expect(stage).toMatch(/^ {2}shopier_prod_access_token: ''$/m);
    expect(stage).toMatch(/^ {2}SHOPIER_WEBHOOK_TOKENS: ''$/m);
  });
});
