import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../src/api/client.js';
import type { BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import { BattleReportDoor, reportFor } from '../src/screens/BattleReports.js';

/**
 * A BATTLE NOTIFICATION OPENS THE BATTLE. Owner instruction.
 *
 * D121 answered the same complaint one level too high: "you were raided" opened
 * the Intel centre, and the fix at the time was to make it land on the battles
 * shelf instead of the probe list. The reader still tapped ONE fight and got a
 * list with that fight somewhere in it. The door skips the room.
 *
 * THE TWO THINGS THAT MAKE IT SAFE are both asserted here. It must match the
 * pirate binder as well as the mission one, because a raid at a pirate has no
 * mission row (D150) — and it must never leave the reader looking at a blank
 * sheet, so a fight it cannot find hands back to the list rather than rendering
 * an empty one.
 */

const base: BattleReport = {
  id: 'b1',
  missionId: 'mission-b1',
  at: new Date('2026-08-26T12:00:00.000Z'),
  grade: 'DECISIVE',
  attacking: true,
  opponentName: 'Sable',
  opponentPlanet: 'Grimhold',
  opponentPlanetId: 'p2',
  neutral: false,
  yourPlanet: 'Vantage-3',
  rounds: [{
    round: 1,
    attackerDamage: 800,
    defenderDamage: 300,
    shieldAbsorbed: 0,
    shieldBreakerDamage: 0,
    attackerLosses: {},
    defenderLosses: { DART: 6 },
  }],
  yourLosses: {},
  theirLosses: { DART: 6 },
  yourFleet: { DART: 12 },
  /** Defender-only: the force that arrived. Empty on an attacker’s report. D164. */
  theirFleet: {},
  lootAlloy: 300,
  lootCrystal: 80,
  lootDeuterium: 0,
  dominion: 120,
  shieldAbsorbed: 0,
  cargoLimited: false,
  defenceSalvage: {},
  disruptedMinutes: 0,
  wreckValue: 0,
};

const report = (over: Partial<BattleReport> = {}): BattleReport => ({ ...base, ...over });

function open(missionId: string, reports: BattleReport[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports });
  const api = { reports: () => Promise.resolve({ reports }) } as unknown as Api;
  const onUnavailable = vi.fn();
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReportDoor
          missionId={missionId}
          onClose={onClose}
          onUnavailable={onUnavailable}
        />
      </ApiProvider>
    </QueryClientProvider>,
  );
  return { onUnavailable, onClose };
}

beforeEach(async () => {
  const i18n = (await import('../src/i18n/index.js')).default;
  await i18n.changeLanguage('en');
});

describe('the door a battle notification opens', () => {
  it('draws the report itself, with no list in front of it', async () => {
    const { onUnavailable } = open('mission-b1', [report()]);

    // The sheet, not a row: the grade is its title and the opponent its eyebrow.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Sable/)).toBeInTheDocument();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  /** D150: a raid at a pirate has no mission row, so its `refId` is the raid. */
  it('opens a pirate fight by the raid id its notification carries', async () => {
    const pirate = report({
      id: 'b2',
      // A pirate fight has no mission row at all, which is the whole reason the
      // notification's `refId` is the raid.
      missionId: undefined,
      pirateRaidId: 'raid-9',
      pirate: { level: 3, callsign: 'a1b2', damageMult: 1.3 },
    });
    const { onUnavailable } = open('raid-9', [pirate]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  /**
   * THE FALLBACK, AND IT IS THE REASON THE DESTINATION STILL NAMES A SHELF. A
   * report that is not in the list — a fight from a kind this build cannot match,
   * or a row the cache has not caught up with — hands the reader to the battles
   * list rather than to an empty sheet.
   */
  it('hands back to the list when the exact fight is not there', async () => {
    const { onUnavailable } = open('mission-nowhere', [report()]);

    await waitFor(() => {
      expect(onUnavailable).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  /** And it draws nothing at all while the answer is still unknown. */
  it('shows no sheet and no fallback before the reports have arrived', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const api = {
      reports: () => new Promise<never>(() => { /* never settles */ }),
    } as unknown as Api;
    const onUnavailable = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <ApiProvider api={api}>
          <BattleReportDoor
            missionId="mission-b1"
            onClose={vi.fn()}
            onUnavailable={onUnavailable}
          />
        </ApiProvider>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});

describe('which fight a notification names', () => {
  it('matches the mission binder and the pirate binder, and nothing else', () => {
    const ordinary = report();
    const pirateFight = report({
      id: 'b2',
      missionId: 'mission-b2',
      pirateRaidId: 'raid-9',
    });
    const all = [ordinary, pirateFight];

    expect(reportFor(all, 'mission-b1')?.id).toBe('b1');
    expect(reportFor(all, 'raid-9')?.id).toBe('b2');
    expect(reportFor(all, 'b1')).toBeUndefined();
    expect(reportFor([], 'mission-b1')).toBeUndefined();
  });
});
