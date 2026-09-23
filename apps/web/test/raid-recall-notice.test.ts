import { describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import { describeNotification } from '../src/lib/notifications.js';

/**
 * A RAID CALLED BACK COMES HOME AS ITSELF. Decision K8.
 *
 * The owner turned it before it struck, so no battle was fought. "Empty-handed" is
 * the wording for a raid that fought and found nothing; read hours later it would
 * tell the commander the raid failed. The server marks the homecoming `recalled`.
 */
const AT = new Date('2026-09-23T12:00:00.000Z');
const news = (payload: Record<string, unknown>): NotificationView => ({
  id: 'n1',
  kind: 'fleet_returned',
  refId: 'r1',
  payload,
  seen: false,
  at: AT,
});

describe('a raid that was called back, home again', () => {
  const home = {
    trip: 'raid', ships: 20, fromUsername: 'Sable', fromPlanetName: 'Tharsis',
    lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0,
  };

  it('says it was called back, not that it came home empty-handed', () => {
    const line = describeNotification(news({ ...home, recalled: true }), AT.getTime());
    expect(line).toMatch(/called back/i);
    expect(line).toMatch(/Tharsis/);
    expect(line).toMatch(/20 ships/);
    expect(line).not.toMatch(/empty-handed/i);
  });

  it('still calls a raid that fought and found nothing empty-handed', () => {
    expect(describeNotification(news(home), AT.getTime())).toMatch(/empty-handed/i);
  });
});
