import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import { useLiveAlerts } from '../src/session/useLiveAlerts.js';

let notifications: NotificationView[] = [];
const say = vi.fn();
vi.mock('../src/api/queries.js', () => ({ useNotifications: () => ({ data: { notifications } }) }));
vi.mock('../src/ui/Toast.js', () => ({ useToast: () => say }));
const event = (id: string, valid = true): NotificationView => ({ id, kind: 'raid_result', seen: false,
  at: new Date('2026-10-15T13:02:37.112Z'), payload: valid ? {
    targetKind: 'MONUMENT', monumentId: '68af7958-61b8-4f14-a5c1-34f692be7987', monumentOrdinal: 4,
    attacking: true, grade: 'REPELLED', control: 'DEFENDER', survivors: 3, unitsLost: 0, lootDeuterium: 0, dominion: 7040,
  } : { targetKind: 'MONUMENT', monumentId: '68af7958-61b8-4f14-a5c1-34f692be7987' } });

beforeEach(() => { notifications = []; say.mockClear(); });

it('keeps the first snapshot silent, then announces a fresh result only once', () => {
  notifications = [event('old')];
  const view = renderHook(() => { useLiveAlerts(true); });
  expect(say).not.toHaveBeenCalled();
  notifications = [event('new'), ...notifications];
  view.rerender();
  expect(say).toHaveBeenCalledTimes(1);
  notifications = [...notifications];
  view.rerender();
  expect(say).toHaveBeenCalledTimes(1);
});

it('does not let unreadable results consume the three alert slots', () => {
  const view = renderHook(() => { useLiveAlerts(true); });
  notifications = [event('broken1', false), event('broken2', false), event('broken3', false), event('battle')];
  view.rerender();
  expect(say).toHaveBeenCalledTimes(1);
  expect(say.mock.calls[0]?.[0]).toMatch(/not captured/i);
});

it('still caps valid batches and never marks overflow read', () => {
  const view = renderHook(() => { useLiveAlerts(true); });
  notifications = [event('a'), event('b'), event('c'), event('d')];
  view.rerender();
  expect(say).toHaveBeenCalledTimes(3);
  expect(notifications.every(n => !n.seen)).toBe(true);
  notifications = [...notifications];
  view.rerender();
  expect(say).toHaveBeenCalledTimes(3);
});
