import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportsSchema, type StrategicBattleReport } from '../src/api/schemas.js';
import { StrategicReportSheet } from '../src/screens/BattleReports.js';
import { MonumentReportSheet } from '../src/screens/MonumentReportSheet.js';

/**
 * C17 (2026-11-15): the Death Star / radiation bomb result and the monument fight's report,
 * on the game kit. What the server decided is unchanged; only how it reads.
 */
const at = new Date('2026-08-26T12:00:00.000Z');
const strike = (over: Partial<StrategicBattleReport> = {}): StrategicBattleReport => ({
  kind: 'STRATEGIC', id: 's1', missionId: 'death-star-1', at, attacking: false,
  opponentName: 'Sable', opponentPlanet: 'Grimhold', opponentPlanetId: 'p2', yourPlanet: 'Vantage-3', yourPlanetId: 'p1',
  outcome: 'FIRST_STRIKE', damage: 12_000, shieldDestroyed: 800, trigger: null, loyalty: null,
  destroyedFleet: { DART: 5 }, destroyedResources: { alloy: 4_000, crystal: 2_000, deuterium: 500 },
  levelChanges: [{ kind: 'BUILDING', id: 'CORE', before: 6, after: 5 }, { kind: 'INSTRUMENT', id: 'AEGIS', before: 3, after: 1 }],
  destroyedOrders: [{ kind: 'BUILDING', subject: 'REFINERY', count: 1, cost: { alloy: 900, crystal: 400, deuterium: 0 } }],
  ...over,
});
/**
 * No page utility or v2 colour is left on the part: it is drawn by the kit alone. The Honor and
 * Dominion figures (`RankingScores`) are G9's number display and move to the kit with the ranking.
 */
const noLegacy = (node: Element) => {
  for (const el of [node, ...node.querySelectorAll('*')].filter((el) => !el.closest('[data-ranking-scores]'))) {
    expect(el.getAttribute('class') ?? '').not.toMatch(/rounded-control|text-v2-|border-v2-|bg-v2-|font-v2-|text-micro|text-caption|v2-legend/);
  }
};
const body = (selector: string) => {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`no ${selector}`);
  return node;
};

describe('the strategic report on the kit (C17)', () => {
  it('reads a Death Star hit as a threat plate of four figures, names in words, never ids', () => {
    render(<StrategicReportSheet report={strike()} onClose={vi.fn()} />);
    const report = body('[data-strategic-report]');
    expect(report).toHaveClass('gk-report');
    const plate = body('[data-strategic-verdict]');
    expect(plate).toHaveAttribute('data-tone', 'threat');
    expect(plate.querySelectorAll('.gk-report__figure')).toHaveLength(4);
    expect(screen.getByText('Command Core')).toBeVisible();
    expect(screen.getByText('Aegis')).toBeVisible();
    expect(screen.getByText('Alloy Refinery ×1')).toBeVisible();
    expect(screen.queryByText('CORE')).not.toBeInTheDocument();
    noLegacy(report);
  });

  it('colours the plate as a gain when it was your weapon that landed', () => {
    render(<StrategicReportSheet report={strike({ attacking: true })} onClose={vi.fn()} />);
    expect(body('[data-strategic-verdict]')).toHaveAttribute('data-tone', 'good');
  });

  it('opens both worlds through 44 px route doors', () => {
    const focus = vi.fn();
    render(<StrategicReportSheet report={strike()} onClose={vi.fn()} onFocusPlanet={focus} />);
    const door = screen.getByRole('button', { name: 'Grimhold' });
    expect(door).toHaveClass('gk-route__door');
    fireEvent.click(door);
    expect(focus).toHaveBeenCalledWith('p2');
    fireEvent.click(screen.getByRole('button', { name: 'Vantage-3' }));
    expect(focus).toHaveBeenCalledWith('p1');
  });

  it('states what a radiation bomb did, and keeps how bombs work one rules row away', () => {
    render(<StrategicReportSheet onClose={vi.fn()} report={strike({
      attacking: true, damage: 0, destroyedFleet: {}, levelChanges: [], destroyedOrders: [], loyalty: { before: 64, after: 44 },
      radiation: { level: 2, activeUntil: null, faults: ['REFINERY_OUTAGE'] },
      honor: { delta: 6_000_000, reason: 'TACTICAL' },
    })} />);
    const report = body('[data-strategic-report]');
    expect(screen.getByText('Colony loyalty 64% → 44%.')).toBeVisible();
    expect(report.querySelector('[data-report-loyalty]')).toHaveClass('gk-report__note');
    const rules = report.querySelector('details.gk-rules');
    expect(rules).not.toBeNull();
    expect(rules).not.toHaveAttribute('open');
    expect(within(rules as HTMLElement).getByText(/Each bomb creates 30 minutes of radiation/)).toBeInTheDocument();
    expect(within(rules as HTMLElement).getByText(/at most 2.5 Honor per bomb/)).toBeInTheDocument();
    noLegacy(report);
  });

  it('draws an interception and an EMP on the kit too', () => {
    const { unmount } = render(<StrategicReportSheet report={strike({ outcome: 'INTERCEPTED', trigger: 'RADAR', damage: 0 })} onClose={vi.fn()} />);
    expect(screen.getByText('Death Star destroyed in flight')).toBeVisible();
    noLegacy(body('[data-strategic-report]'));
    unmount();
    render(<StrategicReportSheet report={strike({ damage: 0, destroyedFleet: {}, loyalty: { before: 60, after: 40 } })} onClose={vi.fn()} />);
    expect(screen.getByText(/Aegis dropped to zero/)).toBeVisible();
    expect(body('[data-report-loyalty]')).toHaveClass('gk-well');
    noLegacy(body('[data-strategic-report]'));
  });
});

const monument = reportsSchema.parse({ rivals: [], reports: [{
  kind: 'MONUMENT', id: 'mb-3', at: at.toISOString(), attacking: true, grade: 'PARTIAL', control: 'DEFENDER', roundCount: 2,
  monument: { id: 'm-3', ordinal: 3, position: { x: 1, y: 2, z: 3 } },
  yourFleet: { DART: 12, ARGOSY: 2 }, yourSurvivors: { DART: 5, ARGOSY: 1 }, yourLosses: { DART: 7, ARGOSY: 1 }, yourDamage: [],
  theirFleet: { DART: 20 }, theirLosses: { DART: 12 }, lootDeuterium: 17, dominion: -123, enemyFleetVisibility: 'FULL',
  rounds: [
    { round: 1, yourLosses: { DART: 4 }, theirLosses: { DART: 6 }, yourRetreated: {}, theirRetreatedCount: 0 },
    { round: 2, yourLosses: { DART: 3, ARGOSY: 1 }, theirLosses: { DART: 6 }, yourRetreated: {}, theirRetreatedCount: 0 },
  ],
}] }).reports[0];

describe('the monument report on the kit (C17)', () => {
  const show = (focus = vi.fn(), close = vi.fn()) => {
    if (monument?.kind !== 'MONUMENT') throw new Error('wrong fixture');
    render(<MonumentReportSheet report={monument} onClose={close} onFocusMonument={focus} />);
    return body('[data-monument-report]');
  };

  it('opens on a partial plate and draws each own hull as a survivor row', () => {
    const report = show();
    expect(report).toHaveClass('gk-report');
    expect(body('[data-battle-outcome]')).toHaveClass('gk-report__verdict');
    expect(report.querySelectorAll('[data-own-hull]')).toHaveLength(2);
    expect(report.querySelector('[data-own-hull="DART"] .gk-survivor')).not.toBeNull();
    noLegacy(report);
  });

  it('keeps the rounds and the rules behind kit rules rows, closed until pressed', () => {
    const report = show();
    const rows = report.querySelectorAll('details.gk-rules');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) expect(row).not.toHaveAttribute('open');
    expect(report.querySelectorAll('[data-monument-round]')).toHaveLength(2);
  });

  it('closes on a kit door to the monument', () => {
    const focus = vi.fn();
    const close = vi.fn();
    show(focus, close);
    const look = screen.getByRole('button', { name: /Look at Ancient Observatory/i });
    expect(look).toHaveClass('gk-btn');
    fireEvent.click(look);
    expect(close).toHaveBeenCalled();
    expect(focus).toHaveBeenCalledWith('m-3');
  });
});
