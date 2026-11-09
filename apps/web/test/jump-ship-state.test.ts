import { JUMP_FLIGHT } from '@astera/rules';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { JumpingShipState } from '../src/galaxy/JumpingShip.js';
import { shipStateAt } from '../src/galaxy/jumpShipState.js';

const fresh = (): JumpingShipState => ({ at: new THREE.Vector3(), facing: new THREE.Quaternion(), lever: 0, turbo: 0, vanish: 0 });
const nose = (state: JumpingShipState) => new THREE.Vector3(0, 0, 1).applyQuaternion(state.facing);
const from = [150, 40, -140] as const, stop = [30, 6, -40] as const;

describe('the ship on the jump\'s clock', () => {
  it('waits at its berth already facing its way, dark', () => {
    // A turn while the drive caught swung the hull out of an upright phone's frame (preview 2026-11-09).
    for (const s of [0.5, JUMP_FLIGHT.lit]) {
      const state = shipStateAt(from, stop, s, fresh());
      expect(nose(state).dot(new THREE.Vector3(stop[0] - from[0], stop[1] - from[1], stop[2] - from[2]).normalize())).toBeCloseTo(1);
    }
    const state = shipStateAt(from, stop, 0.5, fresh());
    expect(state.at.toArray()).toEqual([...from]);
    expect(state.lever).toBe(0);
  });

  it('burns the long flame while it is fast, and not at the berth or the stop', () => {
    expect(shipStateAt(from, stop, 2, fresh()).turbo).toBe(0);
    expect(shipStateAt(from, stop, 10, fresh()).turbo).toBeCloseTo(0.7);
    expect(shipStateAt(from, stop, JUMP_FLIGHT.arrive - 1, fresh()).turbo).toBe(0);
  });

  it('stops at the end of its way and is gone after the burst', () => {
    const state = shipStateAt(from, stop, JUMP_FLIGHT.gone, fresh());
    state.at.toArray().forEach((value, i) => { expect(value).toBeCloseTo(stop[i]!); });
    expect(state.vanish).toBe(1);
    expect(shipStateAt(from, stop, JUMP_FLIGHT.arrive, fresh()).vanish).toBe(0);
  });
});
