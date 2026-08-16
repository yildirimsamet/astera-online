import { useMemo, useRef } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { SatelliteId } from '@blindspace/rules';
import { ORBITAL_ART } from '../ui/assets.js';
import type { PlanetNode } from './scene.js';

/**
 * EVERY INSTRUMENT ANYONE HAS BUILT, IN ORBIT, VISIBLE TO EVERYONE.
 *
 * D15: hardware is public, readings are not. A satellite is a physical object —
 * you can see one from a distance the same way you can see that a planet is
 * large — so it is drawn for every world in the galaxy, not only your own. What
 * is never published is the LEVEL: an Aegis is visible, its shield strength is
 * not, and shield strength is what actually decides a raid.
 *
 * Two things this buys the game. Deterrence becomes a real strategy, because a
 * visibly instrumented world is one people route around. And building something
 * finally shows up somewhere other people can see it, which is the ownership
 * pillar's missing feedback loop — a Ring full of hardware is the closest thing
 * this game has to a trophy case.
 *
 * DRAWN AS: one instanced mesh per instrument type, so the whole galaxy's
 * hardware is four draw calls however many planets carry it. Each instance is
 * billboarded, which keeps the renders readable from any camera angle and costs
 * one quaternion copy.
 */

/** Bodies are drawn only this close. Past it they are noise around a dot. */
const VISIBLE_WITHIN = 34;

/** Orbit geometry, relative to the planet's own radius. */
const ORBIT_RADIUS = 1.6;
const ORBIT_TILT = 0.38;
/** Seconds for a full circuit. Slow enough to read as an orbit, not a fan. */
const PERIOD = 46;

const TYPES: readonly SatelliteId[] = ['TELESCOPE', 'RADAR', 'VEIL', 'AEGIS', 'DRILL'];

interface Body {
  planet: PlanetNode;
  /** Where this one sits in its planet's ring, so they never overlap. */
  index: number;
  of: number;
}

export function Satellites({ nodes }: { nodes: readonly PlanetNode[] }) {
  const byType = useMemo(() => {
    const map = new Map<SatelliteId, Body[]>();
    for (const planet of nodes) {
      planet.satellites.forEach((type, index) => {
        const list = map.get(type) ?? [];
        list.push({ planet, index, of: planet.satellites.length });
        map.set(type, list);
      });
    }
    return map;
  }, [nodes]);

  return (
    <>
      {TYPES.map((type) => {
        const bodies = byType.get(type);
        if (!bodies || bodies.length === 0) return null;
        return <Ring key={type} type={type} bodies={bodies} />;
      })}
    </>
  );
}

function Ring({ type, bodies }: { type: SatelliteId; bodies: Body[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const texture = useLoader(THREE.TextureLoader, ORBITAL_ART[type]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  /**
   * A fixed phase per body, so a planet's instruments are spread around its ring
   * rather than stacked, and two planets are never in step with each other.
   */
  const phases = useMemo(
    () =>
      bodies.map((body, i) => {
        const spread = (body.index / Math.max(1, body.of)) * Math.PI * 2;
        // Hashed from the planet id: the same world keeps the same arrangement
        // between sessions, which is what makes it recognisable rather than
        // decorative.
        let h = 2166136261;
        for (let c = 0; c < body.planet.id.length; c++) {
          h = Math.imul(h ^ body.planet.id.charCodeAt(c), 16777619);
        }
        return spread + ((Math.abs(h) % 360) / 360) * Math.PI * 2 + i * 0.0001;
      }),
    [bodies],
  );

  useFrame(({ clock }) => {
    const node = mesh.current;
    if (!node) return;
    const t = (clock.elapsedTime / PERIOD) * Math.PI * 2;
    let drawn = 0;

    bodies.forEach((body, i) => {
      const [px, py, pz] = body.planet.position;
      // Cheap distance gate: a satellite twenty planet-widths away is a flickering
      // pixel, and fifty planets' worth of them is a haze over the whole disc.
      const far =
        (camera.position.x - px) ** 2 +
          (camera.position.y - py) ** 2 +
          (camera.position.z - pz) ** 2 >
        VISIBLE_WITHIN ** 2;
      if (far) return;

      const angle = t + (phases[i] ?? 0);
      const orbit = body.planet.radius * ORBIT_RADIUS;
      dummy.position.set(
        px + Math.cos(angle) * orbit,
        py + Math.sin(angle) * orbit * ORBIT_TILT,
        pz + Math.sin(angle) * orbit,
      );
      dummy.quaternion.copy(camera.quaternion);
      const size = body.planet.radius * 0.42;
      dummy.scale.set(size, size, size);
      dummy.updateMatrix();
      node.setMatrixAt(drawn, dummy.matrix);
      drawn += 1;
    });

    node.count = drawn;
    node.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, bodies.length]}
      frustumCulled={false}
      renderOrder={2}
    >
      <planeGeometry args={[1, 1]} />
      {/*
        alphaTest rather than transparency: these overlap each other and the
        planets constantly, and sorted transparency between fifty billboards is
        exactly the depth mess the planet field already had to be rescued from.
      */}
      <meshBasicMaterial map={texture} transparent alphaTest={0.3} depthWrite={false} />
    </instancedMesh>
  );
}
