import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SILENT_SPACE, alloyRate, storageCap } from '@astera/rules';
import { Api, ApiError } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { planetSchema, type GalaxyPlanet, type PirateContact, type ReturnStatus } from '../src/api/schemas.js';
import { PirateFocus, PlanetFocus } from '../src/galaxy/FocusPanel.js';
import i18n from '../src/i18n/index.js';
import { describeError } from '../src/i18n/errors.js';
import { launchFault } from '../src/lib/faults.js';
import { compact, full } from '../src/lib/format.js';
import { buildingGain } from '../src/lib/gains.js';
import { describeNow, nowEntries, type NowInput } from '../src/lib/nowLine.js';
import { SilentSpaceNotice } from '../src/shell/SilentSpaceNotice.js';
import { FaultSheet } from '../src/screens/FaultSheet.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { planetView } from './fixtures.js';

/**
 * SILENT SPACE IS A WAITING ROOM, AND THE SCREENS HAVE TO SAY SO BEFORE A BUTTON IS PRESSED.
 * D212, owner rule 2026-10-07. The server refuses; these surfaces explain.
 */

afterEach(async () => { await i18n.changeLanguage('en'); });

describe('the launch lock', () => {
  it('names Silent Space before any colony fault, on every lane', () => {
    expect(launchFault([], 'fleet', true)).toBe('SILENT_SPACE');
    expect(launchFault([{ kind: 'PROSPECTOR_FAULT' }], 'prospector', true)).toBe('SILENT_SPACE');
    expect(launchFault([{ kind: 'SHIPYARD_REVOLT' }], 'fleet', false)).toBe('SHIPYARD_REVOLT');
    expect(launchFault([], 'fleet')).toBeNull();
  });

  it('says why in every language the launch lock is read in', async () => {
    for (const language of ['en', 'tr', 'de', 'es', 'fr', 'ja']) {
      await i18n.changeLanguage(language);
      expect(i18n.exists('faults.launchBlock.SILENT_SPACE')).toBe(true);
      expect(i18n.exists('errors.SILENT_SPACE_LOCKED')).toBe(true);
    }
  });

  it('turns the server refusal into the player’s language', async () => {
    await i18n.changeLanguage('tr');
    const text = describeError(new ApiError('SILENT_SPACE_LOCKED', 'Attacks and gathering are closed in Silent Space.', 409));
    expect(text).toContain('Sessiz Uzay');
    expect(text).not.toContain('Attacks');
  });
});

describe('the pirate rail inside Silent Space', () => {
  const pirate: PirateContact = {
    id: 'mJtQH0vR5cP8sN2xK7dL4A', callsign: 'mJtQ', zone: 'IDENTIFIED', at: { x: 100, y: 0, z: 0 },
    expiresInMinutes: 180, reachMinutes: 12,
    reach: [{ hull: 'DART', minutes: 12, distance: 900, at: { x: 900, y: 0, z: 0 } }],
    level: 3, fleet: { DART: 2 }, damageMult: 1, mass: 'MEDIUM',
  };
  it('keeps the raid shut and tells the commander why', () => {
    render(<PirateFocus pirate={pirate} fleetAtHome={{ DART: 10 }} launchBlock="SILENT_SPACE" raiding={false}
      onClose={vi.fn()} onAttack={vi.fn()} open onToggle={vi.fn()} />);
    const button = screen.getByRole('button', { name: i18n.t('faults.launchBlock.SILENT_SPACE') });
    expect(button).toBeDisabled();
  });
});

describe('a world focus from inside Silent Space', () => {
  const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();
  const target: GalaxyPlanet = {
    id: 'p2', name: 'Grimhold', owner: 'Sable', position: { x: 200, y: 0, z: 0 }, coreTier: 2, coreLevel: 6,
    intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false,
  };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ApiProvider api={new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch })}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
  it('closes the raid and the clan mark, and names the room as the reason', () => {
    const origin = { ...planetView({ buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
      fleet: { DART: 6 } }, { alloy: 4000, crystal: 2000 }), silentSpace: true };
    render(<Wrapper><PlanetFocus target={target} planet={origin} intel={{ watching: [], probeReports: [], probeCooldowns: [],
      radarLog: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 } }} reports={[]} now={NOW}
    showClanTargetAction onMarkClanTarget={vi.fn()} onClose={vi.fn()} onAttack={vi.fn()} onInstallTelescope={vi.fn()}
    onLaunched={vi.fn()} open onToggle={vi.fn()} /></Wrapper>);
    const attack = screen.getAllByRole('button', { name: i18n.t('focus.planet.attackSilentSpace') });
    expect(attack.length).toBeGreaterThan(0);
    for (const button of attack) expect(button).toBeDisabled();
    expect(screen.getAllByText(i18n.t('faults.launchBlock.SILENT_SPACE')).length).toBeGreaterThan(0);
  });
});

describe('the Now line before a departure', () => {
  const NOW = Date.parse('2026-09-23T12:00:00Z');
  const input = (silentSpaceAt: Date | null): NowInput => ({
    now: NOW, threads: [], runs: [], builds: [], research: [], events: [], shieldUntil: null, silentSpaceAt,
  });
  const hours = (n: number): Date => new Date(NOW + n * 3_600_000);

  it('warns in the last twelve hours and not before', () => {
    expect(nowEntries(input(hours(13)))).toEqual([]);
    expect(nowEntries(input(hours(12)))).toEqual([{ tier: 2, kind: 'silentSpace', at: hours(12).getTime() }]);
    expect(nowEntries(input(null))).toEqual([]);
    expect(nowEntries(input(hours(-1)))).toEqual([]);
  });

  it('ranks after an enemy landing and ahead of the commander’s own work', () => {
    const entries = nowEntries({
      ...input(hours(6)),
      threads: [{ kind: 'incoming', targetName: 'Kestrel', minutesRemaining: 600, arriveAt: hours(10) }],
      builds: [{ id: 'o', queue: 'CONSTRUCTION', slot: 0, kind: 'BUILDING', subject: 'REFINERY', count: 1,
        startedAt: hours(-1), finishesAt: new Date(NOW + 60_000), cost: { alloy: 1, crystal: 0, deuterium: 0 } }],
    });
    expect(entries.map((entry) => entry.kind)).toEqual(['incoming', 'silentSpace', 'build']);
  });

  it('names what the commander can do about it', () => {
    const [entry] = nowEntries(input(hours(3)));
    const { title, detail } = describeNow(entry!);
    expect(title).toBe(i18n.t('now.silentSpace'));
    expect(detail).toBe(i18n.t('now.silentSpaceDetail'));
  });
});

describe('the works inside Silent Space', () => {
  it('shows the halved rate and the unchanged store', () => {
    const levels = { CORE: 5, REFINERY: 4, EXTRACTOR: 4, DEUTERIUM_PLANT: 0, VAULT: 2, SHIPYARD: 0, HANGAR: 0 } as const;
    const slow = buildingGain('REFINERY', 4, 0, { ...levels }, 1, SILENT_SPACE.productionPace);
    expect(slow.now).toBe(i18n.t('gains.refinery.rate', { amount: compact(alloyRate(4) * 0.5) }));
    expect(slow.unlocks).toBe(i18n.t('gains.refinery.storage', {
      now: compact(storageCap(alloyRate(4), 2)), next: compact(storageCap(alloyRate(5), 2)),
    }));
  });

  it('reads both new fields and an older server that sends neither', () => {
    const base = planetView();
    const parsed = planetSchema.parse({ ...base, silentSpace: true, silentSpaceAt: null });
    expect(parsed.silentSpace).toBe(true);
    expect(parsed.silentSpaceAt).toBeNull();
    const at = '2026-10-08T06:00:00.000Z';
    expect(planetSchema.parse({ ...base, silentSpaceAt: at }).silentSpaceAt).toEqual(new Date(at));
    const older = planetSchema.parse(base);
    expect(older.silentSpace).toBeUndefined();
  });
});

describe('an outage inside Silent Space', () => {
  it('prices the lost hour at the pace the works were really running', () => {
    const world = planetView({ buildings: { CORE: 4, REFINERY: 4, EXTRACTOR: 2, VAULT: 1 } }, {
      alloyPerHour: 0, nominalAlloyPerHour: 1000,
    });
    const fault = { id: 'f1', kind: 'REFINERY_OUTAGE' as const, startedAt: new Date(0),
      cost: { alloy: 10, crystal: 10, deuterium: 0 }, repair: null };
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>
        <ApiProvider api={new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch })}>
          <ToastProvider>{children}</ToastProvider>
        </ApiProvider>
      </QueryClientProvider>
    );
    render(<Wrapper><FaultSheet fault={fault} planet={{ ...world, silentSpace: true, faults: [fault] }} onClose={vi.fn()} /></Wrapper>);
    expect(screen.getByText(i18n.t('faults.toll.alloy', { amount: full(500) }))).toBeInTheDocument();
  });
});

describe('the Silent Space notice', () => {
  const data: ReturnStatus = { placement: { playerId: 'commander-b', version: 1, role: 'WAITING' }, homeShard: 'EU-1', canApply: true, application: null };
  it('says why the commander is here, what is closed and what is slower', async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
    render(<SilentSpaceNotice data={data} open={false} allowAutomatic onClose={vi.fn()} onApply={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('30 saat');
    expect(dialog).toHaveTextContent('saldırı');
    expect(dialog).toHaveTextContent('asteroid');
    expect(dialog).toHaveTextContent('korsan');
    expect(dialog).toHaveTextContent('%50');
  });
});
