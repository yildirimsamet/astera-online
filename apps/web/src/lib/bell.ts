import type { NotificationView } from '../api/schemas.js';
import { describeNotification, isUrgent } from './notifications.js';

/**
 * THE BELL'S NUMBER AND WHETHER IT PULSES. Spec B1.
 *
 * Unseen news only — a standing state such as a full store is not news and has
 * its own mark on the meter — and only news the sheet can word, so the count
 * never promises a row that does not appear. It pulses only when one of them is
 * urgent (`isUrgent`), because a bell that always moves is a bell nobody reads.
 */
export function bellState(list: readonly NotificationView[], now: number): { unseen: number; urgent: boolean } {
  const fresh = list.filter((notification) => !notification.seen && describeNotification(notification, now) !== null);
  return { unseen: fresh.length, urgent: fresh.some(isUrgent) };
}
