import { useLoader } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Matrix4, Mesh, Quaternion, Vector3, Euler, type InstancedMesh, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Vec3 } from '@astera/rules';
import { HitboxMaterial } from './hitboxDebug.js';
import { VESSEL_NOSE_TURN, starterShipYaw, vesselGroups, type NeighbourShip, type VesselGroup } from './mainSky.js';
import { VESSEL_LENGTH } from './scene.js';
import { markHit, wasTap } from './tap.js';

/** As long as your own: same class of ship. Yours reads larger only by being closer. */
const LENGTH = VESSEL_LENGTH;

const isMesh = (node: Object3D): node is Mesh => node instanceof Mesh;

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => { if (isMesh(node)) found.push(node); });
  return found;
}

/** One state of one hull, whoever wears it. A model holds few meshes; each is one instanced draw. */
function HullInstances({ group, offset }: { group: VesselGroup; offset: Vec3 }) {
  const gltf = useLoader(GLTFLoader, group.file, loader => { loader.setMeshoptDecoder(MeshoptDecoder); });
  const meshes = useMemo(() => meshesOf(gltf.scene), [gltf]);
  return (
    <>
      {meshes.map(mesh => <HullPart key={mesh.uuid} mesh={mesh} ships={group.ships} offset={offset} />)}
    </>
  );
}

function HullPart({ mesh, ships, offset }: { mesh: Mesh; ships: readonly NeighbourShip[]; offset: Vec3 }) {
  const ref = useRef<InstancedMesh>(null);
  useEffect(() => {
    const instanced = ref.current;
    if (!instanced) return;
    const placed = new Matrix4();
    const size = new Vector3(LENGTH, LENGTH, LENGTH);
    ships.forEach((ship, index) => {
      const yaw = starterShipYaw(ship.position, offset) + VESSEL_NOSE_TURN;
      placed.compose(new Vector3(...ship.position), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), size).multiply(mesh.matrixWorld);
      instanced.setMatrixAt(index, placed);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [ships, mesh, offset]);
  return <instancedMesh key={ships.length} ref={ref} args={[mesh.geometry, mesh.material, ships.length]} raycast={() => null} />;
}

/**
 * THE OTHER SHIPS IN THIS GALAXY: real hulls at their places, and a press opens the card on them.
 * Nobody here is drawn as they truly are until a probe has said what they are (§3.11).
 */
export function VesselField({ ships, offset, onSelect }: {
  ships: readonly NeighbourShip[];
  offset: Vec3;
  onSelect: (id: string) => void;
}) {
  const groups = useMemo(() => vesselGroups(ships), [ships]);
  return (
    <>
      {ships.map(ship => (
        <mesh
          key={ship.id}
          position={ship.position}
          onPointerUp={(event) => { if (!wasTap()) return; markHit(); event.stopPropagation(); onSelect(ship.id); }}
        >
          <sphereGeometry args={[0.8, 8, 6]} />
          <HitboxMaterial kind="fleet" />
        </mesh>
      ))}
      {groups.map(group => (
        <Suspense key={group.file} fallback={null}><HullInstances group={group} offset={offset} /></Suspense>
      ))}
    </>
  );
}
