import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    expect(loot).toHaveTextContent(compact(18_000));
    expect(loot).toHaveTextContent(compact(24_000));
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
