import { useEffect } from 'react';
import type { PlanetMoon } from '../../api/schemas.js';
import { planetView } from '../../../test/fixtures.js';
import { MoonPanel, type MoonScanResult } from '../../screens/MoonPanel.js';
import { BaseSwitch } from '../hud/BaseSwitch.js';
import { Sheet } from '../kit/Sheet.js';
import { ATMOSPHERE } from '../../ui/atmosphere.js';

const MIN = 60_000;
const noop = (): void => undefined;
const never = (): Promise<never> => new Promise<never>(noop);

/** The Moon page of the Base (Ay F9), in the states a commander meets it. */
export type MoonGalleryState = 'locked' | 'none' | 'dock' | 'gate' | 'scan';

const moon = (now: number): PlanetMoon => ({
  rarity: 'RARE',
  origin: 'BATTLE',
  cracks: 2,
  crackLimit: 5,
  lastHitAt: new Date(now - 3 * 60 * MIN),
  gateReadyAt: null,
  closedUntil: null,
  visualSeed: 42,
  fleet: { DART: 24, TALON: 8 },
  fleetDamage: [],
  fleetCombatReady: { DART: 24, TALON: 8 },
  dockUsed: 420,
  dockCapacity: 1_550,
  dockFree: 1_130,
  scanRange: 2_250,
  scanPierces: false,
  moves: [{
    id: 'mv-1', kind: 'HOP_UP', fromPlanetId: 'p-1', toPlanetId: 'p-1', fleet: { DART: 6 },
    departAt: new Date(now - 30_000), arriveAt: new Date(now + 60_000),
  }],
});

export function GalleryMoon({ state }: { state: MoonGalleryState }) {
  const now = Date.now();
  const planet = planetView({
    buildings: { CORE: 10, SHIPYARD: 6, HANGAR: 5 },
    fleet: { DART: 40, TALON: 10, WARDEN: 2 },
    research: [{ id: 'LUNAR_CAPTURE', level: state === 'locked' ? 0 : 1 }],
    moon: state === 'locked' || state === 'none' ? null : moon(now),
  } as Parameters<typeof planetView>[0], { id: 'p-1', name: 'Thistle', alloy: 48_000, crystal: 22_000, deuterium: 3_400 });
  const tab = state === 'gate' ? 'gate' : state === 'scan' ? 'scan' : null;
  useEffect(() => {
    if (tab === null) return undefined;
    const timer = window.setTimeout(() => {
      // The Base switch is the first tab list; the moon's own dock | gate | scan is the second.
      const lists = document.querySelectorAll('[role="tablist"]');
      const button = lists[1]?.querySelectorAll('[role="tab"]')[tab === 'gate' ? 1 : 2];
      if (button instanceof HTMLElement) button.click();
    }, 300);
    return () => { window.clearTimeout(timer); };
  }, [tab]);
  return (
    <Sheet bleed title="Thistle" titleLang="en" eyebrow="Samet" headerArt={ATMOSPHERE.baseWorld} kit={{ tone: 'self' }} onClose={noop} detents={['full']}>
      <BaseSwitch value="moon" onChange={noop} moonAvailable arenaAvailable />
      <MoonPanel
        planet={planet}
        moonsEnabled
        otherMoons={[
          { planetId: 'p-2', name: 'Kestrel', position: { x: 900, y: 0, z: 0 }, rarity: 'COMMON', dockFree: 300, dockCapacity: 470, gateReadyAt: null, closedUntil: null },
          { planetId: 'p-3', name: 'Vireo', position: { x: -1_400, y: 0, z: 200 }, rarity: 'EPIC', dockFree: 3_250, dockCapacity: 3_250, gateReadyAt: new Date(now + 95 * MIN), closedUntil: null },
        ]}
        scanTargets={[
          { planetId: 't-1', name: 'Marrow', distance: 640, isPlayer: true, ownerLabel: 'Vex' },
          { planetId: 't-2', name: 'Halcyon', distance: 1_210, isPlayer: true, ownerLabel: 'Orrin' },
          { planetId: 't-3', name: 'Dust 7', distance: 1_900, isPlayer: false },
        ]}
        worldNames={new Map([['t-1', 'Marrow'], ['t-2', 'Halcyon'], ['p-1', 'Thistle']])}
        onOrderMoon={never}
        onHop={never}
        onJump={never}
        onScan={(): Promise<MoonScanResult> => never()}
      />
    </Sheet>
  );
}
