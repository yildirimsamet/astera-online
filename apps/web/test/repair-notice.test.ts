import { describe, expect, it } from 'vitest';
import type { NotificationView } from '../src/api/schemas.js';
import { describeNotification } from '../src/lib/notifications.js';

/**
 * WHAT THE REPAIR STATION DID, SAID IN THE BELL. Kalıcı gemi hasarı, `plan.md` F6.
 *
 * A defender learns which of its ships went to the dock and which were patched on the
 * spot; a raider learns some of its ships fly home damaged; a landing says what the
 * station did with them. Every clause is said only when it happened.
 */

const AT = new Date('2026-09-30T12:00:00.000Z');
const news = (kind: NotificationView['kind'], payload: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind, refId: 'r1', payload, seen: false, at: AT,
});
const say = (kind: NotificationView['kind'], payload: Record<string, unknown>) =>
  describeNotification(news(kind, payload), AT.getTime()) ?? '';

describe('the Repair Station in the bell', () => {
  const raided = {
    grade: 'PARTIAL', lootAlloy: 500, lootCrystal: 0, lootDeuterium: 0, unitsLost: 3, theirLosses: 2,
    originUsername: 'Sable', originPlanetName: 'Tharsis',
  };

  it('tells a defender what went to the dock and what was patched', () => {
    const line = say('raided', { ...raided, docked: 2, autoRepaired: 1 });
    expect(line).toMatch(/2 ships to the Repair Station/);
    expect(line).toMatch(/1 patched free/);
  });

  it('says it on a held line too', () => {
    expect(say('raided', { ...raided, grade: 'REPELLED', docked: 1 })).toMatch(/1 ship to the Repair Station/);
  });

  it('says nothing about the dock when nothing went there', () => {
    expect(say('raided', raided)).not.toMatch(/Repair Station|patched/);
  });

  it('tells a raider some of its ships fly home damaged', () => {
    const line = say('raid_result', {
      grade: 'DECISIVE', targetUsername: 'Sable', targetPlanetName: 'Tharsis',
      lootAlloy: 900, lootCrystal: 0, lootDeuterium: 0, unitsLost: 1, shipsHome: 5, damaged: 2,
    });
    expect(line).toMatch(/2 coming home damaged/);
  });

  it('says what the station did when the ships land', () => {
    const line = say('fleet_returned', {
      trip: 'raid', ships: 5, fromUsername: 'Sable', fromPlanetName: 'Tharsis',
      lootAlloy: 900, lootCrystal: 0, lootDeuterium: 0, docked: 1, autoRepaired: 1,
    });
    expect(line).toMatch(/1 ship to the Repair Station/);
    expect(line).toMatch(/1 patched free/);
  });
});
