import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SchoolTelemetry } from '../src/onboarding/flightSchool/telemetry.js';
import { SCHOOL_SCENES } from '../src/onboarding/flightSchool/scenes.js';
import type { AnalyticsName, AnalyticsProperties } from '../src/api/analyticsSchemas.js';

beforeEach(() => { localStorage.clear(); });
function setup(replay = false, resumed = false) {
  let permitted = false;
  const emit = vi.fn<(name: AnalyticsName, properties: AnalyticsProperties, mode: 'training' | 'replay') => void>();
  const tracker = new SchoolTelemetry(1_800_000_000_000, replay, resumed, () => permitted, emit);
  return { tracker, emit, allow: () => { permitted = true; } };
}
it('keeps training usable when optional observation identifiers cannot be created', () => {
  const { tracker, allow, emit } = setup(); allow();
  vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('identifier unavailable'); });
  expect(() => { tracker.visible('welcome', 'text', true, true); }).not.toThrow();
  expect(emit).not.toHaveBeenCalled();
});
describe('academy observation boundaries', () => {
  it('waits for permission, scene readiness and foreground before creating an attempt', () => {
    const { tracker, emit, allow } = setup();
    tracker.visible('welcome', 'scene_preparation', true, false);
    expect(emit).not.toHaveBeenCalled(); expect(localStorage.length).toBe(0);
    allow(); tracker.visible('welcome', 'text', false, true); expect(emit).not.toHaveBeenCalled();
    tracker.visible('welcome', 'text', true, true);
    expect(emit.mock.calls.map(([name]) => name)).toEqual(['training_started', 'training_scene_visible']);
    tracker.revealed('welcome', 'text'); tracker.revealed('welcome', 'text');
    tracker.ready('welcome'); tracker.ready('welcome'); tracker.accepted('welcome', 'home');
    expect(emit.mock.calls.filter(([name]) => name === 'training_text_revealed')).toHaveLength(1);
    expect(emit.mock.calls.filter(([name]) => name === 'training_action_accepted')).toHaveLength(1);
  });
  it.each(SCHOOL_SCENES.map(scene => [scene.id] as const))('records visible scene %s without inventing an action', scene => {
    const { tracker, emit, allow } = setup(); allow();
    tracker.visible(scene, 'text', true, true);
    tracker.visible(scene, 'user_action', true, true);
    expect(emit.mock.calls.filter(([name]) => name === 'training_scene_visible')).toHaveLength(1);
    expect(emit.mock.calls.some(([name]) => name === 'training_action_accepted')).toBe(false);
  });
  it('starts an unlinked measurement attempt after reload without replaying historical actions', () => {
    const first = setup(); first.allow(); first.tracker.visible('core', 'order', true, true);
    const attempt = first.emit.mock.calls[0]?.[1].attemptId;
    const restored = setup(false, true); restored.allow(); restored.tracker.visible('coreResult', 'text', true, true);
    expect(restored.emit.mock.calls[0]?.[0]).toBe('training_resumed');
    expect(restored.emit.mock.calls[0]?.[1].attemptId).not.toBe(attempt);
    expect(restored.emit.mock.calls.some(([name]) => name === 'training_action_accepted')).toBe(false);
  });
  it('distinguishes early exit, completion and replay, and never writes replay identity to storage', () => {
    const early = setup(); early.allow(); early.tracker.visible('welcome', 'text', true, true); early.tracker.exit('welcome');
    expect(early.emit.mock.calls.at(-1)).toEqual(['training_exit_requested', expect.objectContaining({ code: 'skipped' }), 'training']);
    const finished = setup(); finished.allow(); finished.tracker.visible('departure', 'text', true, true); finished.tracker.exit('departure');
    expect(finished.emit.mock.calls.at(-1)?.[0]).toBe('training_completed');
    localStorage.clear(); const replay = setup(true); replay.allow(); replay.tracker.visible('welcome', 'text', true, true);
    expect(replay.emit.mock.calls[0]?.[2]).toBe('replay'); expect(localStorage.length).toBe(0);
  });
});

it('keeps the eleven player-facing steps as the reporting hierarchy', () => {
  const { tracker, emit, allow } = setup(); allow();
  for (const scene of SCHOOL_SCENES) tracker.visible(scene.id, 'text', true, true);
  const visible = emit.mock.calls.filter(([name]) => name === 'training_scene_visible');
  expect(new Set(visible.map(([, properties]) => properties.step))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]));
  for (const scene of SCHOOL_SCENES) {
    expect(visible.find(([, properties]) => properties.scene === scene.id)?.[1].step).toBe(scene.chapter);
  }
});

it('does not report a hidden text reveal and forgets the optional attempt on withdrawal', () => {
  const { tracker, emit, allow } = setup(); allow(); tracker.visible('welcome', 'text', true, true);
  tracker.visible('welcome', 'text', false, true); emit.mockClear(); tracker.revealed('welcome', 'text');
  expect(emit).not.toHaveBeenCalled(); tracker.revoke(); expect(localStorage.length).toBe(0);
  tracker.visible('welcome', 'text', true, true); tracker.revealed('welcome', 'text');
  expect(emit.mock.calls.filter(([name]) => name === 'training_text_revealed')).toHaveLength(1);
});

it('does not renew the first creation date of a restored optional training identity', () => {
  const first = setup(); first.allow(); first.tracker.visible('welcome', 'text', true, true);
  const before = localStorage.getItem('astera.school-observation.v1');
  vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000);
  const restored = setup(false, true); restored.allow(); restored.tracker.visible('core', 'text', true, true);
  expect(localStorage.getItem('astera.school-observation.v1')).toBe(before);
});
