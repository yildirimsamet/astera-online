import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportsSchema } from '../src/api/schemas.js';
import { ReportScene } from '../src/v2/hud/ReportScene.js';
import { MonumentReportSheet } from '../src/screens/MonumentReportSheet.js';

const ordinary = { kind: 'BATTLE', id: 'battle', at: '2026-10-22T18:00:00Z', grade: 'REPELLED', attacking: true,
  opponentName: 'Opponent', opponentPlanet: 'Target', opponentPlanetId: 'target', yourPlanet: 'Home',
  yourFleet: { CORSAIR: 3 }, yourLosses: { CORSAIR: 1 }, theirLosses: {}, rounds: [],
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0, yourDamage: [], yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2 };
const monument = { kind: 'MONUMENT', id: 'monument-battle', at: '2026-10-22T18:00:00Z', grade: 'DECISIVE',
  monument: { id: 'monument', ordinal: 1, position: { x: 1, y: 2, z: 3 } }, attacking: false, control: 'ATTACKER',
  yourFleet: { CORSAIR: 1 }, yourSurvivors: { CORSAIR: 1 }, yourLosses: {}, theirLosses: {}, yourDamage: [],
  yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2, roundCount: 1, lootDeuterium: 0, dominion: 0 };

describe('own retreated ships remain distinct from battle deaths', () => {
  it.each([ordinary, monument])('preserves own retreats through the actual API parser: $kind', report => {
    expect(reportsSchema.parse({ rivals: [], reports: [report] }).reports[0]).toMatchObject({ yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2 });
  });
  it('keeps old reports readable without claiming that they recorded retreats', () => {
    expect(reportsSchema.parse({ rivals: [], reports: [{ ...ordinary, yourRetreated: undefined }] }).reports[0])
      .toMatchObject({ yourRetreated: undefined });
  });
  it('shows retreat survival separately on an ordinary report', () => {
    const r = reportsSchema.parse({ rivals: [], reports: [ordinary] }).reports[0];
    if (!r || r.kind === 'MONUMENT' || r.kind === 'STRATEGIC') throw new Error('wrong fixture');
    render(<ReportScene report={r} />);
    expect(screen.getByText('Retreated alive: 1. These ships kept their hull damage.')).toBeVisible();
    expect(screen.getByText('Enemy ships that retreated and survived: 2.')).toBeVisible();
  });
  it('explains how a monument can be lost with a physical survivor', () => {
    const r = reportsSchema.parse({ rivals: [], reports: [monument] }).reports[0];
    if (!r || r.kind !== 'MONUMENT') throw new Error('wrong fixture');
    render(<MonumentReportSheet report={r} onClose={vi.fn()} />);
    expect(screen.getByText('Retreated alive: 1. These ships kept their hull damage.')).toBeVisible();
    expect(screen.getByText('Enemy ships that retreated and survived: 2.')).toBeVisible();
  });
});
