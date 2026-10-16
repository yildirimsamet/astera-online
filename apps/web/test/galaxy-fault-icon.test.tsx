import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { GalaxyPlanetName } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { faultMarkNodes } from '../src/galaxy/FaultMarks.js';

const world = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'mine',
  name: 'Vantage',
  owner: 'Me',
  position: { x: 0, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  satellites: [],
  shielded: false,
  intel: 'RESOLVED',
  isSelf: true,
  isOwned: true,
  state: { kind: 'NORMAL' },
  ...over,
});

describe('the owner-only colony fault mark on the galaxy', () => {
  it('draws a red fault icon beside a broken owned world name', () => {
    const [node] = planetNodes([world({ faulty: true })]);
    const view = render(<GalaxyPlanetName node={node!} />);
    const mark = view.container.querySelector('[data-colony-fault-icon]');

    expect(mark).not.toBeNull();
    expect(mark).toHaveClass('text-threat-ink');
    expect(mark?.parentElement).toHaveTextContent('Vantage');
  });

  it('does not expose the mark on a foreign world even if a forged payload sets it', () => {
    const [node] = planetNodes([world({ isSelf: false, isOwned: false, faulty: true })]);
    const view = render(<GalaxyPlanetName node={node!} />);
    expect(view.container.querySelector('[data-colony-fault-icon]')).toBeNull();
  });
});

/**
 * THE BADGE OVER THE WORLD, AT EVERY ZOOM. Owner, 2026-10-16: *"Kolonilerde arıza olduğunda
 * kolonin üstünde sahibinin görebileceği bir arıza işareti çıkıyordu eskiden. Yok olmuş …
 * Görünür anlaşılır fark edilir olsun."* The label's icon only appears once the camera is
 * close; the badge stands in the marker stack, so a broken colony reads from the whole disc.
 */
describe('the fault badge over a broken colony', () => {
  it('stands over the commander’s own broken worlds and nowhere else', () => {
    const nodes = planetNodes([
      world({ id: 'broken', faulty: true }),
      world({ id: 'sound' }),
      world({ id: 'foreign', isSelf: false, isOwned: false, faulty: true }),
    ]);
    expect(faultMarkNodes(nodes).map((node) => node.id)).toEqual(['broken']);
  });
});
