import { describe, expect, it } from 'vitest';
import { buildGalaxyRecord } from '../src/services/galaxyRecord.js';

describe('galaxy record selection', () => {
  it('counts conflict at a world but not unrelated public lifecycle or development events', () => {
    const record = buildGalaxyRecord({
      seasonId: 'season-1',
      ranked: [],
      rankedClans: [],
      reports: [],
      worlds: [
        { id: 'contested', name: 'Frontier' },
        { id: 'developed', name: 'Haven' },
      ],
      events: [
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'capture-1', subjectPlanetId: 'contested' },
        { seasonId: 'season-1', kind: 'death_star_impact', refId: 'strike-2', subjectPlanetId: 'contested' },
        { seasonId: 'season-1', kind: 'core_tier', refId: 'build-1', subjectPlanetId: 'developed' },
        { seasonId: 'season-1', kind: 'core_tier', refId: 'build-2', subjectPlanetId: 'developed' },
        { seasonId: 'season-1', kind: 'core_tier', refId: 'build-3', subjectPlanetId: 'developed' },
      ],
    });

    expect(record.mostContestedWorld).toEqual({ planetName: 'Frontier', events: 2 });
  });

  it('does not archive a deleted or foreign world as the most contested world', () => {
    const record = buildGalaxyRecord({
      seasonId: 'season-1',
      ranked: [],
      rankedClans: [],
      reports: [],
      worlds: [{ id: 'known', name: 'Frontier' }],
      events: [
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'capture-1', subjectPlanetId: 'known' },
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'capture-2', subjectPlanetId: 'unknown' },
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'capture-3', subjectPlanetId: 'unknown' },
      ],
    });

    expect(record.mostContestedWorld).toEqual({ planetName: 'Frontier', events: 1 });
  });

  it('keeps a reclaimed world when its Chronicle facts still preserve its name', () => {
    const record = buildGalaxyRecord({
      seasonId: 'season-1',
      ranked: [],
      rankedClans: [],
      reports: [],
      worlds: [{ id: 'known', name: 'Frontier' }],
      events: [
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'one', subjectPlanetId: 'known' },
        { seasonId: 'season-1', kind: 'bombardment', refId: 'two', subjectPlanetId: 'reclaimed', payload: { planetName: 'Old Haven' } },
        { seasonId: 'season-1', kind: 'bombardment', refId: 'three', subjectPlanetId: 'reclaimed', payload: { planetName: 'Old Haven' } },
      ],
    });

    expect(record.mostContestedWorld).toEqual({ planetName: 'Old Haven', events: 2 });
  });

  it('counts one raid once even when its report and Chronicle consequences both survive', () => {
    const record = buildGalaxyRecord({
      seasonId: 'season-1',
      ranked: [
        { playerId: 'attacker', commanderName: 'A', taken: 1, lost: 0 },
        { playerId: 'defender', commanderName: 'D', taken: 0, lost: 1 },
      ],
      rankedClans: [],
      reports: [{
        id: 'report-1', missionId: 'mission-1', seasonId: 'season-1', targetKind: 'PLAYER',
        attackerPlayerId: 'attacker', defenderPlayerId: 'defender', targetPlanetId: 'world-1',
        attackerLosses: {}, defenderLosses: {}, dominionSwing: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }],
      worlds: [{ id: 'world-1', name: 'Frontier' }],
      events: [
        { seasonId: 'season-1', kind: 'bombardment', refId: 'mission-1', subjectPlanetId: 'world-1' },
        { seasonId: 'season-1', kind: 'control_transfer', refId: 'mission-1', subjectPlanetId: 'world-1' },
      ],
    });

    expect(record.mostContestedWorld).toEqual({ planetName: 'Frontier', events: 1 });
  });
});
