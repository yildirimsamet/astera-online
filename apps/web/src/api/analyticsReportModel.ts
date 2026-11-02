import type { AnalyticsEvent, AnalyticsProperties } from './analyticsSchemas.js';
import { retentionWindow, shouldStartSession, summarizeActivity, type ActivityInterval } from './analyticsModel.js';
export interface ReportObservation {
  at: number; name: string; mode: AnalyticsEvent['mode']; source: 'client_observation' | 'server_fact';
  timeTrusted: boolean; contextId: string; sessionId: string; sequence?: number | null; properties: AnalyticsProperties;
}
/** Observed windows only. A missed heartbeat is never filled with invented playing time. */
export function summarizePlayerObservations(input: readonly ReportObservation[], now: number) {
  const sorted = [...input].sort((a, b) => a.at - b.at || a.contextId.localeCompare(b.contextId)
    || (a.sequence ?? -1) - (b.sequence ?? -1));
  const live = sorted.filter(e => e.mode === 'live' && e.timeTrusted);
  const foreground: ActivityInterval[] = [], interaction: ActivityInterval[] = [];
  const sessions: { start: number; end: number; ending: 'observed_background' | 'inferred_timeout' | 'open' }[] = [];
  const readySince = new Map<string, number>(), gameplay = new Set<ReportObservation>();
  const openContexts = new Set<string>();
  let previous: number | null = null;
  for (const event of sorted) {
    if (event.source !== 'client_observation' || !event.timeTrusted) continue;
    if (event.name === 'load_phase' && (event.properties.phase !== 'ready' || event.mode !== 'live')) readySince.delete(event.contextId);
    if (event.mode !== 'live') continue;
    if (event.name === 'game_ready' && !readySince.has(event.contextId)) readySince.set(event.contextId, event.at);
    const preparedAt = readySince.get(event.contextId);
    if (preparedAt === undefined || !['game_ready', 'foreground_started', 'foreground_ended', 'interaction'].includes(event.name)) continue;
    gameplay.add(event);
    if (shouldStartSession(previous, event.at)) sessions.push({ start: event.at, end: event.at, ending: 'open' });
    if (previous === null || shouldStartSession(previous, event.at)) openContexts.clear();
    if (event.name === 'foreground_ended') openContexts.delete(event.contextId); else openContexts.add(event.contextId);
    const session = sessions.at(-1)!;
    session.end = event.at; previous = event.at;
    session.ending = event.name === 'foreground_ended' && !openContexts.size ? 'observed_background' : 'open';
    if (event.name === 'interaction') {
      const duration = Math.min(120_000, event.properties.foregroundMs ?? 0);
      const sampleStart = event.at - duration, observedStart = Math.max(sampleStart, preparedAt);
      if (event.at > observedStart) foreground.push({ start: observedStart, end: event.at });
      const active = Math.min(duration, event.properties.interactionMs ?? 0);
      if (event.properties.interactionSlices) {
        for (const slice of event.properties.interactionSlices) {
          const start = Math.max(observedStart, sampleStart + Math.min(duration, slice.startMs));
          const end = Math.min(event.at, sampleStart + Math.min(duration, slice.endMs));
          if (end > start) interaction.push({ start, end });
        }
      } else if (active > 0) interaction.push({ start: Math.max(observedStart, event.at - active), end: event.at });
    }
  }
  for (const session of sessions) if (session.ending === 'open' && now - session.end >= 30 * 60_000) session.ending = 'inferred_timeout';
  const firstReadyAt = live.find(e => e.name === 'game_ready' && e.source === 'client_observation')?.at ?? null;
  const returns: number[] = [], manualReturns: number[] = [];
  let evidenceAt: number | null = null, evidenceSession = -1, anchorSession: number | null = null;
  for (const event of live) {
    const qualified = event.name === 'game_ready' && event.source === 'client_observation'
      || event.name === 'command_accepted' && event.source === 'server_fact';
    const observed = gameplay.has(event);
    if (!qualified && !observed) continue;
    if (shouldStartSession(evidenceAt, event.at)) evidenceSession++;
    evidenceAt = event.at;
    if (event.at === firstReadyAt && event.name === 'game_ready' && anchorSession === null) anchorSession = evidenceSession;
    if (qualified && anchorSession !== null && evidenceSession > anchorSession) {
      returns.push(event.at);
      if (event.name === 'command_accepted') manualReturns.push(event.at);
    }
  }
  const unknownRetention = { mature: false, returned: null };
  const training = sorted.filter(e => e.timeTrusted && e.mode === 'training' && e.name === 'training_scene_visible').at(-1);
  const last = (names?: readonly string[]) => {
    const event = sorted.findLast(e => e.timeTrusted && e.mode !== 'replay' && (!names || names.includes(e.name)));
    return event ? { name: event.name, at: event.at, mode: event.mode, source: event.source, properties: event.properties } : null;
  };
  return { foregroundMs: summarizeActivity(foreground), interactionMs: summarizeActivity(interaction), sessions, firstReadyAt,
    lastObservation: last(), lastSurface: last(['surface_visible']), lastCommand: last(['command_accepted']),
    lastBlocker: last(['blocker_visible', 'command_blocked']), lastOutcome: last(['outcome_visible', 'outcome_resolved']),
    commands: live.filter(e => e.source === 'server_fact' && e.name === 'command_accepted').length,
    lastTraining: training ? { step: training.properties.step ?? null, scene: training.properties.scene ?? null, at: training.at } : null,
    untrusted: sorted.filter(e => !e.timeTrusted).length,
    return24h: firstReadyAt === null || now < firstReadyAt + 24 * 3600000 ? unknownRetention
      : { mature: true, returned: returns.some(at => at > firstReadyAt && at < firstReadyAt + 24 * 3600000) },
    manualRetention: { d1: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 1, now, manualReturns),
      d3: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 3, now, manualReturns),
      d7: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 7, now, manualReturns) },
    retention: { d1: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 1, now, returns),
      d3: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 3, now, returns),
      d7: firstReadyAt === null ? unknownRetention : retentionWindow(firstReadyAt, 7, now, returns) },
  };
}
