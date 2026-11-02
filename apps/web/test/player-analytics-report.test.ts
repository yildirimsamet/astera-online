import { expect, it } from 'vitest';
import { summarizePlayerObservations, type ReportObservation } from '../src/api/analyticsReportModel.js';
const at = 1_800_000_000_000;
const e = (ms: number, name: string, properties = {}, extra: Partial<ReportObservation> = {}): ReportObservation =>
  ({ at: at + ms, name, properties, mode: 'live', source: 'client_observation', timeTrusted: true, contextId: 'tab', sessionId: 'session', ...extra });
it('unions overlapping tabs, uses interaction intervals rather than whole open time and infers missing closes', () => {
  const report = summarizePlayerObservations([
    e(0, 'game_ready'), e(10_000, 'game_ready', {}, { contextId: 'tab2' }), e(60_000, 'interaction', { foregroundMs: 60_000, interactionMs: 20_000 }),
    e(70_000, 'interaction', { foregroundMs: 60_000, interactionMs: 20_000 }, { contextId: 'tab2' }),
    e(3_600_000, 'foreground_started', { offsetMinutes: 180 }), e(3_660_000, 'foreground_ended'),
  ], at + 4_000_000);
  expect(report.foregroundMs).toBe(70_000); expect(report.interactionMs).toBe(30_000);
  expect(report.sessions).toHaveLength(2); expect(report.sessions[0]?.ending).toBe('inferred_timeout');
  expect(report.sessions[1]?.ending).toBe('observed_background');
  expect(report.retention.d1).toEqual({ mature: false, returned: null });
});
it('keeps training steps, replay and server facts out of live playing time', () => {
  const report = summarizePlayerObservations([
    e(0, 'training_scene_visible', { step: 4, scene: 'sight' }, { mode: 'training' }),
    e(1_000, 'interaction', { foregroundMs: 60_000 }, { mode: 'replay' }),
    e(2_000, 'command_accepted', { code: 'CORE' }, { source: 'server_fact' }),
    e(10_000, 'game_ready', {}, { timeTrusted: false }),
  ], at + 1_000_000);
  expect(report.foregroundMs).toBe(0); expect(report.sessions).toHaveLength(0);
  expect(report.lastTraining).toEqual({ step: 4, scene: 'sight', at });
  expect(report.commands).toBe(1); expect(report.firstReadyAt).toBeNull();
  expect(report.untrusted).toBe(1);
});
it('uses mature relative D1 windows and ignores old data before the cohort anchor', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(24 * 3_600_000, 'game_ready')], at + 48 * 3_600_000);
  expect(report.retention.d1).toEqual({ mature: true, returned: true });
  expect(report.retention.d3.returned).toBeNull();
});

it('does not count a background tab becoming visible as a qualified D1 return by itself', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(24 * 3_600_000, 'foreground_started')], at + 48 * 3_600_000);
  expect(report.retention.d1).toEqual({ mature: true, returned: false });
});
it('accepts a committed manual command as return evidence, without fabricating foreground duration', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(24 * 3_600_000, 'command_accepted', {}, { source: 'server_fact' })], at + 48 * 3_600_000);
  expect(report.retention.d1).toEqual({ mature: true, returned: true });
  expect(report.foregroundMs).toBe(0);
});

it('excludes homepage and sign-in time, and clips the first heartbeat at actual scene readiness', () => {
  const report = summarizePlayerObservations([
    e(0, 'load_phase', { phase: 'landing' }), e(0, 'foreground_started'),
    e(60_000, 'interaction', { foregroundMs: 60_000, interactionMs: 60_000 }),
    e(65_000, 'load_phase', { phase: 'ready' }), e(70_000, 'game_ready'),
    e(120_000, 'interaction', { foregroundMs: 60_000, interactionMs: 60_000, interactionSlices: [{ startMs: 0, endMs: 60_000 }] }),
    e(125_000, 'load_phase', { phase: 'servers' }),
    e(180_000, 'interaction', { foregroundMs: 60_000, interactionMs: 60_000 }),
    e(190_000, 'interaction', { foregroundMs: 60_000 }, { contextId: 'another_homepage_tab' }),
  ], at + 200_000);
  expect(report.foregroundMs).toBe(50_000); expect(report.interactionMs).toBe(50_000);
  expect(report.sessions).toEqual([{ start: at + 70_000, end: at + 120_000, ending: 'open' }]);
});
it('does not invent a playing session from a consented homepage visit without a prepared game', () => {
  const report = summarizePlayerObservations([e(0, 'foreground_started'), e(60_000, 'interaction', { foregroundMs: 60_000 })], at + 100_000);
  expect(report.sessions).toHaveLength(0); expect(report.foregroundMs).toBe(0);
});

it('keeps the last observed stage, confirmed command, shown blocker and result separate', () => {
  const report = summarizePlayerObservations([
    e(0, 'game_ready'), e(100, 'surface_visible', { surface: 'fleet' }),
    e(200, 'command_accepted', { code: 'CORE', refId: 'work' }, { source: 'server_fact' }),
    e(300, 'blocker_visible', { code: 'insufficient_resources', surface: 'development_item' }),
    e(400, 'outcome_resolved', { refId: 'work' }, { source: 'server_fact' }),
    e(500, 'outcome_visible', { refId: 'report' }),
    e(600, 'command_attempted', { code: 'build' }),
  ], at + 1000);
  expect(report).toMatchObject({
    lastObservation: { name: 'command_attempted', at: at + 600 },
    lastSurface: { name: 'surface_visible', properties: { surface: 'fleet' } },
    lastCommand: { name: 'command_accepted', at: at + 200 },
    lastBlocker: { name: 'blocker_visible', at: at + 300 },
    lastOutcome: { name: 'outcome_visible', at: at + 500 },
  });
});
it('does not turn arena activity into strategy foreground time or strategy return evidence', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(1000, 'load_phase', { phase: 'arena' }, { mode: 'arena' }),
    e(60000, 'interaction', { foregroundMs: 60000 }, { mode: 'arena' })], at + 100000);
  expect(report.foregroundMs).toBe(0); expect(report.sessions[0]?.end).toBe(at);
});

it('uses client sequence to order equal timestamps returned in arbitrary database order', () => {
  const report = summarizePlayerObservations([
    e(0, 'game_ready', {}, { sequence: 2 }),
    e(0, 'load_phase', { phase: 'landing' }, { sequence: 1 }),
    e(60000, 'interaction', { foregroundMs: 60000 }, { sequence: 3 }),
  ], at + 100000);
  expect(report.foregroundMs).toBe(60000);
});

it('separates a qualified return within 24 hours from D1 and from a manual return', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(3600000, 'game_ready'),
    e(25 * 3600000, 'command_accepted', {}, { source: 'server_fact' })], at + 48 * 3600000);
  expect(report.return24h).toEqual({ mature: true, returned: true });
  expect(report.manualRetention.d1).toEqual({ mature: true, returned: true });
  expect(report.manualRetention.d3).toEqual({ mature: false, returned: null });
});
it('does not label its first prepared scene a return because manual history existed before it', () => {
  const report = summarizePlayerObservations([e(-3600000, 'command_accepted', {}, { source: 'server_fact' }),
    e(0, 'game_ready'), e(60000, 'command_accepted', {}, { source: 'server_fact' })], at + 24 * 3600000);
  expect(report.return24h).toEqual({ mature: true, returned: false });
});

it('does not close the combined playing session when another prepared tab is still open', () => {
  const report = summarizePlayerObservations([e(0, 'game_ready'), e(1000, 'game_ready', {}, { contextId: 'tab2' }),
    e(2000, 'foreground_ended')], at + 3000);
  expect(report.sessions[0]?.ending).toBe('open');
});
it('does not infer the latest training stage from an untrusted client clock', () => {
  const report = summarizePlayerObservations([e(0, 'training_scene_visible', { step: 4 }, { mode: 'training', timeTrusted: false })], at + 1000);
  expect(report.lastTraining).toBeNull(); expect(report.untrusted).toBe(1);
});
