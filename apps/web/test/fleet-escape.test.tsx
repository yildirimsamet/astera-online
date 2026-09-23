import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { MULTI_WORLD, escapeFuel, type Fleet } from '@astera/rules';
import type { Api } from '../src/api/client.js';
import { reportsSchema, seasonSchema, type BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import { describeNotification } from '../src/lib/notifications.js';
import { BattleReports } from '../src/screens/BattleReports.js';
import { EscapeReadout } from '../src/ui/EscapeReadout.js';
import { ForceCompare } from '../src/ui/ForceCompare.js';
import i18n from '../src/i18n/index.js';

/**
 * TAKTİK GERİ ÇEKİLME ON THE SCREEN. Owner decision, 2026-09-23.
 *
 * The four questions, one surface each:
 *
 *   · the DEFENDER'S planet says at what firepower their ships run and whether the
 *     tank can pay for it — before any raid, so the rule is a plan and not a surprise;
 *   · the RAIDER'S launch sheet draws the line on the axis it already compares on, and
 *     says what the reading implies — never what the truth is;
 *   · the REPORT tells each side what it saw: the defender what ran and what it
 *     burned, or that the tank was dry; the raider only that the ships ran;
 *   · the NOTIFICATION says it in a clause, so "−0 units lost" is never the only
 *     thing a defender reads after their fleet survived a raid ten times its size.
 */

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

const LINE: Fleet = { DART: 20 };
const LIFT = escapeFuel(LINE);

const base: BattleReport = {
  id: 'e1',
  missionId: 'mission-e1',
  at: new Date('2026-09-23T12:00:00.000Z'),
  grade: 'DECISIVE',
  attacking: false,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  rounds: [],
  yourLosses: {},
  theirLosses: {},
  yourFleet: {},
  theirFleet: { DART: 60 },
  lootAlloy: -300,
  lootCrystal: -80,
  lootDeuterium: 0,
  dominion: -380,
  dominionBreakdown: null,
  shieldAbsorbed: 0,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
};

async function openReport(over: Partial<BattleReport>) {
  const one = { ...base, ...over };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [one] });
  const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReports />
      </ApiProvider>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole('button', { name: /Sable/ }));
  return document.querySelector('[data-fleet-escape]');
}

describe('the payload', () => {
  it('reads the season it was dealt', () => {
    const season = seasonSchema.parse({
      seasonId: 's', shard: 'EU-1', seed: 1, status: 'ACTIVE',
      startsAt: '2026-09-23T00:00:00Z', endsAt: '2026-10-07T00:00:00Z',
      playerCap: 300, players: 1, rulesetVersion: MULTI_WORLD.fleetEscapeRulesetVersion,
    });
    expect(season.rulesetVersion).toBe(MULTI_WORLD.fleetEscapeRulesetVersion);
  });

  it('keeps the defender’s full record, the raider’s bare one, and a legacy row without either', () => {
    const parsed = reportsSchema.parse({
      reports: [
        { ...base, fleetEscape: { kind: 'ESCAPED', ships: LINE, fuel: LIFT } },
        { ...base, fleetEscape: { kind: 'STRANDED', ships: LINE, fuel: LIFT, available: 3 } },
        { ...base, attacking: true, fleetEscape: { kind: 'ESCAPED' } },
        { ...base, fleetEscape: null },
        base,
      ],
      rivals: [],
    });
    const escapes = parsed.reports.map((row) => ('fleetEscape' in row ? row.fleetEscape ?? null : null));
    expect(escapes).toEqual([
      { kind: 'ESCAPED', ships: LINE, fuel: LIFT },
      { kind: 'STRANDED', ships: LINE, fuel: LIFT, available: 3 },
      { kind: 'ESCAPED' },
      null,
      null,
    ]);
  });
});

describe('the battle report', () => {
  it('tells the defender how many ships ran and what the lift burned', async () => {
    const line = await openReport({ fleetEscape: { kind: 'ESCAPED', ships: LINE, fuel: LIFT } });
    expect(line).not.toBeNull();
    expect(line).toHaveTextContent('20');
    expect(line).toHaveTextContent(String(LIFT));
    expect(line).toHaveTextContent(/lifted off/i);
  });

  it('tells a stranded defender what the lift needed and what the tank held', async () => {
    const line = await openReport({
      grade: 'DECISIVE',
      yourLosses: LINE,
      fleetEscape: { kind: 'STRANDED', ships: LINE, fuel: LIFT, available: 3 },
    });
    expect(line).toHaveTextContent(String(LIFT));
    expect(line).toHaveTextContent('3');
    expect(line).toHaveTextContent(/tank/i);
  });

  it('tells the raider only that the ships ran', async () => {
    const line = await openReport({ attacking: true, fleetEscape: { kind: 'ESCAPED' } });
    expect(line).toHaveTextContent(/lifted off/i);
    expect(line).not.toHaveTextContent(String(LIFT));
    expect(line).not.toHaveTextContent('20');
  });

  it('never shows a raider a dry tank, even if a payload carried one', async () => {
    const line = await openReport({
      attacking: true,
      fleetEscape: { kind: 'STRANDED', ships: LINE, fuel: LIFT, available: 0 },
    });
    expect(line).toBeNull();
  });

  it('says nothing on a fight the rule never came into, or on a legacy row', async () => {
    expect(await openReport({ fleetEscape: null })).toBeNull();
  });
});

describe('the notifications', () => {
  const NOW = new Date('2026-09-23T12:00:00Z').getTime();
  const say = (kind: string, payload: unknown): string | null =>
    describeNotification({ id: 'n', seen: false, at: new Date(NOW), kind, payload }, NOW);
  const raided = { grade: 'DECISIVE', lootAlloy: 300, lootCrystal: 80, lootDeuterium: 0, unitsLost: 0 };

  it('tells the defender their ships ran', () => {
    expect(say('raided', { ...raided, escape: 'ESCAPED', escapeShips: 20 })).toMatch(/20 ships lifted off/);
  });

  it('tells a stranded defender the tank was dry', () => {
    expect(say('raided', { ...raided, unitsLost: 20, escape: 'STRANDED', escapeShips: 20 }))
      .toMatch(/tank/i);
  });

  it('tells the raider the line emptied in front of it', () => {
    expect(say('raid_result', {
      grade: 'DECISIVE', targetUsername: 'Sable', targetPlanetName: 'Grimhold',
      lootAlloy: 300, lootCrystal: 80, lootDeuterium: 0, unitsLost: 0, shipsHome: 80,
      targetFled: true,
    })).toMatch(/lifted off/i);
  });

  it('reads a payload from before the rule exactly as it did', () => {
    expect(say('raided', raided)).not.toMatch(/lifted off|tank/i);
  });
});

describe('the launch sheet’s comparison', () => {
  const theirs = { low: 4_000, high: 9_000, source: 'Probe', ageMinutes: 12 };
  const lines = { clears: { low: 20_000, high: 30_000 }, breaks: { low: 35_000, high: 45_000 } };

  it('draws the escape line on the enemy axis and says what the reading implies', () => {
    const view = render(
      <ForceCompare yours={30_000} theirs={theirs} lines={lines} escape={{ at: 10_000, verdict: 'RUN' }} />,
    );
    const marker = view.container.querySelector<HTMLElement>('[data-part="escape-line"]');
    expect(marker).not.toBeNull();
    expect(Number.parseFloat(marker!.style.left)).toBeCloseTo((10_000 / 30_000) * 100, 4);
    expect(screen.getByTestId('compare-escape')).toHaveTextContent(/lift off/i);
  });

  it('says they stand, or that it is open, in the same place', () => {
    const { rerender } = render(
      <ForceCompare yours={30_000} theirs={theirs} lines={lines} escape={{ at: 10_000, verdict: 'STAND' }} />,
    );
    expect(screen.getByTestId('compare-escape')).toHaveTextContent(/stand/i);
    rerender(
      <ForceCompare yours={30_000} theirs={theirs} lines={lines} escape={{ at: 10_000, verdict: 'UNSURE' }} />,
    );
    expect(screen.getByTestId('compare-escape')).toHaveTextContent(/may/i);
  });

  it('draws nothing where the rule does not apply', () => {
    const view = render(<ForceCompare yours={30_000} theirs={theirs} lines={lines} />);
    expect(view.container.querySelector('[data-part="escape-line"]')).toBeNull();
    expect(screen.queryByTestId('compare-escape')).toBeNull();
  });

  it('keeps the rule one tap deeper, beside the others', async () => {
    render(<ForceCompare yours={30_000} theirs={theirs} lines={lines} escape={{ at: 10_000, verdict: null }} />);
    await userEvent.click(screen.getByRole('button', { name: /what is this/i }));
    expect(screen.getByTestId('compare-escape-rule')).toHaveTextContent(/three times/i);
  });
});

describe('the defender’s own readout', () => {
  it('states the firepower their ships run from and whether the tank can pay', () => {
    render(<EscapeReadout fleet={{ ...LINE, PROSPECTOR: 2 }} ground={{}} deuterium={500} />);
    const line = screen.getByTestId('escape-readout');
    // Three times the line's 9,360 firepower.
    expect(line).toHaveTextContent('28k');
    expect(line).toHaveTextContent(String(LIFT));
  });

  it('counts the guns in the line, because the rule does', () => {
    render(<EscapeReadout fleet={LINE} ground={{ BASTION: 2 }} deuterium={500} />);
    // (9,360 + 6,000) × 3
    expect(screen.getByTestId('escape-readout')).toHaveTextContent('46k');
  });

  it('warns when the tank cannot pay for the lift', () => {
    render(<EscapeReadout fleet={LINE} ground={{}} deuterium={LIFT - 1} />);
    expect(screen.getByTestId('escape-readout')).toHaveAttribute('data-short', '');
  });

  it('has nothing to say about a world with no ships to lift', () => {
    const view = render(<EscapeReadout fleet={{ PROSPECTOR: 2 }} ground={{ BASTION: 4 }} deuterium={500} />);
    expect(view.container).toBeEmptyDOMElement();
  });
});
