import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type * as Drei from '@react-three/drei';
import type * as Fiber from '@react-three/fiber';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { ShipCosmeticEquipment } from '@astera/rules';
import { SHIP_CLASSES } from '@astera/rules/arena';
import { FormationHulls, Hull } from '../src/galaxy/Fleets.js';
import { ShipBody } from '../src/galaxy/ParkedShip.js';
import { ErrorBoundary } from '../src/shell/ErrorBoundary.js';
import { HULL_LOD_MODEL, HULL_MODEL } from '../src/ui/assets.js';
import { shipHullModels } from '../src/galaxy/shipCosmetics.js';

// Exercise the real components and boundaries; replace only GPU hooks and asset reads.
const assets = vi.hoisted(() => ({
  failures: new Map<string, string>(),
  read: vi.fn<(url: string) => { scene: THREE.Group }>(),
}));
vi.mock('@react-three/fiber', async original => ({
  ...await original<typeof Fiber>(),
  useFrame: vi.fn(),
  useLoader: Object.assign((_loader: unknown, url: string) => assets.read(url), { clear: vi.fn() }),
}));
vi.mock('@react-three/drei', async original => ({
  ...await original<typeof Drei>(),
  useGLTF: Object.assign((url: string) => assets.read(url), { preload: vi.fn(), clear: vi.fn() }),
}));
vi.mock('../src/galaxy/SceneWarmup.js', () => ({ useModelWarmup: vi.fn() }));

beforeEach(() => {
  assets.failures.clear();
  assets.read.mockReset().mockImplementation(url => {
    const message = assets.failures.get(url);
    if (message) throw new Error(message);
    return { scene: new THREE.Group() };
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('ship model failures stay inside the visual', () => {
  it('leaves only the controls when the model catalogue is unavailable', () => {
    const view = render(<ErrorBoundary><button>Hangar</button><ShipBody model={undefined} lit /></ErrorBoundary>);
    expect(screen.getByRole('button', { name: 'Hangar' })).toBeInTheDocument();
    expect(view.container.querySelector('[name="ship-silhouette"]')).toBeNull();
    expect(assets.read).not.toHaveBeenCalled();
  });

  it.each(SHIP_CLASSES)('keeps the game controls usable when the %s model returns 404', ship => {
    const url = `/__ref/dist/lite/v2/yarik/ships/${ship}.glb`;
    assets.failures.set(url, 'fetch responded with 404');
    const open = vi.fn();
    const view = render(<ErrorBoundary>
      <button onClick={open}>Open fleet</button>
      <ShipBody model={{ url, engines: [], nozzle: 0.03, ktx2: false }} lit={false} />
    </ErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: 'Open fleet' }));
    expect(open).toHaveBeenCalledOnce();
    expect(assets.read).toHaveBeenCalledWith(url);
    expect(view.container.querySelector('primitive')).toBeNull();
    expect(view.container.querySelector('[name="ship-silhouette"]')).toBeNull();
  });

  it('loads another commander ship after a failure without reloading the game', () => {
    assets.failures.set('broken.glb', 'Invalid glTF');
    const body = (url: string) => <ErrorBoundary><button>Hangar</button>
      <ShipBody model={{ url, engines: [], nozzle: 0.03, ktx2: false }} lit={false} />
    </ErrorBoundary>;
    const view = render(body('broken.glb'));
    expect(screen.getByRole('button', { name: 'Hangar' })).toBeInTheDocument();
    expect(view.container.querySelector('primitive')).toBeNull();
    view.rerender(body('healthy.glb'));
    expect(view.container.querySelector('primitive')).not.toBeNull();
  });

  it.each(['fetch responded with 404', 'Failed to fetch', 'Invalid glTF'])(
    'hides an individual hull on %s and recovers when its URL changes', async message => {
      assets.failures.set('broken-hull.glb', message);
      const body = (url: string) => <ErrorBoundary><button>Galaxy</button>
        <Hull url={url} scale={1} glow="#fff" focused={false} />
      </ErrorBoundary>;
      const view = render(body('broken-hull.glb'));
      expect(screen.getByRole('button', { name: 'Galaxy' })).toBeInTheDocument();
      expect(view.container.querySelector('[name="craft-hull"]')).toBeNull();
      view.rerender(body('healthy-hull.glb'));
      await waitFor(() => { expect(view.container.querySelector('[name="craft-hull"]')).not.toBeNull(); });
    },
  );

  it.each(['full', 'low'] as const)('keeps the map open when a fleet\'s base %s model fails', tier => {
    assets.failures.set(tier === 'full' ? HULL_MODEL.CITADEL : HULL_LOD_MODEL.CITADEL, 'fetch responded with 404');
    const view = render(<ErrorBoundary><button>Galaxy</button>
      <FormationHulls markers={[{ hull: 'CITADEL', ordinal: 0, filled: 1 }]} slots={[[0, 0, 0]]}
        scale={1} aimDistance={{ current: 100 }} focused={false} />
    </ErrorBoundary>);
    expect(screen.getByRole('button', { name: 'Galaxy' })).toBeInTheDocument();
    expect(view.container.querySelector('[name="formation-hulls-citadel"]')).toBeNull();
  });

  it('restores an individual hull after a temporary network failure without a page reload', async () => {
    assets.failures.set('temporary.glb', 'Failed to fetch');
    const view = render(<ErrorBoundary><button>Galaxy</button>
      <Hull url="temporary.glb" scale={1} glow="#fff" focused={false} />
    </ErrorBoundary>);
    expect(view.container.querySelector('[name="craft-hull"]')).toBeNull();
    assets.failures.delete('temporary.glb');
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => { expect(view.container.querySelector('[name="craft-hull"]')).not.toBeNull(); });
    expect(screen.getByRole('button', { name: 'Galaxy' })).toBeInTheDocument();
  });

  it.each(['full', 'low'] as const)('restores a formation when its base %s model becomes available again', async tier => {
    const url = tier === 'full' ? HULL_MODEL.CITADEL : HULL_LOD_MODEL.CITADEL;
    assets.failures.set(url, 'Failed to fetch');
    const view = render(<ErrorBoundary><button>Galaxy</button>
      <FormationHulls markers={[{ hull: 'CITADEL', ordinal: 0, filled: 1 }]} slots={[[0, 0, 0]]}
        scale={1} aimDistance={{ current: 100 }} focused={false} />
    </ErrorBoundary>);
    expect(view.container.querySelector('[name="formation-hulls-citadel"]')).toBeNull();
    assets.failures.delete(url);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => { expect(view.container.querySelector('[name="formation-hulls-citadel"]')).not.toBeNull(); });
    expect(screen.getByRole('button', { name: 'Galaxy' })).toBeInTheDocument();
  });

  it('keeps the existing base-model fallback when a cosmetic fails, and contains its failure too', () => {
    const equipment: ShipCosmeticEquipment = { CORSAIR: 'ship-red-dragon' };
    const { model } = shipHullModels('CORSAIR', equipment);
    assets.failures.set(model, 'fetch responded with 404');
    const body = (key: string) => <ErrorBoundary><button>Galaxy</button>
      <FormationHulls key={key} markers={[{ hull: 'CORSAIR', ordinal: 0, filled: 1 }]} slots={[[0, 0, 0]]}
        scale={1} aimDistance={{ current: 100 }} focused={false} shipSkins={equipment} />
    </ErrorBoundary>;
    const view = render(body('cosmetic-failed'));
    expect(view.container.querySelector('[name="formation-hulls-corsair"]')).not.toBeNull();
    assets.failures.set(HULL_MODEL.CORSAIR, 'fetch responded with 404');
    view.rerender(body('both-failed'));
    expect(screen.getByRole('button', { name: 'Galaxy' })).toBeInTheDocument();
    expect(view.container.querySelector('[name="formation-hulls-corsair"]')).toBeNull();
  });
});
