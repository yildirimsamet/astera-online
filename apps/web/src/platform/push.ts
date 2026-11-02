import { PushNotifications } from '@capacitor/push-notifications';
import { refreshPhonePermission } from './localNotifications.js';
import { capabilities } from './runtime.js';
import { z } from 'zod';
import { observe } from '../lib/playerAnalytics/runtime.js';

/**
 * THE PHONE'S ADDRESS FOR PAID ALERTS (Bildirim Merkezi, FCM). Owner 2026-10-31.
 *
 * The server sends a raid alert to every FCM token the commander's account holds; this keeps
 * this phone's token there. It never prompts on its own: the permission is asked only when
 * the player asks (building the centre, or the centre's own button), and otherwise a phone
 * that already allows notifications connects quietly. Android shows notifications through
 * the one OS permission the free queue alerts also use, so the shared permission state is
 * refreshed after asking. The channel the server names (`alerts`) is created before the
 * token is handed out, or FCM would fall back to its own.
 */
const CHANNEL = 'alerts';
/** The last token handed to the server, kept across app starts: a phone whose notifications were
 * switched off in its settings must still be taken off the account, or alerts are paid for unseen. */
const STORE = 'astera:push-token';

function remembered(): string | null {
  try { return globalThis.localStorage.getItem(STORE); } catch { return null; }
}
function remember(value: string | null): void {
  try {
    if (value === null) globalThis.localStorage.removeItem(STORE);
    else globalThis.localStorage.setItem(STORE, value);
  } catch {
    // This start still knows it; the next one asks FCM again.
  }
}

export interface PushApi {
  registerPushDevice(token: string, locale: string): Promise<unknown>;
  forgetPushDevice(token: string): Promise<unknown>;
}

let target: { api: PushApi; locale: string } | null = null;
let token: string | null = null;
let listening: Promise<unknown> | null = null;
let opening: Promise<unknown> | null = null;
const openedSchema = z.object({ notification: z.object({ data: z.object({ refId: z.string().uuid() }) }) });

/** Every `register()` answers with the token again, so a language change or a refreshed token is sent the same way. */
function post(): void {
  if (target && token) void target.api.registerPushDevice(token, target.locale).catch(() => undefined);
}

export async function connectPush(api: PushApi, options: { locale: string; channelName: string; ask: boolean }): Promise<'on' | 'denied' | 'off'> {
  if (!capabilities().nativePush) return 'off';
  target = { api, locale: options.locale };
  try {
    let receive = (await PushNotifications.checkPermissions()).receive;
    if (receive !== 'granted' && options.ask) {
      receive = (await PushNotifications.requestPermissions()).receive;
      observe('alert_permission', { code: receive === 'granted' ? 'granted' : 'denied', variant: 'push' }, 'live');
      void refreshPhonePermission();
    }
    if (receive !== 'granted') return options.ask ? 'denied' : 'off';
    listening ??= PushNotifications.addListener('registration', ({ value }) => { token = value; remember(value); post(); });
    opening ??= PushNotifications.addListener('pushNotificationActionPerformed', value => {
      const opened = openedSchema.safeParse(value);
      if (opened.success) observe('alert_opened', { refId: opened.data.notification.data.refId, code: 'push' }, 'live');
    });
    await listening;
    await opening;
    await PushNotifications.createChannel({ id: CHANNEL, name: options.channelName, importance: 5, visibility: 1, vibration: true });
    await PushNotifications.register();
    return 'on';
  } catch {
    return 'off';
  }
}

/**
 * Takes this phone off the signed-in account: at sign-out (the next commander on this phone must
 * not hear the last one's raids) and when the phone settings refuse notifications. Kept for a
 * retry if the server could not be told. Never throws.
 */
export async function disconnectPush(api: PushApi): Promise<void> {
  const known = token ?? remembered();
  target = null;
  if (!known) return;
  try {
    await api.forgetPushDevice(known);
    token = null;
    remember(null);
  } catch {
    // Still on the account; the next disconnect tries again, and a sign-in moves it anyway.
  }
}
