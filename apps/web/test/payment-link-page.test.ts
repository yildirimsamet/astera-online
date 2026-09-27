import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { startPaymentLink } from '../public/checkout-page.js';

const source = (): Promise<string> => readFile(resolve(process.cwd(), 'public/checkout.html'), 'utf8');
const document = (): Document => new DOMParser().parseFromString(
  '<html lang="en"><body><p data-payment-link>Waiting</p></body></html>', 'text/html');

describe('the default payment link', () => {
  it('is a real page with Paddle.js, payment context and the buying policies', async () => {
    const html = await source();
    expect(html).toContain('https://cdn.paddle.com/paddle/v2/paddle.js');
    expect(html).toContain('/checkout-page.js');
    expect(html).toContain('/pricing.html');
    expect(html).toContain('/refunds.html');
    expect(html).toContain('/terms.html');
    expect(html).not.toMatch(/pdl_live_|live_[a-z\d]{20,}/i);
    const nginx = await readFile(resolve(process.cwd(), '../../deploy/nginx/astera.conf'), 'utf8');
    const policy = nginx.split('location = /checkout.html {')[1]?.split('add_header Content-Security-Policy ')[1]?.split('" always;')[0];
    expect(policy).toMatch(/script-src [^;]*https:\/\/cdn\.paddle\.com/);
    expect(policy).toMatch(/connect-src [^;]*https:\/\/\*\.paddle\.com/);
    expect(policy).toMatch(/frame-src [^;]*https:\/\/\*\.paddle\.com/);
  });

  it('initializes live Paddle for a transaction link using only the public token endpoint', async () => {
    const root = document();
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      enabled: true, clientToken: 'live_test_token',
    }), { status: 200 })));
    const initialize = vi.fn();
    await startPaymentLink(root, 'https://asteraonline.space/checkout.html?_ptxn=txn_01m3fxlive000000000000000',
      fetcher, { Initialize: initialize });
    expect(fetcher).toHaveBeenCalledWith('/api/paddle/client-config', { credentials: 'omit' });
    expect(initialize).toHaveBeenCalledWith({ token: 'live_test_token' });
    expect(root.querySelector('[data-payment-link]')?.textContent).toMatch(/opening/i);
  });

  it('does not initialize checkout for a missing transaction or closed sales', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ enabled: false }), { status: 200 })));
    const initialize = vi.fn();
    await startPaymentLink(document(), 'https://asteraonline.space/checkout.html', fetcher, { Initialize: initialize });
    expect(fetcher).not.toHaveBeenCalled();
    const root = document();
    await startPaymentLink(root, 'https://asteraonline.space/checkout.html?_ptxn=txn_01m3fxlive000000000000000',
      fetcher, { Initialize: initialize });
    expect(initialize).not.toHaveBeenCalled();
    expect(root.querySelector('[data-payment-link]')?.textContent).toMatch(/unavailable/i);
  });
});
