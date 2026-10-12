import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createHcaptchaPreview } from '../src/cli/hcaptcha-preview.js';

const origin = 'http://hcaptcha.localtest.me:4319';
const siteKey = 'ca789b15-e6aa-4f4a-95d6-0016aaf245f4';
const secret = 'private-test-secret';
const apps: FastifyInstance[] = [];
const headers = { host: 'hcaptcha.localtest.me:4319', origin };

afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

function setup(response: unknown = { success: true }) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response));
  const app = createHcaptchaPreview({ siteKey, secret, origin, fetcher });
  apps.push(app);
  return { app, fetcher };
}

describe('standalone hCaptcha preview', () => {
  it('does not report a successful live check before a token was submitted', async () => {
    const { app } = setup();
    const response = await app.inject({ url: '/status', headers });
    expect(JSON.parse(response.body)).toEqual({ attempted: false });
  });

  it('renders the configured widget without exposing the secret', async () => {
    const { app } = setup();
    const response = await app.inject({ url: '/', headers });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain(siteKey);
    expect(response.body).toContain('https://js.hcaptcha.com/1/api.js');
    expect(response.body).not.toContain(secret);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('verifies a solved token on the server with the expected sitekey', async () => {
    const { app, fetcher } = setup();
    const response = await app.inject({ method: 'POST', url: '/verify', headers, payload: { token: 'solved-token' } });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: true, errorCodes: [] });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.hcaptcha.com/siteverify');
    expect(options?.method).toBe('POST');
    expect(options?.redirect).toBe('error');
    const body = options?.body;
    if (!(body instanceof URLSearchParams)) throw new Error('Expected a form-encoded verification request');
    expect(body.toString()).toBe(new URLSearchParams({ secret, sitekey: siteKey, response: 'solved-token' }).toString());
    expect(response.body).not.toContain(secret);
    expect(response.body).not.toContain('solved-token');
    const status = await app.inject({ url: '/status', headers });
    expect(JSON.parse(status.body)).toEqual({ attempted: true, success: true, errorCodes: [] });
  });

  it('reports provider rejection as a failed verification', async () => {
    const { app } = setup({ success: false, 'error-codes': ['invalid-input-response'] });
    const response = await app.inject({ method: 'POST', url: '/verify', headers, payload: { token: 'fake-token' } });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ success: false, errorCodes: ['invalid-input-response'] });
  });

  it.each([{}, { token: '' }, { token: 3 }, { token: 'x', secret: 'forged' }, { token: 'x'.repeat(8193) }])(
    'rejects malformed or oversized input without contacting the provider', async (payload) => {
      const { app, fetcher } = setup();
      const response = await app.inject({ method: 'POST', url: '/verify', headers, payload });
      expect([400, 413]).toContain(response.statusCode);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it.each([
    { host: 'evil.example:4319', origin },
    { host: 'hcaptcha.localtest.me:4319', origin: 'https://evil.example' },
    { host: 'hcaptcha.localtest.me:4319' },
  ])('rejects a request outside the local preview origin', async (requestHeaders) => {
    const { app, fetcher } = setup();
    const response = await app.inject({ method: 'POST', url: '/verify', headers: requestHeaders, payload: { token: 'x' } });
    expect(response.statusCode).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects hostile Host headers on the page itself', async () => {
    const { app } = setup();
    const response = await app.inject({ url: '/', headers: { host: 'evil.example' } });
    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain(siteKey);
  });

  it.each([{ success: 'true' }, {}, { success: true, 'error-codes': 42 }])(
    'does not trust a malformed provider response', async (providerResponse) => {
      const { app } = setup(providerResponse);
      const response = await app.inject({ method: 'POST', url: '/verify', headers, payload: { token: 'x' } });
      expect(response.statusCode).toBe(502);
      expect(JSON.parse(response.body)).toEqual({ success: false, errorCodes: ['verification-unavailable'] });
    },
  );

  it('reports transport failure without leaking the transport error', async () => {
    const { app, fetcher } = setup();
    fetcher.mockRejectedValueOnce(new Error(secret));
    const response = await app.inject({ method: 'POST', url: '/verify', headers, payload: { token: 'x' } });
    expect(response.statusCode).toBe(502);
    expect(response.body).not.toContain(secret);
    expect(JSON.parse(response.body)).toEqual({ success: false, errorCodes: ['verification-unavailable'] });
  });

  it('rejects a non-success HTTP response even if its JSON claims success', async () => {
    const { app, fetcher } = setup();
    fetcher.mockResolvedValueOnce(Response.json({ success: true }, { status: 503 }));
    const response = await app.inject({ method: 'POST', url: '/verify', headers, payload: { token: 'x' } });
    expect(response.statusCode).toBe(502);
  });

  it('refuses missing credentials before starting', () => {
    expect(() => createHcaptchaPreview({ siteKey, secret: '', origin })).toThrow();
    expect(() => createHcaptchaPreview({ siteKey: 'bad-key', secret, origin })).toThrow();
  });
});
