import { afterEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import type { AuthTransport } from '../src/platform/authTransport.js';

const id = '11111111-1111-4111-8111-111111111111';
const media = { kind: 'image' as const, assetId: id, mimeType: 'image/png' };
function native() {
  const request = vi.fn<AuthTransport['request']>(() => Promise.resolve(new Response(JSON.stringify({ accountId: 'operator', username: 'operator', displayName: 'Operator', country: 'TR', accessToken: 'access' }))));
  const http = vi.fn<typeof fetch>(() => Promise.resolve(new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } })));
  const create = vi.fn(() => 'blob:review'); const revoke = vi.fn();
  vi.stubGlobal('URL', class extends URL { static override createObjectURL = create; static override revokeObjectURL = revoke; });
  return { api: new Api({ fetch: http, baseUrl: 'https://api.example.test', authTransport: { request, clear: () => Promise.resolve() } }), http, create, revoke };
}
afterEach(() => { vi.unstubAllGlobals(); });
it('uses a report-bound web URL without downloading a blob or accepting an arbitrary asset selector', async () => {
  const http = vi.fn<typeof fetch>(); const api = new Api({ fetch: http, authTransport: null });
  const source = await api.adminReportMediaSource(id, media, new AbortController().signal);
  expect(source.url).toBe(`/api/admin/content-reports/${id}/media`); expect(http).not.toHaveBeenCalled();
});
it('keeps native review bytes bearer-protected and releases them when the session ends', async () => {
  const { api, http, revoke } = native(); await api.login('operator', 'fixture-password');
  const source = await api.adminReportMediaSource(id, media, new AbortController().signal);
  expect(http).toHaveBeenCalledWith(`https://api.example.test/api/admin/content-reports/${id}/media`, expect.objectContaining({ credentials: 'omit', redirect: 'error', headers: { authorization: 'Bearer access' } }));
  expect(source.url).toBe('blob:review'); await api.logout(); expect(revoke).toHaveBeenCalledWith('blob:review');
});
it('does not create an object URL for an unavailable or invalid attachment', async () => {
  const { api, http, create } = native(); await api.login('operator', 'fixture-password');
  http.mockResolvedValueOnce(new Response(null, { status: 404 }));
  await expect(api.adminReportMediaSource(id, media, new AbortController().signal)).rejects.toBeDefined();
  http.mockResolvedValueOnce(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
  await expect(api.adminReportMediaSource(id, media, new AbortController().signal)).rejects.toBeDefined();
  expect(create).not.toHaveBeenCalled();
});
