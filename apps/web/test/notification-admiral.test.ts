import { beforeEach, describe, expect, it } from 'vitest';
import { describeNotification } from '../src/lib/notifications.js';
import type { NotificationView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';

const at = new Date('2026-10-25T12:00:00.000Z');
const warning = (payload: Record<string, unknown>): NotificationView => ({ id: 'n1', kind: 'incoming_fleet', payload, seen: false, at });

beforeEach(async () => { await i18n.changeLanguage('en'); });

/** Y9 (owner 2026-10-25): an inbound raid escorted by a commander ship says so on the warning. */
describe('the radar warning names an escorting commander ship', () => {
  it('names the class and level', () => {
    const text = describeNotification(warning({ arriveAt: new Date(at.getTime() + 300_000).toISOString(), etaMinutes: 5, admiral: { ship: 'akinci', level: 7 } }), at.getTime());
    expect(text).toMatch(/commander ship.*Akıncı Lv 7/i);
  });

  it('says nothing of a raid without one', () => {
    const text = describeNotification(warning({ etaMinutes: 5 }), at.getTime());
    expect(text).not.toMatch(/commander ship/i);
  });
});
