import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import {
  intelSchema,
  planetSchema,
  reportsSchema,
  type BattleReport,
  type GalaxyPlanet,
  type IntelView,
  type NotificationView,
  type PlanetView,
  type ProbeReport,
} from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { dossier } from '../src/lib/dossier.js';
import { describeNotification, signalFamily } from '../src/lib/notifications.js';
import { useTargetReading } from '../src/lib/useTargetReading.js';
import { ClanSupportBay, DefencePostureCard } from '../src/screens/ClanSupportBay.js';
import { BattleReports } from '../src/screens/BattleReports.js';
import { DESTINATION } from '../src/shell/Signals.js';
import { EscapeReadout } from '../src/ui/EscapeReadout.js';
import { planetView } from './fixtures.js';

/**
 * KLAN DESTEĞİYLE BİRLİKTE KAÇIŞ — F1, owner decisions 2026-11-10
 * (`docs/klan-savunma-kacis-f1-2026-11-10.md`). The two toggles are independent; both on,
 * an outmatched line lifts together and the host's tank pays only for the host's ships.
 */

beforeEach(async () => { await i18n.changeLanguage('en'); });

type Stance = 'ESCAPE' | 'SUPPORT' | 'HOLD' | 'ESCAPE_SUPPORT';
const legacy = (stance: Stance) => (stance === 'ESCAPE_SUPPORT' ? 'ESCAPE' : stance);

function world(stance: Stance, waves = 0): PlanetView {
  const base = planetView();
  const now = Date.now();
  return planetSchema.parse(JSON.parse(JSON.stringify({
    ...base,
    rulesetVersion: 15,
    defencePosture: {
      posture: legacy(stance), stance,
      escape: stance === 'ESCAPE' || stance === 'ESCAPE_SUPPORT',
      support: stance === 'SUPPORT' || stance === 'ESCAPE_SUPPORT',
      supportLocked: null,
    },
    clanSupport: {
      room: { used: waves * 40, reserved: 0, total: 470 },
      waves: Array.from({ length: waves }, (_, index) => ({
        id: `wave-${String(index)}`, status: 'STATIONED',
        sender: { playerId: 'ali', name: 'Ali' }, host: { playerId: 'me', name: 'Me' },
        originPlanetId: 'origin', hostPlanetId: 'world', hostPlanetName: 'Vega',
        fleet: { PIKE: 12 }, bulk: 40, damaged: false,
        sentAt: new Date(now - 3_600_000).toISOString(), arriveAt: new Date(now - 1_800_000).toISOString(),
        stationedAt: new Date(now - 1_800_000).toISOString(), expiresAt: new Date(now + 3_600_000).toISOString(),
        returnAt: null, returnReason: null, outOfBand: false, battles: 0,
      })),
    },
  })));
}

function show(node: React.ReactNode, fetch = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(['season'], { honorSoloCredit: false });
  const api = new Api({ fetch: fetch as unknown as typeof globalThis.fetch });
  render(<QueryClientProvider client={client}><ApiProvider api={api}>{node}</ApiProvider></QueryClientProvider>);
  return fetch;
}
const toggle = (name: RegExp) => screen.getByRole('checkbox', { name });
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

describe('F1 — the posture card takes both toggles', () => {
  it('shows both on for a clan member who never touched them, and says the line lifts together', () => {
    show(<DefencePostureCard planet={world('ESCAPE_SUPPORT')} />);
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'true');
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/lift together/i)).toBeInTheDocument();
    expect(screen.getByText(/pays only for your ships/i)).toBeInTheDocument();
    expect(screen.queryByText(/only one can be on/i)).toBeNull();
  });

  it('keeps the retreat on when support is switched on, and saves both', async () => {
    const user = userEvent.setup();
    const fetch = show(<DefencePostureCard planet={world('ESCAPE')} />,
      vi.fn().mockResolvedValue(ok({ planet: planetView(), returnedWaves: 0 })));
    await user.click(toggle(/clan support/i));
    expect(toggle(/tactical retreat/i)).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /^save/i }));
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(typeof init.body === 'string' ? init.body : '')).toEqual({ escape: true, support: true });
  });

  it('keeps support on when the retreat is switched off — the guests stay, no confirmation', async () => {
    const user = userEvent.setup();
    const fetch = show(<DefencePostureCard planet={world('ESCAPE_SUPPORT', 1)} />,
      vi.fn().mockResolvedValue(ok({ planet: planetView(), returnedWaves: 0 })));
    await user.click(toggle(/tactical retreat/i));
    expect(toggle(/clan support/i)).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: /^save/i }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('asks before closing the door on standing waves', async () => {
    const user = userEvent.setup();
    const fetch = show(<DefencePostureCard planet={world('ESCAPE_SUPPORT', 1)} />);
    await user.click(toggle(/clan support/i));
    await user.click(screen.getByRole('button', { name: /^save/i }));
    expect(screen.getByText(/1 support wave home/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tells the bay the line lifts together under both, and never retreats under support alone', () => {
    show(<ClanSupportBay planet={world('ESCAPE_SUPPORT', 1)} />);
    expect(screen.getByText(/outmatches the whole line/i)).toBeInTheDocument();
  });
});

describe('F1 — the Defend tab’s retreat line with support standing', () => {
  it('says standing support counts in the line and lifts with it free', () => {
    render(<EscapeReadout fleet={{ DART: 40 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" support={{ PIKE: 40 }} />);
    expect(screen.getByTestId('escape-readout')).toHaveTextContent(/clan support.*lifts with/i);
  });

  it('counts the five-ship floor across the whole line, as the battle does', () => {
    render(<EscapeReadout fleet={{ DART: 2 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" support={{ PIKE: 40 }} />);
    const line = screen.getByTestId('escape-readout');
    expect(line).not.toHaveTextContent(/at least 5 fighting ships/i);
    expect(line).toHaveTextContent(/clan support.*lifts with/i);
  });

  it('still names the floor when the whole line is under it, counting the support', () => {
    render(<EscapeReadout fleet={{ DART: 2 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" support={{ PIKE: 2 }} />);
    expect(screen.getByTestId('escape-readout')).toHaveTextContent(/4 of 5 ready/i);
  });

  it('speaks for a line of support alone: a host with no ships still sees the wave can lift', () => {
    render(<EscapeReadout fleet={{}} ground={{}} deuterium={0} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" support={{ PIKE: 40 }} />);
    const line = screen.getByTestId('escape-readout');
    expect(line).toHaveTextContent(/clan support.*lifts with/i);
    expect(line).not.toHaveAttribute('data-short');
  });

  it('counts no support under the retreat alone — no wave can stand at an ESCAPE world', () => {
    render(<EscapeReadout fleet={{ DART: 2 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE" support={{ PIKE: 40 }} />);
    expect(screen.getByTestId('escape-readout')).toHaveTextContent(/2 of 5 ready/i);
  });

  it('warns that a dry tank keeps the whole line — support included — in the fight (F1-K4)', () => {
    render(<EscapeReadout fleet={{ DART: 40 }} ground={{}} deuterium={0} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" support={{ PIKE: 40 }} />);
    const line = screen.getByTestId('escape-readout');
    expect(line).toHaveTextContent(/whole line.*support included.*fights/i);
    expect(line).not.toHaveTextContent(/lifts with it, free/i);
  });

  it('counts the waves that land before the raid, and says how many ships are on the way (F2 E6)', () => {
    render(<EscapeReadout fleet={{ DART: 2 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE_SUPPORT" arriving={{ PIKE: 6 }} />);
    const line = screen.getByTestId('escape-readout');
    // 2 at home + 6 landing in time clears the five-ship floor.
    expect(line).not.toHaveTextContent(/of 5 ready/i);
    expect(line).toHaveTextContent('6 support ships land before the raid and count in this line');
  });

  it('counts nothing on the way under the retreat alone', () => {
    render(<EscapeReadout fleet={{ DART: 2 }} ground={{}} deuterium={5_000} rulesetVersion={15}
      posture="ESCAPE" arriving={{ PIKE: 6 }} />);
    const line = screen.getByTestId('escape-readout');
    expect(line).toHaveTextContent(/2 of 5 ready/i);
    expect(line).not.toHaveTextContent(/land before the raid/i);
  });

  it('says nothing of support when none stands there', () => {
    render(<EscapeReadout fleet={{ DART: 40 }} ground={{}} deuterium={5_000} rulesetVersion={15} posture="ESCAPE_SUPPORT" />);
    expect(screen.getByTestId('escape-readout')).not.toHaveTextContent(/clan support/i);
  });
});

const target: GalaxyPlanet = {
  id: 'them', name: 'Vega', owner: 'Ali', position: { x: 200, y: 0, z: 0 },
  coreTier: 2, coreLevel: 6, intel: 'RESOLVED', state: { kind: 'NORMAL' },
  satellites: [], shielded: false, isSelf: false,
};
const probe = (over: Partial<ProbeReport> = {}): ProbeReport => ({
  targetPlanetId: 'them', targetName: 'Vega', targetUsername: 'Ali',
  at: new Date(Date.now() - 30 * 60_000), accuracy: 0.8, detected: false,
  stock: { low: 100, high: 200 }, deuteriumStock: null,
  defence: { low: 10_000, high: 14_000 }, fleetSize: { low: 20, high: 30 }, fleetHome: true,
  posture: 'ESCAPE', stance: 'ESCAPE_SUPPORT',
  support: { supporters: 2, defence: { low: 8_000, high: 11_000 }, fleetSize: { low: 30, high: 40 }, classReading: null },
  ...over,
});
const intelWith = (report: ProbeReport): IntelView => ({
  watching: [], radarLog: [], probeCooldowns: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 }, probeReports: [report],
});

describe('F1 — the raider reads the door and the guests', () => {
  it('parses the stance beside the three-value posture old clients read', () => {
    const parsed = intelSchema.parse(JSON.parse(JSON.stringify(intelWith(probe()))));
    expect(parsed.probeReports[0]).toMatchObject({ posture: 'ESCAPE', stance: 'ESCAPE_SUPPORT' });
  });

  it('prints the exact posture and the support row in the dossier', () => {
    const facts = dossier({ target, planet: planetView(), intel: intelWith(probe()), reports: [], now: Date.now() }).facts;
    expect(facts.find((fact) => fact.key === 'posture')?.value).toMatch(/retreat on · takes clan support/i);
    expect(facts.some((fact) => fact.key === 'support')).toBe(true);
  });

  it('keeps the retreat mark, weighs the whole line, and says it lifts together', () => {
    const read = renderHook(() => useTargetReading({
      target: { kind: 'world', world: target }, intel: intelWith(probe()), reports: [], tech: {}, wing: { DART: 60 }, rulesetVersion: 15,
    })).result.current;
    expect(read.escape).not.toBeNull();
    expect(read.notes.join(' ')).toMatch(/whole line lifts together/i);
    expect(read.notes.join(' ')).toMatch(/2 clan supporters/i);
  });
});

const NOTICE_AT = new Date('2026-11-10T12:00:00.000Z');
const news = (payload: Record<string, unknown>): NotificationView => ({
  id: 'n1', kind: 'clan_support_lifted', refId: 'm1', payload, seen: false, at: NOTICE_AT,
});

describe('F1 — the supporter hears the wave ran with the line', () => {
  it('says how many ships lifted and that they still stand there, and opens the world', () => {
    const line = describeNotification(news({ hostPlanetId: 'vega', hostPlanetName: 'Vega', ships: 12 }), NOTICE_AT.getTime()) ?? '';
    expect(line).toMatch(/Vega/);
    expect(line).toMatch(/12 ships/);
    expect(line).toMatch(/still stand/i);
    expect(signalFamily(news({ hostPlanetId: 'vega', hostPlanetName: 'Vega', ships: 12 }))).toBe('gain');
    expect(DESTINATION.clan_support_lifted).toEqual({ panel: 'planet' });
  });
});

const report: BattleReport = {
  id: 'e1', missionId: 'mission-e1', at: new Date('2026-11-10T12:00:00.000Z'), grade: 'DECISIVE', attacking: false,
  opponentName: 'Sable', opponentPlanet: 'Grimhold', opponentPlanetId: 'p2', neutral: false, yourPlanet: 'Vantage-3',
  rounds: [], yourLosses: {}, theirLosses: {}, yourFleet: {}, theirFleet: { DART: 600 },
  lootAlloy: -300, lootCrystal: -80, lootDeuterium: 0, dominion: -380, dominionBreakdown: null, shieldAbsorbed: 0,
  cargoLimited: false, defenceSalvage: {}, yourDamage: [], disruptedMinutes: 0, wreckValue: 0,
  fleetEscape: { kind: 'ESCAPED', ships: { DART: 20 }, fuel: 40, support: [{ stackId: 'w1', ships: { PIKE: 12 } }, { stackId: 'w2', ships: { PIKE: 3 } }] },
};

describe('F1 — the host’s report says the support ran too', () => {
  it('parses the lifted waves on the defender’s record', () => {
    const parsed = reportsSchema.parse(JSON.parse(JSON.stringify({ reports: [report], rivals: [] })));
    const row = parsed.reports[0]!;
    expect('fleetEscape' in row && row.fleetEscape?.kind === 'ESCAPED' ? row.fleetEscape.support : null).toHaveLength(2);
  });

  it('counts the clanmates’ ships that lifted with the host', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['reports'], reportsSchema.parse(JSON.parse(JSON.stringify({ reports: [report], rivals: [] }))));
    const api = new Api({ fetch: vi.fn().mockImplementation(() => Promise.resolve(ok({ reports: [report], rivals: [] }))) });
    render(<QueryClientProvider client={client}><ApiProvider api={api}><BattleReports /></ApiProvider></QueryClientProvider>);
    await userEvent.click(screen.getByRole('button', { name: /Sable/ }));
    expect(document.querySelector('[data-fleet-escape]')).toHaveTextContent(/15 clanmate ships lifted with yours/i);
  });
});

describe('F1 — no help text still says the two postures exclude each other', () => {
  it('drops the old "supported means never retreats" rule from the guides and the retreat article', async () => {
    const { guideArticles } = await import('../src/wiki/guides.js');
    const { fleetAndIntelArticles } = await import('../src/wiki/fleet-and-intel.js');
    const text = JSON.stringify([guideArticles, fleetAndIntelArticles]);
    for (const stale of [/cannot be active together/, /A supported planet cannot retreat/, /iki duruş birlikte etkin olamaz/,
      /Desteklenen gezegen geri çekilemez/, /Choose retreat to preserve ships, or/]) {
      expect(text).not.toMatch(stale);
    }
    expect(text).toMatch(/whole line/);
    expect(text).toMatch(/tüm hat/);
  });
});
