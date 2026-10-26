import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { reportsSchema } from '../src/api/schemas.js';
import { COMBAT, combatOutcomeTable } from '@astera/rules';
import i18n from '../src/i18n/index.js';
import { MonumentBattleRules } from '../src/screens/MonumentBattleRules.js';
import { getWikiArticle } from '../src/wiki/catalog.js';
import { conceptReference } from '../src/wiki/facts.js';
import { ReportScene } from '../src/v2/hud/ReportScene.js';
import { MonumentReportSheet } from '../src/screens/MonumentReportSheet.js';

const ordinary = { kind: 'BATTLE', id: 'battle', at: '2026-10-22T18:00:00Z', grade: 'REPELLED', attacking: true,
  opponentName: 'Opponent', opponentPlanet: 'Target', opponentPlanetId: 'target', yourPlanet: 'Home',
  yourFleet: { CORSAIR: 3 }, yourLosses: { CORSAIR: 1 }, theirLosses: {}, rounds: [],
  lootAlloy: 0, lootCrystal: 0, lootDeuterium: 0, dominion: 0, yourDamage: [], yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2 };
const monument = { kind: 'MONUMENT', id: 'monument-battle', at: '2026-10-22T18:00:00Z', grade: 'DECISIVE',
  monument: { id: 'monument', ordinal: 1, position: { x: 1, y: 2, z: 3 } }, attacking: false, control: 'ATTACKER',
  yourFleet: { CORSAIR: 1 }, yourSurvivors: { CORSAIR: 1 }, yourLosses: {}, theirLosses: {}, yourDamage: [],
  yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2, roundCount: 1, lootDeuterium: 0, dominion: 0 };

describe('own retreated ships remain distinct from battle deaths', () => {
  it.each([ordinary, monument])('preserves own retreats through the actual API parser: $kind', report => {
    expect(reportsSchema.parse({ rivals: [], reports: [report] }).reports[0]).toMatchObject({ yourRetreated: { CORSAIR: 1 }, theirRetreatedCount: 2 });
  });
  it('keeps old reports readable without claiming that they recorded retreats', () => {
    expect(reportsSchema.parse({ rivals: [], reports: [{ ...ordinary, yourRetreated: undefined }] }).reports[0])
      .toMatchObject({ yourRetreated: undefined });
  });
  it('shows retreat survival separately on an ordinary report', () => {
    const r = reportsSchema.parse({ rivals: [], reports: [ordinary] }).reports[0];
    if (!r || r.kind === 'MONUMENT' || r.kind === 'STRATEGIC') throw new Error('wrong fixture');
    render(<ReportScene report={r} />);
    expect(screen.getByText('Retreated alive: 1. These ships kept their hull damage.')).toBeVisible();
    expect(screen.getByText('Enemy ships that retreated and survived: 2.')).toBeVisible();
  });
  it('explains how a monument can be lost with a physical survivor', () => {
    const r = reportsSchema.parse({ rivals: [], reports: [monument] }).reports[0];
    if (r?.kind !== 'MONUMENT') throw new Error('wrong fixture');
    render(<MonumentReportSheet report={r} onClose={vi.fn()} />);
    expect(screen.getByText('Retreated alive: 1. These ships kept their hull damage.')).toBeVisible();
    expect(screen.getByText('Enemy ships that retreated and survived: 2.')).toBeVisible();
  });
});


describe('six-round public combat rules', () => {
  it.each(['en', 'tr', 'de', 'fr', 'es', 'ja'])('explains the last retreat round in %s', async language => {
    await i18n.changeLanguage(language);
    const { container } = render(<MonumentBattleRules />);
    expect(container.textContent).toContain(String(COMBAT.rounds));
    expect(container.textContent).toContain(String(COMBAT.rounds - 1));
    expect(container.textContent).not.toContain('{{');
    await i18n.changeLanguage('en');
  });
  /** Combat v3 (owner 2026-10-25): one target per shot, retreats after rounds 1–7, the owner's outcome table. */
  it.each(['en', 'tr'] as const)('publishes one target per shot, collector protection, the retreat rounds and the outcome table in %s', language => {
    const text = JSON.stringify(getWikiArticle('combat.model')?.sections[language]);
    expect(text).toMatch(language === 'en' ? /one living target/i : /tek bir canlı hedefe/i);
    expect(text).not.toMatch(language === 'en' ? /up to 10/i : /en fazla 10/i);
    expect(text).toMatch(language === 'en' ? /Garbage Collector/ : /Hurdacı/);
    expect(text).toContain(`1–${COMBAT.rounds - 1}`);
    const table = conceptReference('combat.model', language)?.blocks.find((block) =>
      block.kind === 'table' && block.rows.some((row) => row[0] === '1:2'));
    if (table?.kind !== 'table') throw new Error('Missing the outcome table');
    expect(table.rows).toHaveLength(combatOutcomeTable().length);
    const half = table.rows.find((row) => row[0] === '1:2')!;
    expect(half[1]).toMatch(/50/);
    expect(half[2]).toMatch(/30/);
  });

  it.each(['en', 'tr'] as const)('states the fleet escape on power, not resource value, in %s', language => {
    const text = JSON.stringify(getWikiArticle('combat.retreat')?.sections[language]);
    expect(text).not.toMatch(language === 'en' ? /resource value/i : /kaynak değeri/i);
    const blocks = JSON.stringify(conceptReference('combat.retreat', language));
    expect(blocks).toMatch(language === 'en' ? /power/i : /güç/i);
    expect(blocks).not.toMatch(language === 'en' ? /armed-unit value/i : /birimlerin değeri/i);
  });
});


it('opens all six monument rounds and keeps fifth-round escapes distinct from deaths', () => {
  const rounds = Array.from({ length: 6 }, (_, i) => ({ round: i + 1, yourLosses: i === 5 ? { CORSAIR: 1 } : {},
    theirLosses: {}, yourRetreated: i === 4 ? { CORSAIR: 1 } : {}, theirRetreatedCount: i === 4 ? 2 : 0 }));
  const parsed = reportsSchema.parse({ rivals: [], reports: [{ ...monument, roundCount: 6, rounds }] }).reports[0];
  if (parsed?.kind !== 'MONUMENT') throw new Error('wrong fixture');
  expect(parsed).toHaveProperty('rounds', rounds);
  render(<MonumentReportSheet report={parsed} onClose={vi.fn()} />);
  expect(document.querySelectorAll('[data-monument-round]')).toHaveLength(6);
  expect(document.querySelector('[data-monument-round="5"]')).toHaveTextContent('Retreated alive: 1.');
  expect(document.querySelector('[data-monument-round="6"]')).not.toHaveTextContent('Retreated alive');
});
