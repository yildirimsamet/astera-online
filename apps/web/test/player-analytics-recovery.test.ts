import { beforeEach, expect, it, vi } from 'vitest';
import { observeRecovery } from '../src/lib/playerAnalytics/recovery.js';
const telemetry = vi.hoisted(() => ({ observe: vi.fn<(name: string, properties: Record<string, unknown>, mode: string) => void>(), analyticsRecording: vi.fn(() => true), analyticsHeaders: vi.fn(() => ({ 'x-analytics-visitor': 'visit' })) }));
vi.mock('../src/lib/playerAnalytics/runtime.js', () => telemetry);
beforeEach(() => { vi.clearAllMocks(); telemetry.analyticsRecording.mockReturnValue(true); telemetry.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'visit' }); });
it('records request and completion stages without the recovery address, code or returned challenge', async () => {
  const result = { email: 'private@example.com', challengeId: 'private-challenge' };
  expect(await observeRecovery('request', () => Promise.resolve(result))).toBe(result);
  await observeRecovery('complete', () => Promise.resolve({ ok: true, code: '012345', password: 'private-password' }));
  expect(telemetry.observe.mock.calls.map(([, properties]) => properties.phase)).toEqual(['request_attempted', 'challenge_issued', 'complete_attempted', 'completed']);
  const payload = JSON.stringify(telemetry.observe.mock.calls);
  for (const secret of ['private@example.com', 'private-challenge', '012345', 'private-password']) expect(payload).not.toContain(secret);
});
it('logs only a bounded failure code while preserving the real request failure', async () => {
  const failure = Object.assign(new Error('private@example.com'), { code: 'BAD_CODE' });
  await expect(observeRecovery('complete', () => Promise.reject(failure))).rejects.toBe(failure);
  expect(telemetry.observe).toHaveBeenLastCalledWith('recovery_result', expect.objectContaining({ phase: 'complete_failed', code: 'BAD_CODE' }), 'live');
});
it('does not create an attempt before permission or append a result to a different scope', async () => {
  telemetry.analyticsRecording.mockReturnValue(false);
  await observeRecovery('request', () => Promise.resolve()); expect(telemetry.observe).not.toHaveBeenCalled();
  telemetry.analyticsRecording.mockReturnValue(true);
  await observeRecovery('request', () => { telemetry.analyticsHeaders.mockReturnValue({ 'x-analytics-visitor': 'next' }); return Promise.resolve(); });
  expect(telemetry.observe).toHaveBeenCalledTimes(1);
});
it('does not prevent account recovery when observation identifiers are unavailable', async () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementationOnce(() => { throw new Error('identifier unavailable'); });
  const operation = vi.fn(() => Promise.resolve('submitted'));
  await expect(observeRecovery('request', operation)).resolves.toBe('submitted');
  expect(operation).toHaveBeenCalledOnce();
});
