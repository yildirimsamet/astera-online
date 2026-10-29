import type { CraftPicking } from './CraftHitTargets.js';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { ShipCosmeticEquipment } from '@astera/rules';
import type { FormationHulls } from './Fleets.js';
import { formationEngineUnits } from './engineUnits.js';
import { hullVisualScale } from './flightVisual.js';
import { createFormationHullMatrixScratch, formationHullMatrix } from './formationHullInstances.js';
import { useGalaxyCulling, useVisualFrame } from './visualFrame.js';
import { createLocalVisibility, localSphereVisible } from './formationVisibility.js';
import { serverNow } from '../lib/clock.js';
import { towCablePoint, towAnchor, towRoll, type TowedHull } from './towing.js';
import type { Marker } from './Squadrons.js';
import type { Vec3Tuple } from './scene.js';

interface Props extends CraftPicking {
  tows: readonly TowedHull[];
  tug: Marker;
  tugSlot: Vec3Tuple;
  scale: number;
  aimDistance: RefObject<number>;
  focused: boolean;
  HullsComponent: typeof FormationHulls;
  shipSkins?: ShipCosmeticEquipment;
}

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN: Vec3Tuple[] = [[0, 0, 0]];

/** All interlocking links and attachment collars share one draw call and one tiny torus. */
export function TowedShips({tows, tug, tugSlot, scale, aimDistance, focused, HullsComponent, shipSkins, onPointerUp}: Props) {
  const chain = useRef<THREE.InstancedMesh>(null);
  const canCull = useGalaxyCulling();
  const visibility = useMemo(createLocalVisibility, []);
  const radius = useMemo(() => tows.reduce((bound, tow) => Math.max(bound,
    Math.hypot(...tow.position) + hullVisualScale(tow.hull, scale) + scale * 2), 0), [tows, scale]);
  const tugAnchor = useMemo(() => {
    const nozzles = formationEngineUnits([tug], [tugSlot], scale, shipSkins)[0]!.nozzles;
    const anchor: Vec3Tuple = [0, 0, 0];
    for (const nozzle of nozzles) {
      anchor[0] += nozzle[0] / nozzles.length;
      anchor[1] += nozzle[1] / nozzles.length;
      anchor[2] += nozzle[2] / nozzles.length;
    }
    anchor[2] += .025;
    return anchor;
  }, [tug, tugSlot, scale, shipSkins]);
  useLayoutEffect(() => { chain.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage); }, []);
  const counts = useMemo(() => tows.map((tow, index) => {
    const previous = tows[index - 1];
    const distance = previous ? previous.position[2] - tow.position[2] : tugSlot[2] - tow.position[2];
    return Math.max(8, Math.min(index === 0 ? 48 : 24, Math.ceil(distance / (scale * .13))));
  }), [tows, tugSlot, scale]);
  const total = counts.reduce((sum, count) => sum + count + 2, 0);
  const scratch = useMemo(() => ({matrix: new THREE.Matrix4(), matrixScratch: createFormationHullMatrixScratch(),
    anchor: new THREE.Vector3(), point: [0, 0, 0] as Vec3Tuple, next: [0, 0, 0] as Vec3Tuple,
    start: [0, 0, 0] as Vec3Tuple, end: [0, 0, 0] as Vec3Tuple,
    position: new THREE.Vector3(), size: new THREE.Vector3(), direction: new THREE.Vector3(),
    rotation: new THREE.Quaternion(), twist: new THREE.Quaternion()}), []);

  useVisualFrame(({camera}) => {
    const mesh = chain.current;
    if (!mesh) return;
    mesh.visible = !canCull || localSphereVisible(visibility, camera, mesh, radius);
    if (!mesh.visible) return;
    let instance = 0;
    const time = serverNow() / 1000;
    for (const [index, tow] of tows.entries()) {
      const previous = tow.previous >= 0 ? tows[tow.previous] : undefined;
      if (previous) {
        towAnchor(previous, scale, time * 1000, tow.previous, false, scratch.start);
      } else {
        formationHullMatrix(tug, tugSlot, scale, aimDistance.current, scratch.matrix, scratch.matrixScratch);
        scratch.anchor.set(...tugAnchor).applyMatrix4(scratch.matrix);
        scratch.anchor.toArray(scratch.start);
      }
      towAnchor(tow, scale, time * 1000, index, true, scratch.end);
      const drop = scale * .06;
      const count = counts[index]!;
      for (let link = 0; link < count; link++) {
        const t = (link + .5) / count;
        towCablePoint(scratch.start, scratch.end, drop, t, scratch.point);
        towCablePoint(scratch.start, scratch.end, drop, t + .01, scratch.next);
        // Slow flex is bounded and zero at the hulls, preserving both attachment points.
        scratch.point[0] += Math.sin(t * Math.PI) * Math.sin(time * .7 - t * 5 + index) * scale * .035;
        scratch.next[0] += Math.sin((t + .01) * Math.PI) * Math.sin(time * .7 - (t + .01) * 5 + index) * scale * .035;
        scratch.direction.set(scratch.next[0] - scratch.point[0], scratch.next[1] - scratch.point[1], scratch.next[2] - scratch.point[2]);
        const spacing = scratch.direction.length() / (.01 * count);
        scratch.rotation.setFromUnitVectors(UP, scratch.direction.normalize());
        scratch.twist.setFromAxisAngle(UP, link % 2 * Math.PI / 2);
        scratch.rotation.multiply(scratch.twist);
        scratch.position.set(...scratch.point);
        scratch.size.set(scale * .031, Math.max(scale * .031, spacing * .73), scale * .031);
        scratch.matrix.compose(scratch.position, scratch.rotation, scratch.size);
        mesh.setMatrixAt(instance++, scratch.matrix);
      }
      for (const point of [scratch.start, scratch.end]) {
        scratch.position.set(...point);
        scratch.rotation.identity();
        scratch.size.setScalar(scale * .045);
        scratch.matrix.compose(scratch.position, scratch.rotation, scratch.size);
        mesh.setMatrixAt(instance++, scratch.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <group name="towed-prize-chain">
    <instancedMesh ref={chain} args={[undefined, undefined, total]} name="tow-chain-links" frustumCulled={false}>
      <torusGeometry args={[1, .24, 4, 8]} />
      <meshStandardMaterial color="#a0a6ac" metalness={.65} roughness={.48} emissive="#4e5964" emissiveIntensity={.1} />
    </instancedMesh>
    {tows.map((tow, index) => <TowedShip key={`${tow.hull}:${index}`} tow={tow} index={index}
      scale={scale} focused={focused} HullsComponent={HullsComponent} onPointerUp={onPointerUp} />)}
  </group>;
}

function TowedShip({tow, index, scale, focused, HullsComponent, onPointerUp}: CraftPicking & {
  tow: TowedHull; index: number; scale: number; focused: boolean; HullsComponent: typeof FormationHulls;
}) {
  const hull = useRef<THREE.Group>(null);
  const aim = useRef(1e6);
  const markers = useMemo<Marker[]>(() => [{hull: tow.hull, filled: 1, ordinal: 0}], [tow.hull]);
  useVisualFrame(() => {
    // Axial roll leaves the nose and tail attached while making the powerless hull read as dead weight.
    if (hull.current) hull.current.rotation.z = towRoll(serverNow(), index);
  });
  return <group name="towed-prize" position={tow.position} ref={hull} userData={{hull: tow.hull, chainIndex: index}}>
    <HullsComponent markers={markers} slots={ORIGIN} scale={scale} aimDistance={aim} focused={focused} onPointerUp={onPointerUp} />
  </group>;
}
