import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api, ApiError } from '../src/api/client.js';

class UploadRequest {
  static sent: UploadRequest[] = [];
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  timeout = 0;
  status = 200;
  responseText = '';
  withCredentials = false;
  headers: Record<string, string> = {};
  method = '';
  url = '';
  body: File | null = null;
  open(method: string, url: string) { this.method = method; this.url = url; }
  setRequestHeader(key: string, value: string) { this.headers[key] = value; }
  send(body: File) { this.body = body; UploadRequest.sent.push(this); }
  abort() { this.onabort?.(); this.onloadend?.(); }
  finish(status: number, body: unknown) { this.status = status; this.responseText = JSON.stringify(body); this.onload?.(); this.onloadend?.(); }
}
const media = { kind: 'image' as const, assetId: '00000000-0000-4000-8000-000000000001', mimeType: 'image/png' };
const file = () => new File(['image bytes'], 'photo.png', { type: 'image/png' });
function setup() {
  UploadRequest.sent = [];
  vi.stubGlobal('XMLHttpRequest', UploadRequest);
  const api = new Api();
  return api;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe('authenticated chat uploads', () => {
  it('reports progress, sends binary content and parses the server response', async () => {
    const api = setup(); const progress = vi.fn(); const picked = file();
    const result = api.uploadChatMedia(picked, new AbortController().signal, progress);
    const request = UploadRequest.sent[0]!;
    expect(request.url).toBe('/api/admin/chat/media');
    expect(request.headers['content-type']).toBe('application/octet-stream');
    expect(request.headers['x-media-type']).toBe('image/png');
    expect(request.withCredentials).toBe(true);
    expect(request.body).toBe(picked);
    request.upload.onprogress?.({ lengthComputable: true, loaded: 3, total: 4 });
    expect(progress).toHaveBeenCalledWith(75);
    request.finish(200, { media });
    await expect(result).resolves.toEqual({ media });
  });

  it('aborts a pending upload and never silently retries it', async () => {
    const api = setup(); const controller = new AbortController();
    const result = api.uploadChatMedia(file(), controller.signal, vi.fn());
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(UploadRequest.sent).toHaveLength(1);
  });

  it('times out stalled uploads and allows the composer to recover', async () => {
    const api = setup();
    const result = api.uploadChatMedia(file(), new AbortController().signal, vi.fn());
    const request = UploadRequest.sent[0]!;
    expect(request.timeout).toBe(120_000);
    request.ontimeout?.();
    await expect(result).rejects.toMatchObject({ code: 'UNREACHABLE' });
  });

  it('reconciles a placement rejection like ordinary API requests', async () => {
    const api = setup(); const changed = vi.fn();
    window.addEventListener('astera:placement-changed', changed);
    try {
      const result = api.uploadChatMedia(file(), new AbortController().signal, vi.fn());
      UploadRequest.sent[0]!.finish(409, { error: 'PLACEMENT_CHANGED', message: 'Refresh your galaxy' });
      await expect(result).rejects.toMatchObject({ code: 'PLACEMENT_CHANGED' });
      expect(changed).toHaveBeenCalledTimes(1);
    } finally { window.removeEventListener('astera:placement-changed', changed); }
  });

  it('refreshes an expired access token once and retries the same file', async () => {
    const api = setup(); const restore = vi.spyOn(api, 'restore').mockResolvedValue(true);
    const result = api.uploadChatMedia(file(), new AbortController().signal, vi.fn());
    UploadRequest.sent[0]!.finish(401, { error: 'UNAUTHENTICATED', message: 'Sign in first' });
    await vi.waitFor(() => { expect(UploadRequest.sent).toHaveLength(2); });
    expect(restore).toHaveBeenCalledTimes(1);
    UploadRequest.sent[1]!.finish(200, { media });
    await expect(result).resolves.toEqual({ media });
  });

  it('keeps permission errors actionable and rejects malformed successful responses', async () => {
    const api = setup(); const restore = vi.spyOn(api, 'restore');
    const denied = api.uploadChatMedia(file(), new AbortController().signal, vi.fn());
    UploadRequest.sent[0]!.finish(403, { error: 'ADMIN_FORBIDDEN', message: 'Admin access is required' });
    await expect(denied).rejects.toBeInstanceOf(ApiError);
    expect(restore).not.toHaveBeenCalled();
    const malformed = api.uploadChatMedia(file(), new AbortController().signal, vi.fn());
    UploadRequest.sent[1]!.finish(200, { media: { kind: 'youtube', videoId: 'bad' } });
    await expect(malformed).rejects.toThrow();
  });
});
