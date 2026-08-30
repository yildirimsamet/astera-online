import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { DEATH_STAR } from '@astera/rules';
import type { Contact, PendingThread } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import { FullRate } from './frames.jsx';
import {
  ringTexture,
  fireTexture,
  publicEffectIntensity,
  smokeTexture,
  sparkTexture,
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

interface BurstLobe {
  offset: Vec3Tuple;
  delay: number;
  size: number;
  drift: number;
}

/** Stable particles: everybody watching one mission sees the same destruction. */
const seeded = (text: string): (() => number) => {
  let state = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    state ^= text.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export function deathStarBurstLayout(id: string, count = 22): BurstLobe[] {
  const random = seeded(id);
  return Array.from({ length: count }, (_, i) => {
    const angle = random() * Math.PI * 2;
    const radial = 0.14 + random() * 0.76;
    return {
      offset: [
        Math.cos(angle) * radial,
        (random() - 0.5) * 0.72,
        Math.sin(angle) * radial,
      ],
      delay: i === 0 ? 0 : 0.018 + random() * 0.16,
      size: 0.7 + random() * 1.15,
      drift: 0.5 + random() * 1.1,
    };
  });
}

function Impact({ event }: { event: DeathStarImpactEvent }) {
  const root = useRef<THREE.Group>(null);
  const core = useRef<THREE.Sprite>(null);
  const rings = useRef<(THREE.Sprite | null)[]>([]);
  const fireballs = useRef<(THREE.Sprite | null)[]>([]);
  const smokeClouds = useRef<(THREE.Sprite | null)[]>([]);
  const shell = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const fire = useMemo(fireTexture, []);
  const ring = useMemo(ringTexture, []);
  const smoke = useMemo(smokeTexture, []);
  const lobes = useMemo(() => deathStarBurstLayout(event.id), [event.id]);

  useFrame(() => {
    const elapsed = Math.max(0, serverNow() - event.at) / DEATH_STAR_IMPACT_MS;
    if (root.current) root.current.visible = elapsed < 1;
    const pulse = Math.min(1, elapsed * 8.5);
    if (core.current) {
      const size = event.radius * (0.7 + pulse * 4.6);
      core.current.scale.set(size, size, 1);
      core.current.material.opacity = Math.max(0, 1 - elapsed * 3.7) * event.intensity;
    }
    for (const [i, sprite] of rings.current.entries()) {
      if (!sprite) continue;
      const offset = i * 0.105;
      const progress = Math.max(0, Math.min(1, (elapsed - offset) / (0.38 + i * 0.1)));
      const size = event.radius * (0.9 + progress * (4.7 + i * 0.75));
      sprite.visible = elapsed >= offset && progress < 1;
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = Math.sin(progress * Math.PI)
        * (0.56 - i * 0.17)
        * event.intensity;
    }
    lobes.forEach((lobe, i) => {
      const sprite = fireballs.current[i];
      if (!sprite) return;
      const progress = Math.max(0, Math.min(1, (elapsed - lobe.delay) / 0.5));
      const visible = elapsed >= lobe.delay && progress < 1;
      sprite.visible = visible;
      // Ignition starts across the struck hemisphere, not as one regular blob at
      // the exact centre. The lobe then tears outward from that surface point.
      const travel = event.radius * (0.34 + lobe.drift * progress);
      sprite.position.set(
        lobe.offset[0] * travel,
        lobe.offset[1] * travel,
        lobe.offset[2] * travel,
      );
      const size = event.radius * lobe.size * (0.26 + Math.sin(progress * Math.PI) * 0.92);
      sprite.scale.set(size, size, 1);
      sprite.material.opacity = visible
        ? Math.sin(progress * Math.PI) * 0.88 * event.intensity
        : 0;
    });
    lobes.slice(0, 9).forEach((lobe, i) => {
      const sprite = smokeClouds.current[i];
      if (!sprite) return;
      const delay = 0.14 + lobe.delay * 0.6;
      const progress = Math.max(0, Math.min(1, (elapsed - delay) / 0.78));
      sprite.visible = elapsed >= delay && progress < 1;
      const travel = event.radius * lobe.drift * (0.48 + progress * 1.55);
      sprite.position.set(
        lobe.offset[0] * travel,
        lobe.offset[1] * travel + event.radius * progress * 0.3,
        lobe.offset[2] * travel,
      );
      const size = event.radius * lobe.size * (0.72 + progress * 2.4);
      sprite.scale.set(size, size, 1);
      sprite.material.rotation = i * 0.79 + progress * (i % 2 === 0 ? 0.35 : -0.35);
      sprite.material.opacity = Math.sin(progress * Math.PI) * 0.54 * event.intensity;
    });
    if (shell.current) {
      const progress = Math.min(1, elapsed / 0.18);
      shell.current.scale.setScalar(event.radius * (1.01 + progress * 0.12));
      const material = shell.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, (1 - progress) * 0.52) * event.intensity;
    }
    if (light.current) {
      light.current.intensity = Math.max(0, 52 * (1 - elapsed * 2.4) ** 3)
        * event.intensity;
    }
  });

  return (
    <group ref={root} name="death-star-impact" position={event.position}>
      <FullRate />
      <pointLight ref={light} color="#ff7840" distance={event.radius * 22} intensity={52} decay={2} />
      <sprite ref={core} renderOrder={1310}>
        <spriteMaterial map={fire} color="#fff4d4" transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {['#ffe8b8', '#ff512f'].map((colour, i) => (
        <sprite
          key={colour}
          ref={(node) => { rings.current[i] = node; }}
          renderOrder={1307 - i}
        >
          <spriteMaterial map={ring} color={colour} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      {lobes.map((lobe, i) => (
        <sprite
          key={`fire-${String(i)}`}
          ref={(node) => { fireballs.current[i] = node; }}
          position={lobe.offset}
          renderOrder={1305}
        >
          <spriteMaterial map={fire} color={i % 3 === 0 ? '#fff0ba' : '#ff7538'} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      {lobes.slice(0, 9).map((lobe, i) => (
        <sprite
          key={`smoke-${String(i)}`}
          ref={(node) => { smokeClouds.current[i] = node; }}
          position={lobe.offset}
          renderOrder={1299}
        >
          <spriteMaterial map={smoke} color={i % 2 === 0 ? '#6e4a47' : '#423b43'} transparent depthTest={false} depthWrite={false} />
        </sprite>
      ))}
      <ImpactDebris event={event} />
      <mesh ref={shell} renderOrder={1300}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#ff3b19" transparent opacity={0.78} depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function ImpactDebris({ event }: { event: DeathStarImpactEvent }) {
  const points = useRef<THREE.Points>(null);
  const spark = useMemo(sparkTexture, []);
  const particles = useMemo(() => {
    const random = seeded(`${event.id}:debris`);
    return Array.from({ length: 96 }, () => {
      const theta = random() * Math.PI * 2;
      const z = random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - z * z));
      const speed = event.radius * (0.75 + random() * 2.1);
      return {
        velocity: new THREE.Vector3(Math.cos(theta) * radial, z * 0.7, Math.sin(theta) * radial)
          .multiplyScalar(speed),
        delay: random() * 0.24,
      };
    });
  }, [event.id, event.radius]);
  const geometry = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(new Float32Array(particles.length * 3), 3));
    return buffer;
  }, [particles.length]);
  const material = useMemo(() => new THREE.PointsMaterial({
    map: spark,
    color: '#ffb34c',
    size: event.radius * 0.12,
    transparent: true,
    opacity: 1,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    toneMapped: false,
  }), [event.radius, spark]);

  useFrame(() => {
    const elapsed = Math.max(0, serverNow() - event.at) / 1_000;
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    particles.forEach((particle, i) => {
      const seconds = Math.max(0, elapsed - particle.delay);
      const drag = Math.max(0, 1 - seconds * 0.055);
      position.setXYZ(
        i,
        particle.velocity.x * seconds * drag,
        particle.velocity.y * seconds * drag - event.radius * 0.045 * seconds * seconds,
        particle.velocity.z * seconds * drag,
      );
    });
    position.needsUpdate = true;
    material.opacity = Math.max(0, 1 - elapsed / 6.3) * event.intensity;
    if (points.current) points.current.visible = elapsed < DEATH_STAR_IMPACT_MS / 1_000;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={1304}
      name="death-star-impact-debris"
    />
  );
}
