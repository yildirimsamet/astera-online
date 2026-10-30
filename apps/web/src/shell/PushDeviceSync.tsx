import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { LANGUAGES, type Language } from '../i18n/languages.js';
import { usePhonePermission } from '../platform/localNotifications.js';
import { connectPush, disconnectPush } from '../platform/push.js';

/**
 * KEEPS THIS PHONE'S FCM ADDRESS ON THE SERVER (Bildirim Merkezi push, owner 2026-10-31), so a
 * paid raid alert can reach it. Quiet: it connects only while the phone already allows
 * notifications, and again when the player changes the language the alerts are written in.
 * A phone whose settings refuse notifications is taken off the account: the server then
 * records its alerts as undelivered rather than charging for ones nobody would see.
 * Asking for the permission is the centre's job (`NotificationCenterSheet`).
 */
export function PushDeviceSync() {
  const api = useApi();
  const { t, i18n } = useTranslation();
  const { display } = usePhonePermission();
  const resolved = i18n.resolvedLanguage;
  const locale: Language = LANGUAGES.find(language => language === resolved) ?? 'en';
  const channelName = t('notificationCenter.pushChannel');
  useEffect(() => {
    if (display === 'granted') void connectPush(api, { locale, channelName, ask: false });
    else if (display === 'denied') void disconnectPush(api);
  }, [api, display, locale, channelName]);
  return null;
}
