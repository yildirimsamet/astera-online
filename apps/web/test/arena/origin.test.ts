import { afterEach, describe, expect, it, vi } from 'vitest';
import { arenaSocketUrl, arenaUrl } from '../../src/arena/origin.js';
import { openReferenceSession, probeArenaAccess } from '../../src/arena/access.js';
import { askTeam } from '../../src/arena/teamDesk.js';
import { fetchHangar } from '../../src/arena/hangarDesk.js';

const APP = { VITE_ASTERA_PLATFORM: 'native-production', VITE_ASTERA_API_URL: 'https://asteraonline.space' };
const page = (protocol: string, host: string) => ({ protocol, host });

afterEach(() => { vi.unstubAllEnvs(); });

describe('arena origin', () => {
  it('keeps the web on its own page and sends a bundled app to its API host', () => {
    expect(arenaUrl('/arena/access', {})).toBe('/arena/access');
    expect(arenaUrl('/arena/access', { VITE_ASTERA_PLATFORM: 'web', VITE_ASTERA_API_URL: 'https://elsewhere.example' })).toBe('/arena/access');
    expect(arenaUrl('/arena/access', APP)).toBe('https://asteraonline.space/arena/access');
  });

  it('opens the socket beside the page on the web and beside the API in an app', () => {
    expect(arenaSocketUrl({}, page('https:', 'asteraonline.space'))).toBe('wss://asteraonline.space/arena/ws');
    expect(arenaSocketUrl({}, page('http:', 'localhost:5173'))).toBe('ws://localhost:5173/arena/ws');
    expect(arenaSocketUrl(APP, page('https:', 'localhost'))).toBe('wss://asteraonline.space/arena/ws');
    expect(arenaSocketUrl({ VITE_ASTERA_PLATFORM: 'native-local', VITE_ASTERA_API_URL: 'http://localhost:3200' }, page('http:', 'localhost')))
      .toBe('ws://localhost:3200/arena/ws');
  });

  it('points every desk request of a bundled app at the API host', async () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', APP.VITE_ASTERA_PLATFORM);
    vi.stubEnv('VITE_ASTERA_API_URL', APP.VITE_ASTERA_API_URL);
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response('{}', { status: 500 })));
    await probeArenaAccess('token', fetcher);
    await askTeam('token', { kind: 'read' }, fetcher);
    await fetchHangar('token', fetcher);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([
      'https://asteraonline.space/arena/access', 'https://asteraonline.space/arena/team', 'https://asteraonline.space/arena/hangar']);
  });

  /** The pack's cookie is SameSite=Strict on the API host; an app page can never send it (KG-K17). */
  it('does not ask for the reference pack from a bundled app', async () => {
    vi.stubEnv('VITE_ASTERA_PLATFORM', APP.VITE_ASTERA_PLATFORM);
    vi.stubEnv('VITE_ASTERA_API_URL', APP.VITE_ASTERA_API_URL);
    const fetcher = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
    expect(await openReferenceSession('token', fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
