import { describe, expect, it, vi } from 'vitest';
import { PlayerAnalytics } from '../src/lib/playerAnalytics/client.js';

const urlText = (url: RequestInfo | URL): string => typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
const bodyText = (init?: RequestInit): string => {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON body');
  return init.body;
};

function setup() {
  let now = 1_800_000_000_000;
  const fetch = vi.fn<typeof globalThis.fetch>(url => Promise.resolve(urlText(url).endsWith('/visitors')
    ? new Response(JSON.stringify({ visitorId: crypto.randomUUID(), credential: 'v'.repeat(43), expiresAt: new Date(now + 86_400_000).toISOString() }), { status: 201 })
    : new Response(JSON.stringify({ accepted: 1, duplicates: 0 }))));
  const client = new PlayerAnalytics({ fetch, now: () => now, storage: sessionStorage });
  const enable = () => client.enable({ platform: 'web', locale: 'tr', build: 'test', campaign: {} });
  return { client, fetch, enable, advance: (ms: number) => { now += ms; } };
}
describe('bounded first-party observation client', () => {
  it('does no work or persistent storage before explicit enablement', async () => {
    sessionStorage.clear(); const { client, fetch } = setup();
    client.record('game_ready', {}, 'live'); await client.flush();
    expect(fetch).not.toHaveBeenCalled(); expect(sessionStorage.length).toBe(0);
  });
  it('preserves event identity over a failed delivery and sends the account token without the game API', async () => {
    sessionStorage.clear(); const { client, fetch, enable } = setup(); client.identity('commander', 'access'); await enable(); client.record('game_ready', {}, 'live');
    fetch.mockRejectedValueOnce(new Error('offline')); await client.flush();
    const first = JSON.parse(bodyText(fetch.mock.calls.at(-1)?.[1])) as { events: { id: string }[] };
    await client.flush();
    const second = JSON.parse(bodyText(fetch.mock.calls.at(-1)?.[1])) as { events: { id: string }[] };
    expect(second.events.map(e => e.id)).toEqual(first.events.map(e => e.id));
    expect(fetch.mock.calls.at(-1)?.[1]?.headers).toMatchObject({ authorization: 'Bearer access' });
  });
  it('does not deliver unsent events to the next account, and revocation clears persistence', async () => {
    sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable();
    client.identity('A', 'a'); client.record('game_ready', {}, 'live');
    client.identity('B', 'b'); await client.flush();
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST' && bodyText(init).includes('game_ready'))).toHaveLength(0);
    await client.disable(); expect(sessionStorage.length).toBe(0);
  });
  it('drops expired data and limits batch bytes and queued observations', async () => {
    sessionStorage.clear(); const { client, fetch, enable, advance } = setup(); await enable();
    for (let i = 0; i < 400; i++) client.record('surface_visible', { surface: 'base' }, 'live');
    expect(client.pending).toBeLessThanOrEqual(256); await client.flush();
    const batch = bodyText(fetch.mock.calls.at(-1)?.[1]);
    expect(new TextEncoder().encode(batch).length).toBeLessThanOrEqual(32 * 1024);
    advance(86_400_001); await client.flush(); expect(client.pending).toBe(0);
  });
  it('does not reopen a visit if permission is revoked while an account switch is awaiting deletion', async () => {
    sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable();
    let release: ((response: Response) => void) | undefined;
    fetch.mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
    client.identity('A', 'a'); client.identity('B', 'b');
    await client.disable();
    release?.(new Response(null, { status: 204 }));
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(fetch.mock.calls.filter(([url, init]) => urlText(url).endsWith('/visitors') && init?.method === 'POST')).toHaveLength(1);
    expect(sessionStorage.length).toBe(0);
  });
});

it('counts interaction only after the first input and never extends it across an unobserved gap', async () => {
  sessionStorage.clear(); const { client, fetch, enable, advance } = setup(); await enable(); client.foreground(true);
  advance(50_000); client.interact(); advance(10_000); client.heartbeat(); await client.flush();
  let batch = JSON.parse(bodyText(fetch.mock.calls.at(-1)?.[1])) as { events: { name: string; properties: { interactionMs?: number } }[] };
  expect(batch.events.find(event => event.name === 'interaction')?.properties.interactionMs).toBe(10_000);
  advance(180_000); client.heartbeat(); await client.flush();
  batch = JSON.parse(bodyText(fetch.mock.calls.at(-1)?.[1])) as typeof batch;
  expect(batch.events.find(event => event.name === 'interaction')?.properties.interactionMs).toBe(0);
});
it('opens a fresh grant after a full day instead of permanently disabling measurement', async () => {
  sessionStorage.clear(); const { client, enable, advance } = setup(); await enable(); advance(86_400_001);
  await enable(); expect(client.recording).toBe(true);
});

it('honours a server retry deadline instead of retrying immediately on reconnection', async () => {
  sessionStorage.clear(); const { client, fetch, enable, advance } = setup(); await enable();
  fetch.mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '120' } }));
  await client.flush(); const calls = fetch.mock.calls.length; await client.flush();
  expect(fetch).toHaveBeenCalledTimes(calls); advance(120_000); await client.flush();
  expect(fetch).toHaveBeenCalledTimes(calls + 1);
});
it('does not erase delivered history merely because the player signs out', async () => {
  sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable();
  client.identity('A', 'a'); await client.flush(); client.identity(null, null);
  await Promise.resolve();
  expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
});

it('keeps observation mode controlled by the screen rather than an auth event during training', async () => {
  sessionStorage.clear(); const { client, enable, fetch, advance } = setup(); await enable();
  client.record('load_phase', { phase: 'rehearsing' }, 'training'); client.foreground(true);
  client.record('auth_attempted', { code: 'claim' }, 'live'); advance(60_000); client.heartbeat(); await client.flush();
  const batch = JSON.parse(bodyText(fetch.mock.calls.at(-1)?.[1])) as { events: { name: string; mode: string }[] };
  expect(batch.events.find(event => event.name === 'interaction')?.mode).toBe('training');
});

it('does not inherit a duplicated tab context when the new navigation does not resume that page', async () => {
  sessionStorage.clear(); const { client, enable, fetch } = setup(); await enable(); client.record('surface_visible', { surface: 'old_tab' });
  const requests = fetch.mock.calls.length;
  const duplicate = new PlayerAnalytics({ fetch, now: () => 1_800_000_000_000, storage: sessionStorage, resume: false });
  await duplicate.enable({ platform: 'web', locale: 'tr', build: 'test', campaign: {} });
  expect(fetch).toHaveBeenCalledTimes(requests + 1); await duplicate.flush();
  expect(bodyText(fetch.mock.calls.at(-1)?.[1])).not.toContain('old_tab');
});

it('does not restart measurement on an identity change after explicit withdrawal', async () => {
  sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable(); client.identity('A', 'a');
  await client.disable(); const calls = fetch.mock.calls.length; client.identity('B', 'b');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(fetch).toHaveBeenCalledTimes(calls); expect(client.recording).toBe(false);
});
it('renews an anonymous observation scope immediately after sign-out while permission remains granted', async () => {
  sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable(); client.identity('A', 'a');
  client.identity(null, null); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(fetch.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2);
});

it('aborts a stalled delivery after ten seconds and can retry the same observations', async () => {
  vi.useFakeTimers();
  try {
    sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable();
    let aborted = false;
    fetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
    }));
    const pending = client.flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(aborted).toBe(true); await pending;
    expect(client.pending).toBe(1); await client.flush(); expect(client.pending).toBe(0);
  } finally { vi.useRealTimers(); }
});

it('aborts an in-flight observation on withdrawal before revoking the visit', async () => {
  sessionStorage.clear(); const { client, fetch, enable } = setup(); await enable();
  let aborted = false;
  fetch.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
  }));
  const pending = client.flush(); await client.disable();
  expect(aborted).toBe(true); await pending; expect(client.pending).toBe(0);
});

it('bounds the entire grant response including a stalled JSON body', async () => {
  vi.useFakeTimers();
  try {
    sessionStorage.clear(); const { client, fetch, enable } = setup();
    let aborted = false;
    fetch.mockImplementationOnce((_url, init) => Promise.resolve(new Response(new ReadableStream({
      start(controller) { init?.signal?.addEventListener('abort', () => {
        aborted = true; controller.error(new DOMException('Aborted', 'AbortError'));
      }); },
    }))));
    let finished = false; const pending = enable().then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(aborted).toBe(true); expect(finished).toBe(true);
    await pending; await enable(); expect(client.recording).toBe(true);
  } finally { vi.useRealTimers(); }
});
