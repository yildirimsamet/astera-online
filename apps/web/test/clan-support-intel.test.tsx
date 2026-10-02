import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { reportsSchema, type GalaxyPlanet, type IntelView, type ProbeReport, type Report } from '../src/api/schemas.js';
import { dossier, fieldedAtLeast } from '../src/lib/dossier.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';
import { planetView } from './fixtures.js';

/**
 * KLAN SAVUNMA DESTEĞİ — what the probe sold, on every surface a target is chosen from
 * (owner K9): the world's posture exactly, the clanmates standing there as a reading of
 * their own, the enemy bar as the WHOLE line, and no retreat line on a world that cannot
 * retreat.
 */

const NOW = Date.parse('2026-10-01T12:00:00Z');

const world: GalaxyPlanet = {
  id: 'them', name: 'Vega', owner: 'Ali', position: { x: 200, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false,
};

const probe = (over: Partial<ProbeReport> = {}): ProbeReport => ({
  targetPlanetId: 'them', targetName: 'Vega', targetUsername: 'Ali',
  at: new Date(Date.now() - 30 * 60_000), accuracy: 0.8, detected: false,
  stock: { low: 100, high: 200 }, deuteriumStock: null,
  defence: { low: 10_000, high: 14_000 },
  fleetSize: { low: 20, high: 30 }, fleetHome: true,
  ...over,
});

const supported = (over: Partial<ProbeReport> = {}) => probe({
  posture: 'SUPPORT',
  support: { supporters: 2, defence: { low: 8_000, high: 11_000 }, fleetSize: { low: 30, high: 40 }, classReading: null },
  ...over,
});

const intelWith = (report: ProbeReport | null): IntelView => ({
  watching: [], radarLog: [], probeCooldowns: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
  probeReports: report ? [report] : [],
});

const facts = (report: ProbeReport) => dossier({
  target: world, planet: planetView(), intel: intelWith(report), reports: [], now: NOW,
}).facts;

const reading = (report: ProbeReport, rulesetVersion = 15) => renderHook(() => useTargetReading({
  target: { kind: 'world', world },
  intel: intelWith(report),
  reports: [],
  tech: {},
  wing: { DART: 60 },
  rulesetVersion,
})).result.current;

describe('the dossier rows', () => {
  it('states the posture exactly, and the support as its own reading', () => {
    const read = facts(supported());
    expect(read.find((fact) => fact.key === 'posture')?.value).toMatch(/clan support on · never retreats/i);
    const support = read.find((fact) => fact.key === 'support');
    expect(support?.value).toMatch(/2 supporters/);
    expect(support?.value).toMatch(/8000–11000/);
    expect(support?.value).toMatch(/30–40 ships/);
    expect(support?.source).toBe('probe');
  });

  it('says nobody stood there when the posture was open and the bay empty', () => {
    // What the server actually writes for an empty bay at a SUPPORT world (`resolveProbe`).
    const empty = { supporters: 0, defence: { low: 0, high: 0 }, fleetSize: { low: 0, high: 0 }, classReading: null };
    const read = facts(supported({ support: empty }));
    expect(read.find((fact) => fact.key === 'support')?.value).toMatch(/none standing/i);
    expect(read.find((fact) => fact.key === 'support')?.value).not.toMatch(/0 supporters/i);
    // And a reading with no support object at all says the same.
    expect(facts(supported({ support: null })).find((fact) => fact.key === 'support')?.value).toMatch(/none standing/i);
  });

  it('prints no support row on a world that cannot hold any, and the posture still', () => {
    const read = facts(probe({ posture: 'HOLD', support: null }));
    expect(read.find((fact) => fact.key === 'posture')?.value).toMatch(/fights to the end/i);
    expect(read.find((fact) => fact.key === 'support')).toBeUndefined();
  });

  it('prints neither on a report from before the rule', () => {
    const read = facts(probe());
    expect(read.find((fact) => fact.key === 'posture')).toBeUndefined();
    expect(read.find((fact) => fact.key === 'support')).toBeUndefined();
  });
});

describe('the target reading against a supported world', () => {
  it('draws the enemy bar as the whole line — host and support — and says so', () => {
    const read = reading(supported());
    expect(read.opposing).toMatchObject({ low: 18_000, high: 25_000 });
    expect(read.notes.join(' ')).toMatch(/2 clan supporters/i);
  });

  it('tells the raider the most the support could multiply a win by', () => {
    // Host ships 10k–14k, support 8k–11k: at most 1 + 11/10. The probe never sees the guns,
    // and guns only lower the factor, so the ceiling is the one figure the reading can vouch for.
    const read = reading(supported());
    // Only the host's part is multiplied: the supporters' ships destroyed count once.
    expect(read.notes.join(' ')).toMatch(/if you win, the host’s part of your dominion is up to ×2\.1/i);
  });

  it('draws no retreat line where the posture forbids it, and says why', () => {
    const read = reading(supported());
    expect(read.escape).toBeNull();
    expect(read.notes.join(' ')).toMatch(/never retreats/i);
    const hold = reading(probe({ posture: 'HOLD', support: null }));
    expect(hold.escape).toBeNull();
    expect(hold.notes.join(' ')).toMatch(/fights to the end/i);
  });

  it('keeps today’s retreat line on a world that retreats', () => {
    const read = reading(probe({ posture: 'ESCAPE', support: null }));
    expect(read.escape).not.toBeNull();
    expect(read.opposing).toMatchObject({ low: 10_000, high: 14_000 });
  });

  it('keeps the retreat line on a report from before the rule', () => {
    expect(reading(probe(), 14).escape).not.toBeNull();
  });
});

describe('the floor a battle sets on their fleet', () => {
  const report = (over: Record<string, unknown>): Report => {
    const parsed = reportsSchema.parse({
      reports: [{
        kind: 'BATTLE', id: 'r', missionId: 'm', at: new Date(NOW - 60_000).toISOString(), grade: 'PARTIAL',
        rounds: [], attacking: true, opponentName: 'Ali', opponentPlanet: 'Vega',
        opponentPlanetId: 'them', yourPlanet: 'Home', yourPlanetId: 'home', neutral: false,
        yourLosses: { DART: 3 }, theirLosses: { PIKE: 10, DART: 4 }, yourFleet: { DART: 40 },
        theirFleet: {}, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 10,
        shieldAbsorbed: 0, cargoLimited: false, defenceSalvage: {},
        ...over,
      }],
      rivals: [],
    });
    const [only] = parsed.reports;
    if (!only) throw new Error('expected a report');
    return only;
  };

  it('counts only what the host lost when clanmates stood in the line', () => {
    const floor = fieldedAtLeast([report({
      defenseLine: { defenderCount: 2, members: [
        { playerId: 'ali', name: 'Ali', role: 'HOST', losses: { DART: 4 }, sent: null, survivors: null, dominion: -30 },
        { playerId: 'zey', name: 'Zeynep', role: 'SUPPORT', losses: { PIKE: 10 }, sent: null, survivors: null, dominion: -5 },
      ] },
    })], 'them');
    expect(floor?.fleet).toEqual({ DART: 4 });
  });

  it('keeps the whole loss when the host stood alone', () => {
    expect(fieldedAtLeast([report({})], 'them')?.fleet).toEqual({ PIKE: 10, DART: 4 });
  });
});
