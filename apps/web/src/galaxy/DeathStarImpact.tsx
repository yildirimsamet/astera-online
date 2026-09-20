import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEATH_STAR } from '@astera/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { FullRate } from './frames.jsx';
import {
  ringTexture,
  publicEffectIntensity,
} from './vfx.js';
import { toWorld, type PlanetNode, type Vec3Tuple } from './scene.js';

/** Long enough to read as an event, short enough not to obscure the next decision. */
export const DEATH_STAR_IMPACT_MS = DEATH_STAR.impactSeconds * 1000;

export interface DeathStarImpactEvent {
  id: string;
  at: number;
  position: Vec3Tuple;
  radius: number;
  intensity: number;
}

/** The clock, rather than a timer callback, decides whether the event exists. */
export const isDeathStarImpactVisible = (at: number, now: number): boolean =>
  now >= at && now < at + DEATH_STAR_IMPACT_MS;

export function mergeRetainedDeathStarImpacts(
  current: readonly DeathStarImpactEvent[],
  candidates: readonly DeathStarImpactEvent[],
  now: number,
): DeathStarImpactEvent[] {
  const merged = new Map(candidates.map((event) => [event.id, event]));
  for (const event of current) {
    /*
      A future candidate disappearing is a cancellation, not an impact refetch.

      The owner can schedule the target blast from their pending Death Star before
      it arrives. If an interceptor destroys it, that pending row disappears while
      the original arrival is still in the future. Retaining it here manufactured
      a planet explosion at that old arrival time. A real strike disappears only
      once its authoritative impact has begun, which is the one case retention is
      for: keep those live frames through the resolving refetch.
    */
    if (event.at <= now && !merged.has(event.id)) merged.set(event.id, event);
  }
  return [...merged.values()]
    .filter((event) => event.at + DEATH_STAR_IMPACT_MS > now)
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

const radiusAt = (position: Vec3Tuple, nodes: readonly PlanetNode[]): number => {
  let nearest: PlanetNode | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (const node of nodes) {
    const d = Math.hypot(
      node.position[0] - position[0],
      node.position[1] - position[1],
      node.position[2] - position[2],
    );
    if (d < distance) {
      distance = d;
      nearest = node;
    }
  }
  return nearest?.radius ?? 0.82;
};

/**
 * Resolve the one public fact needed by the cinematic: where and when it lands.
 * Foreign traffic only qualifies in its final, destination-clamped window; before
 * that `to` is deliberately just a bearing and must never be treated as a target.
 */
export function deathStarImpactCandidates(
  pending: readonly PendingThread[],
  contacts: readonly Contact[],
  nodes: readonly PlanetNode[],
): DeathStarImpactEvent[] {
  const events = new Map<string, DeathStarImpactEvent>();
  const add = (event: DeathStarImpactEvent): void => {
    const current = events.get(event.id);
    if (!current || event.intensity >= current.intensity) events.set(event.id, event);
  };
  for (const thread of pending) {
    if (thread.kind !== 'death_star' || thread.leg === 'return' || !thread.id || !thread.path) continue;
    const position = toWorld(thread.path.to);
    add({
      id: thread.id,
      at: thread.path.arriveAt.getTime(),
      position,
      radius: radiusAt(position, nodes),
      intensity: 1,
    });
  }
  /**
   * A STRANGER'S EXPLOSION COMES OFF THE PUBLISHED MOMENT, NEVER OFF THE FLIGHT. D106.
   *
   * `impact` is an instant and a point the server states outright, exactly as
   * `engagement` states a bombardment — so the defender's screen and every
   * bystander's fire the same detonation, at the same second, at the same world as
   * the attacker's. Reading it off the end of a bearing window instead is what made
   * this effect the attacker's private cinema: only a client that happened to hold
   * the final window could reconstruct it at all, and it drew the blast wherever
   * that window happened to stop.
  */
  for (const contact of contacts) {
    if (!contact.impact) continue;
    const position = toWorld(contact.impact.target);
    add({
      id: contact.id,
      at: contact.impact.at.getTime(),
      position,
      radius: radiusAt(position, nodes),
      intensity: publicEffectIntensity(contact.effectOnly === true),
    });
  }
  return [...events.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/**
 * Retains a scheduled impact after the traffic refetch removes its consumed
 * mission. Without this small registry the live broadcast could unmount the
 * effect on its first frame—the faster the server answered, the less players saw.
 */
export function DeathStarImpacts({
  pending,
  contacts,
  nodes,
}: {
  pending: readonly PendingThread[];
  contacts: readonly Contact[];
  nodes: readonly PlanetNode[];
}) {
  const candidates = useMemo(
    () => deathStarImpactCandidates(pending, contacts, nodes),
    [pending, contacts, nodes],
  );
  const [retained, setRetained] = useState<DeathStarImpactEvent[]>(candidates);

  useEffect(() => {
    const now = serverNow();
    setRetained((current) => mergeRetainedDeathStarImpacts(current, candidates, now));
  }, [candidates]);

  useEffect(() => {
    if (retained.length === 0) return;
    const nextExpiry = Math.min(...retained.map((event) => event.at + DEATH_STAR_IMPACT_MS));
    const delay = nextExpiry - serverNow();
    if (delay <= 0) {
      setRetained((current) => current.filter((event) => event.at + DEATH_STAR_IMPACT_MS > serverNow()));
      return;
    }
    if (delay > 2_147_483_647) return;
    const timer = setTimeout(() => {
      setRetained((current) => current.filter((event) => event.at + DEATH_STAR_IMPACT_MS > serverNow()));
    }, delay);
    return () => { clearTimeout(timer); };
  }, [retained]);

  return (
    <>
      {retained.map((event) => <TimedImpact key={event.id} event={event} />)}
    </>
  );
}

export function TimedImpact({ event }: { event: DeathStarImpactEvent }) {
  const [active, setActive] = useState(() => isDeathStarImpactVisible(event.at, serverNow()));

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sync = (): void => { setActive(isDeathStarImpactVisible(event.at, serverNow())); };
    const arm = (at: number): void => {
      const delay = at - serverNow();
      if (delay > 0 && delay <= 2_147_483_647) timers.push(setTimeout(sync, delay));
    };
    sync();
    arm(event.at);
    arm(event.at + DEATH_STAR_IMPACT_MS);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, [event.at]);

  return active ? <Impact event={event} /> : null;
}

function Impact({ event }: { event: DeathStarImpactEvent }) {
  const root = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Sprite>(null);
  const rings = useRef<(THREE.Sprite | null)[]>([]);
  const shell = useRef<THREE.Mesh>(null);
  const arcs = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const ring = useMemo(ringTexture, []);

  useFrame((_state, delta) => {
    const elapsed = Math.max(0, serverNow() - event.at) / DEATH_STAR_IMPACT_MS;
    if (root.current) root.current.visible = elapsed < 1;
    const opening = Math.min(1, elapsed * 12);
    const fade = Math.max(0, 1 - elapsed);

    if (flash.current) {
      const size = event.radius * (0.6 + opening * 3.4);
      flash.current.scale.set(size, size, 1);
      flash.current.material.opacity = Math.max(0, 1 - elapsed * 5) * event.intensity;
    }
    rings.current.forEach((sprite, i) => {
      if (!sprite) return;
      const delay = i * 0.07;
      const progress = Math.max(0, Math.min(1, (elapsed - delay) / 0.5));
      sprite.visible = elapsed >= delay && progress < 1;
      const size = event.radius * (1 + progress * (5.5 + i));
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(progress * Math.PI)
        * (0.75 - i * 0.16)
        * event.intensity;
    });
    if (shell.current) {
      shell.current.rotation.y += delta * 4.2;
      shell.current.rotation.z -= delta * 2.7;
      shell.current.scale.setScalar(event.radius * (1.05 + opening * 0.75));
      (shell.current.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, 0.62 - elapsed * 0.75) * event.intensity;
    }
    arcs.current.forEach((arc, i) => {
      if (!arc) return;
      arc.rotation.x += delta * (2.1 + i * 0.5);
      arc.rotation.y -= delta * (2.8 + i * 0.35);
      arc.scale.setScalar(event.radius * (1.2 + opening * (1.4 + i * 0.18)));
      (arc.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, fade * (0.8 - i * 0.12)) * event.intensity;
    });
    if (light.current) {
      light.current.intensity = Math.max(0, 60 * (1 - elapsed * 3.2) ** 3)
        * event.intensity;
    }
  });

  return (
    <group ref={root} name="death-star-emp-impact" position={event.position}>
      <FullRate />
      <pointLight ref={light} color="#63f5ff" distance={event.radius * 24} intensity={60} decay={2} />
      <sprite ref={flash} renderOrder={1310}>
        <spriteMaterial
          map={ring}
          color="#e8ffff"
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      {['#bffcff', '#53d9ff', '#8b7cff'].map((colour, i) => (
        <sprite key={colour} ref={(node) => { rings.current[i] = node; }} renderOrder={1308 - i}>
          <spriteMaterial
            map={ring}
            color={colour}
            transparent
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </sprite>
      ))}
      <mesh ref={shell} renderOrder={1305}>
        <icosahedronGeometry args={[1, 2]} />
        <meshBasicMaterial
          color="#52eaff"
          wireframe
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(node) => { arcs.current[i] = node; }}
          rotation={[i * 0.9, i * 0.65, i * 1.15]}
          renderOrder={1306}
        >
          <torusGeometry args={[1, 0.018 + i * 0.004, 8, 64, Math.PI * (1.15 + i * 0.2)]} />
          <meshBasicMaterial
            color={i === 2 ? '#a58cff' : '#7af7ff'}
            transparent
            depthTest={false}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
