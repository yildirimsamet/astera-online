import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import type { BattleReport } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { BattleReports } from '../src/screens/BattleReports.js';

const base: BattleReport = {
  id: 'b1', missionId: 'm1', at: new Date('2026-11-05T12:00:00.000Z'), grade: 'PARTIAL', attacking: true,
  opponentName: 'OP-1', opponentPlanet: 'OP-1', opponentPlanetId: 'site-1', neutral: true, yourPlanet: 'Newcomer',
  rounds: [{ round: 1, attackerDamage: 80, defenderDamage: 30, shieldAbsorbed: 0, shieldBreakerDamage: 0, attackerLosses: {}, defenderLosses: { DART: 1 } }],
  yourLosses: {}, theirLosses: { DART: 1 }, yourFleet: { DART: 4 }, theirFleet: {},
  lootAlloy: 36, lootCrystal: 24, lootDeuterium: 0, dominion: null, shieldAbsorbed: 0, cargoLimited: true,
  defenceSalvage: {}, yourDamage: [{ hull: 'DART', count: 1, damageBp: 6600 }], disruptedMinutes: 0, wreckValue: 0,
};

async function open(one: BattleReport, row: RegExp) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['reports'], { reports: [one] });
  const api = { reports: () => Promise.resolve({ reports: [one] }) } as unknown as Api;
  render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
  const list = document.body.textContent;
  await userEvent.click(screen.getByRole('button', { name: row }));
  return { list, sheet: document.body.textContent };
}

beforeEach(async () => { await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('a report read aboard a ship', () => {
  it('calls an outpost an outpost, in the list and in the sheet', async () => {
    const { list, sheet } = await open({ ...base, opponentKind: 'OUTPOST' }, /abandoned outpost/i);
    expect(list).toMatch(/You raided an abandoned outpost/i);
    expect(sheet).not.toMatch(/unclaimed world|on that world/i);
  });

  it('asks for the only cargo ship this galaxy builds', async () => {
    const { sheet } = await open({ ...base, opponentKind: 'OUTPOST' }, /abandoned outpost/i);
    expect(sheet).toMatch(/bring Courier/i);
    expect(sheet).not.toMatch(/Wayfarer|Atlas|Argosy/);
  });

  it('sends the wounded to the Repair Station, not the workshop', async () => {
    const { sheet } = await open({ ...base, opponentKind: 'OUTPOST' }, /abandoned outpost/i);
    expect(sheet).toMatch(/Repair Station/);
    expect(sheet).not.toMatch(/workshop/i);
  });

  // Owner 2026-11-06: no wound heals on landing, aboard or in the main game.
  it('promises no wound heals on landing', async () => {
    const { sheet } = await open({ ...base, opponentKind: 'OUTPOST' }, /abandoned outpost/i);
    expect(sheet).toContain('Survivors return to the hangar with their wounds. Send them to the Repair Station yourself.');
    expect(sheet).not.toMatch(/heals on landing/i);
  });

  it('calls pirates pirates, and the ship they hit a ship', async () => {
    const pirates = { ...base, attacking: false, neutral: false, opponentName: 'PIRATE', opponentPlanet: 'PIRATE', opponentPlanetId: null, opponentKind: 'PIRATES', cargoLimited: false, grade: 'DECISIVE' } as BattleReport;
    const { list, sheet } = await open(pirates, /pirates/i);
    expect(list).toMatch(/Raided by pirates/i);
    expect(list).not.toContain('PIRATE');
    expect(sheet).toMatch(/Attacked ship: Newcomer/);
    expect(sheet).not.toMatch(/planet|your world/i);
  });

  it('never prints the raw pirate name in the sheet', async () => {
    const pirates = { ...base, attacking: false, neutral: false, opponentName: 'PIRATE', opponentPlanet: '', opponentPlanetId: null, opponentKind: 'PIRATES', cargoLimited: false } as BattleReport;
    const { sheet } = await open(pirates, /pirates/i);
    expect(sheet).not.toContain('PIRATE');
    expect(sheet).toContain('Pirates');
  });

  it('calls the wall on a ship an Aegis', async () => {
    const hit = { ...base, attacking: false, neutral: false, opponentName: 'Sable', opponentPlanet: 'Sable', opponentPlanetId: 'v2', opponentKind: 'SHIP', shieldAbsorbed: 40, shieldBefore: 90, shieldAfter: 50, cargoLimited: false, rounds: [{ ...base.rounds[0]!, shieldAbsorbed: 40 }] } as BattleReport;
    const { sheet } = await open(hit, /Sable/);
    expect(sheet).not.toMatch(/planet shield/i);
  });

  it('says nothing stood on the ship when a raid met no one', async () => {
    const empty = { ...base, attacking: false, neutral: false, opponentName: 'PIRATE', opponentPlanet: 'PIRATE', opponentPlanetId: null, opponentKind: 'PIRATES', cargoLimited: false, grade: 'DECISIVE', rounds: [] } as BattleReport;
    const { sheet } = await open(empty, /pirates/i);
    expect(sheet).toMatch(/stood on your ship/);
    expect(sheet).not.toMatch(/your world/i);
  });

  it('leaves a main-galaxy report in main-galaxy words', async () => {
    const { list, sheet } = await open({ ...base }, /unclaimed world/i);
    expect(list).toMatch(/unclaimed world/i);
    expect(sheet).toMatch(/Wayfarer/);
    expect(sheet).toMatch(/workshop/i);
    // The main game heals nothing on landing (`maintenanceLanding`); only the ship stage does.
    expect(sheet).not.toMatch(/heals on landing/i);
  });
});
