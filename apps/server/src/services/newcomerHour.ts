import { and, count, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import { buildOrders, planets, players, pushDevices } from '../db/schema.js';
import { schedule, type EventRow } from '../worker/queue.js';
import { sendPush, type PushMessage } from './notificationCenter.js';
import { notify } from './notifications.js';
import { loadLocked } from './planet.js';

/**
 * KURULUŞ SAATİ'NİN İKİ ANI (plan 2026-11-20 §4, Faz 2). Ten minutes before a first game's five-fold hour
 * ends the commander is told, in the game and on the phone, to start the next build while the works still
 * run; at the end the game sums what the hour made. Both are scheduled once at the landing.
 */
const WARN_MS = 10 * 60_000;

export async function scheduleNewcomerHour(tx: Tx, input: { seasonId: string; planetId: string; until: Date }): Promise<void> {
  const at = (stage: 'ending' | 'ended', resolveAt: Date) => schedule(tx, {
    seasonId: input.seasonId, kind: 'newcomer_hour', refId: input.planetId,
    dedupeKey: `newcomer_hour:${stage}:${input.planetId}`, payload: { stage }, resolveAt,
  });
  await at('ending', new Date(input.until.getTime() - WARN_MS));
  await at('ended', input.until);
}

const stageSchema = z.object({ stage: z.enum(['ending', 'ended']) });

type Locale = typeof pushDevices.$inferSelect.locale;
const ENDING: Record<Locale, [string, string]> = {
  tr: ['Kuruluş Saati bitiyor', 'Beş kat üretimin son 10 dakikası. Sıradaki inşayı şimdi başlat.'],
  en: ['Founding hour is ending', 'The last 10 minutes of five-fold output. Start your next build now.'],
  de: ['Die Gründungsstunde endet', 'Die letzten 10 Minuten fünffacher Produktion. Starte jetzt deinen nächsten Bau.'],
  fr: ['L’Heure de fondation s’achève', 'Les 10 dernières minutes de production quintuplée. Lance ta prochaine construction maintenant.'],
  es: ['La Hora fundacional termina', 'Los últimos 10 minutos de producción quíntuple. Empieza ya tu próxima construcción.'],
  ja: ['創設の一時間がまもなく終了', '5倍生産の残り10分です。次の建設を今すぐ始めましょう。'],
};
const endingMessage = (locale: Locale, planetId: string): PushMessage => ({
  kind: 'newcomer_hour_ending', title: ENDING[locale][0], body: ENDING[locale][1],
  data: { kind: 'newcomer_hour_ending', refId: planetId },
});

export async function resolveNewcomerHour(db: Db, clock: Clock, event: EventRow): Promise<void> {
  if (!event.refId) throw new Error('newcomer_hour without planet');
  const planetId = event.refId;
  const { stage } = stageSchema.parse(event.payload);
  const now = clock.now();
  const phones = await db.transaction(async tx => {
    const planet = await loadLocked(tx, planetId, clock);
    const until = planet.newcomerBoostUntil;
    const [owner] = await tx.select({ id: players.id, accountId: players.accountId }).from(players)
      .innerJoin(planets, eq(planets.controllerPlayerId, players.id)).where(eq(planets.id, planetId));
    if (!until || !owner) return [];
    if (stage === 'ending') {
      // A worker that reaches the warning after the hour has nothing true to say.
      if (now >= until) return [];
      const fresh = await notify(tx, { playerId: owner.id, kind: 'newcomer_hour_ending', payload: { until: until.toISOString() }, at: now, refId: planetId });
      return fresh ? tx.select().from(pushDevices).where(eq(pushDevices.accountId, owner.accountId)) : [];
    }
    const [row] = await tx.select({ telemetry: planets.seasonTelemetry }).from(planets).where(eq(planets.id, planetId));
    const [done] = await tx.select({ builds: count() }).from(buildOrders).where(and(eq(buildOrders.planetId, planetId),
      eq(buildOrders.queue, 'CONSTRUCTION'), eq(buildOrders.status, 'COMPLETED'),
      gte(buildOrders.readyAt, new Date(until.getTime() - 60 * 60_000)), lte(buildOrders.readyAt, until)));
    const produced = row?.telemetry.produced ?? { alloy: 0, crystal: 0 };
    await notify(tx, { playerId: owner.id, kind: 'newcomer_hour_summary', at: now, refId: planetId,
      payload: { alloy: Math.floor(produced.alloy), crystal: Math.floor(produced.crystal), builds: done?.builds ?? 0 } });
    return [];
  });
  // Now or never: a phone in its quiet hours is not woken, and the morning would be after the hour.
  if (phones.length > 0) await sendPush(db, phones, locale => endingMessage(locale, planetId), now, { nowOrNever: true });
}
