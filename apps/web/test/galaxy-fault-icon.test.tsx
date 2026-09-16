import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GalaxyPlanet } from '../src/api/schemas.js';
import { GalaxyPlanetName } from '../src/galaxy/GalaxyCanvas.js';
import { planetNodes } from '../src/galaxy/scene.js';

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
