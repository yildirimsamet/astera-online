import { beforeEach, expect, it, vi } from 'vitest';
import { beginTrainingEntry, finishTrainingEntry, failTrainingEntry } from '../src/lib/playerAnalytics/trainingEntry.js';
const telemetry = vi.hoisted(() => ({ observe: vi.fn<(name: string, properties: Record<string, unknown>, mode: string) => void>(), analyticsRecording: vi.fn(() => true), analyticsHeaders: vi.fn(() => ({ 'x-analytics-visitor': 'visit' })) }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => telemetry);
beforeEach(() => { finishTrainingEntry(); vi.clearAllMocks(); telemetry.analyticsRecording.mockReturnValue(true); telemetry.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'visit' }); });
it('links an actual lazy render failure to the Play attempt and records it only once', () => {
  const id = beginTrainingEntry('public_landing'); failTrainingEntry(); failTrainingEntry();
  expect(telemetry.observe.mock.calls.map(([name]) => name)).toEqual(['play_clicked', 'training_load_failed']);
  expect(telemetry.observe).toHaveBeenLastCalledWith('training_load_failed', { surface: 'public_landing', attemptId: id, code: 'unavailable' }, 'live');
});
it('closes the entry only once training is prepared and cannot relabel a later game failure', () => {
  const id = beginTrainingEntry('native_landing'); expect(finishTrainingEntry()).toBe(id); failTrainingEntry();
  expect(telemetry.observe).toHaveBeenCalledTimes(1);
});
it('does not carry a click across withdrawal or a different observation scope', () => {
  beginTrainingEntry('public_landing'); telemetry.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'new' });
  expect(finishTrainingEntry()).toBeUndefined();
  telemetry.analyticsRecording.mockReturnValue(false); expect(beginTrainingEntry('public_landing')).toBeNull();
  failTrainingEntry(); expect(telemetry.observe).toHaveBeenCalledTimes(1);
});
it('leaves Play available when an optional attempt identifier cannot be created', () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('identifier unavailable'); });
  expect(beginTrainingEntry('public_landing')).toBeNull();
  expect(telemetry.observe).not.toHaveBeenCalled();
});
