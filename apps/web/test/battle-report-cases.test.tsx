import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import type { BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReports } from '../src/screens/BattleReports.js';
import i18n from '../src/i18n/index.js';

/**
 * THE CASES A BATTLE IS ACTUALLY IN, AND WHAT THE REPORT OWES EACH ONE.
 *
 * Owner report: *"Savaş raporlarında insanlar düzgün bilgilendirilmiyor. Bir sürü
 * effect tasarım görsel vs. var ama günün sonunda kullanıcılar bir halt anlamıyor.
 * Savaşta ne oldu, karşıda neler vardı, yer savunması var mıydı varsa ne yaptı,
 * hangi round'da neler hayatta kaldı neler öldü."*
 *
 * The cases below are not invented. Each is a real outcome of the shipped
 * `resolveCombat`, swept in `docs/battle-reports.md`, and each one used to reach
 * the reader as an empty box or an unexplained short list.
 */

const base: BattleReport = {
  id: 'b1',
  missionId: 'mission-b1',
  at: new Date('2026-08-26T12:00:00.000Z'),
  grade: 'PARTIAL',
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  rounds: [
    {
      round: 1,
      attackerDamage: 800,
      defenderDamage: 300,
      shieldAbsorbed: 100,
      shieldBreakerDamage: 0,
      attackerLosses: { DART: 2 },
      defenderLosses: { DART: 6 },
    },
  ],
  yourLosses: { DART: 2 },
  theirLosses: { DART: 6, BASTION: 1 },
  yourFleet: { DART: 12, COURIER: 3 },
  /** Defender-only: the force that arrived. Empty on an attacker’s report. D164. */
  theirFleet: {},
  lootAlloy: 300,
  lootCrystal: 80,
  lootDeuterium: 0,
  dominion: 120,
  shieldAbsorbed: 100,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
};

const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

async function openSheet(one: BattleReport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [one] });
  const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
  const view = render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReports />
      </ApiProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: new RegExp(one.opponentName) }));
  return view;
}

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

describe('the walkover — a DECISIVE with no rounds at all', () => {
  /**
   * The most common raid in the game is at a world with nothing standing on it,
   * and `resolveCombat` breaks before round one: `rounds: []`, no losses on either
   * side, grade DECISIVE. The sheet rendered a heading over an empty plate — the
   * least informative report in the game for the most frequent fight in it.
   */
  const walkover = () => report({
    grade: 'DECISIVE',
    rounds: [],
    yourLosses: {},
    theirLosses: {},
    shieldAbsorbed: 0,
  });

  it('says the world was undefended instead of drawing an empty round list', async () => {
    const view = await openSheet(walkover());
    expect(view.container.querySelector('[data-walkover]')).not.toBeNull();
    expect(view.container.querySelector('[data-combat-round]')).toBeNull();
  });

  it('still reports the haul, which is the only thing that happened', async () => {
    const view = await openSheet(walkover());
    // The loot line signs its figures, so match the number rather than the string.
    expect(view.container.textContent).toMatch(/300/);
  });
});

describe('what was on the other side', () => {
  /**
   * ON A DECISIVE THE LIST IS COMPLETE. Nothing survived, so their losses ARE
   * their whole board and the reader may treat the reading as total.
   */
  it('states the roster is complete when nothing survived', async () => {
    const view = await openSheet(report({ grade: 'DECISIVE' }));
    expect(view.container.querySelector('[data-their-board="complete"]')).not.toBeNull();
  });

  /**
   * ON ANYTHING ELSE IT IS A FLOOR, and saying so is the entire fix. `reports.ts`
   * withholds the opponent's roster on purpose — the caller's roster minus losses
   * is survivors, and the same subtraction on the opponent's is what fog refuses.
   * The old sheet rendered that bound as a short list with no explanation, which a
   * reader takes for a broken report rather than a bounded one.
   */
  it('states the roster is only a floor when they held', async () => {
    const view = await openSheet(report({ grade: 'PARTIAL' }));
    expect(view.container.querySelector('[data-their-board="floor"]')).not.toBeNull();
    expect(view.container.textContent).toMatch(/at least/i);
  });

  it('says nothing was destroyed rather than showing a blank on a clean repel', async () => {
    const view = await openSheet(report({ grade: 'REPELLED', theirLosses: {} }));
    expect(view.container.querySelector('[data-their-board="floor"]')).not.toBeNull();
  });
});

describe('was there ground defence, and what did it do', () => {
  /**
   * GROUND GUNS ARE NOT SHIPS AND MUST NOT BE LISTED AS THEM.
   *
   * A Bastion in a loss list beside a Dart looks like one more hull the defender
   * flew. It cannot fly, cannot loot, cannot take Dominion, is priced at 1.6x for
   * exactly that reason, and 60% of it walks back out of its own wreckage. Whether
   * a world had a wall is one of the three questions an attacker returns with, and
   * the report answered it only by accident of the roster being alphabetical.
   */
  it('separates the wall from the ships in what was destroyed', async () => {
    const view = await openSheet(report({ theirLosses: { DART: 6, BASTION: 1, THORN: 4 } }));
    const ground = view.container.querySelector('[data-ground-group]');
    expect(ground, 'ground defence is not called out').not.toBeNull();
    expect(ground!.textContent).toMatch(/bastion/i);
    expect(ground!.textContent).toMatch(/thorn/i);
    expect(ground!.textContent).not.toMatch(/dart/i);
  });

  it('says explicitly that a world had no wall when none was destroyed', async () => {
    const view = await openSheet(report({ grade: 'DECISIVE', theirLosses: { DART: 6 } }));
    expect(view.container.querySelector('[data-no-ground]')).not.toBeNull();
  });

  /**
   * A DECISIVE proves the absence; a PARTIAL cannot. Claiming "no ground defence"
   * off an incomplete reading would be the report inventing the one fact an
   * attacker would bet their next fleet on.
   */
  it('never claims a world had no wall from an incomplete reading', async () => {
    const view = await openSheet(report({ grade: 'PARTIAL', theirLosses: { DART: 6 } }));
    expect(view.container.querySelector('[data-no-ground]')).toBeNull();
  });
});

describe('the order a reader asks their questions in', () => {
  /**
   * Owner instruction: *"savaş raporlarını yeniden düzgün bir şekilde sırala."*
   *
   * Every fact was already on this sheet and it still could not be read, because
   * the order was close to inverted: what was on the other side sat twelfth and the
   * round-by-round fourteenth, under a bookkeeping block about Dominion and clans
   * that only means anything once the fight is understood.
   *
   * The order is the deliverable here, so it is the thing pinned. Asserted by
   * DOCUMENT POSITION rather than by index, so inserting a block inside a section
   * does not fail this and moving a section between them always does.
   */
  const order = ['happened', 'there', 'who', 'changed'] as const;

  const sections = (view: ReturnType<typeof render>): string[] =>
    [...view.container.querySelectorAll('[data-report-section]')]
      .map((h) => h.getAttribute('data-report-section') ?? '');

  const sectionEl = (view: ReturnType<typeof render>, key: string): Element => {
    const found = view.container.querySelector(`[data-report-section="${key}"]`);
    expect(found, `no ${key} section`).not.toBeNull();
    return found!;
  };

  it('runs what happened, what was there, who died, what it changed', async () => {
    const view = await openSheet(report());
    expect(sections(view)).toEqual([...order]);
  });

  it('puts the enemy board above everything the fight paid out', async () => {
    const view = await openSheet(report());
    const board = view.container.querySelector('[data-their-board]')!;
    const changed = sectionEl(view, 'changed');
    expect(board.compareDocumentPosition(changed) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  it('puts the rounds above it too', async () => {
    const view = await openSheet(report());
    const round = view.container.querySelector('[data-combat-round]')!;
    const changed = sectionEl(view, 'changed');
    expect(round.compareDocumentPosition(changed) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
  });

  /**
   * NOTHING ON THIS SHEET FOLDS. A report is read once, at the end of a bet the
   * commander has already paid for. Folding a section of it would be the
   * interaction-cost rule eating the decision-support rule it exists to serve.
   */
  it('hides none of it behind a tap', async () => {
    const view = await openSheet(report());
    expect(view.container.querySelectorAll('[aria-expanded]')).toHaveLength(0);
    expect(order).toHaveLength(4);
  });
});
