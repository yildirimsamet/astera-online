import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { reportsSchema } from '../src/api/schemas.js';
import { BattleReportDoor } from '../src/screens/BattleReports.js';
import { ReportScene } from '../src/v2/hud/ReportScene.js';

const report = (over: Record<string, unknown> = {}) => ({
  kind: 'BATTLE', id: 'recent-report', missionId: 'recent-flight',
  at: '2026-10-11T05:37:22Z', grade: 'PARTIAL', attacking: true,
  opponentName: 'yasin', opponentPlanet: 'Target', opponentPlanetId: 'target',
  yourPlanet: 'Home', yourFleet: { CATACLYSM: 3 }, yourLosses: {}, theirLosses: {},
  rounds: [], lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0,
  yourDamage: [], ...over,
});

const fractional = { hull: 'CATACLYSM', count: 1, damageBp: 0, remainderBp: 0.8857506709106965 };
const history = () => ({ rivals: [], reports: [report(), report({
  id: 'earlier-report', missionId: 'earlier-flight', at: '2026-10-10T09:33:59Z',
  opponentName: 'Earlier opponent', yourDamage: [fractional],
})] });

const apiFor = (body: unknown) => new Api({ fetch: vi.fn(() => Promise.resolve(
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }),
)) });

const parse = (lots: unknown) => reportsSchema.parse({
  rivals: [], reports: [report({ yourDamage: lots })],
}).reports[0];

describe('battle reports with fractional HP damage', () => {
  it('keeps the newest report readable when an older report carries less than one basis point of damage', async () => {
    const result = await apiFor(history()).reports();
    expect(result.reports.map(row => row.id)).toEqual(['recent-report', 'earlier-report']);
    expect(result.reports[1]).toMatchObject({ yourDamage: [fractional] });
  });

  it('opens the notified battle through the real API parser with fractional damage elsewhere in the list', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onUnavailable = vi.fn();
    render(<QueryClientProvider client={client}><ApiProvider api={apiFor(history())}>
      <BattleReportDoor missionId="recent-flight" onClose={vi.fn()} onUnavailable={onUnavailable} />
    </ApiProvider></QueryClientProvider>);

    const dialog = await screen.findByRole('dialog');
    expect(dialog.querySelector('header')).toHaveTextContent('yasin');
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it.each([
    [0, Number.MIN_VALUE], [0, 0.8857506709106965], [0, 0],
    [2000, 0], [2000, Number.MIN_VALUE], [9999, 0.9999999999999999],
  ])('preserves valid damage components %s + %s', (damageBp, remainderBp) => {
    const lot = { ...fractional, damageBp, remainderBp };
    expect(parse([lot])).toMatchObject({ yourDamage: [lot] });
  });

  it('keeps legacy whole-basis-point damage and omitted damage readable', () => {
    const legacy = { hull: 'DART', count: 2, damageBp: 1200 };
    expect(parse([legacy])).toMatchObject({ yourDamage: [legacy] });
    expect(reportsSchema.parse({ rivals: [], reports: [report({ yourDamage: undefined })] }).reports[0])
      .toMatchObject({ yourDamage: [] });
  });

  it.each([
    { damageBp: -1 }, { damageBp: 0.5 }, { damageBp: 10000 }, { damageBp: Infinity },
    { remainderBp: -0.1 }, { remainderBp: 1 }, { remainderBp: NaN }, { remainderBp: Infinity },
    { remainderBp: null }, { remainderBp: '0.5' },
    { count: 0 }, { count: -1 }, { count: 1.5 }, { hull: 'UNKNOWN' },
  ])('rejects invalid damage without weakening the report boundary: %j', over => {
    expect(reportsSchema.safeParse({
      rivals: [], reports: [report({ yourDamage: [{ ...fractional, damageBp: 2000, ...over }] })],
    }).success).toBe(false);
  });

  it.each([0.8857506709106965, Number.MIN_VALUE])('shows positive damage below one basis point: %s', remainderBp => {
    const parsed = parse([{ ...fractional, remainderBp }]);
    if (!parsed || parsed.kind === 'STRATEGIC' || parsed.kind === 'MONUMENT') throw new Error('Expected a battle');
    render(<ReportScene report={parsed} />);
    expect(document.querySelector('[data-report-damage]')).toHaveTextContent('Cataclysm ×1 · 1% damage');
  });

  it('keeps distinct HP lots of the same hull and integer damage as separate rows', () => {
    const consoleError = vi.spyOn(console, 'error');
    const parsed = parse([
      { ...fractional, damageBp: 2000, remainderBp: 0.25 },
      { ...fractional, damageBp: 2000, remainderBp: 0.75 },
    ]);
    if (!parsed || parsed.kind === 'STRATEGIC' || parsed.kind === 'MONUMENT') throw new Error('Expected a battle');
    render(<ReportScene report={parsed} />);
    expect(within(document.querySelector<HTMLElement>('[data-report-damage]')!).getAllByRole('listitem')).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each([0.5, Number.MIN_VALUE])('sends fractional damage above the free repair boundary to the dock: %s', remainderBp => {
    const parsed = reportsSchema.parse({ rivals: [], reports: [report({
      attacking: false,
      yourDamage: [
        { hull: 'CATACLYSM', count: 1, damageBp: 2000, remainderBp },
        { hull: 'DART', count: 1, damageBp: 2000, remainderBp: 0 },
      ],
    })] }).reports[0];
    if (!parsed || parsed.kind === 'STRATEGIC' || parsed.kind === 'MONUMENT') throw new Error('Expected a battle');
    render(<ReportScene report={parsed} />);

    const rows = within(document.querySelector<HTMLElement>('[data-report-damage]')!).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Cataclysm ×1 · 21% damage');
    expect(rows[0]).toHaveTextContent('Repair Station');
    expect(rows[1]).toHaveTextContent('Dart ×1 · 20% damage');
    expect(rows[1]).toHaveTextContent('patched free');
  });
});
