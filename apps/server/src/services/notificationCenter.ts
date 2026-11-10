import { deferQuietPushes } from './pushDelivery.js';
import {
  ALERT_TIMINGS, NOTIFICATION_CENTER, PAID_ALERTS, PROBE_ALERT_COOLDOWN_MINUTES, alertPrice, alertSendAt, deuteriumRate,
  productionMult, type AlertTiming, type PaidAlertKind,
} from '@astera/rules';
import { and, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import type { Clock } from '../clock.js';
import type { Db, Tx } from '../db/client.js';
import {
  buildings, missions, notificationCenters, paidAlerts, planets, players, pushDevices, radiationBombFlights, satellites,
} from '../db/schema.js';
import { schedule } from '../worker/queue.js';
import { GameError, assertWorldOperational, orbitFromRows, refreshWealth, saveResources, withPlanetLock } from './planet.js';

/**
 * BİLDİRİM MERKEZİ. docs/bildirim-merkezi-plani-2026-10-30.md.
 *
 * The commander's (not a world's) centre: built once, a one-way deuterium wallet, and
 * the paid pushes that leave a closed phone. The in-game warning is untouched and free;
 * everything here is the outside-the-game copy of it. `paid_alerts` is the ledger and
 * the outbox in one: one row per (player, kind, subject), so nothing arms or charges twice.
 */

type Locale = (typeof pushDevices.$inferSelect)['locale'];
const PAID_KINDS = Object.keys(PAID_ALERTS) as PaidAlertKind[];
const isPaidKind = (value: unknown): value is PaidAlertKind => PAID_KINDS.some(kind => kind === value);
const isTiming = (value: unknown): value is AlertTiming => ALERT_TIMINGS.some(timing => timing === value);

/** What every one of the commander's worlds makes in an hour, boosted like the works themselves. */
export async function commanderDeuteriumPerHour(tx: Tx | Db, playerId: string): Promise<number> {
  const worlds = await tx.select({ id: planets.id }).from(planets).where(eq(planets.controllerPlayerId, playerId));
  if (worlds.length === 0) return 0;
  const ids = worlds.map(world => world.id);
  const [levels, orbit] = await Promise.all([
    tx.select({ planetId: buildings.planetId, type: buildings.type, level: buildings.level }).from(buildings)
      .where(and(inArray(buildings.planetId, ids), inArray(buildings.type, ['DEUTERIUM_PLANT', 'CORE']))),
    tx.select({ planetId: satellites.planetId, slot: satellites.slot, type: satellites.type }).from(satellites)
      .where(inArray(satellites.planetId, ids)),
  ]);
  let total = 0;
  for (const id of ids) {
    const level = (type: string) => levels.find(row => row.planetId === id && row.type === type)?.level ?? 0;
    total += deuteriumRate(level('DEUTERIUM_PLANT'))
      * productionMult(orbitFromRows(orbit.filter(row => row.planetId === id), level('CORE')));
  }
  return total;
}

function pricesAt(rate: number) {
  const timed = (kind: 'incoming_attack' | 'incoming_strategic') =>
    Object.fromEntries(ALERT_TIMINGS.map(timing => [timing, alertPrice(kind, timing, rate)])) as Record<AlertTiming, number>;
  return {
    incoming_attack: timed('incoming_attack'),
    incoming_strategic: timed('incoming_strategic'),
    probe_detected: alertPrice('probe_detected', 'NOW', rate),
  };
}

/** Everything the centre's screen shows: state, today's prices and the recent ledger. */
export async function notificationCenterView(db: Db, playerId: string, clock: Clock) {
  const now = clock.now();
  const [center] = await db.select().from(notificationCenters).where(eq(notificationCenters.playerId, playerId));
  const rate = await commanderDeuteriumPerHour(db, playerId);
  const recent = await db.select({
    kind: paidAlerts.kind, status: paidAlerts.status, price: paidAlerts.price, sendAt: paidAlerts.sendAt, payload: paidAlerts.payload,
  }).from(paidAlerts).where(eq(paidAlerts.playerId, playerId)).orderBy(desc(paidAlerts.createdAt)).limit(20);
  const [unfunded] = await db.select({ count: sql<number>`count(*)::int` }).from(paidAlerts).where(and(
    eq(paidAlerts.playerId, playerId), eq(paidAlerts.status, 'UNFUNDED'),
    gte(paidAlerts.sendAt, new Date(now.getTime() - 24 * 3_600_000)),
  ));
  return {
    built: center !== undefined,
    wallet: center?.wallet ?? 0,
    timing: center?.timing ?? 'T5',
    muted: center?.muted ?? [],
    buildCost: NOTIFICATION_CENTER.buildCost,
    deuteriumPerHour: rate,
    prices: pricesAt(rate),
    /** Alerts the wallet could not pay for in the last day. */
    unfunded: unfunded?.count ?? 0,
    recent: recent.map(row => ({ ...row, sendAt: row.sendAt.toISOString() })),
  };
}
export type NotificationCenterView = Awaited<ReturnType<typeof notificationCenterView>>;

/** Built once, paid from the world the commander is looking at. */
export async function buildNotificationCenter(db: Db, playerId: string, planetId: string, clock: Clock): Promise<void> {
  await withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const [existing] = await tx.select({ playerId: notificationCenters.playerId }).from(notificationCenters)
      .where(eq(notificationCenters.playerId, playerId)).for('update');
    if (existing) throw new GameError('ALREADY_BUILT', 'The Notification Center is already built', 409);
    const cost = NOTIFICATION_CENTER.buildCost;
    if (planet.alloy < cost.alloy || planet.crystal < cost.crystal || planet.deuterium < cost.deuterium) {
      throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    }
    planet.alloy -= cost.alloy; planet.crystal -= cost.crystal; planet.deuterium -= cost.deuterium;
    await saveResources(tx, planet.planetId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
    await tx.insert(notificationCenters).values({ playerId, builtAt: planet.now });
    await refreshWealth(tx, planet);
  }, playerId);
}

/** One way and confirmed (owner: no withdrawal, so a wallet cannot launder a store). */
export async function fundNotificationCenter(
  db: Db, playerId: string, planetId: string, amount: number, confirmed: boolean, clock: Clock,
): Promise<void> {
  if (!Number.isInteger(amount) || amount < 1) throw new GameError('BAD_AMOUNT', 'Amount must be a positive whole number');
  if (!confirmed) throw new GameError('CONFIRM_REQUIRED', 'Confirm the transfer: it cannot be taken back');
  await withPlanetLock(db, planetId, clock, async (tx, planet) => {
    assertWorldOperational(planet);
    const [center] = await tx.select({ playerId: notificationCenters.playerId }).from(notificationCenters)
      .where(eq(notificationCenters.playerId, playerId)).for('update');
    if (!center) throw new GameError('NOT_BUILT', 'Build the Notification Center first', 409);
    if (planet.deuterium < amount) throw new GameError('INSUFFICIENT_RESOURCES', 'Not enough resources');
    planet.deuterium -= amount;
    await saveResources(tx, planet.planetId, { alloy: planet.alloy, crystal: planet.crystal, deuterium: planet.deuterium });
    await tx.update(notificationCenters).set({ wallet: sql`${notificationCenters.wallet} + ${amount}` })
      .where(eq(notificationCenters.playerId, playerId));
    await refreshWealth(tx, planet);
  }, playerId);
}

export async function setNotificationCenter(
  db: Db, playerId: string, settings: { timing?: AlertTiming; muted?: PaidAlertKind[] },
): Promise<void> {
  if (settings.timing !== undefined && !isTiming(settings.timing)) throw new GameError('BAD_SETTINGS', 'Unknown timing');
  if (settings.muted !== undefined && !settings.muted.every(isPaidKind)) throw new GameError('BAD_SETTINGS', 'Unknown alert');
  const rows = await db.update(notificationCenters).set({
    ...(settings.timing !== undefined ? { timing: settings.timing } : {}),
    ...(settings.muted !== undefined ? { muted: [...new Set(settings.muted)] } : {}),
  }).where(eq(notificationCenters.playerId, playerId)).returning({ playerId: notificationCenters.playerId });
  if (rows.length === 0) throw new GameError('NOT_BUILT', 'Build the Notification Center first', 409);
}

/** An app install; a token seen again moves to whoever signed in on it. */
export async function registerPushDevice(
  db: Db, accountId: string, token: string, platform: 'android', locale: Locale, clock: Clock, utcOffsetMinutes = 0,
): Promise<void> {
  const now = clock.now();
  await db.insert(pushDevices).values({ token, accountId, platform, locale, utcOffsetMinutes, createdAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: pushDevices.token, set: { accountId, platform, locale, utcOffsetMinutes, lastSeenAt: now } });
}

export async function forgetPushDevice(db: Db, accountId: string, token: string): Promise<void> {
  await db.delete(pushDevices).where(and(eq(pushDevices.token, token), eq(pushDevices.accountId, accountId)));
}

/**
 * ARM ONE ALERT, INSIDE THE TRANSACTION THAT LEARNED OF IT. A timed kind is sent at the
 * commander's chosen lead once the radar has the fleet (`radarSeenAt` is that instant);
 * an instant kind now. No centre, a muted kind, or a moment already past: nothing.
 */
export async function armPaidAlert(tx: Tx, input: {
  seasonId: string; playerId: string; kind: PaidAlertKind; refId: string; now: Date;
  /** Timed kinds: when the fleet lands. */
  arriveAt?: Date;
  payload: Record<string, unknown>;
}): Promise<void> {
  const probe = input.kind === 'probe_detected';
  // A probe alert locks the centre so two probes landing together cannot both pass the spacing.
  const read = tx.select().from(notificationCenters).where(eq(notificationCenters.playerId, input.playerId));
  const [center] = probe ? await read.for('update') : await read;
  if (!center || center.muted.includes(input.kind)) return;
  if (probe && await probeAlertedSince(tx, input.playerId, new Date(input.now.getTime() - PROBE_ALERT_COOLDOWN_MINUTES * 60_000))) return;
  const timed = 'timed' in PAID_ALERTS[input.kind];
  if (timed && !input.arriveAt) throw new Error(`${input.kind} needs an arrival`);
  const sendAtMs = timed && input.arriveAt
    ? alertSendAt(center.timing, input.arriveAt.getTime(), input.now.getTime())
    : input.now.getTime();
  if (sendAtMs === null) return;
  const sendAt = new Date(sendAtMs);
  const [row] = await tx.insert(paidAlerts).values({
    playerId: input.playerId, kind: input.kind, refId: input.refId, timing: timed ? center.timing : null, sendAt,
    payload: { ...input.payload, ...(input.arriveAt ? { arriveAt: input.arriveAt.toISOString() } : {}) },
    createdAt: input.now,
  }).onConflictDoNothing({ target: [paidAlerts.playerId, paidAlerts.kind, paidAlerts.refId] }).returning({ id: paidAlerts.id });
  if (!row) return;
  await schedule(tx, { seasonId: input.seasonId, kind: 'paid_alert', refId: row.id, resolveAt: sendAt });
}

/** A probe push still on its way or delivered after `since`; one that reached nobody keeps no window shut. */
async function probeAlertedSince(tx: Tx, playerId: string, since: Date): Promise<boolean> {
  const [row] = await tx.select({ id: paidAlerts.id }).from(paidAlerts).where(and(
    eq(paidAlerts.playerId, playerId), eq(paidAlerts.kind, 'probe_detected'),
    inArray(paidAlerts.status, ['PENDING', 'SENT']), gt(paidAlerts.createdAt, since),
  )).limit(1);
  return row !== undefined;
}

/** The arrival of a raid or a radiation bomb still on its way to the commander; null once it is not. */
async function inboundArrival(tx: Tx, refId: string): Promise<Date | null> {
  const [mission] = await tx.select({ status: missions.status, recalledAt: missions.recalledAt, arriveAt: missions.arriveAt })
    .from(missions).where(eq(missions.id, refId));
  if (mission) return mission.status === 'in_flight' && mission.recalledAt === null ? mission.arriveAt : null;
  const [bomb] = await tx.select({ status: radiationBombFlights.status, arriveAt: radiationBombFlights.arriveAt })
    .from(radiationBombFlights).where(eq(radiationBombFlights.id, refId));
  return bomb?.status === 'OUTBOUND' ? bomb.arriveAt : null;
}

/* ── sending ───────────────────────────────────────────────────────── */

export interface PushMessage { kind: PaidAlertKind | 'raid_over' | 'raided' | 'system_open' | 'shield_falling' | 'repair_done' | 'miner_home' | 'repair_funded' | 'while_away'; title: string; body: string; data: Record<string, string> }
export interface PushTransport {
  /** `accepted` counts the phones the provider took the message for. */
  send(tokens: string[], message: PushMessage): Promise<{ invalid: string[]; accepted: number }>;
}
/** Set at boot (FCM) or by a test; none means no push leaves and no paid alert is charged. */
let transport: PushTransport | null = null;
export function setPushTransport(next: PushTransport | null): void { transport = next; }

const COPY: Record<Locale, Record<PaidAlertKind, { title: string; body: string }>> = {
  tr: {
    incoming_attack: { title: 'Saldırı geliyor', body: '{world} dünyana bir filo yaklaşıyor. Varış: {minutes} dk.' },
    incoming_strategic: { title: 'Stratejik silah geliyor', body: '{world} dünyana stratejik bir silah yaklaşıyor. Varış: {minutes} dk.' },
    probe_detected: { title: 'Sonda tespit edildi', body: '{world} dünyanı bir sonda taradı.' },
  },
  en: {
    incoming_attack: { title: 'Attack incoming', body: 'A fleet is closing on {world}. Arrives in {minutes} min.' },
    incoming_strategic: { title: 'Strategic weapon incoming', body: 'A strategic weapon is closing on {world}. Arrives in {minutes} min.' },
    probe_detected: { title: 'Probe detected', body: 'A probe scanned {world}.' },
  },
  de: {
    incoming_attack: { title: 'Angriff im Anflug', body: 'Eine Flotte nähert sich {world}. Ankunft in {minutes} Min.' },
    incoming_strategic: { title: 'Strategische Waffe im Anflug', body: 'Eine strategische Waffe nähert sich {world}. Ankunft in {minutes} Min.' },
    probe_detected: { title: 'Sonde entdeckt', body: 'Eine Sonde hat {world} gescannt.' },
  },
  fr: {
    incoming_attack: { title: 'Attaque en approche', body: 'Une flotte approche de {world}. Arrivée dans {minutes} min.' },
    incoming_strategic: { title: 'Arme stratégique en approche', body: 'Une arme stratégique approche de {world}. Arrivée dans {minutes} min.' },
    probe_detected: { title: 'Sonde détectée', body: 'Une sonde a scanné {world}.' },
  },
  es: {
    incoming_attack: { title: 'Ataque en camino', body: 'Una flota se acerca a {world}. Llega en {minutes} min.' },
    incoming_strategic: { title: 'Arma estratégica en camino', body: 'Un arma estratégica se acerca a {world}. Llega en {minutes} min.' },
    probe_detected: { title: 'Sonda detectada', body: 'Una sonda escaneó {world}.' },
  },
  ja: {
    incoming_attack: { title: '攻撃接近中', body: '{world}に艦隊が接近中。到着まで{minutes}分。' },
    incoming_strategic: { title: '戦略兵器接近中', body: '{world}に戦略兵器が接近中。到着まで{minutes}分。' },
    probe_detected: { title: '探査機を検知', body: '{world}が探査機にスキャンされました。' },
  },
};

function messageFor(kind: PaidAlertKind, locale: Locale, payload: Record<string, unknown>, now: Date, refId: string, alertId: string): PushMessage {
  const world = typeof payload.targetPlanetName === 'string' ? payload.targetPlanetName : '';
  const arriveAt = typeof payload.arriveAt === 'string' ? Date.parse(payload.arriveAt) : Number.NaN;
  const minutes = Number.isFinite(arriveAt) ? Math.max(1, Math.ceil((arriveAt - now.getTime()) / 60_000)) : 0;
  const copy = COPY[locale][kind];
  return {
    kind, title: copy.title,
    body: copy.body.replace('{world}', world).replace('{minutes}', String(minutes)),
    data: { kind, refId, alertId, ...(typeof payload.targetPlanetId === 'string' ? { planetId: payload.targetPlanetId } : {}) },
  };
}

/**
 * THE MOMENT AN ALERT IS DUE. Re-reads the subject (a recalled or landed raid is no raid),
 * then holds the price from the wallet in the same transaction as the status, and only then
 * sends. A wallet short of the price sends nothing and says so on the centre (decision 6).
 * Only a delivered alert is paid for (owner 2026-11-10): when no phone takes it — push off
 * on this server, every phone forgotten by the provider, or an outage — the price goes back.
 */
export async function settlePaidAlert(db: Db, clock: Clock, alertId: string): Promise<void> {
  const delivery = await db.transaction(async (tx) => {
    const now = clock.now();
    const [alert] = await tx.select().from(paidAlerts).where(eq(paidAlerts.id, alertId)).for('update');
    if (alert?.status !== 'PENDING') return null;
    const settle = (status: (typeof paidAlerts.$inferSelect)['status'], price: number | null = null) =>
      tx.update(paidAlerts).set({ status, price, settledAt: now }).where(eq(paidAlerts.id, alert.id));

    if ('timed' in PAID_ALERTS[alert.kind]) {
      const arriveAt = await inboundArrival(tx, alert.refId);
      const armedFor = typeof alert.payload.arriveAt === 'string' ? Date.parse(alert.payload.arriveAt) : Number.NaN;
      if (arriveAt?.getTime() !== armedFor || arriveAt <= now) {
        await settle('CANCELLED');
        return null;
      }
    }
    const devices = await tx.select({ token: pushDevices.token, locale: pushDevices.locale }).from(pushDevices)
      .innerJoin(players, eq(players.accountId, pushDevices.accountId))
      .where(eq(players.id, alert.playerId));
    if (devices.length === 0 || !transport) { await settle('NO_DEVICE'); return null; }

    const price = alertPrice(alert.kind, alert.timing ?? 'NOW', await commanderDeuteriumPerHour(tx, alert.playerId));
    const paid = await tx.update(notificationCenters).set({ wallet: sql`${notificationCenters.wallet} - ${price}` })
      .where(and(eq(notificationCenters.playerId, alert.playerId), gte(notificationCenters.wallet, price)))
      .returning({ wallet: notificationCenters.wallet });
    if (paid.length === 0) { await settle('UNFUNDED'); return null; }
    await settle('SENT', price);
    return { alert, devices, now, price };
  });
  if (!delivery) return;
  // After COMMIT, so a slow or failing provider never holds the ledger open; at most once.
  const { alert, now, price } = delivery;
  const accepted = await sendPush(db, delivery.devices, locale => messageFor(alert.kind, locale, alert.payload, now, alert.refId, alert.id), now, { paid: true })
    .catch(() => 0);
  if (accepted > 0) return;
  await db.transaction(async (tx) => {
    const [given] = await tx.update(paidAlerts).set({ status: 'NO_DEVICE', price: null })
      .where(and(eq(paidAlerts.id, alert.id), eq(paidAlerts.status, 'SENT'))).returning({ id: paidAlerts.id });
    if (!given) return;
    await tx.update(notificationCenters).set({ wallet: sql`${notificationCenters.wallet} + ${price}` })
      .where(eq(notificationCenters.playerId, alert.playerId));
  });
}

/**
 * One message per language on these phones, and a token the provider has given up on is
 * forgotten. Answers how many phones the provider took it for.
 */
export async function sendPush(db: Db, devices: readonly { token: string; locale: Locale }[], write: (locale: Locale) => PushMessage, now = new Date(), options: { paid?: boolean } = {}): Promise<number> {
  if (!transport) return 0;
  const byLocale = new Map<Locale, string[]>();
  const ready = options.paid ? devices : await deferQuietPushes(db, devices, write, now);
  for (const device of ready) byLocale.set(device.locale, [...(byLocale.get(device.locale) ?? []), device.token]);
  let accepted = 0;
  for (const [locale, tokens] of byLocale) {
    const answer = await transport.send(tokens, write(locale));
    accepted += answer.accepted;
    if (answer.invalid.length > 0) await db.delete(pushDevices).where(inArray(pushDevices.token, answer.invalid));
  }
  return accepted;
}
