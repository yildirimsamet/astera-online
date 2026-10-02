import { describe, expect, it } from 'vitest';
import {
  clanSupportQuoteSchema,
  clanSupportWaveSchema,
  defencePostureResultSchema,
  mySupportSchema,
  planetSchema,
  reportsSchema,
} from '../src/api/schemas.js';
import { keys } from '../src/api/keys.js';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';
import { planetView } from './fixtures.js';

/**
 * KLAN SAVUNMA DESTEĞİ — the wire (`docs/clan-defense-support-plan.md`, P12).
 * Every new field is optional, so a client one deploy ahead of its server still parses.
 */

const wave = {
  id: 'wave',
  status: 'STATIONED',
  sender: { playerId: 'ali', name: 'Ali' },
  host: { playerId: 'host', name: 'Host' },
  originPlanetId: 'origin',
  hostPlanetId: 'world',
  hostPlanetName: 'Vega',
  fleet: { PIKE: 12 },
  bulk: 24,
  damaged: false,
  sentAt: '2026-10-01T10:00:00Z',
  arriveAt: '2026-10-01T10:20:00Z',
  stationedAt: '2026-10-01T10:20:00Z',
  expiresAt: '2026-10-01T22:20:00Z',
  returnAt: null,
  returnReason: null,
  outOfBand: false,
  battles: 0,
};

describe('the clan support wire', () => {
  it('parses a world with its posture and support bay, and one from an older server without', () => {
    const base = planetView();
    const parsed = planetSchema.parse(JSON.parse(JSON.stringify({
      ...base,
      defencePosture: { posture: 'SUPPORT', escape: false, support: true, supportLocked: null },
      clanSupport: { room: { used: 24, reserved: 0, total: 470 }, waves: [wave] },
    })));
    expect(parsed.defencePosture?.posture).toBe('SUPPORT');
    expect(parsed.clanSupport?.waves[0]?.expiresAt).toBeInstanceOf(Date);

    const legacy = planetSchema.parse(JSON.parse(JSON.stringify(base)));
    expect(legacy.defencePosture ?? null).toBeNull();
    expect(legacy.clanSupport ?? null).toBeNull();
  });

  it('parses a wave, the Fleet page list, the quote and the posture answer', () => {
    expect(clanSupportWaveSchema.parse(wave).sender.name).toBe('Ali');
    expect(mySupportSchema.parse({ waves: [wave] }).waves).toHaveLength(1);
    const quote = clanSupportQuoteSchema.parse({
      refusals: [{ code: 'CLAN_SUPPORT_TIER_BAND', message: 'band', params: { mine: 5, theirs: 3 } }],
      arriveAt: '2026-10-01T10:20:00Z',
      travelMinutes: 20,
      returnMinutes: 20,
      fuel: 30,
      bays: { used: 2, total: 5 },
      hostRoom: { used: 24, reserved: 0, total: 470, after: 48 },
      band: { ok: false, mine: 5, theirs: 3 },
      stationUntil: '2026-10-01T22:20:00Z',
      seasonClipped: false,
      personalHangar: { used: 300, total: 470 },
      senderShieldUntil: null,
    });
    expect(quote.refusals[0]?.params?.mine).toBe(5);
    expect(quote.arriveAt).toBeInstanceOf(Date);
    const answered = defencePostureResultSchema.parse({ planet: planetView(), returnedWaves: 2 });
    expect(answered.returnedWaves).toBe(2);
  });

  it('parses a battle report that carries a defending line', () => {
    const parsed = reportsSchema.parse({
      reports: [{
        kind: 'BATTLE', id: 'r', missionId: 'm', at: '2026-10-01T12:00:00Z', grade: 'PARTIAL',
        rounds: [], attacking: true, opponentName: 'Host', opponentPlanet: 'Vega',
        opponentPlanetId: 'world', yourPlanet: 'Home', yourPlanetId: 'home', neutral: false,
        yourLosses: { DART: 3 }, theirLosses: { PIKE: 5, RAMPART: 1 }, yourFleet: { DART: 40 },
        theirFleet: {}, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 10,
        shieldAbsorbed: 0, cargoLimited: false, defenceSalvage: {},
        defenseLine: {
          defenderCount: 2,
          members: [
            { playerId: 'host', name: 'Host', role: 'HOST', losses: { RAMPART: 1 }, sent: null, survivors: null, dominion: -8 },
            { playerId: 'ali', name: 'Ali', role: 'SUPPORT', losses: { PIKE: 5 }, sent: null, survivors: null, dominion: -2 },
          ],
        },
      }],
      rivals: [],
    });
    const report = parsed.reports[0];
    if (report?.kind !== 'BATTLE') throw new Error('expected a battle');
    expect(report.defenseLine?.members.map((member) => member.role)).toEqual(['HOST', 'SUPPORT']);
  });

  it('refetches the galaxy — and only that — when a clanmate’s support door opens or closes', () => {
    expect(readsForPrivateEvent('private:clan-posture')).toEqual([keys.galaxy]);
  });

  it('refetches the support pages and both worlds when a wave moves', () => {
    expect(readsForPrivateEvent('private:clan-support')).toEqual([
      keys.clanSupport, keys.planet, keys.planets, keys.pending, keys.traffic, keys.reports,
    ]);
  });
});
