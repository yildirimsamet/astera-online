import { describe, expect, it, vi } from 'vitest';
import { arenaCredential, openReferenceSession, probeArenaAccess, tokenSecondsLeft } from '../../src/arena/access.js';

const NOW = 1_800_000_000_000;
const jwt = (payload: object): string => {
  const body = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.signature`;
};

describe('arena credential', () => {
  it('reads the seconds left on a token and treats anything unreadable as expired', () => {
    expect(tokenSecondsLeft(jwt({ exp: NOW / 1000 + 600 }), NOW)).toBe(600);
    expect(tokenSecondsLeft(jwt({ exp: NOW / 1000 - 5 }), NOW)).toBe(0);
    expect(tokenSecondsLeft(jwt({ sub: 'x' }), NOW)).toBe(0);
    expect(tokenSecondsLeft('not-a-token', NOW)).toBe(0);
    expect(tokenSecondsLeft('a.%%%.b', NOW)).toBe(0);
  });

  it('reuses a token with time left and refreshes one about to lapse', async () => {
    const live = jwt({ exp: NOW / 1000 + 600 });
    const fresh = { accessToken: live, restore: vi.fn(() => Promise.resolve(true)) };
    expect(await arenaCredential(fresh, NOW)).toBe(live);
    expect(fresh.restore).not.toHaveBeenCalled();

    const renewed = jwt({ exp: NOW / 1000 + 900 });
    const stale = { accessToken: jwt({ exp: NOW / 1000 + 30 }), restore: vi.fn(() => { stale.accessToken = renewed; return Promise.resolve(true); }) };
    expect(await arenaCredential(stale, NOW)).toBe(renewed);
    expect(stale.restore).toHaveBeenCalledOnce();
  });

  it('survives a failed refresh: the hello is refused and says so, nothing throws', async () => {
    const broken = { accessToken: null, restore: vi.fn(() => Promise.reject(new Error('offline'))) };
    expect(await arenaCredential(broken, NOW)).toBeNull();
  });
});

describe('arena access probe', () => {
  const answer = (body: unknown, status = 200) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

  it('asks with the bearer token and believes only an explicit yes', async () => {
    const yes = answer({ allowed: true });
    expect(await probeArenaAccess('token', yes)).toBe(true);
    expect(yes).toHaveBeenCalledWith('/arena/access', { headers: { authorization: 'Bearer token' } });
    expect(await probeArenaAccess('token', answer({ allowed: false }))).toBe(false);
    expect(await probeArenaAccess('token', answer({ allowed: 'yes' }))).toBe(false);
    expect(await probeArenaAccess('token', answer({ allowed: true }, 502))).toBe(false);
  });

  it('stays closed with no token or no arena process behind the proxy', async () => {
    const never = vi.fn(() => Promise.reject(new Error('unreachable')));
    expect(await probeArenaAccess(null, never)).toBe(false);
    expect(never).not.toHaveBeenCalled();
    expect(await probeArenaAccess('token', never)).toBe(false);
    expect(await probeArenaAccess('token', vi.fn(() => Promise.resolve(new Response('<html>', { status: 200 }))))).toBe(false);
  });
});

/** Owner 2026-10-20: the private playtest flies the reference pack, cookie-gated per pilot. */
describe('reference pack session', () => {
  it('asks the arena for the pack cookie and opens only on its explicit grant', async () => {
    const granted = vi.fn((_url: string, _init?: RequestInit) => Promise.resolve(new Response(null, { status: 204 })));
    expect(await openReferenceSession('tok', granted as unknown as typeof fetch)).toBe(true);
    expect(granted).toHaveBeenCalledWith('/arena/ref-session', { method: 'POST', credentials: 'same-origin', headers: { authorization: 'Bearer tok' } });
    for (const status of [401, 403, 404, 500]) {
      expect(await openReferenceSession('tok', () => Promise.resolve(new Response(null, { status })))).toBe(false);
    }
    expect(await openReferenceSession('tok', () => Promise.reject(new Error('offline')))).toBe(false);
    expect(await openReferenceSession(null, granted as unknown as typeof fetch)).toBe(false);
  });
});
