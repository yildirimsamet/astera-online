import { expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';

const proof = { version: '2026-10-19' as const, locale: 'tr' as const };
function client() {
  const http = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ error: 'FIXTURE_STOP', message: 'Fixture' }), { status: 400 })));
  return { api: new Api({ fetch: http }), http };
}
it.each(['register', 'claim'] as const)('never infers agreement for %s without an explicit caller proof', async action => {
  const { api, http } = client();
  await expect(action === 'register' ? api.register('Pilot', 'fixture-password') : api.claim('Pilot', 'fixture-password', 0)).rejects.toMatchObject({ code: 'COMMUNITY_POLICY_REQUIRED' });
  expect(http).not.toHaveBeenCalled();
});
it.each(['register', 'claim'] as const)('carries the explicit version and display language through %s', async action => {
  const { api, http } = client();
  await expect(action === 'register' ? api.register('Pilot', 'fixture-password', 'TR', proof) : api.claim('Pilot', 'fixture-password', 0, 'TR', proof)).rejects.toMatchObject({ code: 'FIXTURE_STOP' });
  const body = http.mock.calls[0]?.[1]?.body; if (typeof body !== 'string') throw new Error('Missing request body');
  expect(JSON.parse(body)).toMatchObject({ communityPolicyVersion: proof.version, communityPolicyLocale: proof.locale, countryCode: 'TR' });
});
