import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../src/api/client.js';
import type { NotificationView } from '../src/api/schemas.js';
import { describeError } from '../src/i18n/errors.js';
import i18n from '../src/i18n/index.js';
import { describeNotification } from '../src/lib/notifications.js';

/**
 * WHAT A HIT ON A COLONY SAYS OUTSIDE ITS REPORT. Owner, 2026-10-01: a Death Star costs a
 * colony 20 loyalty and takes it at 20 or less. A commander who never opens the report must
 * still learn from the bell that their colony is slipping, or that it is gone.
 */

const AT = new Date('2026-10-01T12:00:00.000Z');
const news = (kind: NotificationView['kind'], payload: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind, refId: 'm1', payload, seen: false, at: AT,
});
const say = (kind: NotificationView['kind'], payload: Record<string, unknown>) =>
  describeNotification(news(kind, payload), AT.getTime()) ?? '';

beforeEach(async () => { await i18n.changeLanguage('en'); });

describe('a Death Star on a colony, in the bell', () => {
  it('names the loyalty the hit took', () => {
    expect(say('death_star_result', {
      outcome: 'FIRST_STRIKE', targetPlanetId: 'p9', loyalty: { before: 60, after: 40 },
    })).toMatch(/loyalty 60% → 40%/i);
  });

  it('says when the hit took the colony', () => {
    const line = say('death_star_result', {
      outcome: 'FIRST_STRIKE', targetPlanetId: 'p9', loyalty: { before: 18.2, after: 0 },
    });
    expect(line).toMatch(/seceded/i);
    expect(line).toMatch(/neutral/i);
  });

  it('keeps the plain EMP sentence for a capital', () => {
    expect(say('death_star_result', { outcome: 'FIRST_STRIKE', targetPlanetId: 'p9' }))
      .toMatch(/Aegis drained/i);
  });
});

/**
 * A SECESSION IS NOT A STRIKE. `colony_lost` is only ever sent by a secession now, and it
 * used to blame "a strategic strike" for a colony its own commander let fall apart.
 */
describe('a colony lost, in the bell', () => {
  it('names the world that seceded and blames no strike', () => {
    const line = say('colony_lost', { planetId: 'p9', planetName: 'Kestrel', cause: 'SECESSION' });
    expect(line).toMatch(/Kestrel/);
    expect(line).toMatch(/seceded/i);
    expect(line).not.toMatch(/strategic strike/i);
  });

  it('still reads when no name came with it', () => {
    const line = say('colony_lost', { targetPlanetId: 'p9' });
    expect(line).toMatch(/seceded/i);
    expect(line).not.toMatch(/strategic strike/i);
  });
});

/** The battery's two refusals reach a Turkish commander in Turkish, figures intact. */
describe('the battery refusals, in the player’s language', () => {
  it('names the pad’s capacity', async () => {
    await i18n.changeLanguage('tr');
    const said = describeError(new ApiError('INTERCEPTOR_LOADED', 'That world has reached its interceptor capacity', 409, { max: 4 }));
    expect(said).toMatch(/4/);
    expect(said).not.toMatch(/interceptor capacity/);
  });

  it('names the Radar rung it needs', async () => {
    await i18n.changeLanguage('tr');
    const said = describeError(new ApiError('INTERCEPTOR_LOCKED', 'Raise the Radar first', 403, { requiredRadar: 3, radar: 0 }));
    expect(said).toMatch(/Radar/);
    expect(said).toMatch(/3/);
    expect(said).not.toMatch(/Raise the Radar first/);
  });
});
