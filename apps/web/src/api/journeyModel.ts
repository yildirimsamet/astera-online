import { summarizePlayerObservations, type ReportObservation } from './analyticsReportModel.js';
import { summarizeActivity } from './analyticsModel.js';
import { JOURNEY_STAGES, type JourneyPlayer } from './journeySchemas.js';

export interface JourneyWork {
  at: number; endsAt: number | null; kind: 'order' | 'mission'; code: string; queue?: string; done: boolean;
}
export interface JourneyInput {
  accountId: string; username: string; joinedAt: number; enlistedAt: number | null;
  lastSeenAt: number | null; galaxy: string | null; guideOffAt: number | null;
  modules: Readonly<Partial<Record<string, number>>>; facts: readonly string[]; departed: boolean;
  work: readonly JourneyWork[]; observations: readonly ReportObservation[]; truncated: boolean;
}
const maxAt = (values: readonly (number | null)[]): number | null => {
  const known = values.filter((at): at is number => at !== null);
  return known.length ? Math.max(...known) : null;
};
const activityNames = new Set(['game_ready', 'foreground_started', 'foreground_ended', 'command_attempted', 'surface_visible', 'training_exit_requested']);

/** Server state proves progress; client samples prove observed playing time. Neither proves a reason to leave. */
export function journeyPlayer(input: JourneyInput, now: number, absentMinutes: number): JourneyPlayer {
  const observations = input.observations.filter(e => e.timeTrusted && e.at <= now && e.mode === 'live').sort((a, b) => a.at - b.at || (a.sequence ?? 0) - (b.sequence ?? 0));
  const client = observations.filter(e => e.source === 'client_observation');
  const summary = summarizePlayerObservations(input.observations.filter(e => e.at <= now), now);
  const work = input.work.filter(w => w.at <= now).toSorted((a, b) => a.at - b.at);
  const evidence = (e: ReportObservation) => ({ at: e.at, code: e.properties.subject && e.name === 'command_accepted'
    ? `${e.properties.subject}:${e.properties.code ?? ''}` : e.properties.code ?? e.properties.surface ?? e.properties.scene ?? e.name });
  const commands = [...work.map(w => ({ at: w.at, code: w.code })), ...observations.filter(e => e.name === 'command_accepted' && e.source === 'server_fact').map(evidence)].sort((a, b) => a.at - b.at);
  const lastCommand = commands.at(-1) ?? null;
  const lastClientAt = client.at(-1)?.at ?? null;
  const lastActiveAt = maxAt([input.lastSeenAt, lastCommand?.at ?? null,
    ...client.filter(e => activityNames.has(e.name) || e.name === 'interaction' && (e.properties.interactionMs ?? 0) > 0).map(e => e.at)]);
  const lastSurface = client.filter(e => e.name === 'surface_visible').at(-1);
  const tutorial = client.filter(e => (e.name === 'training_scene_visible' || e.name === 'training_exit_requested') && e.properties.trainingVersion === 'starter-tutorial.v2').at(-1);
  const pendingThen = work.filter(w => lastActiveAt !== null && w.at <= lastActiveAt && w.endsAt !== null && w.endsAt > lastActiveAt);
  const observed = summary.firstReadyAt !== null && summary.foregroundMs > 0;
  const serverAt = maxAt([input.lastSeenAt, lastCommand?.at ?? null]);
  const partial = input.truncated || lastClientAt !== null && serverAt !== null && serverAt > lastClientAt + 120_000;
  const uniqueEvidence = (names: readonly string[]) => [...new Map(client.filter(e => names.includes(e.name)).map(e => {
    const item = evidence(e); return [item.code, item];
  })).values()];
  const milestones: JourneyPlayer['milestones'] = ['registered'];
  const add = (id: JourneyPlayer['stage'], reached: boolean) => { if (reached) milestones.push(id); };
  add('enlisted', input.enlistedAt !== null);
  add('refinery', (input.modules.REFINERY ?? 0) >= 2);
  add('mining', input.facts.some(f => f === 'FIRST_MINING_SENT' || f === 'FIRST_MINING_RETURN') || work.some(w => w.code === 'MINE'));
  add('probe', input.facts.includes('FIRST_PROBE_REPORT') || work.some(w => w.code === 'PROBE'));
  add('yard', (input.modules.SHIPYARD ?? 0) >= 1);
  add('built', work.some(w => w.kind === 'order' && w.queue === 'YARD' && w.done));
  add('battle', input.facts.includes('FIRST_BATTLE_REPORT') || work.some(w => w.code === 'RAID_SITE' || w.code === 'RAID_SHIP'));
  add('victory', input.facts.includes('FIRST_OUTPOST_VICTORY'));
  add('departed', input.departed);
  const history: JourneyPlayer['history'] = work.map(w => ({ at: w.at, code: w.code, kind: 'command' }));
  for (const e of client) {
    const kind = e.name === 'outcome_visible' ? 'result' : e.name === 'surface_visible' ? 'screen'
      : e.name === 'training_scene_visible' || e.name === 'training_exit_requested' ? 'guide'
        : e.name === 'command_blocked' || e.name === 'blocker_visible' ? 'blocker'
          : e.name === 'client_error' ? 'error' : e.name === 'foreground_ended' ? 'background' : null;
    if (kind) history.push({ ...evidence(e), kind });
  }
  const samples = client.filter(e => e.name === 'interaction' && (e.properties.foregroundMs ?? 0) > 0)
    .map(e => ({ start: e.at - Math.min(120_000, e.properties.foregroundMs ?? 0), end: e.at }));
  return {
    accountId: input.accountId, username: input.username, joinedAt: input.joinedAt, galaxy: input.galaxy,
    stage: milestones.at(-1) ?? 'registered', milestones, guideSkipped: input.guideOffAt !== null,
    lastTutorial: tutorial ? { at: tutorial.at, code: tutorial.properties.scene ?? 'unknown' } : null,
    lastActiveAt, lastClientAt, lastCommand, lastSurface: lastSurface ? evidence(lastSurface) : null,
    activity: lastActiveAt === null ? 'unknown' : now - lastActiveAt >= absentMinutes * 60_000 ? 'absent' : 'recent',
    foregroundMs: observed ? summary.foregroundMs : null, interactionMs: observed ? summary.interactionMs : null,
    sampledForegroundMs: summarizeActivity(samples), durationQuality: observed ? partial ? 'partial' : 'observed' : 'missing',
    sessionCount: observed ? summary.sessions.length : null,
    waitingAtLastActivity: pendingThen.length ? { count: pendingThen.length, nextAt: Math.min(...pendingThen.map(w => w.endsAt ?? Infinity)) } : null,
    blockers: uniqueEvidence(['blocker_visible', 'command_blocked']),
    errors: uniqueEvidence(['client_error']),
    history: history.sort((a, b) => a.at - b.at).slice(-20),
  };
}

export function summarizeJourney(players: readonly JourneyPlayer[]) {
  const durations = players.filter(p => p.durationQuality === 'observed' && p.foregroundMs !== null).map(p => p.foregroundMs ?? 0).sort((a, b) => a - b);
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const middle = Math.floor(durations.length / 2);
  const medianMs = durations.length ? durations.length % 2 ? durations[middle] ?? null : ((durations[middle - 1] ?? 0) + (durations[middle] ?? 0)) / 2 : null;
  const bands = [[0, 60_000], [60_000, 180_000], [180_000, 600_000], [600_000, 1_800_000], [1_800_000, Infinity]];
  return {
    measured: durations.length, averageMs: durations.length ? total / durations.length : null, medianMs,
    durationMissing: players.filter(p => p.durationQuality === 'missing').length,
    durationPartial: players.filter(p => p.durationQuality === 'partial').length,
    durationBuckets: bands.map(([min = 0, max = Infinity]) => ({ min, max, count: durations.filter(d => d >= min && d < max).length })),
    stages: JOURNEY_STAGES.map(id => ({ id, reached: players.filter(p => p.milestones.includes(id)).length,
      last: players.filter(p => p.stage === id).length, absent: players.filter(p => p.stage === id && p.activity === 'absent').length })),
  };
}
