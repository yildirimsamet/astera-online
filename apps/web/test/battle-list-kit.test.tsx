import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { reportsSchema, type Report } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { BattleReports } from '../src/screens/BattleReports.js';

/**
 * THE BATTLES SHELF ON THE KIT (G5 #1, C14). A list of fights is a list of doors to their
 * reports: one row, one press, the outcome in its colour before a word is read, who it was
 * against, and what it moved on the ladder — in a line, not a column of labels.
 */

const at = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const round = { round: 1, attackerDamage: 800, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: {}, defenderLosses: { DART: 6 } };
const ordinary = {
  neutral: false, rounds: [round, { ...round, round: 2 }, { ...round, round: 3 }],
  yourLosses: {}, theirLosses: { DART: 6 }, yourFleet: { DART: 12 }, theirFleet: {},
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0, shieldAbsorbed: 0, cargoLimited: false,
  defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0,
};
const reports: Report[] = reportsSchema.parse({ rivals: [], reports: [
  { ...ordinary, id: 'b-raid', missionId: 'm-raid', at: at(20), grade: 'PARTIAL', attacking: true,
    opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-kestrel', yourPlanet: 'Bellwether', yourPlanetId: 'p-1',
    defenderClan: { id: 'c-1', tag: 'NOVA', name: 'Nova Drift' }, dominion: 120, honor: { delta: 38_000_000, reason: 'COMBAT' } },
  { ...ordinary, id: 'b-held', missionId: 'm-held', at: at(180), grade: 'REPELLED', attacking: false,
    opponentName: 'Rook', opponentPlanet: 'Hollow', opponentPlanetId: 'p-hollow', yourPlanet: 'Bellwether', yourPlanetId: 'p-1' },
  { kind: 'STRATEGIC', id: 's-colony', missionId: 'm-colony', at: at(26 * 60), attacking: true,
    opponentName: 'Sable', opponentPlanet: 'Tharsis', opponentPlanetId: 'p2', yourPlanet: 'Thistle', yourPlanetId: 'p-1',
    outcome: 'FIRST_STRIKE', damage: 18_400, destroyedFleet: {}, destroyedResources: { alloy: 0, crystal: 0, deuterium: 0 },
    levelChanges: [], destroyedOrders: [], shieldDestroyed: 1_800, trigger: null, loyalty: { before: 18, after: 0 } },
  { kind: 'MONUMENT', id: 'battle-3', at: at(2 * 24 * 60), attacking: true, grade: 'PARTIAL', control: 'DEFENDER', roundCount: 5,
    monument: { id: '00000000-0000-4000-8000-000000000003', ordinal: 3, position: { x: 6000, y: 410, z: -500 } },
    yourFleet: { CITADEL: 3 }, yourSurvivors: { CITADEL: 2 }, yourLosses: { CITADEL: 1 }, yourDamage: [], theirLosses: { DART: 12 },
    lootDeuterium: 17, dominion: -123 },
] }).reports;

function show(list: Report[], focus: ((planetId: string) => void) | null = () => undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: list });
  const api = new Api({ fetch: () => Promise.resolve(new Response(JSON.stringify({ reports: list, rivals: [] }))) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReports {...(focus ? { onFocusPlanet: focus } : {})} />
      </ApiProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('the battles shelf on the kit', () => {
  it('lists every fight as a kit ledger row whose door is its report', () => {
    show(reports);
    const list = screen.getByRole('list', { name: 'Battle reports' });
    expect(list).toHaveClass('gk-ledger');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row.querySelector('[data-report-row]')).toHaveClass('gk-ledger__row');
  });

  /** The world a fight was at keeps its own door (it always had one), now a 44 px seam under the row. */
  it('gives the world a fight was at its own door under the row, and names it once', async () => {
    const focus = vi.fn();
    show(reports, focus);
    const [raid, held, strike, monument] = screen.getAllByRole('listitem');
    const world = within(raid!).getByRole('button', { name: 'Kestrel' });
    expect(world).toHaveClass('gk-ledger__seam');
    expect(raid!.querySelector('[data-report-row]')).not.toHaveTextContent('Kestrel');
    await userEvent.click(world);
    expect(focus).toHaveBeenLastCalledWith('p-kestrel');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(held!).getByRole('button', { name: 'Bellwether' })).toHaveClass('gk-ledger__seam');
    expect(within(strike!).getByRole('button', { name: 'Tharsis' })).toHaveClass('gk-ledger__seam');
    expect(within(monument!).getAllByRole('button')).toHaveLength(1);
  });

  it('names the world in plain words when there is no way to fly there', () => {
    show(reports, null);
    const [raid] = screen.getAllByRole('listitem');
    expect(within(raid!).getAllByRole('button')).toHaveLength(1);
    expect(raid).toHaveTextContent('Kestrel');
  });

  it('marks each outcome in its colour, then says who it was against', () => {
    show(reports);
    const [raid, held, strike, monument] = screen.getAllByRole('listitem');
    expect(raid!.querySelector('.gk-battle__mark')).toHaveAttribute('data-tone', 'partial');
    expect(held!.querySelector('.gk-battle__mark')).toHaveAttribute('data-tone', 'win');
    // a strike reads from your side: yours landed (a win); one that hit you would be a loss
    expect(strike!.querySelector('.gk-battle__mark')).toHaveAttribute('data-tone', 'win');
    expect(monument!.querySelector('.gk-battle__mark')).toHaveAttribute('data-tone', 'partial');
    expect(raid!.querySelector('.gk-ledger__title')).toHaveTextContent(/You raided.*\[NOVA\].*VEX/);
    expect(strike!.querySelector('.gk-ledger__title')).toHaveTextContent(/Sable/);
  });

  it('never cuts a line short', () => {
    show(reports);
    expect(screen.getByRole('list', { name: 'Battle reports' }).querySelector('.truncate')).toBeNull();
  });

  it('reads what a fight moved on the ladder in one line, named for a reader', () => {
    show(reports);
    const [raid, held] = screen.getAllByRole('listitem');
    expect(raid!.querySelector('[data-battle-honor]')).toHaveTextContent('Honor+38');
    expect(raid!.querySelector('[data-battle-dominion]')).toHaveTextContent('+120');
    // a swing of zero moves nobody's score, so it has no figure
    expect(held!.querySelector('[data-battle-dominion]')).toBeNull();
  });

  it('says how the shelf fills when nothing has been fought yet', () => {
    show([]);
    const empty = document.querySelector('.gk-empty');
    expect(empty).not.toBeNull();
    expect(empty).toHaveTextContent('No battles yet');
    expect(empty).toHaveTextContent(/never a guess/);
  });
});
