import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { refreshQueries } from '../src/api/refreshQueries.js';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const requests: ReturnType<typeof deferred<number>>[] = [];
  const fetch = vi.fn(() => {
    const request = deferred<number>();
    requests.push(request);
    return request.promise;
  });
  client.setQueryData(['world', 'one'], 0);
  const observer = new QueryObserver(client, { queryKey: ['world', 'one'], queryFn: fetch, staleTime: Infinity });
  const stop = observer.subscribe(() => undefined);
  return { client, requests, fetch, stop };
}

it('coalesces repeated invalidations and retains events arriving during the repair read', async () => {
  const f = fixture();
  const done = [refreshQueries(f.client, { queryKey: ['world'] })];
  for (let i = 0; i < 20; i++) done.push(refreshQueries(f.client, { queryKey: ['world', 'one'] }));
  expect(f.fetch).toHaveBeenCalledTimes(1);
  f.requests[0]!.resolve(1);
  await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(2); });
  done.push(refreshQueries(f.client, { queryKey: ['world'] }));
  f.requests[1]!.resolve(2);
  await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(3); });
  f.requests[2]!.resolve(3);
  await Promise.all(done);
  expect(f.client.getQueryData(['world', 'one'])).toBe(3);
  expect(f.fetch).toHaveBeenCalledTimes(3);
  f.stop(); f.client.clear();
});

it.each(['inactive', 'removed'] as const)('does not start a queued read after the query becomes %s', async mode => {
  const f = fixture();
  const first = refreshQueries(f.client, { queryKey: ['world'] });
  const second = refreshQueries(f.client, { queryKey: ['world'] });
  f.stop();
  if (mode === 'removed') f.client.removeQueries({ queryKey: ['world'] });
  f.requests[0]!.resolve(1);
  await Promise.all([first, second]);
  expect(f.fetch).toHaveBeenCalledTimes(1);
  if (mode === 'inactive') expect(f.client.getQueryState(['world', 'one'])?.isInvalidated).toBe(true);
  f.client.clear();
});

it('repairs a failed in-flight read without discarding the pending invalidation', async () => {
  const f = fixture();
  const first = refreshQueries(f.client, { queryKey: ['world'] });
  const second = refreshQueries(f.client, { queryKey: ['world'] });
  f.requests[0]!.reject(new Error('temporary network failure'));
  await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(2); });
  f.requests[1]!.resolve(2);
  await Promise.all([first, second]);
  expect(f.client.getQueryData(['world', 'one'])).toBe(2);
  f.stop(); f.client.clear();
});

it('keeps the same query hash isolated between clients and invalidates inactive queries without fetching', async () => {
  const a = fixture();
  const b = fixture();
  const reads = [refreshQueries(a.client), refreshQueries(b.client)];
  a.requests[0]!.resolve(1); b.requests[0]!.resolve(2);
  await Promise.all(reads);
  expect(a.client.getQueryData(['world', 'one'])).toBe(1);
  expect(b.client.getQueryData(['world', 'one'])).toBe(2);
  a.stop(); b.stop();
  await refreshQueries(a.client);
  expect(a.fetch).toHaveBeenCalledTimes(1);
  expect(a.client.getQueryState(['world', 'one'])?.isInvalidated).toBe(true);
  a.client.clear(); b.client.clear();
});

it('finishes an awaiting mutation after its fresh pass even while later events keep arriving', async () => {
  const f = fixture();
  const first = refreshQueries(f.client);
  let fresh = false;
  const mutation = refreshQueries(f.client).then(() => { fresh = true; });
  let later: Promise<void> = Promise.resolve();
  try {
    f.requests[0]!.resolve(1);
    await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(2); });
    later = refreshQueries(f.client);
    f.requests[1]!.resolve(2);
    await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(3); });
    // The later event needs the third read; it must not hold the earlier action's
    // button pending forever on a busy galaxy with a slow connection.
    await vi.waitFor(() => { expect(fresh).toBe(true); }, { timeout: 200 });
  } finally {
    f.stop();
    for (const request of f.requests) request.resolve(3);
    await Promise.all([first, mutation, later]);
    f.client.clear();
  }
});

it('keeps a replacement query independent of a removed query with the same key', async () => {
  const f = fixture();
  const old = [refreshQueries(f.client), refreshQueries(f.client)];
  f.stop();
  f.client.removeQueries({ queryKey: ['world'] });
  f.client.setQueryData(['world', 'one'], 0);
  const observer = new QueryObserver(f.client, {
    queryKey: ['world', 'one'], queryFn: f.fetch, staleTime: Infinity,
  });
  const stop = observer.subscribe(() => undefined);
  const current = [refreshQueries(f.client), refreshQueries(f.client)];
  try {
    expect(f.fetch).toHaveBeenCalledTimes(2);
    f.requests[1]!.resolve(2);
    await vi.waitFor(() => { expect(f.fetch).toHaveBeenCalledTimes(3); }, { timeout: 200 });
    f.requests[2]!.resolve(3);
    await Promise.all(current);
    expect(f.client.getQueryData(['world', 'one'])).toBe(3);
  } finally {
    stop();
    for (const request of f.requests) request.resolve(3);
    await Promise.all([...old, ...current]);
    f.client.clear();
  }
});
