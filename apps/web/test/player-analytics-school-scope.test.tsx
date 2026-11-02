import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useSchoolTelemetry } from '../src/onboarding/flightSchool/useSchoolTelemetry.js';
import { createSchool } from '../src/onboarding/flightSchool/world.js';
const runtime = vi.hoisted(() => ({ observe: vi.fn<(name: string, properties: unknown, mode?: string) => void>(), analyticsRecording: () => true, ANALYTICS_READY_EVENT: 'astera:analytics-ready' }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => runtime);

it('forgets the in-memory training attempt when permission is withdrawn in another tab', () => {
  localStorage.clear();
  renderHook(() => useSchoolTelemetry(createSchool(1800000000000), false, false, true));
  const first = runtime.observe.mock.calls[0]?.[1];
  expect(first).toBeDefined();
  expect(localStorage.getItem('astera.school-observation.v1')).toBeNull();
  localStorage.setItem('astera.player-analytics.choice', JSON.stringify({ version: 1, decision: 'denied' }));
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'astera.player-analytics.choice' })); });
  expect(localStorage.getItem('astera.school-observation.v1')).toBeNull();
  localStorage.setItem('astera.player-analytics.choice', JSON.stringify({ version: 1, decision: 'granted' }));
  act(() => { window.dispatchEvent(new Event(runtime.ANALYTICS_READY_EVENT)); });
  expect(runtime.observe.mock.calls.at(-1)?.[1]).not.toEqual(first);
  expect(localStorage.getItem('astera.school-observation.v1')).toBeNull();
});
