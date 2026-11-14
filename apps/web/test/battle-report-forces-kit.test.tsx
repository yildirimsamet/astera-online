import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../src/api/client.js';
import { reportsSchema, type BattleReport } from '../src/api/schemas.js';
import { ApiProvider } from '../src/api/context.js';
import i18n from '../src/i18n/index.js';
import { BattleReportDoor } from '../src/screens/BattleReports.js';
import { reports as de } from '../src/i18n/locales/de/intel.js';
import { reports as en } from '../src/i18n/locales/en/intel.js';
import { reports as es } from '../src/i18n/locales/es/intel.js';
import { reports as ja } from '../src/i18n/locales/ja/intel.js';

/**
 * WHAT WAS THERE, AND WHO DIED WHEN, ON THE KIT (G5 #3, C15b). The two questions a commander
 * comes home with are read off the same rows on both sides of the fight — a hull, what went
 * in, what died — and the rounds are one ledger, each with its arithmetic one press away.
 */

const round = (n: number, over: Record<string, unknown> = {}) => ({
  round: n, attackerRoll: 1.04, defenderRoll: 0.97, attackerDamage: 8_400, defenderDamage: 3_100,
  shieldBefore: 2_400, shieldAfter: 600, shieldAbsorbed: 1_800, shieldBreakerDamage: 0, attackerHullDamage: 6_600,
  attackerLosses: { DART: 6 }, defenderLosses: { PIKE: 10 }, ...over,
});

const raw = {
  kind: 'BATTLE', id: 'r-raid', missionId: 'm-raid', at: new Date(Date.now() - 20 * 60_000).toISOString(),
  grade: 'PARTIAL', attacking: true, enemyFleetVisibility: 'FULL', opponentName: 'VEX', opponentPlanet: 'Kestrel',
  opponentPlanetId: 'p-kestrel', yourPlanet: 'Bellwether', yourPlanetId: 'p-1', neutral: false,
  rounds: [round(1), round(2, { shieldBefore: 600, shieldAfter: 0, shieldAbsorbed: 600, distributedFire: true, targetLimit: 1, yourRetreated: { DART: 2 } })],
  yourFleet: { DART: 23, TALON: 19, COURIER: 8 }, yourLosses: { DART: 12 }, theirFleet: { PIKE: 30, BASTION: 4 },
  theirLosses: { PIKE: 20 }, lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0, dominionBreakdown: null,
  shieldAbsorbed: 2_400, shieldBefore: 2_400, shieldAfter: 0, cargoLimited: false, defenceSalvage: {}, yourDamage: [],
  disruptedMinutes: 0, wreckValue: 0,
};

const parse = (over: Record<string, unknown> = {}): BattleReport => {
  const [one] = reportsSchema.parse({ rivals: [], reports: [{ ...raw, ...over }] }).reports;
  if (!one || one.kind === 'STRATEGIC' || one.kind === 'MONUMENT') throw new Error('fixture is not a battle');
  return one;
};

function open(report: BattleReport) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [report], rivals: [] });
  const api = new Api({ fetch: () => Promise.resolve(new Response(JSON.stringify({ reports: [report], rivals: [] }))) });
  render(
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <BattleReportDoor missionId={report.missionId ?? report.id} onClose={() => undefined} onUnavailable={() => undefined} />
      </ApiProvider>
    </QueryClientProvider>,
  );
}

const section = (key: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-report-section="${key}"]`);
  if (!found) throw new Error(`no ${key} section`);
  return found;
};

/** A class the v1 and v2 sheets drew their type, colour and boxes with; none of them belongs on a kit surface. */
const STRAY = [
  '.text-micro', '.text-caption', '.text-figure', '.text-label', '.text-title', '.text-dim', '.text-bone', '.socket',
  '.v2-legend', '.truncate', '.rounded-control', '.rounded-cell', '.rounded-chip', '.font-v2-mono', '[class*="v2-"]',
  '[class*="border-"]', '[class*="bg-"]',
].join(', ');

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('forces and rounds on the kit', () => {
  it('draws what was there and who died with kit parts only, on attack and on defence', () => {
    open(parse());
    for (const key of ['there', 'who']) {
      expect([...section(key).querySelectorAll(STRAY)].map((el) => `${el.tagName}.${el.className}`), key).toEqual([]);
    }
    cleanup();
    open(parse({ attacking: false, enemyFleetVisibility: undefined, theirFleet: { VIPER: 22 }, theirLosses: { VIPER: 16 },
      defenceSalvage: { BASTION: 1 }, yourFleet: { DART: 30, BASTION: 4 }, yourLosses: { DART: 4, BASTION: 2 } }));
    for (const key of ['there', 'who']) {
      expect([...section(key).querySelectorAll(STRAY)].map((el) => `${el.tagName}.${el.className}`), key).toEqual([]);
    }
  });

  it('reads both sides off the same kit force rows', () => {
    open(parse());
    const theirs = section('there').querySelectorAll('.gk-force');
    const yours = section('who').querySelectorAll('.gk-force');
    expect(theirs.length).toBeGreaterThan(0);
    expect(yours.length).toBe(4); // three hulls and the total
    // A hull is one compact row: its figures on one line beside the picture, not a card each.
    for (const row of [...theirs, ...yours]) {
      expect(row.querySelector('.gk-survivor'), row.textContent).toHaveAttribute('data-compact');
    }
  });

  it('puts the rounds in one kit ledger, each round’s arithmetic behind a kit rules row', async () => {
    open(parse());
    const rounds = section('who').querySelector('.gk-ledger.gk-rounds');
    expect(rounds).not.toBeNull();
    const first = rounds!.querySelector<HTMLElement>('[data-combat-round="1"]')!;
    const toggle = first.querySelector('details');
    expect(toggle).toHaveClass('gk-rules');
    expect(toggle?.querySelector('summary')).toHaveClass('gk-rules__head');
    await userEvent.click(within(first).getByText(i18n.t('reports.roundCalculationToggle')));
    expect(toggle).toHaveAttribute('open');
  });

  it('keeps the battle rules and the fire rules one kit rules row away', () => {
    open(parse());
    const rules = screen.getByText('Battle rules and calculation').closest('details');
    expect(rules).toHaveClass('gk-rules');
    expect(rules).not.toHaveAttribute('open');
    expect(document.querySelector('[data-distributed-fire-rules]')).toHaveClass('gk-rules');
  });

  it('sets the Aegis in a kit well with its state stated, not coloured in', () => {
    open(parse());
    const status = section('there').querySelector('[data-aegis-status]');
    expect(status).toHaveAttribute('data-aegis-status', 'roundedZero');
    expect(status?.closest('.gk-well')).not.toBeNull();
  });

  /*
    A FORCE ROW'S WORDS ARE READ IN EVERY LANGUAGE. German said "Links" and Spanish
    "Izquierda" for what is left — the direction, not the remainder; the Aegis states were
    English in both, and Japanese called a held shield "in session".
  */
  it('names what is left and the Aegis state in each language’s own words', () => {
    expect(de.force.left).toBe('Übrig');
    expect(es.force.left).toBe('Quedan');
    expect(es.verdict.returned).toBe('Sobreviven');
    expect(ja.verdict.sent).toBe('投入');
    expect(ja.verdict.lost).toBe('喪失');
    for (const lang of [de, es]) {
      for (const state of ['broken', 'damaged', 'held'] as const) {
        expect(lang.aegis[state]).not.toBe(en.aegis[state]);
      }
    }
    expect(ja.aegis.held).toBe('健在');
  });
});
