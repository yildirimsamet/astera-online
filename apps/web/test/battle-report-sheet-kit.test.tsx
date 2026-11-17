import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { reportsSchema, type BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { BattleReportDoor, type ReportDoors } from '../src/screens/BattleReports.js';

/**
 * THE BATTLE REPORT ON THE KIT (G5 #3, C15). The sheet answers what happened, what was
 * there, who died and what it changed, in that order, each under the kit's section tag —
 * and then hands the reader the next move the fight made possible: the dossier it just
 * wrote to, the wreck it left, the world the raid came from.
 */

const round = (n: number, over: Record<string, unknown> = {}) => ({
  round: n, attackerDamage: 800, defenderDamage: 300, shieldAbsorbed: 0, shieldBreakerDamage: 0,
  attackerLosses: { DART: 2 }, defenderLosses: { PIKE: 4 }, ...over,
});

const raw = {
  kind: 'BATTLE', id: 'r-raid', missionId: 'm-raid', at: new Date(Date.now() - 20 * 60_000).toISOString(),
  grade: 'PARTIAL', attacking: true, opponentName: 'VEX', opponentPlanet: 'Kestrel', opponentPlanetId: 'p-kestrel',
  yourPlanet: 'Bellwether', yourPlanetId: 'p-1', neutral: false, rounds: [round(1), round(2)],
  yourFleet: { DART: 12, COURIER: 3 }, yourLosses: { DART: 4 }, theirFleet: {}, theirLosses: { PIKE: 8 },
  lootAlloy: 3_100, lootCrystal: 1_000, lootDeuterium: 240, dominion: 120,
  dominionBreakdown: { ruleVersion: 7, lootValue: 4_580, enemyPermanentLossValue: 9_200, ownPermanentLossValue: 4_100, rawExchange: 9_680 },
  shieldAbsorbed: 0, cargoLimited: true, defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 5_200,
  salvage: { alloy: 600, crystal: 240, deuterium: 0 },
  attackerClan: { id: 'c-1', name: 'Halo Watch', tag: 'HALO' }, defenderClan: { id: 'c-2', name: 'Nova Pact', tag: 'NOVA' },
};

const parse = (over: Record<string, unknown> = {}): BattleReport => {
  const [one] = reportsSchema.parse({ rivals: [], reports: [{ ...raw, ...over }] }).reports;
  if (!one || one.kind === 'STRATEGIC' || one.kind === 'MONUMENT') throw new Error('fixture is not a battle');
  return one;
};

const raid = parse();
const defence = parse({
  id: 'r-defend', missionId: 'm-defend', grade: 'REPELLED', attacking: false, opponentName: 'Sable',
  opponentPlanet: 'Tharsis', opponentPlanetId: 'p-tharsis', yourPlanet: 'Thistle-88', yourPlanetId: 'p-88',
  theirFleet: { VIPER: 22 }, theirLosses: { VIPER: 16 }, yourLosses: { DART: 4 }, yourFleet: { DART: 30 },
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, cargoLimited: false, wreckValue: 3_800, salvage: undefined,
});
const pirate = parse({
  id: 'r-pirate', missionId: null, pirateRaidId: 'raid-7', grade: 'DECISIVE', opponentName: 'Pirates',
  opponentPlanet: '', opponentPlanetId: null, pirate: { level: 2, callsign: 'Rook', damageMult: 0.7, capturedHull: null },
  wreckValue: 2_000, attackerClan: null, defenderClan: null,
});

function open(report: BattleReport, doors: ReportDoors = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [report], rivals: [] });
  const api = new Api({ fetch: () => Promise.resolve(new Response(JSON.stringify({ reports: [report], rivals: [] }))) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReportDoor missionId={report.missionId ?? report.pirateRaidId ?? report.id} onClose={() => undefined} onUnavailable={() => undefined} {...doors} />
      </ApiProvider>
    </QueryClientProvider>,
  );
  return screen.getByRole('dialog');
}

const section = (key: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-report-section="${key}"]`);
  if (!found) throw new Error(`no ${key} section`);
  return found;
};

/** A class the v1 and v2 sheets drew their type, colour and boxes with; none of them belongs on a kit surface. */
const V2 = [
  '.text-micro', '.text-caption', '.text-figure', '.text-label', '.text-title', '.text-dim', '.text-bone', '.socket',
  '.v2-legend', '.truncate', '.rounded-control', '.font-v2-mono', '[class*="v2-"]',
].join(', ');

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('the battle report on the kit', () => {
  // O6 (owner 2026-11-17, item 6): "Tüm verileri oyuncunun önüne yığmak =! oyuncuya sonucu iyi bir şekilde
  // sunduk." The scene says the result; each question under it is one shut fold, the next move stays open.
  it('asks each question as its own shut fold under the scene, then the next move', () => {
    open(raid, { onFocusPlanet: vi.fn(), onAttackAgain: vi.fn() });
    const keys = [...document.querySelectorAll('[data-report-section]')].map((el) => el.getAttribute('data-report-section'));
    expect(keys).toEqual(['happened', 'there', 'who', 'changed', 'now']);
    for (const key of ['happened', 'there', 'who', 'changed']) {
      const fold = section(key) as HTMLDetailsElement;
      expect(fold.tagName).toBe('DETAILS');
      expect(fold.open).toBe(false);
      expect(fold.querySelector('summary')?.textContent).not.toBe('');
    }
    expect(section('now').tagName).toBe('SECTION');
    expect(within(section('now')).getByRole('heading', { level: 2 })).toHaveTextContent('Your next move');
  });

  it('sums each fold on its head: the rounds fought, the Dominion it moved', () => {
    open(raid);
    expect(section('who').querySelector('summary')).toHaveTextContent('2 rounds');
    expect(section('changed').querySelector('summary')).toHaveTextContent('+120');
  });

  it('opens the rounds when Watch is pressed', async () => {
    open(raid);
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    await userEvent.click(screen.getByRole('button', { name: /watch/i }));
    expect((section('who') as HTMLDetailsElement).open).toBe(true);
    expect(scroll).toHaveBeenCalled();
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('names both ends of the fight as world doors a thumb can press', async () => {
    const focus = vi.fn();
    open(raid, { onFocusPlanet: focus });
    const route = document.querySelector<HTMLElement>('[data-report-route]');
    expect(route).not.toBeNull();
    const doors = within(route!).getAllByRole('button');
    expect(doors.map((door) => door.textContent)).toEqual(['Bellwether', 'Kestrel']);
    for (const door of doors) expect(door).toHaveClass('gk-route__door');
    await userEvent.click(doors[1]!);
    expect(focus).toHaveBeenCalledWith('p-kestrel');
    await userEvent.click(doors[0]!);
    expect(focus).toHaveBeenCalledWith('p-1');
  });

  it('writes the route as names when there is nowhere to fly, and one end when a pirate has no world', () => {
    open(raid);
    expect(within(document.querySelector<HTMLElement>('[data-report-route]')!).queryAllByRole('button')).toHaveLength(0);
    expect(document.querySelector('[data-report-route]')).toHaveTextContent('BellwetherKestrel');
    cleanup();
    open(pirate, { onFocusPlanet: vi.fn() });
    const route = document.querySelector<HTMLElement>('[data-report-route]')!;
    expect(within(route).getAllByRole('button').map((door) => door.textContent)).toEqual(['Bellwether']);
    expect(route.querySelector('[data-route-arrow]')).toBeNull();
  });

  it('sets why this word in a kit well, and a walkover in one too', () => {
    open(raid);
    expect(document.querySelector('[data-battle-reason]')).toHaveClass('gk-well');
    cleanup();
    open(parse({ rounds: [], grade: 'DECISIVE' }));
    expect(document.querySelector('[data-walkover]')).toHaveClass('gk-well');
  });

  // O6: the scene's own Attack again is the one door to it; the next moves keep what the scene lacks.
  it('hands the raider the wreck it left, the attack once and only on the scene', async () => {
    const focus = vi.fn();
    const again = vi.fn();
    open(raid, { onFocusPlanet: focus, onAttackAgain: again });
    const moves = within(section('now')).getAllByRole('button');
    expect(moves.map((move) => move.getAttribute('data-next-move'))).toEqual(['wreck']);
    expect(moves[0]).toHaveAccessibleName(/Go to the wreck: Kestrel/);
    expect(moves[0]).toHaveTextContent('5.2K');
    expect(screen.getAllByRole('button', { name: /attack again/i })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /attack again/i }));
    expect(again).toHaveBeenCalledWith('p-kestrel');
    await userEvent.click(moves[0]!);
    expect(focus).toHaveBeenCalledWith('p-kestrel');
  });

  it('hands the defender the world the raid came from, and the wreck over their own', async () => {
    const focus = vi.fn();
    open(defence, { onFocusPlanet: focus, onAttackAgain: vi.fn() });
    const moves = within(section('now')).getAllByRole('button');
    expect(moves.map((move) => move.getAttribute('data-next-move'))).toEqual(['source', 'wreck']);
    expect(moves[0]).toHaveAccessibleName(/Raider’s world: Tharsis/);
    expect(moves[1]).toHaveAccessibleName(/Go to the wreck: Thistle-88/);
    await userEvent.click(moves[0]!);
    expect(focus).toHaveBeenCalledWith('p-tharsis');
    await userEvent.click(moves[1]!);
    expect(focus).toHaveBeenCalledWith('p-88');
  });

  it('offers no next move it cannot open: no doors, no section; a pirate wreck orbits nothing', () => {
    open(raid);
    expect(document.querySelector('[data-report-section="now"]')).toBeNull();
    cleanup();
    open(pirate, { onFocusPlanet: vi.fn(), onAttackAgain: vi.fn() });
    expect(document.querySelector('[data-report-section="now"]')).toBeNull();
  });

  it('draws what happened, what it changed and the next move with kit parts only', () => {
    open(raid, { onFocusPlanet: vi.fn(), onAttackAgain: vi.fn() });
    for (const key of ['happened', 'changed', 'now']) {
      const stray = [...section(key).querySelectorAll(V2)].map((el) => `${el.tagName}.${el.className}`);
      expect(stray, key).toEqual([]);
    }
  });
});
