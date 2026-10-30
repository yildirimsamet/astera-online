import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePending } from '../api/queries.js';
import { useWorld } from '../api/world.js';
import { clockOffset, serverNow } from '../lib/clock.js';
import { localAlertText } from '../lib/localAlertText.js';
import { planLocalAlerts } from '../lib/localAlerts.js';
import { syncLocalAlerts, useLocalAlertSettings, usePhonePermission } from '../platform/localNotifications.js';
import { capabilities } from '../platform/runtime.js';

/** The phone fires on its own clock; rounding keeps a drifting offset from rescheduling every read. */
const onDevice = (serverMs: number): number => Math.round((serverMs - clockOffset()) / 10_000) * 10_000;

/**
 * KEEPS THE PHONE'S FREE QUEUE ALERTS EQUAL TO THE QUEUES (Bildirim Merkezi, decision 3).
 * Every read of the worlds or the flights re-plans; a cancelled or paused order simply drops
 * out of the plan and its alert is cancelled. Switched off — by the player, or by the phone
 * settings taking the permission away — the plan is empty. The text is worded in the game's
 * language, and a language change rewords what is already scheduled.
 */
export function LocalAlertSync() {
  const { worlds } = useWorld();
  const pending = usePending().data?.pending;
  const settings = useLocalAlertSettings();
  const { display } = usePhonePermission();
  const { i18n } = useTranslation();
  const lang = i18n.language;
  useEffect(() => {
    if (!capabilities().localNotifications) return;
    const active = settings.enabled && display === 'granted';
    // An unread permission or unread worlds is not "nothing to alert": wait rather than cancel everything.
    if (display === 'unknown' || (active && worlds.length === 0)) return;
    const plan = !active ? [] : planLocalAlerts({
      now: serverNow(),
      prefs: settings.prefs,
      worlds: worlds.map(world => ({
        id: world.planet.id,
        name: world.planet.name,
        construction: world.queues?.CONSTRUCTION ?? [],
        yard: world.queues?.YARD ?? [],
        research: world.researchQueue ?? [],
      })),
      pending: pending ?? [],
    }).map(alert => ({ ...alert, at: onDevice(alert.at) }));
    void syncLocalAlerts(plan, localAlertText, lang);
  }, [worlds, pending, settings, display, lang]);
  return null;
}
