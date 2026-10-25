import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DistributedFireRules } from '../src/ui/DistributedFireRules.js';
import { MonumentBattleRules } from '../src/screens/MonumentBattleRules.js';
import { reportsSchema } from '../src/api/schemas.js';

const report = { kind: 'BATTLE', id: 'r', missionId: 'm', at: '2026-10-25T00:00:00Z', grade: 'PARTIAL', attacking: true,
  opponentName: 'Enemy', opponentPlanet: 'Planet', opponentPlanetId: 'p', yourPlanet: 'Home', yourFleet: { DART: 1 },
  yourLosses: {}, theirLosses: {}, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0 };
const round = { round: 1, distributedFire: true, targetLimit: 10, attackerDamage: 20, defenderDamage: 0,
  shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: {}, defenderLosses: {} };

describe('target selection explanation follows the recorded battle rule', () => {
  it('preserves the immutable target limit through the real report parser', () => {
    const parsed = reportsSchema.parse({ rivals: [], reports: [{ ...report, rounds: [round] }] });
    expect(parsed.reports[0]).toMatchObject({ rounds: [{ targetLimit: 10 }] });
  });
  it('preserves the target limit in the monument report ledger', () => {
    const parsed = reportsSchema.parse({ rivals: [], reports: [{ kind: 'MONUMENT', id: 'r', at: report.at,
      monument: { id: 'm', ordinal: 1, position: { x: 0, y: 0, z: 0 } }, attacking: true, grade: 'PARTIAL', control: 'DEFENDER',
      defenderCargoRetreated: false, roundCount: 1, yourFleet: { DART: 1 }, yourSurvivors: { DART: 1 }, yourRetreated: {}, theirRetreatedCount: 0,
      yourLosses: {}, yourDamage: [], theirLosses: {}, lootDeuterium: 0, dominion: 0,
      rounds: [{ round: 1, distributedFire: true, targetLimit: 10, yourLosses: {}, theirLosses: {}, yourRetreated: {}, theirRetreatedCount: 0 }] }] });
    expect(parsed.reports[0]).toMatchObject({ rounds: [{ targetLimit: 10 }] });
  });
  it('explains ten random targets and class priority on new reports', () => {
    render(<DistributedFireRules targetLimit={10} />);
    expect(screen.getByText(/up to 10/i)).toHaveTextContent(/class/i);
    expect(screen.queryByText(/across all eligible living targets/i)).not.toBeInTheDocument();
  });
  it('keeps the historical all-target explanation on old reports', () => {
    render(<DistributedFireRules />);
    expect(screen.getByText(/across all eligible living targets/i)).toBeInTheDocument();
    expect(screen.queryByText(/up to 10/i)).not.toBeInTheDocument();
  });
  it('teaches the current target cap in public monument rules', () => {
    render(<MonumentBattleRules />);
    expect(screen.getByText(/up to 10/i)).toHaveTextContent(/class/i);
  });
});
