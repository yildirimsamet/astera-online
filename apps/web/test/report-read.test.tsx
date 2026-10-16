import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { keys } from '../src/api/queries.js';
import { useReadReportSignals } from '../src/session/useReadReportSignals.js';

const battle = '57ca7390-373f-44bc-bedd-02260e82660a';
const id = '15758617-863b-4ea7-9c7d-753662d747e2';
afterEach(() => { vi.restoreAllMocks(); });

function setup() {
  const api = new Api();
  const marked = vi.spyOn(api, 'markSeen').mockResolvedValue({ marked: 1 });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const notes = [
    { id, kind: 'raid_result', refId: battle, payload: {}, seen: false, at: new Date() },
    { id: 'other', kind: 'raid_result', refId: 'other-battle', payload: {}, seen: false, at: new Date() },
    { id: 'flight', kind: 'fleet_returned', refId: battle, payload: {}, seen: false, at: new Date() },
  ];
  client.setQueryData(keys.notifications, { notifications: notes });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <ApiProvider api={api}>{children}</ApiProvider></QueryClientProvider>;
  return { api, marked, client, notes, wrapper };
}

it('reads only reports actually presented by a visible successful surface', async () => {
  const f = setup();
  const view = renderHook(({ visible, refs }) => { useReadReportSignals(visible, refs); }, {
    wrapper: f.wrapper, initialProps: { visible: false, refs: [battle] },
  });
  expect(f.marked).not.toHaveBeenCalled();
  view.rerender({ visible: true, refs: [] });
  expect(f.marked).not.toHaveBeenCalled();
  view.rerender({ visible: true, refs: [battle] });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([id]); });
  expect(f.marked).toHaveBeenCalledTimes(1);
  expect(f.client.getQueryData(keys.notifications)).toMatchObject({ notifications: [
    { id, seen: true }, { id: 'other', seen: false }, { id: 'flight', seen: false },
  ] });
});

it('keeps reports unread in a background document and reads on becoming visible', async () => {
  const f = setup();
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  renderHook(() => { useReadReportSignals(true, [battle]); }, { wrapper: f.wrapper });
  expect(f.marked).not.toHaveBeenCalled();
  visibility.mockReturnValue('visible');
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([id]); });
});

it('matches a supporter report without clearing a different battle', async () => {
  const f = setup();
  f.client.setQueryData(keys.notifications, { notifications: [
    { ...f.notes[0], kind: 'clan_support_result', refId: 'mission-id', payload: { reportId: battle } }, f.notes[1],
  ] });
  renderHook(() => { useReadReportSignals(true, [battle]); }, { wrapper: f.wrapper });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledWith([id]); });
});

it('does not repeatedly acknowledge the same id before the write resolves', async () => {
  const f = setup();
  f.marked.mockImplementation(() => new Promise(() => undefined));
  const view = renderHook(() => { useReadReportSignals(true, [battle]); }, { wrapper: f.wrapper });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledTimes(1); });
  act(() => { f.client.setQueryData(keys.notifications, { notifications: f.notes }); });
  view.rerender();
  expect(f.marked).toHaveBeenCalledTimes(1);
});

it('retries a failed acknowledgement on reopening rather than looping while the list stays open', async () => {
  const f = setup();
  f.marked.mockRejectedValue(new Error('offline'));
  const view = renderHook(({ visible }) => { useReadReportSignals(visible, [battle]); }, {
    wrapper: f.wrapper, initialProps: { visible: true },
  });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledTimes(2); }, { timeout: 4000 });
  // Model the authoritative unread feed reconciled after the failed write.
  act(() => { f.client.setQueryData(keys.notifications, { notifications: f.notes }); });
  view.rerender({ visible: true });
  expect(f.marked).toHaveBeenCalledTimes(2);
  view.rerender({ visible: false });
  f.marked.mockResolvedValue({ marked: 1 });
  view.rerender({ visible: true });
  await waitFor(() => { expect(f.marked).toHaveBeenCalledTimes(3); });
});
