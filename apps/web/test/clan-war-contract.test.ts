import { describe, expect, it } from 'vitest';
import { JOINT_WAR_PHYSICAL_LEGS, JOINT_WAR_STAGING_LEGS } from '@astera/rules';
import {
  clanWarSchema,
  clanWarQuoteSchema,
  publicClanSchema,
  trafficSchema,
} from '../src/api/schemas.js';
import { keys } from '../src/api/keys.js';
import { readsForPrivateEvent } from '../src/session/shardEvents.js';
import i18n from '../src/i18n/index.js';

describe('clan joint war wire contract', () => {
  it('parses the one private war view and its live operation', () => {
    const view = clanWarSchema.parse({
      available: true, level: 2, maxLevel: false,
      treasury: { alloy: 10, crystal: 20, deuterium: 0 },
      nextCost: { alloy: 100, crystal: 200, deuterium: 5 },
      room: { alloy: 90, crystal: 180, deuterium: 5 },
      canUpgrade: false,
      hangar: { used: 10, reserved: 20, total: 360 },
      serverNow: '2026-09-20T12:00:00Z',
      operation: {
        id: 'op', status: 'ASSEMBLING', closeReason: null, leaderPlayerId: 'leader',
        target: { playerId: 'enemy', username: 'Rival', planetId: 'world',
          planetName: 'Vega', position: { x: 1, y: 2, z: 3 } },
        staging: { planetId: 'home', name: 'Home', position: { x: 0, y: 0, z: 0 } },
        createdAt: '2026-09-20T12:00:00Z', expiresAt: '2026-09-21T12:00:00Z',
        startedAt: null, resolvedAt: null, completedAt: null,
        contributions: [{ id: 'wave', playerId: 'member', username: 'Scout',
          originPlanetId: 'origin', originPlanetName: 'Origin', sourceKind: 'PHYSICAL',
          status: 'OUTBOUND', fleet: { DART: 3 }, bulk: 3, fuelPaid: 18,
          sentAt: '2026-09-20T12:01:00Z', arrivesAt: '2026-09-20T12:10:00Z',
          mine: true, canRecall: true }],
        pool: { combatHulls: 3, waves: 1, participants: 1 },
      },
    });
    expect(view.operation?.contributions[0]?.arrivesAt).toBeInstanceOf(Date);
    expect(view.serverNow).toBeInstanceOf(Date);
  });

  it('keeps quote refusals and exact fuel legs for the decision surface', () => {
    const quote = clanWarQuoteSchema.parse({
      ok: false, refusals: [{ code: 'CLAN_HANGAR_FULL', message: 'Full' }],
      sourceKind: 'PHYSICAL', bulk: 5,
      fuel: { legs: [{ leg: 'ORIGIN_TO_STAGING', distance: 10, fuel: 4 }], total: 4, available: 3 },
      travel: { stagingMinutes: 3, combinedMinutes: 4, returnMinutes: 5,
        stagingEta: '2026-09-20T12:03:00Z', earliestHome: '2026-09-20T12:12:00Z' },
      bays: { used: 1, total: 2 }, personalHangar: { used: 20, total: 100, afterSend: 20 },
      clanHangar: { used: 10, reserved: 20, total: 160, afterSend: 35 },
      latestStartAt: '2026-09-21T11:00:00Z', canFinishBeforeSeasonEnd: true,
      shieldWouldDrop: null,
    });
    expect(quote.refusals[0]?.code).toBe('CLAN_HANGAR_FULL');
    expect(quote.travel.earliestHome).toBeInstanceOf(Date);
  });

  it('gives each quoted fuel leg a distinct player-facing route name in every language', () => {
    const legs = new Set([...JOINT_WAR_PHYSICAL_LEGS, ...JOINT_WAR_STAGING_LEGS]);
    for (const language of ['en', 'tr', 'fr', 'de', 'es']) {
      const t = i18n.getFixedT(language);
      const names = [...legs].map((leg) => t(`clanWar.fuelLegName.${leg}`));
      expect(new Set(names).size, language).toBe(legs.size);
      for (const name of names) {
        expect(name, language).not.toMatch(/[_:]/);
        expect(name.length, language).toBeGreaterThan(5);
      }
    }
  });

  it('keeps all five clan sections identifiable in a narrow mobile tab bar', () => {
    for (const language of ['en', 'tr', 'fr', 'de', 'es']) {
      const t = i18n.getFixedT(language);
      const names = (['overview', 'strength', 'members', 'aid'] as const)
        .map((id) => t(`clan.tabs.compact.${id}`));
      names.push(t('clanWar.tab'));
      expect(new Set(names).size, language).toBe(5);
      for (const name of names) expect(name.length, language).toBeLessThanOrEqual(7);
    }
  });

  it('accepts the exact-sight clan fleet label and routes private war events narrowly', () => {
    const traffic = trafficSchema.parse({ contacts: [{ id: 'mission', kind: 'fleet',
      from: { x: 0, y: 0, z: 0 }, to: { x: 1, y: 0, z: 0 },
      startAt: '2026-09-20T12:00:00Z', endAt: '2026-09-20T12:01:00Z',
      fleet: { DART: 3 }, clanFleet: { clanId: 'clan', tag: 'OG', label: '[OG] Klan Filosu' },
    }], interceptions: [], interceptionImpacts: [] });
    expect(traffic.contacts[0]?.clanFleet?.tag).toBe('OG');
    expect(readsForPrivateEvent('private:clan-war')).toContainEqual(keys.clanWar);
    expect(readsForPrivateEvent('private:clan-treasury')).toContainEqual(keys.clanWar);
  });

  it('keeps the public clan level and defaults old payloads to unknown', () => {
    const base = {
      id: 'clan', name: 'Orion Guard', tag: 'OG', description: '', recruiting: true,
      leaderName: 'Vantage', memberCount: 2, score: 100,
    };
    expect(publicClanSchema.parse({ ...base, level: 4 }).level).toBe(4);
    expect(publicClanSchema.parse(base).level).toBeNull();
  });
});
