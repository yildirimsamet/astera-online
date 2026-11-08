import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import { useOpenSignals } from '../src/shell/Signals.js';

let notifications: NotificationView[] = [];
const mutate = vi.fn();
vi.mock('../src/api/queries.js', () => ({ useNotifications: () => ({ data: { notifications } }), useMarkSeen: () => ({ mutate }), usePlanet: () => ({ data: undefined }) }));
const telemetry = vi.hoisted(() => ({ observe: vi.fn(), analyticsRecording: vi.fn(() => true), ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => telemetry);

const note = (id: string, kind: string, refId: string | null, seen = false): NotificationView =>
  ({ id, kind, refId, seen, at: new Date('2026-11-08T10:00:00.000Z'), payload: {} });

beforeEach(() => { notifications = []; mutate.mockClear(); telemetry.observe.mockClear(); });

/** Opening the feed is where news is read (plan 2026-11-08 F1: order → result → viewed by server ids). */
it('reports the results read on opening, by the id the server recorded them under', () => {
  notifications = [note('1', 'REPAIR_DONE', '0bb258b3-c801-4675-a7a4-a30793c1a8ab'), note('2', 'FLEET_HOME', '1bb258b3-c801-4675-a7a4-a30793c1a8ab', true),
    note('3', 'SEASON_OPEN', null), note('4', 'raid_result', 'not-a-server-id')];
  const { result } = renderHook(() => useOpenSignals());
  expect([...result.current()]).toEqual(['1', '3', '4']);
  expect(telemetry.observe.mock.calls).toEqual([
    ['outcome_visible', { refId: '0bb258b3-c801-4675-a7a4-a30793c1a8ab', surface: 'signals', code: 'REPAIR_DONE' }, 'live'],
  ]);
});
