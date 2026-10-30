import { useEffect, useSyncExternalStore } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { z } from 'zod';
import type { LocalAlert, LocalAlertPrefs } from '../lib/localAlerts.js';
import { isAppActive, watchAppActivity } from './activity.js';
import { capabilities } from './runtime.js';

/**
 * THE PHONE SIDE OF THE FREE QUEUE ALERTS (Bildirim Merkezi, decision 3).
 *
 * Two pieces of state, kept apart on purpose:
 *   · the player's CHOICE (on/off, categories) — this device's localStorage, off by default;
 *   · the phone's PERMISSION — owned by the OS and changeable behind the game's back in the
 *     phone settings, so it is never stored: it is read on use and again every time the app
 *     comes back to the front.
 * Alerts are scheduled only while both say yes. The permission prompt appears only when the
 * player turns the alerts on.
 */
const STORE = 'astera:local-alerts:v1';
const CHANNEL = 'queue';
/** Marks the notifications this module owns, so a sync never touches anything else. */
const TAG = 'queue';

const settingsSchema = z.object({
  enabled: z.boolean(),
  prefs: z.object({ build: z.boolean(), research: z.boolean(), ships: z.boolean(), fleet: z.boolean() }),
});
export type LocalAlertSettings = z.infer<typeof settingsSchema>;
const DEFAULTS: LocalAlertSettings = { enabled: false, prefs: { build: true, research: true, ships: true, fleet: true } };

/* ── the player's choice ───────────────────────────────────────── */

let cachedSettings: LocalAlertSettings | null = null;
const settingsListeners = new Set<() => void>();

export function readLocalAlertSettings(): LocalAlertSettings {
  try {
    const raw = globalThis.localStorage.getItem(STORE);
    const parsed = raw === null ? null : settingsSchema.safeParse(JSON.parse(raw));
    return parsed?.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function writeLocalAlertSettings(settings: LocalAlertSettings): void {
  cachedSettings = settings;
  try {
    globalThis.localStorage.setItem(STORE, JSON.stringify(settings));
  } catch {
    // The choice still holds for this session.
  }
  for (const listener of settingsListeners) listener();
}

export function useLocalAlertSettings(): LocalAlertSettings {
  return useSyncExternalStore(
    listener => { settingsListeners.add(listener); return () => { settingsListeners.delete(listener); }; },
    () => (cachedSettings ??= readLocalAlertSettings()),
  );
}

export function setLocalAlertPrefs(prefs: LocalAlertPrefs): void {
  writeLocalAlertSettings({ ...readLocalAlertSettings(), prefs });
}

export function disableLocalAlerts(): void {
  writeLocalAlertSettings({ ...readLocalAlertSettings(), enabled: false });
}

/* ── the phone's permission ────────────────────────────────────── */

export interface PhonePermission {
  /** May the app show notifications at all. `unknown` until read, or where the bridge cannot say. */
  display: 'granted' | 'denied' | 'prompt' | 'unknown';
  /** Android 12+: without it Android may hold an alert back up to an hour. */
  exact: 'granted' | 'denied' | 'unknown';
}
let permission: PhonePermission = { display: 'unknown', exact: 'unknown' };
const permissionListeners = new Set<() => void>();
let watchingActivity = false;

const displayOf = (state: string): PhonePermission['display'] =>
  state === 'granted' ? 'granted' : state === 'denied' ? 'denied' : 'prompt';
const exactOf = (state: string): PhonePermission['exact'] => (state === 'granted' ? 'granted' : 'denied');

function publishPermission(next: PhonePermission): PhonePermission {
  if (next.display !== permission.display || next.exact !== permission.exact) {
    permission = next;
    for (const listener of permissionListeners) listener();
  }
  return permission;
}

export const phonePermission = (): PhonePermission => permission;

/** Asks the phone what it allows now. Never throws. */
export async function refreshPhonePermission(): Promise<PhonePermission> {
  if (!watchingActivity) {
    watchingActivity = true;
    // Coming back from the phone settings is exactly when the answer changes.
    watchAppActivity(() => { if (isAppActive()) void refreshPhonePermission(); });
  }
  const [display, exact] = await Promise.all([
    LocalNotifications.checkPermissions().then(status => displayOf(status.display), () => 'unknown' as const),
    LocalNotifications.checkExactNotificationSetting().then(status => exactOf(status.exact_alarm), () => 'unknown' as const),
  ]);
  return publishPermission({ display, exact });
}

/** The current permission, read when first used and on every return to the front. */
export function usePhonePermission(): PhonePermission {
  const value = useSyncExternalStore(
    listener => { permissionListeners.add(listener); return () => { permissionListeners.delete(listener); }; },
    phonePermission,
  );
  useEffect(() => { if (capabilities().localNotifications) void refreshPhonePermission(); }, []);
  return value;
}

/**
 * Turns the alerts on, asking the phone only if it has not already said yes. The switch
 * stays off unless it does; a refused or broken bridge is a no.
 */
export async function enableLocalAlerts(): Promise<boolean> {
  const current = await refreshPhonePermission();
  const display = current.display === 'granted' ? 'granted'
    : await LocalNotifications.requestPermissions().then(status => displayOf(status.display), () => 'denied' as const);
  publishPermission({ ...permission, display });
  const granted = display === 'granted';
  if (granted) writeLocalAlertSettings({ ...readLocalAlertSettings(), enabled: true });
  return granted;
}

/** Opens the phone's on-time alarm setting (Android 12+), then reads it back. */
export async function allowExactLocalAlerts(): Promise<void> {
  const status = await LocalNotifications.changeExactNotificationSetting().catch(() => null);
  if (status) publishPermission({ ...permission, exact: exactOf(status.exact_alarm) });
}

/* ── the scheduled alerts ──────────────────────────────────────── */

const extraSchema = z.object({ astera: z.literal(TAG), lang: z.string().optional(), exact: z.boolean().optional() }).passthrough();

interface SyncJob { plan: readonly LocalAlert[]; text: (alert: LocalAlert) => { title: string; body: string }; lang: string }
let queued: SyncJob | null = null;
let draining: Promise<void> | null = null;

/** Makes the phone equal one plan. An alert is kept only if its time, language and alarm kind still match. */
async function reconcile({ plan, text, lang }: SyncJob): Promise<void> {
  // Asked fresh: an on-time alarm the phone refuses makes the plugin open the phone settings
  // on its own, on every schedule. Without one Android may hold an alert back up to an hour,
  // so alerts set before the player allowed it are set again.
  const onTime = await LocalNotifications.checkExactNotificationSetting()
    .then(status => status.exact_alarm === 'granted', () => false);
  const { notifications } = await LocalNotifications.getPending();
  const wanted = new Map(plan.map(alert => [alert.id, alert]));
  const settled = new Set<number>();
  const cancel: { id: number }[] = [];
  for (const pending of notifications) {
    const extra = extraSchema.safeParse(pending.extra);
    if (!extra.success) continue;
    const alert = wanted.get(pending.id);
    const at = pending.schedule?.at ? new Date(pending.schedule.at).getTime() : null;
    if (at === alert?.at && extra.data.lang === lang && extra.data.exact === onTime) settled.add(pending.id);
    else cancel.push({ id: pending.id });
  }
  if (cancel.length > 0) await LocalNotifications.cancel({ notifications: cancel });
  const fresh = plan.filter(alert => !settled.has(alert.id));
  if (fresh.length === 0) return;
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'Astera Online', importance: 3 });
  await LocalNotifications.schedule({
    notifications: fresh.map(alert => ({
      id: alert.id,
      ...text(alert),
      channelId: CHANNEL,
      isExactNotification: onTime,
      schedule: { at: new Date(alert.at), allowWhileIdle: true },
      extra: { astera: TAG, key: alert.key, lang, exact: onTime },
    })),
  });
}

/**
 * Makes the phone's queue alerts equal `plan`. Syncs run one at a time — two reconciles
 * reading the same pending list would cancel each other's work — and a plan superseded
 * while it waits is skipped for the newest. Never throws: an alert that could not be set
 * is not worth breaking the game over.
 */
export function syncLocalAlerts(plan: readonly LocalAlert[], text: SyncJob['text'], lang: string): Promise<void> {
  queued = { plan, text, lang };
  draining ??= (async () => {
    while (queued) {
      const job = queued;
      queued = null;
      await reconcile(job).catch(() => undefined);
    }
    draining = null;
  })();
  return draining;
}

/** Sign-out: the next commander on this phone must not hear the last one's queues. */
export function clearLocalAlerts(): Promise<void> {
  if (!capabilities().localNotifications) return Promise.resolve();
  return syncLocalAlerts([], () => ({ title: '', body: '' }), '');
}
