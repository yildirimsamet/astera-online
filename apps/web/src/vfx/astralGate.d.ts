import type * as THREE from 'three';

export interface AstralGateOptions {
  speed?: number;
  detail?: number;
  color?: string;
  size?: number;
  density?: number;
}

export interface AstralGateInstance {
  readonly group: THREE.Group;
  readonly finished: boolean;
  readonly phase: string;
  update(deltaSeconds: number): void;
  stop(): void;
  reset(): void;
  dispose(): void;
}

export const defaultOptions: Required<AstralGateOptions>;
export default function createAstralGate(options?: AstralGateOptions): AstralGateInstance;
