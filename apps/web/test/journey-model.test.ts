import { describe, expect, it } from 'vitest';
import { journeyPlayer, summarizeJourney } from '../src/api/journeyModel.js';
import { journeyQuerySchema } from '../src/api/journeySchemas.js';
import type { JourneyInput } from '../src/api/journeyModel.js';

const now = Date.UTC(2026, 10, 11, 12);
const minute = 60_000;
const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  accountId: '00000000-0000-4000-8000-000000000001', username: 'pilot', joinedAt: now - 120 * minute,
  enlistedAt: now - 119 * minute, lastSeenAt: now - 60 * minute, galaxy: 'Starter 1', guideOffAt: null,
  modules: { REFINERY: 2 }, facts: [], departed: false, work: [], observations: [], truncated: false, ...over,
});
const event = (at: number, name: string, properties: JourneyInput['observations'][number]['properties'] = {},
  extra: Partial<JourneyInput['observations'][number]> = {}): JourneyInput['observations'][number] => ({
  at, name, properties, source: 'client_observation', mode: 'live', timeTrusted: true,
  contextId: 'tab', sessionId: 'session', ...extra,
});

// Plan 2026-11-13 §5.1 and Faz 2: the dashboard sees the moment the jump window opens.
describe('the jump window', () => {
  const loop = { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1, SURVEY: 1, SHIPYARD: 1 };
  it('is a stage once the six repairs, a mining run home and a probe report are in', () => {
    const open = journeyPlayer(input({ modules: loop, facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT'] }), now, 30);
    expect(open.milestones).toContain('window');
    expect(open.stage).toBe('window');
  });

  it('is not reached while a deed is missing', () => {
    const closed = journeyPlayer(input({ modules: loop, facts: ['FIRST_MINING_SENT', 'FIRST_MINING_RETURN'] }), now, 30);
    expect(closed.milestones).not.toContain('window');
    expect(summarizeJourney([closed]).stages.find(stage => stage.id === 'window')?.reached).toBe(0);
  });
});

describe('a journey uses gameplay evidence rather than the last guide prompt', () => {
  it('keeps a skipped guide apart from actual progress and reads commands without analytics attribution', () => {
    const player = journeyPlayer(input({ guideOffAt: now - 100 * minute,
      facts: ['FIRST_MINING_RETURN', 'FIRST_PROBE_REPORT', 'FIRST_OUTPOST_VICTORY'],
      observations: [event(now - 101 * minute, 'training_scene_visible', { scene: 'collect', trainingVersion: 'starter-tutorial.v2' }),
        event(now - 100 * minute, 'training_exit_requested', { scene: 'collect', code: 'skipped', trainingVersion: 'starter-tutorial.v2' })],
      work: [{ at: now - 40 * minute, endsAt: now - 35 * minute, kind: 'mission', code: 'PROBE', done: true }],
    }), now, 30);
    expect(player.stage).toBe('victory');
    expect(player.guideSkipped).toBe(true);
    expect(player.lastTutorial?.code).toBe('collect');
    expect(player.lastCommand).toEqual({ at: now - 40 * minute, code: 'PROBE' });
    expect(player.lastActiveAt).toBe(now - 40 * minute);
    expect(player.foregroundMs).toBeNull();
    expect(player.durationQuality).toBe('missing');
  });

  it('marks an observed duration as partial if gameplay continued after telemetry stopped', () => {
    const player = journeyPlayer(input({ observations: [event(now - 110 * minute, 'game_ready'),
      event(now - 109 * minute, 'interaction', { foregroundMs: minute, interactionMs: 30_000 })],
      work: [{ at: now - 40 * minute, endsAt: now - 39 * minute, kind: 'order', code: 'DART', queue: 'YARD', done: true }],
    }), now, 30);
    expect(player.foregroundMs).toBe(minute);
    expect(player.durationQuality).toBe('partial');
    expect(player.milestones).toContain('built');
    const cohort = summarizeJourney([player]);
    expect(cohort.averageMs).toBeNull();
    expect(cohort.durationBuckets.every(bucket => bucket.count === 0)).toBe(true);
  });

  it('does not count offline completions as a return, and identifies work pending at the last activity', () => {
    const player = journeyPlayer(input({ lastSeenAt: now - 60 * minute,
      work: [{ at: now - 61 * minute, endsAt: now - 58 * minute, kind: 'order', code: 'DART', queue: 'YARD', done: true }],
      observations: [event(now - 59 * minute, 'outcome_resolved', { code: 'YARD_DONE' }, { source: 'server_fact' })],
    }), now, 30);
    expect(player.activity).toBe('absent');
    expect(player.lastActiveAt).toBe(now - 60 * minute);
    expect(player.waitingAtLastActivity).toEqual({ count: 1, nextAt: now - 58 * minute });
  });

  it('does not count a scene load failure as zero minutes played or confuse a blocked command with success', () => {
    const player = journeyPlayer(input({ enlistedAt: null, lastSeenAt: null, modules: {},
      observations: [event(now - minute, 'load_phase', { phase: 'starting' }),
        event(now - minute, 'client_error', { code: 'react_render' }),
        event(now - minute, 'command_blocked', { code: 'INSUFFICIENT_RESOURCES' })],
    }), now, 30);
    expect(player.stage).toBe('registered');
    expect(player.foregroundMs).toBeNull();
    expect(player.errors).toHaveLength(1);
    expect(player.blockers).toHaveLength(1);
    expect(player.lastCommand).toBeNull();
  });

  it('unions overlapping tabs, ignores replay and unreliable timestamps and preserves sample coverage', () => {
    const player = journeyPlayer(input({ lastSeenAt: now - minute, observations: [
      event(now - 2 * minute, 'game_ready'),
      event(now - 2 * minute, 'game_ready', {}, { contextId: 'other' }),
      event(now - minute, 'interaction', { foregroundMs: minute, interactionMs: minute }),
      event(now - minute, 'interaction', { foregroundMs: minute, interactionMs: minute }, { contextId: 'other' }),
      event(now, 'interaction', { foregroundMs: minute }, { mode: 'replay' }),
      event(now, 'surface_visible', { surface: 'wrong' }, { timeTrusted: false }),
    ] }), now, 30);
    expect(player.foregroundMs).toBe(minute);
    expect(player.durationQuality).toBe('observed');
    expect(player.lastSurface).toBeNull();
    expect(player.activity).toBe('recent');
  });

  it('shows independent milestone reach and the last confirmed stage, without invented sequential dropoff', () => {
    const early = journeyPlayer(input(), now, 30);
    const later = journeyPlayer(input({ facts: ['FIRST_PROBE_REPORT', 'FIRST_OUTPOST_VICTORY'] }), now, 30);
    const cohort = summarizeJourney([early, later]);
    expect(cohort.stages.find(stage => stage.id === 'victory')).toMatchObject({ reached: 1, last: 1, absent: 1 });
    expect(cohort.stages.find(stage => stage.id === 'mining')?.reached).toBe(0);
    expect(cohort.durationMissing).toBe(2);
  });

  it('keeps bounded histories visibly partial and handles empty cohorts', () => {
    const player = journeyPlayer(input({ truncated: true }), now, 30);
    expect(player.durationQuality).toBe('missing');
    expect(summarizeJourney([])).toMatchObject({ averageMs: null, medianMs: null, measured: 0 });
    expect(journeyQuerySchema.safeParse({ from: 'wrong' }).success).toBe(false);
    expect(journeyQuerySchema.safeParse({ absentMinutes: -1 }).success).toBe(false);
    expect(journeyQuerySchema.safeParse({ from: new Date(now).toISOString(), to: new Date(now - minute).toISOString() }).success).toBe(false);
  });

  it('does not turn a ready scene without any playing-time sample into a measured zero', () => {
    const player = journeyPlayer(input({ observations: [event(now - minute, 'game_ready')] }), now, 30);
    expect(player.foregroundMs).toBeNull();
    expect(player.durationQuality).toBe('missing');
  });

  it('counts an older blocker even after many later observations of other blockers', () => {
    const player = journeyPlayer(input({ observations: Array.from({ length: 12 }, (_, index) =>
      event(now - (20 - index) * minute, 'blocker_visible', { code: `blocker_${index}` })) }), now, 30);
    expect(player.blockers.some(blocker => blocker.code === 'blocker_0')).toBe(true);
    expect(player.blockers).toHaveLength(12);
  });
});
