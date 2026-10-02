import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env.js';
import { polarReady, productIdsFor } from '../src/services/polar.js';

const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };
const ids = {
  POLAR_PRODUCT_LAVA: 'f372f658-e927-4051-b758-e5fa10d09f5f',
  POLAR_PRODUCT_ICE: 'fc685168-53ef-4309-bff8-1dc87c6eeb5a',
  POLAR_PRODUCT_TOXIC: '96a964b1-105f-4592-a236-4b118b512359',
  POLAR_PRODUCT_DESERT: '519098ee-2d23-4494-b07e-d11eda7a4b8b',
  POLAR_PRODUCT_TURKEY: '375d09b0-3c33-4800-ba8b-8582eefa5d1f',
  POLAR_PRODUCT_GERMANY: 'f557093b-eba9-499c-9788-a41c35eb3ad9',
  POLAR_PRODUCT_FRANCE: '468d0d5e-1b7b-42cc-9a50-8951292f177e',
  POLAR_PRODUCT_SPAIN: '2851d8bb-6017-4fc3-a3b3-3eae0ea85314',
  POLAR_PRODUCT_JAPAN: '0ec62d42-711e-4f7b-90ed-ef92d07a8bdb',
  POLAR_PRODUCT_BUNDLE: '9840aaf4-7e11-4aba-8234-6ab4f9379dcb',
};
const liveIds = {
  POLAR_PRODUCT_LAVA: '66986348-3d99-491a-812a-c811859d1a70',
  POLAR_PRODUCT_ICE: '9ff2c27e-e9e1-4e7c-8382-7950c9ba834c',
  POLAR_PRODUCT_TOXIC: '45eb7762-3d38-468f-9a8d-7364ac549ce5',
  POLAR_PRODUCT_DESERT: 'e4dcc308-8977-4e3a-a5b8-11219448321c',
  POLAR_PRODUCT_TURKEY: 'fdce9f79-5287-4a6a-936a-10a21ff72569',
  POLAR_PRODUCT_GERMANY: '648b85c1-b04b-47bc-b742-b2ef73b91458',
  POLAR_PRODUCT_FRANCE: '63bcf9e6-d0fc-4cc2-aaa6-533ca6b51f48',
  POLAR_PRODUCT_SPAIN: 'ab2d4302-5d25-4cb2-9007-c41ee5bdb0d9',
  POLAR_PRODUCT_JAPAN: '82b25098-29bb-4b98-a8f4-11cb78ee2e7b',
  POLAR_PRODUCT_BUNDLE: '34dcfb16-e875-43da-9a9d-e12ee4b5f335',
};

describe('Polar environment gate', () => {
  it('ships sandbox and live templates with distinct ten-product catalogs, sales disabled and no secrets', async () => {
    for (const [template, products, mode] of [
      ['.env.example', ids, 'sandbox'], ['.env.production.example', liveIds, 'production'],
    ] as const) {
      const content = await readFile(resolve(process.cwd(), '../..', template), 'utf8');
      expect(content).toMatch(/^POLAR_CHECKOUT_ENABLED=false$/m);
      expect(content).toMatch(new RegExp(`^POLAR_ENV=${mode}$`, 'm'));
      expect(content).toMatch(/^POLAR_ACCESS_TOKEN=$/m);
      expect(content).toMatch(/^POLAR_WEBHOOK_SECRET=$/m);
      for (const [key, value] of Object.entries(products)) {
        expect(content).toMatch(new RegExp(`^${key}=${value}$`, 'm'));
      }
    }
  });

  it('keeps Polar disabled until all ten products and both secrets are present', () => {
    expect(polarReady(loadEnv({ ...base }))).toBe(false);
    expect(polarReady(loadEnv({ ...base, POLAR_CHECKOUT_ENABLED: 'true',
      POLAR_ACCESS_TOKEN: 'test-token', POLAR_WEBHOOK_SECRET: 'test-secret', ...ids,
      POLAR_PRODUCT_BUNDLE: '' }))).toBe(false);
    expect(polarReady(loadEnv({ ...base, POLAR_CHECKOUT_ENABLED: 'true',
      POLAR_ACCESS_TOKEN: 'test-token', POLAR_WEBHOOK_SECRET: 'test-secret', ...ids }))).toBe(true);
  });

  it('keeps Polar product IDs distinct from Paddle price IDs', () => {
    const env = loadEnv({ ...base, ...ids });
    expect(productIdsFor(env)).toEqual({
      'planet-lava': ids.POLAR_PRODUCT_LAVA,
      'planet-ice': ids.POLAR_PRODUCT_ICE,
      'planet-toxic': ids.POLAR_PRODUCT_TOXIC,
      'planet-desert': ids.POLAR_PRODUCT_DESERT,
      'planet-turkey': ids.POLAR_PRODUCT_TURKEY,
      'planet-germany': ids.POLAR_PRODUCT_GERMANY,
      'planet-france': ids.POLAR_PRODUCT_FRANCE,
      'planet-spain': ids.POLAR_PRODUCT_SPAIN,
      'planet-japan': ids.POLAR_PRODUCT_JAPAN,
      bundle: ids.POLAR_PRODUCT_BUNDLE,
    });
  });
});
