import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MOON } from '@astera/rules';
import type { GalaxyMoons } from '../api/schemas.js';
import { serverNow } from '../lib/clock.js';
import createAstralGate, { type AstralGateInstance } from '../vfx/astralGate.js';
import { moonOrbitPosition, moonRadiusFor } from './moonOrbit.js';

/*
  VFX BRIEF — the public Moon Gate flash (owner, 2026-11-24)
  - In the world: a commander opened a moon's gate. Beside that moon the Astral Gate stands open for the
    flash window (violet where a fleet left, cyan where one arrived) and folds shut at its end.
  - Asset: library/vfx/portal/00gamedevs-vfx/astral-gate.js (in the game as src/vfx/astralGate.ts, MIT).
  - Why: it is the very gate the commander saw on their own jump, so anyone reads "a gate was used there";
    a structure in space, not a ring or halo laid over the moon.
*/

interface Flashes { arrivals: readonly { planetId: string; at: Date }[]; departures: readonly { planetId: string; at: Date }[] }

export interface GateFlash {
  key: string;
  planetId: string;
  side: 'arrival' | 'departure';
  ageSec: number;
  /** In the last moments of the window: the gate folds shut. */
  closing: boolean;
}

/** The gate's own fold-shut time (`astralGate` END_DURATION), so it is shut when the window ends. */
const CLOSE_SECONDS = 0.8;

/** The flashes still inside their window, minus worlds whose own warp is already drawing a gate there. */
export function activeGateFlashes(flashes: Flashes, nowMs: number, quiet: ReadonlySet<string>): GateFlash[] {
  const out: GateFlash[] = [];
  const add = (side: GateFlash['side'], rows: readonly { planetId: string; at: Date }[]) => {
    for (const row of rows) {
      const ageSec = (nowMs - row.at.getTime()) / 1_000;
      if (ageSec < 0 || ageSec > MOON.flashSeconds || quiet.has(row.planetId)) continue;
      out.push({ key: `${side}:${row.planetId}:${String(row.at.getTime())}`, planetId: row.planetId, side, ageSec,
        closing: ageSec >= MOON.flashSeconds - CLOSE_SECONDS });
    }
  };
  add('arrival', flashes.arrivals);
  add('departure', flashes.departures);
  return out;
}

/** Gates kept ready per side: a handful of gates opened in sight at once is already a busy minute. */
const PER_SIDE = 3;
const COLOR: Record<GateFlash['side'], string> = { arrival: '#7fe3f0', departure: '#c1b8ff' };

interface Slot { side: GateFlash['side']; gate: AstralGateInstance; holder: THREE.Group; key: string | null; stopped: boolean }

const _moon = { x: 0, y: 0, z: 0 };
const _out = new THREE.Vector3();
const _up = new THREE.Vector3();
const _side = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const ALT_UP = new THREE.Vector3(1, 0, 0);

export function MoonGateFlashes({ moons, nodes, quiet }: {
  readonly moons?: GalaxyMoons | undefined;
  readonly nodes: readonly { id: string; position: readonly [number, number, number]; radius: number }[];
  /** Worlds whose own Moon Gate warp is playing: that warp already draws their gates. */
  readonly quiet: ReadonlySet<string>;
}) {
  const slots = useMemo<Slot[]>(() => (['arrival', 'departure'] as const).flatMap((side) =>
    Array.from({ length: PER_SIDE }, () => {
      const gate = createAstralGate({ size: 1, speed: 1, detail: 1, color: COLOR[side] });
      const holder = new THREE.Group();
      holder.visible = false;
      holder.add(gate.group);
      return { side, gate, holder, key: null, stopped: false };
    })), []);
  useEffect(() => () => { for (const slot of slots) slot.gate.dispose(); }, [slots]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  useFrame((_, dt) => {
    const nowMs = serverNow();
    const active = moons ? activeGateFlashes(moons.flashes, nowMs, quiet) : [];
    const live = new Set(active.map((f) => f.key));
    for (const slot of slots) if (slot.key !== null && !live.has(slot.key)) { slot.key = null; slot.holder.visible = false; }
    for (const flash of active) {
      let slot = slots.find((s) => s.key === flash.key);
      if (!slot) {
        slot = slots.find((s) => s.key === null && s.side === flash.side);
        if (!slot) continue;
        slot.key = flash.key;
        slot.stopped = false;
        slot.gate.reset();
        slot.gate.update(Math.min(flash.ageSec, 2)); // joined late: open, not replaying the whole minute
      }
      const node = nodeById.get(flash.planetId);
      const seed = moons?.list.find((m) => m.planetId === flash.planetId)?.visualSeed;
      if (!node || seed === undefined) { slot.holder.visible = false; continue; }
      if (flash.closing && !slot.stopped) { slot.stopped = true; slot.gate.stop(); }
      slot.gate.update(dt);
      moonOrbitPosition({ x: node.position[0], y: node.position[1], z: node.position[2] }, node.radius, seed, nowMs / 1_000, _moon);
      const r = moonRadiusFor(node.radius, moons?.rarity[flash.planetId]);
      // Standing just outside the moon, facing away from its world.
      _out.set(_moon.x - node.position[0], _moon.y - node.position[1], _moon.z - node.position[2]).normalize();
      _side.crossVectors(_out, Math.abs(_out.y) > 0.92 ? ALT_UP : UP).normalize();
      _up.crossVectors(_side, _out).normalize();
      _basis.makeBasis(_out, _up, _side);
      slot.holder.quaternion.setFromRotationMatrix(_basis);
      slot.holder.position.set(_moon.x, _moon.y, _moon.z).addScaledVector(_out, r * 1.9);
      slot.holder.position.addScaledVector(_up, -r * 1.45 * 0.9); // the gate's art stands on its base: centre it
      slot.holder.scale.setScalar(r * 0.9);
      slot.holder.visible = !slot.gate.finished;
    }
  });

  return <group name="moon-gate-flashes">{slots.map((slot, i) => <primitive key={i} object={slot.holder} />)}</group>;
}
