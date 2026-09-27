import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from '../src/env.js';
import { paddleReady, priceIdsFor } from '../src/services/paddleLive.js';

describe('live Paddle environment aliases', () => {
  const base = { DATABASE_URL: 'postgres://test', JWT_SECRET: 'test-secret-that-is-long-enough' };

  it('documents the nine live offers and private credentials in both env templates', async () => {
    for (const template of ['.env.example', '.env.production.example']) {
      const text = await readFile(resolve(process.cwd(), '../..', template), 'utf8');
      for (const key of ['PADDLE_LIVE_API_KEY', 'PADDLE_CLIENT_SIDE_TOKEN', 'PADDLE_WEBHOOK_SECRET',
        'PADDLE_PRICE_LAVA', 'PADDLE_PRICE_ICE', 'PADDLE_PRICE_TOXIC', 'PADDLE_PRICE_DESERT',
        'PADDLE_PRICE_TURKEY', 'PADDLE_PRICE_GERMANY', 'PADDLE_PRICE_FRANCE', 'PADDLE_PRICE_SPAIN',
        'PADDLE_PRICE_BUNDLE']) expect(text).toMatch(new RegExp(`^${key}=`, 'm'));
      expect(text).toMatch(/^PADDLE_CHECKOUT_ENABLED=false$/m);
      expect(text).toMatch(/^PADDLE_ENV=production$/m);
      expect(text).toMatch(/^PADDLE_WEBHOOK_SECRET=$/m);
    }
  });

  it('accepts the names used by the production deployment and exposes the canonical config', () => {
    const env = loadEnv({ ...base,
      PADDLE_LIVE_API_KEY: 'pdl_live_example',
      PADDLE_CLIENT_SIDE_TOKEN: 'live_example',
      PADDLE_WEBHOOK_SECRET: 'pdl_ntfset_live_example',
      PADDLE_CHECKOUT_ENABLED: 'true',
      PADDLE_ENV: 'production',
    });
    expect(env.PADDLE_API_KEY).toBe('pdl_live_example');
    expect(env.PADDLE_CLIENT_TOKEN).toBe('live_example');
    expect(env.PADDLE_ENV).toBe('production');
  });

  it('prefers the canonical names when both forms are present', () => {
    const env = loadEnv({ ...base,
      PADDLE_API_KEY: 'pdl_live_canonical', PADDLE_LIVE_API_KEY: 'pdl_live_alias',
      PADDLE_CLIENT_TOKEN: 'live_canonical', PADDLE_CLIENT_SIDE_TOKEN: 'live_alias',
    });
    expect(env.PADDLE_API_KEY).toBe('pdl_live_canonical');
    expect(env.PADDLE_CLIENT_TOKEN).toBe('live_canonical');
  });

  it('keeps every live offer configurable, including country skins and the bundle', () => {
    const env = loadEnv({ ...base,
      PADDLE_PRICE_TURKEY: 'pri_custom_turkey', PADDLE_PRICE_GERMANY: 'pri_custom_germany',
      PADDLE_PRICE_FRANCE: 'pri_custom_france', PADDLE_PRICE_SPAIN: 'pri_custom_spain',
      PADDLE_PRICE_BUNDLE: 'pri_custom_bundle',
    });
    expect(priceIdsFor(env)).toMatchObject({
      'planet-turkey': 'pri_custom_turkey', 'planet-germany': 'pri_custom_germany',
      'planet-france': 'pri_custom_france', 'planet-spain': 'pri_custom_spain',
      bundle: 'pri_custom_bundle',
    });
  });

  it('requires the webhook signing secret before checkout can open', () => {
    const missingSecret = loadEnv({ ...base, PADDLE_ENV: 'production',
      PADDLE_LIVE_API_KEY: 'pdl_live_example', PADDLE_CLIENT_SIDE_TOKEN: 'live_example',
      PADDLE_CHECKOUT_ENABLED: 'true' });
    expect(paddleReady(missingSecret)).toBe(false);
    expect(paddleReady(loadEnv({ ...base, PADDLE_ENV: 'production',
      PADDLE_LIVE_API_KEY: 'pdl_live_example', PADDLE_CLIENT_SIDE_TOKEN: 'live_example',
      PADDLE_WEBHOOK_SECRET: 'pdl_ntfset_live_example', PADDLE_CHECKOUT_ENABLED: 'true' }))).toBe(true);
  });

});
