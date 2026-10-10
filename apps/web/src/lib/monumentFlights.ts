import { distance, interpolatePosition, travelExact } from '@astera/rules';
import type { Monuments, PendingThread } from '../api/schemas.js';
import { monumentName } from '../i18n/names.js';

/** A view of native owner-only flights. HOLD never invents a timed mission or planet. */
export function monumentPendingThreads(view: Monuments | undefined, nowMs = view?.serverNow.getTime()): PendingThread[] {
  if (!view) return [];
  const threads: PendingThread[] = [];
  for (const wave of view.waves) {
    if (wave.status === 'HOLD' || wave.arriveAt === null || (wave.fadeAt && nowMs !== undefined && wave.fadeAt.getTime() <= nowMs)) continue;
    const leg = wave.route[0];
    const target = view.monuments.find((row) => row.id === wave.monumentId);
    if (!leg || !target) continue;
    const recallable = wave.status === 'OUTBOUND' && wave.lots.length > 0
      && nowMs !== undefined && wave.arriveAt.getTime() > nowMs;
    const forecast = wave.returnForecast;
    const recallMinutes = forecast.homePosition && forecast.speed !== undefined && forecast.speed > 0 && nowMs !== undefined
      ? travelExact(distance(interpolatePosition(leg.from, leg.to, leg.startMs, leg.endMs, nowMs), forecast.homePosition), forecast.speed)
      : forecast.minutes;
    threads.push({ id: wave.id, kind: 'monument', monumentId: wave.monumentId, monumentOrdinal: target.ordinal,
      originPlanetId: wave.originPlanetId, targetName: monumentName(target.ordinal),
      arriveAt: wave.arriveAt, minutesRemaining: Math.max(0, (wave.arriveAt.getTime() - view.serverNow.getTime()) / 60_000),
      leg: wave.status === 'RETURNING' ? 'return' : 'outbound', fleet: wave.fleet,
      ...(recallable ? { recallable: true, monumentRecall: { minutes: recallMinutes } } : {}),
      ...(wave.fadeAt ? { fadeAt: wave.fadeAt } : {}),
      path: { from: leg.from, to: leg.to, departAt: new Date(leg.startMs), arriveAt: new Date(leg.endMs) } });
  }
  for (const probe of view.probes) {
    const leg = probe.route[0];
    const target = view.monuments.find((row) => row.id === probe.monumentId);
    const arriveAt = probe.status === 'RETURNING' ? probe.homeAt : probe.arriveAt;
    if (!leg || !target || !arriveAt) continue;
    threads.push({ id: probe.id, kind: 'probe', monumentId: probe.monumentId, monumentOrdinal: target.ordinal,
      originPlanetId: probe.originPlanetId, targetName: monumentName(target.ordinal), arriveAt,
      minutesRemaining: Math.max(0, (arriveAt.getTime() - view.serverNow.getTime()) / 60_000),
      leg: probe.status === 'RETURNING' ? 'return' : 'outbound',
      path: { from: leg.from, to: leg.to, departAt: new Date(leg.startMs), arriveAt: new Date(leg.endMs) } });
  }
  return threads;
}
