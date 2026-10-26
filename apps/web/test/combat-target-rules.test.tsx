import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DistributedFireRules } from '../src/ui/DistributedFireRules.js';
import { MonumentBattleRules } from '../src/screens/MonumentBattleRules.js';
import { reportsSchema } from '../src/api/schemas.js';
import { COMBAT } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { percent } from '../src/lib/format.js';

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
  it('keeps the ten-target explanation on reports fought by the six-round engine', () => {
    render(<DistributedFireRules targetLimit={10} />);
    expect(screen.getByText(/up to 10/i)).toHaveTextContent(/class/i);
    expect(screen.queryByText(/across all eligible living targets/i)).not.toBeInTheDocument();
  });
  it('keeps the historical all-target explanation on old reports', () => {
    render(<DistributedFireRules />);
    expect(screen.getByText(/across all eligible living targets/i)).toBeInTheDocument();
    expect(screen.queryByText(/up to 10/i)).not.toBeInTheDocument();
  });
  /** Combat v3 (owner 2026-10-25): one target per shot, class priority, the kill's excess carried on. */
  it('explains one target per shot, the class order, the carried excess and break-up on v3 reports', () => {
    render(<DistributedFireRules targetLimit={COMBAT.targetsPerShot} />);
    const rule = screen.getByText(/one living target/i);
    expect(rule).toHaveTextContent(/class/i);
    expect(rule).toHaveTextContent(/excess/i);
    expect(rule).toHaveTextContent(percent(COMBAT.criticalBelow));
    expect(rule).not.toHaveTextContent(/up to|split/i);
  });
  it('teaches the current rule in public monument rules', () => {
    render(<MonumentBattleRules />);
    expect(screen.getByText(/one living target/i)).toHaveTextContent(/class/i);
    expect(screen.queryByText(/up to 1 /i)).not.toBeInTheDocument();
  });
  it('states the one-target rule in every language', async () => {
    for (const language of ['tr', 'de', 'fr', 'es', 'ja']) {
      await i18n.changeLanguage(language);
      const { container, unmount } = render(<><DistributedFireRules targetLimit={1} /><MonumentBattleRules /></>);
      expect(container.textContent).not.toMatch(/\{\{|monument\.battleResult|reports\.distributed/);
      expect(container.textContent).toContain(percent(COMBAT.criticalBelow));
      unmount();
    }
    await i18n.changeLanguage('en');
  });
});
