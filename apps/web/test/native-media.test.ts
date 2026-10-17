import { CHAT_MEDIA } from '@astera/rules';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import type { AuthTransport } from '../src/platform/authTransport.js';

const image = { kind: 'image' as const, assetId: 'asset', mimeType: 'image/png' };
const session = { accountId: 'native-account', username: 'pilot', displayName: 'Pilot', country: 'TR', accessToken: 'short-access' };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function harness() {
  const request = vi.fn<AuthTransport['request']>().mockImplementation(() => Promise.resolve(json(session)));
  const fetcher = vi.fn<typeof fetch>();
  const api = new Api({ fetch: fetcher, baseUrl: 'https://api.example.test', authTransport: { request, clear: vi.fn().mockResolvedValue(undefined) } });
  const create = vi.fn().mockReturnValue('blob:private-image'); const revoke = vi.fn();
  vi.stubGlobal('URL', class extends URL { static override createObjectURL = create; static override revokeObjectURL = revoke; });
  return { api, request, fetcher, create, revoke };
}

describe('protected native chat media', () => {
  it('fetches with bearer and no cookies, then releases the object URL on unmount or logout', async () => {
    const { api, fetcher, create, revoke } = harness();
    await api.login('pilot', 'password');
    fetcher.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }));
    const source = await api.chatMediaSource(image, 'dm', 'message', new AbortController().signal);
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/chat/media/asset?channel=dm&messageId=message', expect.objectContaining({
      credentials: 'omit', cache: 'no-store', redirect: 'error', headers: { authorization: 'Bearer short-access' },
    }));
    expect(create).toHaveBeenCalledOnce();
    expect(source.url).toBe('blob:private-image');
    source.release(); source.release();
    expect(revoke).toHaveBeenCalledTimes(1);
    await api.chatMediaSource(image, 'dm', 'message', new AbortController().signal);
    await api.logout();
    expect(revoke).toHaveBeenCalledTimes(2);
  });
  it('keeps the browser image URL path without downloading a blob on web', async () => {
    const fetcher = vi.fn<typeof fetch>(); const api = new Api({ fetch: fetcher, authTransport: null });
    const source = await api.chatMediaSource(image, undefined, undefined, new AbortController().signal);
    expect(source.url).toBe('/api/chat/media/asset');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refreshes once after a 401 and preserves the private media scope', async () => {
    const { api, fetcher, request } = harness(); await api.login('pilot', 'password');
    fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
    await api.chatMediaSource(image, 'clan', 'message', new AbortController().signal);
    expect(request).toHaveBeenCalledWith('/api/auth/refresh', undefined);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1]?.[0]).toContain('channel=clan&messageId=message');
  });
  it('cannot expose a delayed download after logout', async () => {
    const { api, fetcher, create } = harness(); await api.login('pilot', 'password');
    let release: ((response: Response) => void) | undefined;
    fetcher.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const loading = api.chatMediaSource(image, 'dm', 'message', new AbortController().signal);
    const rejection = expect(loading).rejects.toBeDefined();
    await api.logout();
    release?.(new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/png' } }));
    await rejection;
    expect(create).not.toHaveBeenCalled();
  });
  it('rejects oversized or wrong-type media and never creates an object URL', async () => {
    const { api, fetcher, create } = harness(); await api.login('pilot', 'password');
    fetcher.mockResolvedValueOnce(new Response('html', { headers: { 'content-type': 'text/html' } }));
    await expect(api.chatMediaSource(image, undefined, undefined, new AbortController().signal)).rejects.toBeDefined();
    fetcher.mockResolvedValueOnce(new Response('large', { headers: { 'content-type': 'image/png', 'content-length': String(CHAT_MEDIA.imageMaxBytes + 1) } }));
    await expect(api.chatMediaSource(image, undefined, undefined, new AbortController().signal)).rejects.toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });
  it('aborts a streaming body when the owner leaves or a dishonest size exceeds the cap', async () => {
    const { api, fetcher, create } = harness(); await api.login('pilot', 'password');
    const cancel = vi.fn();
    fetcher.mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(CHAT_MEDIA.imageMaxBytes + 1)); }, cancel }), { headers: { 'content-type': 'image/png' } }));
    await expect(api.chatMediaSource(image, undefined, undefined, new AbortController().signal)).rejects.toBeDefined();
    expect(cancel).toHaveBeenCalledOnce(); expect(create).not.toHaveBeenCalled();
    const abort = new AbortController(); abort.abort();
    await expect(api.chatMediaSource(image, undefined, undefined, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
