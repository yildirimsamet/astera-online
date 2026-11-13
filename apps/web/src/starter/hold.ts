import { STARTER } from '@astera/rules';

/**
 * HOW FULL THE HOLD IS, 0 TO 1 (plan 2026-11-13 §4.4): alloy and crystal weigh the same, store and works
 * alike, each up to what the jump carries, so it reads 1 only when both are full (`holdIsFull`).
 */
export function holdShare(held: { alloy: number; crystal: number; bufferAlloy: number; bufferCrystal: number }): number {
  const alloy = Math.min(1, (held.alloy + held.bufferAlloy) / STARTER.carry.alloy);
  const crystal = Math.min(1, (held.crystal + held.bufferCrystal) / STARTER.carry.crystal);
  return (alloy + crystal) / 2;
}
