import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FAULT, distance } from '@astera/rules';
import type { GalaxyPlanet, IntelView } from '../../src/api/schemas.js';
import { compact } from '../../src/lib/format.js';
import { flightModifiers, reachMinutes } from '../../src/lib/navigation.js';
import { duration } from '../../src/lib/time.js';
import { TargetDossier } from '../../src/v2/hud/TargetDossier.js';
import { planetView } from '../fixtures.js';

/**
 * THE TARGET DOSSIER. Spec E2 (docs/ui-v2/gozlemevi.md), the mock's "Hedef dosyası".
 *
 * Everything known about a world on one page: its power against the wing at home,
 * with the reading's source and age, the haul against the hold, and — on a colony —
 * the loyalty RULE, never the loyalty value. It says nothing it was not sold: no
 * enemy band and no haul where nobody has looked.
 */

const NOW = Date.now();

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2',
  name: 'Kestrel',
  owner: 'VEX',
  kind: 'COLONY',
  position: { x: 300, y: 0, z: 400 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED',
  state: { kind: 'NORMAL' },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const probed: IntelView = {
  watching: [],
  probeReports: [{
    targetPlanetId: 'p2',
    targetName: 'Kestrel',
    targetUsername: 'VEX',
    at: new Date(NOW - 2 * 60 * 60_000),
    accuracy: 0.8,
    detected: false,
    stock: { low: 18_000, high: 24_000 },
    deuteriumStock: { low: 1_000, high: 2_000 },
    defence: { low: 27_000, high: 53_000 },
    fleetSize: { low: 20, high: 40 },
    fleetHome: true,
  }],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const blind: IntelView = { ...probed, probeReports: [] };

const home = planetView({ fleet: { DART: 40, COURIER: 2 } });

const show = (props: Partial<Parameters<typeof TargetDossier>[0]> = {}) => render(
  <TargetDossier target={world()} planet={home} intel={probed} reports={[]} rivalSlot={null} now={NOW} {...props} />,
);

describe('the target dossier', () => {
  it('heads the page with the mark, the range and the flight', () => {
    show({ rivalSlot: 0 });
    const target = world();
    const range = Math.round(distance(home.planet.position, target.position));
    const reach = reachMinutes(home.planet.position, target.position, home.fleet, flightModifiers(home));
    expect(screen.getByText('Rival 1')).toBeInTheDocument();
    expect(screen.getByText(`Range ${String(range)}`)).toBeInTheDocument();
    expect(screen.getByText(`${duration(reach ?? 0)} flight`)).toBeInTheDocument();
  });

  it('dates the reading by the look that bought it', () => {
    show();
    const look = document.querySelector<HTMLElement>('[data-dossier-look]')!;
    expect(look).toHaveTextContent(/probe/i);
    expect(look.querySelector('[data-age]')).not.toBeNull();
  });

  /** B5 in the dossier: the band the probe read, on the axis of what stands home. */
  it('puts their band against the wing at home', () => {
    show();
    const ruler = document.querySelector<HTMLElement>('[data-force-ruler]')!;
    expect(within(ruler).getByText('Your wing at home')).toBeInTheDocument();
    expect(ruler.querySelector('[data-part="band"]')).not.toBeNull();
  });

  it('weighs the haul against the hold, and says when the hold is the wall', () => {
    show();
    const loot = document.querySelector<HTMLElement>('[data-dossier-loot]')!;
    expect(loot.querySelectorAll('[data-cargo-mark]').length).toBeGreaterThan(0);
    // Forty Darts and two Couriers hold far less than eighteen thousand.
    expect(loot).toHaveTextContent(/most of it would stay behind/i);
  });

  /** Spec E2's bans: no defence strip and no haul on a world nobody has looked at. */
  it('draws no enemy band and no haul where nobody has looked', () => {
    show({ intel: blind });
    expect(document.querySelector("[data-dossier-look]")).toHaveTextContent(/no probe has looked inside/i);
    expect(document.querySelector('[data-force-ruler] [data-part="band"]')).toBeNull();
    expect(document.querySelector('[data-dossier-loot]')).toBeNull();
  });

  it('states the colony rule on a colony — the rule, never their loyalty', () => {
    show();
    const rule = document.querySelector<HTMLElement>('[data-dossier-colony]')!;
    expect(rule).toHaveTextContent(String(FAULT.battleLoyaltyLoss.DECISIVE));
    expect(rule).toHaveTextContent(String(FAULT.battleLoyaltyLoss.PARTIAL));
    expect(rule).toHaveTextContent(/neutral/i);
  });

  it('keeps the colony rule off every other world', () => {
    show({ target: world({ kind: 'CAPITAL' }) });
    expect(document.querySelector('[data-dossier-colony]')).toBeNull();
  });
});

/**
 * THE DOSSIER, CLOSER TO THE MOCK (M2, owner 2026-09-25): the look carries its signal
 * bars; power has one heading; the haul is drawn resource by resource on a line from zero
 * with your hold marked on it; the rival mark lives in the header, where the mock has it.
 */
describe('the target dossier, as the mock draws it', () => {
  it('shows how sharp the look was, in the Telescope’s bars', () => {
    show();
    const look = document.querySelector<HTMLElement>('[data-dossier-look]')!;
    expect(within(look).getByRole('img', { name: /80%/ })).toBeInTheDocument();
  });

  it('heads power once — the ruler carries the heading', () => {
    show();
    const ruler = document.querySelector<HTMLElement>('[data-force-ruler]')!;
    expect(within(ruler).getByText('Power')).toBeInTheDocument();
    expect(screen.queryByText('Armed unit value')).toBeNull();
    expect(screen.getAllByText('Power')).toHaveLength(1);
  });

  it('draws the haul resource by resource, your hold marked on the same line', () => {
    show();
    const rows = [...document.querySelectorAll<HTMLElement>('[data-dossier-loot] [data-loot-row]')];
    expect(rows.map((row) => row.getAttribute('data-loot-row'))).toEqual(['metal', 'deuterium']);
    // Alloy and crystal together: the probe's pile less its deuterium.
    expect(rows[0]).toHaveTextContent(`${compact(16_000)}–${compact(23_000)}`);
    expect(rows[1]).toHaveTextContent(`${compact(1_000)}–${compact(2_000)}`);
    for (const row of rows) {
      expect(row.querySelector('[data-loot-band]')).not.toBeNull();
      expect(row.querySelector('[data-cargo-mark]')).toHaveClass('bg-v2-self');
    }
  });

  /**
   * THE MOCK'S "OKUNAN DAĞILIM": the probe's class reading as one bar, the counter line
   * under it as its legend. A full split is drawn to its shares; a majority is a floor, so
   * its class gets half and the rest is drawn as unread, never guessed.
   */
  const shaped = (classReading: NonNullable<IntelView['probeReports'][number]['classReading']>): IntelView => ({
    ...probed,
    probeReports: probed.probeReports.map((report) => ({ ...report, classReading })),
  });

  it('draws a full split to its shares, with the counter line as its legend', () => {
    show({ intel: shaped({ kind: 'SHARES', shares: { LANCE: 46, SKIRMISHER: 30, BULWARK: 24 } }) });
    const shape = document.querySelector<HTMLElement>('[data-dossier-shape]')!;
    const parts = [...shape.querySelectorAll<HTMLElement>('[data-share]')];
    expect(parts.map((part) => part.getAttribute('data-share'))).toEqual(['LANCE', 'SKIRMISHER', 'BULWARK']);
    expect(parts.map((part) => part.style.width)).toEqual(['46%', '30%', '24%']);
    expect(shape.querySelector('[data-share-unread]')).toBeNull();
    expect(shape.querySelector('[data-matchup-wall]')).not.toBeNull();
    // Said once: the ruler above no longer carries the line.
    expect(document.querySelector('[data-force-ruler] [data-matchup-wall]')).toBeNull();
  });

  it('draws a majority as a floor, the rest unread', () => {
    show({ intel: shaped({ kind: 'DOMINANT', cls: 'BULWARK' }) });
    const shape = document.querySelector<HTMLElement>('[data-dossier-shape]')!;
    const parts = [...shape.querySelectorAll<HTMLElement>('[data-share]')];
    expect(parts.map((part) => part.getAttribute('data-share'))).toEqual(['BULWARK']);
    expect(parts[0]!.style.width).toBe('50%');
    expect(shape.querySelector('[data-share-unread]')).not.toBeNull();
  });

  it('draws no bar where the probe could not read the shape — only the sentence', () => {
    show({ intel: shaped({ kind: 'UNREAD' }) });
    const shape = document.querySelector<HTMLElement>('[data-dossier-shape]')!;
    expect(shape.querySelector('[data-share]')).toBeNull();
    expect(shape.querySelector('[data-matchup-wall]')).not.toBeNull();
  });

  /** Nothing that fires has no shape: the ruler already says 0, and an empty heading says nothing. */
  it('keeps the section off a wall with nothing that fires', () => {
    show({ intel: shaped({ kind: 'NONE' }) });
    expect(document.querySelector('[data-dossier-shape]')).toBeNull();
  });

  it('keeps the section off a world nobody has looked at', () => {
    show({ intel: blind });
    expect(document.querySelector('[data-dossier-shape]')).toBeNull();
  });

  it('marks and unmarks the rival from the header', async () => {
    const onToggle = vi.fn();
    const { rerender } = show({ rival: { pending: false, onToggle } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Mark rival' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<TargetDossier target={world()} planet={home} intel={probed} reports={[]} rivalSlot={0} now={NOW} rival={{ pending: false, onToggle }} />);
    expect(screen.getByRole('button', { name: /Rival 1/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
