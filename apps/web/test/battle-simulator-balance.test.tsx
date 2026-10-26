import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BattleBalance } from '../src/battle-simulator/BattleBalance.js';
import { DEFAULT_SCENARIO, scenarioSchema, simulateScenario } from '../src/battle-simulator/scenario.js';

/**
 * THE BALANCE STRIP STATES ONLY WHAT CAN HAPPEN. A side of guns and support never withdraws,
 * whatever window its power tier grants; a side with no firepower is named as such, never "1:∞".
 */
const fought = (over: object) => simulateScenario(scenarioSchema.parse({ ...DEFAULT_SCENARIO, aegisLevel: 0, ...over }));
const strip = (run: ReturnType<typeof fought>) => {
  render(<BattleBalance balance={run.result.balance!} ships={run.recording.ships} />);
  return screen.getByRole('region', { name: 'Battle balance' });
};

describe('battle balance strip', () => {
  it('never promises a retreat to a side that holds only guns or support', () => {
    const run = fought({ attackers: [{ id: 'a', fleet: { CORSAIR: 8 } }], defenders: [{ id: 'd', fleet: { BASTION: 3, ARGOSY: 2 } }] });
    expect(run.result.balance?.defenderRetreat).not.toBeNull();
    const defender = strip(run).querySelectorAll('dl > div')[1]!;
    expect(defender).toHaveTextContent('Never retreats');
    expect(defender).not.toHaveTextContent(/Retreats below/);
  });

  it('keeps the window of a side that has warships able to leave', () => {
    const run = fought({ attackers: [{ id: 'a', fleet: { CORSAIR: 8 } }], defenders: [{ id: 'd', fleet: { DART: 3, BASTION: 1 } }] });
    expect(strip(run).querySelectorAll('dl > div')[1]).toHaveTextContent(/Retreats below/);
  });

  it('names a side with no firepower instead of an infinite ratio', () => {
    const noDefence = strip(fought({ defenders: [{ id: 'd', fleet: { ARGOSY: 3 } }] }));
    expect(noDefence).toHaveTextContent('Defender has no firepower');
    expect(noDefence).not.toHaveTextContent('∞');
  });

  it('names an attacker with no firepower the same way', () => {
    expect(strip(fought({ attackers: [{ id: 'a', fleet: { COURIER: 3 } }] }))).toHaveTextContent('Attacker has no firepower');
  });
});
