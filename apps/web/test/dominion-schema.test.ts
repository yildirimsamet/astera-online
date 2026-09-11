import { describe, expect, it } from 'vitest';
import { leaderboardSchema } from '../src/api/schemas.js';
import type { NotificationView } from '../src/api/schemas.js';
import { notificationIdentity } from '../src/lib/notifications.js';

describe('Dominion API numeric contract', () => {
  const response = (score: number) => ({
    ladder: [{
      rank: 1,
      playerId: 'player-1',
      username: 'Commander',
      score,
    }],
    you: null,
  });

  it('accepts exact safe integers and rejects fractions or unsafe values', () => {
    expect(leaderboardSchema.safeParse(response(125_000)).success).toBe(true);
    expect(leaderboardSchema.safeParse(response(0.5)).success).toBe(false);
    expect(leaderboardSchema.safeParse(response(Number.MAX_SAFE_INTEGER + 1)).success).toBe(false);
  });

  it('applies the same contract to persisted raid-result notifications', () => {
    const notification = (dominion: number): NotificationView => ({
      id: 'notification-1',
      kind: 'raid_result',
      refId: 'mission-1',
      payload: {
        grade: 'DECISIVE',
        targetName: 'Rival',
        lootAlloy: 0,
        lootCrystal: 0,
        lootDeuterium: 0,
        unitsLost: 0,
        shipsHome: 1,
        dominion,
      },
      seen: false,
      at: new Date('2026-09-11T00:00:00.000Z'),
    });

    expect(notificationIdentity(notification(Number.MAX_SAFE_INTEGER))).not.toBeNull();
    expect(notificationIdentity(notification(0.5))).toBeNull();
    expect(notificationIdentity(notification(Number.MAX_SAFE_INTEGER + 1))).toBeNull();
  });
});
