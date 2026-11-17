import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GalaxyPlanet, IntelView } from '../../src/api/schemas.js';
import { TargetDossier } from '../../src/v2/hud/TargetDossier.js';
import { planetView } from '../fixtures.js';

/**
 * G4-d (2026-11-15): THE TARGET FILE ON THE GAME KIT. "Is this worth a raid, and what do I
 * bring?" The file's head is kit chips a thumb can press, the look that bought the reading
 * sits in a glass well, each part is headed by the kit's section tag with its source aside,
 * and the rule behind the power ruler is the kit's round "?" — never a dotted link. Nothing
 * runs off the side: the counter lines wrap.
 */

const NOW = Date.now();
const V2_LOOK = /(^|\s)(text|bg|border|font)-v2-|rounded-(control|chip|cell)|v2-legend|v2-hatch|(^|\s)text-(micro|caption|body)(\s|$)|whitespace-nowrap|(^|\s)truncate(\s|$)/;
const oldPaint = (root: Element): string[] =>
  [root, ...root.querySelectorAll('[class]')].map((el) => el.getAttribute('class') ?? '').filter((name) => V2_LOOK.test(name));

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2', name: 'Kestrel', owner: 'VEX', kind: 'COLONY', position: { x: 300, y: 0, z: 400 }, coreTier: 2, coreLevel: 6,
  intel: 'RESOLVED', state: { kind: 'NORMAL' }, satellites: [], shielded: false, isSelf: false, ...over,
});

const probed: IntelView = {
  watching: [],
  probeReports: [{
    targetPlanetId: 'p2', targetName: 'Kestrel', targetUsername: 'VEX', at: new Date(NOW - 2 * 60 * 60_000), accuracy: 0.8,
    detected: false, stock: { low: 18_000, high: 24_000 }, deuteriumStock: { low: 1_000, high: 2_000 },
    defence: { low: 27_000, high: 53_000 }, fleetSize: { low: 20, high: 40 }, fleetHome: true,
    classReading: { kind: 'SHARES', shares: { LANCE: 46, SKIRMISHER: 30, BULWARK: 24 } },
  }],
  probeCooldowns: [], radarLog: [], probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const commander = (): GalaxyPlanet => world({ coreTier: 6, controller: { kind: 'PLAYER', playerId: 'vex', displayName: 'VEX' } });
const home = planetView({ fleet: { DART: 40, COURIER: 2 } });
const file = () => document.querySelector<HTMLElement>('[data-target-dossier]')!;

describe('the target file on the kit', () => {
  it('carries none of the old look, ruler and counter lines included', () => {
    render(<TargetDossier target={commander()} planet={home} intel={probed} reports={[]} rivalSlot={null} now={NOW}
      rival={{ pending: false, onToggle: vi.fn() }} ownPeakCore={12} />);
    expect(file()).toHaveClass('gk-dossier');
    expect(oldPaint(file())).toEqual([]);
  });

  it('heads the file with kit chips, the presses a thumb’s size and with the kit’s sound', () => {
    const onToggle = vi.fn();
    render(<TargetDossier target={commander()} planet={home} intel={probed} reports={[]} rivalSlot={null} now={NOW}
      rival={{ pending: false, onToggle }} ownPeakCore={12} />);
    const mark = screen.getByRole('button', { name: 'Mark rival' });
    expect(mark).toHaveClass('gk-hit');
    expect(mark).toHaveAttribute('data-own-sound');
    expect(mark.querySelector('.gk-chip')).not.toBeNull();
    fireEvent.click(mark);
    expect(onToggle).toHaveBeenCalledOnce();
    const band = file().querySelector<HTMLElement>('[data-dossier-band]')!;
    expect(band).toHaveClass('gk-hit');
    expect(band).toHaveAttribute('data-own-sound');
  });

  it('sets the look in a glass well, and heads each part with the kit tag, its source aside', () => {
    render(<TargetDossier target={world()} planet={home} intel={probed} reports={[]} rivalSlot={null} now={NOW} />);
    expect(file().querySelector('[data-dossier-look]')).toHaveClass('gk-well');
    for (const part of ['[data-dossier-shape]', '[data-dossier-loot]', '[data-dossier-colony]']) {
      expect(file().querySelector(`${part} .gk-tag`)).not.toBeNull();
    }
    expect(file().querySelector('[data-dossier-shape] .gk-tag__aside')).toHaveTextContent(/probe/i);
  });

  it('opens the power rule on the kit’s round “?”', () => {
    render(<TargetDossier target={world()} planet={home} intel={probed} reports={[]} rivalSlot={null} now={NOW} />);
    const ruler = file().querySelector<HTMLElement>('[data-force-ruler]')!;
    const why = within(ruler).getByRole('button', { name: /what is this/i });
    expect(why).toHaveClass('gk-round');
    expect(why).toHaveAttribute('data-own-sound');
    fireEvent.click(why);
    expect(screen.getByTestId('ruler-rule')).toHaveClass('gk-well');
  });
});
