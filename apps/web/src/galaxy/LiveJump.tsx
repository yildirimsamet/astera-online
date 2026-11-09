import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { holdJumpStill, revealSecond, type Jump } from '../starter/jump.js';
import { movedNode, type JumpWorld } from '../starter/jumpWorld.js';
import { planetModel } from '../ui/assets.js';
import { useGLTF } from '@react-three/drei';
import { JumpingShip } from './JumpingShip.js';
import { jumpCamera, jumpStop, type JumpPath, type OpeningPose, type Point } from './jumpCamera.js';
import { shipStateAt } from './jumpShipState.js';
import { Streaks } from './JumpStreaks.js';
import { PlanetField } from './PlanetField.js';

const NO_RIVALS = [] as const;
const ignore = (): void => undefined;
const LOOK = new THREE.Vector3(), AHEAD = new THREE.Vector3();
/** Far enough to hold both galaxies while the ship crosses between them. */
const JUMP_FAR = 4000;

/** The flight's last frame as a picture, taken after the frame has drawn (the composer is priority 1). */
function StillTaker() {
  const gl = useThree(state => state.gl);
  const taken = useRef(false);
  useFrame(() => {
    if (taken.current) return;
    taken.current = true;
    // A lost context answers an empty picture: then there is no still, and the move goes over plain space.
    try {
      const frame = gl.domElement.toDataURL('image/jpeg', 0.92);
      if (frame.length > 1000) holdJumpStill(frame);
    } catch { /* No still: as above. */ }
  }, 2);
  return null;
}

/**
 * THE JUMP, FLOWN IN THE PLAYER'S OWN GALAXY VIEW (owner, 2026-11-09): "farklı bir animasyon filmi oynuyor
 * gibi". The ship leaves from where it stands, among its own neighbours; the camera eases off the
 * player's view onto it, follows it across the gap into the main galaxy, and stops it at the foot of the
 * new world. Everything here is in the main galaxy's frame, moved by `offset` into this galaxy's.
 */
export function LiveJump({ jump, world, offset }: { jump: Jump; world: JumpWorld; offset: Point }) {
  const camera = useThree(state => state.camera);
  const invalidate = useThree(state => state.invalidate);
  const path = useMemo<JumpPath>(() => ({ from: world.from, planet: world.planet, radius: world.radius, ship: world.ship }), [world]);
  const stop = useMemo(() => jumpStop(path), [path]);
  // Where it is drawn is where it is sized: the galaxy view picks a world's model by its distance.
  const destination = useMemo(() => [movedNode(world.destination, offset)], [world, offset]);
  // The best model of the new world is on its way from the press: it fills the screen at the end.
  useEffect(() => { useGLTF.preload(planetModel(world.destination.id, 'full')); }, [world]);
  const clock = useRef(0);
  const reveal = revealSecond(jump);
  const [taking, setTaking] = useState(false);
  // Where the player was looking at the press, in the main frame: the flight starts from that view.
  const opening = useMemo<OpeningPose>(() => {
    const ship = new THREE.Vector3(world.from[0] + offset[0], world.from[1] + offset[1], world.from[2] + offset[2]);
    camera.getWorldDirection(AHEAD);
    const look = camera.position.clone().addScaledVector(AHEAD, camera.position.distanceTo(ship));
    return {
      position: [camera.position.x - offset[0], camera.position.y - offset[1], camera.position.z - offset[2]],
      target: [look.x - offset[0], look.y - offset[1], look.z - offset[2]],
    };
  // Taken once, at the press: later frames are the flight's own.
  }, []);
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.far = Math.max(camera.far, JUMP_FAR);
    camera.updateProjectionMatrix();
  }, [camera]);
  // First in the frame (priority -1): the ship and the streaks read this clock after it is set, so the
  // camera and the hull are on the same instant. Read a frame late, the hull shook against the lens.
  useFrame(() => {
    const s = (performance.now() - jump.origin) / 1000;
    clock.current = s;
    const pose = jumpCamera(path, s, opening);
    camera.position.set(pose.position[0] + offset[0], pose.position[1] + offset[1], pose.position[2] + offset[2]);
    LOOK.set(pose.target[0] + offset[0], pose.target[1] + offset[1], pose.target[2] + offset[2]);
    camera.up.set(...pose.up);
    camera.lookAt(LOOK);
    if (camera instanceof THREE.PerspectiveCamera && camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    if (!taking && s >= reveal - 0.15) setTaking(true);
    // The view draws on demand: the flight asks for every frame.
    invalidate();
  }, -1);
  return (
    <>
    <Suspense fallback={null}>
      <PlanetField nodes={destination} selectedId={null} rivals={NO_RIVALS} onSelect={ignore} marks={false} />
    </Suspense>
    <group position={offset}>
      <Streaks path={path} clock={clock} />
      <JumpingShip hull={jump.hull} look={jump.look} poseAt={(into) => { shipStateAt(path.from, stop, clock.current, into); }} />
      {taking && <StillTaker />}
    </group>
    </>
  );
}
