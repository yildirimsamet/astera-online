import { describe, expect, it } from 'vitest';
import { wreckShape } from '../src/galaxy/Wrecks.js';
import { STARTER_MODEL_SCALE } from '../src/galaxy/scene.js';

describe('starter wreck models keep their proportions', () => {
  it.each([true, false])('halves every dimension, including a void heap (%s)', isVoid => {
    const main = wreckShape(0.8, isVoid);
    const starter = wreckShape(0.8, isVoid, STARTER_MODEL_SCALE);
    expect(starter.ringRadius).toBe(main.ringRadius / 2);
    expect(starter.tube).toBe(main.tube / 2);
  });
});
