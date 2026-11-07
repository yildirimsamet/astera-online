import { EffectPass, Pass } from 'postprocessing';
import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { ditherOutput } from '../src/galaxy/GalaxyPostprocessing.js';

describe('the galaxy picture', () => {
  it('dithers its effect pass, which is what breaks up the rings in dark space', () => {
    const pass = new EffectPass(new PerspectiveCamera());
    ditherOutput({ passes: [new Pass(), pass] });
    expect(pass.dithering).toBe(true);
  });

  it('has nothing to do before the composer exists', () => {
    expect(() => { ditherOutput(null); }).not.toThrow();
  });
});
