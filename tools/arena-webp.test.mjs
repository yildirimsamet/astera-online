import { describe, expect, it } from 'vitest';
import { FALLBACK, fallbackClasses } from './arena-webp.mjs';

const ship = key => ({ model: `/__ref/dist/lite/v2/yarik/ships/${key}.glb`, uvFlip: false, rotateY: 0, unit: true, pbr: true, lods: 3, engines: [[0.1, 0, -0.4]], nozzle: 0.05 });

describe('the webp fallback pack (S22 2026-10-26: a 32-bit Chrome cannot start the transcoder)', () => {
  it('points the lite webp manifest\'s class ships at their webp copies and keeps everything else', () => {
    const classes = { akinci: ship('akinci'), muhafiz: ship('muhafiz'), kilavuz: ship('kilavuz') };
    const out = fallbackClasses(classes);
    for (const key of ['akinci', 'muhafiz', 'kilavuz']) {
      expect(out[key]).toEqual({ ...classes[key], model: `/__ref/dist/lite/v2/yarik/ships-webp/${key}.glb` });
    }
    expect(classes.akinci.model).toBe('/__ref/dist/lite/v2/yarik/ships/akinci.glb');
  });

  it('keeps every map at most 512 px: webp decodes to full RGBA on the GPU', () => {
    expect(FALLBACK.px).toBe(512);
    expect(FALLBACK.ships).toBe('dist/lite/v2/yarik/ships-webp');
  });
});
