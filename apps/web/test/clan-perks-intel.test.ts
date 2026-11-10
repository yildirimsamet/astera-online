import { beforeEach, describe, expect, it } from 'vitest';
import type { GalaxyPlanet, IntelView, ProbeReport } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { dossier } from '../src/lib/dossier.js';
import { conceptReference } from '../src/wiki/facts.js';
import { planetView } from './fixtures.js';

/**
 * F2 E5 — THE RAIDER SEES THE RISK. A probe of a clan world reads the clan's level, and the
 * dossier says what it buys a defender: whether the clan hears the raid, and how fast help flies.
 */

const NOW = Date.parse('2026-11-10T12:00:00Z');
const world: GalaxyPlanet = {
  id: 'them', name: 'Kuzgun', owner: 'Ayşe', position: { x: 200, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false,
};
const probe = (over: Partial<ProbeReport> = {}): ProbeReport => ({
  targetPlanetId: 'them', targetName: 'Kuzgun', targetUsername: 'Ayşe',
  at: new Date(NOW - 30 * 60_000), accuracy: 0.8, detected: false,
  stock: { low: 100, high: 200 }, deuteriumStock: null,
  defence: { low: 10_000, high: 14_000 }, fleetSize: { low: 20, high: 30 }, fleetHome: true,
  ...over,
});
const intel = (report: ProbeReport): IntelView => ({
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 }, probeReports: [report],
});
const clanRow = (report: ProbeReport) => dossier({ target: world, planet: planetView(), intel: intel(report), reports: [], now: NOW })
  .facts.find((fact) => fact.key === 'clanLevel');

describe('the probe reads the target clan', () => {
  beforeEach(async () => { await i18n.changeLanguage('en'); });

  it('names the alarm and the corridor the level buys', () => {
    const row = clanRow(probe({ clanLevel: 7 }));
    expect(row?.value).toBe('Level 7 · clan alarm on · support flies ×5');
    expect(row?.source).toBe('probe');
    expect(row?.note).toMatch(/clanmates can reach this world faster than an ordinary flight/i);
  });

  it('says a founding clan has no alarm yet', () => {
    expect(clanRow(probe({ clanLevel: 1 }))?.value).toBe('Level 1 · no clan alarm · support flies ×2');
  });

  it('prints nothing for a world outside a clan', () => {
    expect(clanRow(probe())).toBeUndefined();
  });

  it('reads in Turkish', async () => {
    await i18n.changeLanguage('tr');
    expect(clanRow(probe({ clanLevel: 3 }))?.value).toBe('Seviye 3 · klan alarmı var · destek ×3 hızla gelir');
  });
});

describe('the Wiki states the F2 ladder', () => {
  const text = (id: string, language: 'en' | 'tr') => JSON.stringify(conceptReference(id, language));

  it('names the corridor instead of a flat aid speed', () => {
    expect(text('clan.aid', 'en')).toMatch(/First leg 2×–5× by clan level · return 1\.1×/);
    expect(text('clan.aid', 'tr')).toMatch(/İlk bacak klan seviyesine göre 2×–5× · dönüş 1,1×/);
  });

  it('lists the stay each rung buys', () => {
    expect(text('clan.support', 'en')).toMatch(/12 h · 18 h from level 4 · 24 h from level 8/);
  });

  it('puts each rung’s perk in the clan level table', () => {
    const page = text('clan.joint-war', 'en');
    expect(page).toMatch(/Perk/);
    expect(page).toMatch(/Clan alarm/);
    expect(page).toMatch(/Shared furnace \+2% per active member/);
    expect(text('clan.joint-war', 'tr')).toMatch(/Altın sancak/);
  });
});
