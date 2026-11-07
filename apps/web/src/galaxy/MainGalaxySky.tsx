import { useMemo } from 'react';
import { VIEW, toWorld, type Vec3 } from '@astera/rules';
import type { MainSky } from '../api/starterSchemas.js';
import { Core } from './Environment.js';
import { HitboxMaterial } from './hitboxDebug.js';
import { markHit, wasTap } from './tap.js';
import { mainSkyClouds, mainSkyMonuments } from './mainSky.js';
import { Monuments } from './Monuments.js';
import { RadiationHaze } from './RadiationHaze.js';

const NOBODY: never[] = [];
/** About the monument shell, the galaxy's true edge. */
const TAP_RADIUS = 5000 / VIEW.scale;
const ignore = (): void => undefined;

/**
 * THE REAL MAIN GALAXY, SEEN FROM A STARTER GALAXY, drawn by the main game's own renderers so that the
 * player arrives where they have been looking. Its worlds go through `PlanetField` with the ships
 * here (`mainSkyNodes`), and this draws the rest. Each starter galaxy stands at its own `offset`.
 * Asteroids, pirates, fleets and events are never sent, and nothing can be picked, because the two
 * galaxies do not touch (K1).
 */
export function MainGalaxySky({ monuments = [], clouds = [], offset, onTap }: {
  monuments?: MainSky['monuments'];
  clouds?: MainSky['clouds'];
  offset: Vec3;
  /** The whole galaxy can be tapped and no world in it can: the answer is a line of public facts. */
  onTap?: () => void;
}) {
  const standing = useMemo(() => mainSkyMonuments(monuments, offset), [monuments, offset]);
  const haze = useMemo(() => mainSkyClouds(clouds, new Date(0), offset), [clouds, offset]);
  return (
    <>
      <RadiationHaze hpClouds={haze} />
      <group name="main-galaxy-sky" position={toWorld(offset)}>
        <Core />
        <mesh onPointerUp={(event) => { if (!onTap || !wasTap()) return; markHit(); event.stopPropagation(); onTap(); }}>
          <sphereGeometry args={[TAP_RADIUS, 12, 8]} />
          <HitboxMaterial kind="fleet" />
        </mesh>
      </group>
      <Monuments quiet monuments={standing} planets={NOBODY} focusedId={null} onSelect={ignore} />
    </>
  );
}
