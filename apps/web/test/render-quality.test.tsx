import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  QUALITY_PRESETS,
  RENDER_QUALITIES,
  renderPreset,
  renderQuality,
  setRenderQuality,
  useRenderQuality,
} from '../src/lib/quality.js';

/**
 * WHAT A DEVICE IS ASKED TO SPEND ON THE GALAXY.
 *
 * Players reported the phone getting hot. The cost of this scene is per PIXEL and
 * paid several times over — a multisampled half-float scene target, a luminance
 * pass, a mipmap chain and a composite — so the dial is the ceiling on the device
 * pixel ratio and nothing else.
 *
 * Every invariant here is invisible in a screenshot, which is why it needs a test:
 * a preset that silently forces a ratio UP, a composer left sized for the previous
 * ratio, or a rung that stopped buying coverage samples all look perfectly fine in
 * a still frame and are wrong on the device.
 */

const source = (path: string): string =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

const CANVAS = 'src/galaxy/GalaxyCanvas.tsx';

describe('the quality ladder', () => {
  it('offers three rungs, most expensive first', () => {
    expect(RENDER_QUALITIES).toEqual(['high', 'balanced', 'low']);
    expect(Object.keys(QUALITY_PRESETS).sort()).toEqual(['balanced', 'high', 'low']);
  });

  /**
   * THE TOP RUNG IS WHAT THE GAME ALREADY SHIPPED. A player who wants the picture
   * they had before this feature existed must be able to get exactly it back, so
   * the ceiling at the top of the ladder is the `[1, 2]` clamp `GalaxyCanvas` has
   * always carried.
   */
  it('keeps the shipped image available at the top', () => {
    expect(QUALITY_PRESETS.high.dprCap).toBe(2);
  });

  it('falls, and only falls, as the ladder descends', () => {
    const caps = RENDER_QUALITIES.map((id) => QUALITY_PRESETS[id].dprCap);
    for (const [index, cap] of caps.entries()) {
      if (index === 0) continue;
      expect(cap, `${RENDER_QUALITIES[index]!} must cost less than the rung above`)
        .toBeLessThan(caps[index - 1]!);
    }
  });

  /**
   * EVERY RUNG BUYS COVERAGE SAMPLES, and the bottom one needs them most.
   *
   * The owner's report after the first drop was that a rock's tail and the hairline
   * on a world's limb came apart into steps. Both are thin GEOMETRY — a ribbon of
   * tapering quads and a ring under two per cent of a world across — so both fall
   * under one pixel of coverage and multisampling is the only thing that draws
   * them at all. Setting this to zero to save a resolve would spend the picture on
   * exactly the preset with the least of it left.
   */
  it('never turns multisampling off, at any rung', () => {
    for (const id of RENDER_QUALITIES) {
      expect(QUALITY_PRESETS[id].multisampling, `${id} must still resolve edges`)
        .toBeGreaterThanOrEqual(2);
    }
  });
});

describe('the stored preference', () => {
  beforeEach(() => {
    setRenderQuality('balanced');
  });

  it('reports the current rung and its preset together', () => {
    setRenderQuality('low');
    expect(renderQuality()).toBe('low');
    expect(renderPreset()).toBe(QUALITY_PRESETS.low);
  });

  it('writes the choice to the device, so a reload does not ask again', () => {
    setRenderQuality('high');
    expect(globalThis.localStorage.getItem('astera.quality')).toBe('high');
  });

  /**
   * A CHANGE REDRAWS EVERY READER, and choosing what is already chosen does not.
   *
   * Exercised through the hook rather than the private listener set, because the
   * hook IS the contract: `useSyncExternalStore` is the store's only consumer, and
   * a subscribe that failed to fire would leave the canvas rendering at the old
   * ceiling while the menu showed the new one.
   */
  it('redraws its readers on a real change, and not on a repeat', () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useRenderQuality();
    });

    expect(result.current).toBe('balanced');
    const settled = renders;

    act(() => { setRenderQuality('low'); });
    expect(result.current).toBe('low');
    expect(renders).toBeGreaterThan(settled);

    const afterChange = renders;
    act(() => { setRenderQuality('low'); });
    expect(renders).toBe(afterChange);
  });
});

describe('the canvas spends what the preset says', () => {
  const canvas = source(CANVAS);

  /**
   * A CLAMP, NEVER A FIXED NUMBER. `[1, cap]` keeps fiber's own behaviour — take
   * the device's ratio, then clamp it — so a preset can only ever lower what a
   * screen already asks for. A bare `dpr={1.5}` on a desktop at 1 would render half
   * again as many pixels as the display has and throw them away, which would make
   * the cheap rung the expensive one.
   */
  it('hands the ratio over as a ceiling', () => {
    expect(canvas).toMatch(/dpr=\{\[1, preset\.dprCap\]\}/);
  });

  it('takes its multisampling from the same preset', () => {
    expect(canvas).toMatch(/multisampling=\{preset\.multisampling\}/);
  });

  /**
   * THE COMPOSER MUST BE REBUILT WHEN THE CEILING MOVES, and nothing else will do
   * it. `EffectComposer` sizes its buffers in an effect keyed on the CSS box and
   * `postprocessing` then multiplies by `renderer.getPixelRatio()` at that moment.
   * Changing the preset moves the ratio without moving the CSS box, so no
   * dependency fires: the scene keeps rendering into buffers built for the old
   * ratio, and the picture comes out scaled and cropped rather than merely slower.
   *
   * This is exactly the class of bug a screenshot of the DEFAULT preset cannot
   * catch, because it only appears after a player changes the setting.
   */
  it('replaces the composer when the resolution ceiling changes', () => {
    const composer = canvas.slice(canvas.indexOf('<EffectComposer'));
    /*
      THE CEILING IS IN THE KEY; IT IS NO LONGER THE WHOLE KEY. A lost WebGL
      context is the second thing that has to rebuild this composer — a phone
      that backgrounds the tab hands back a NEW context, and every render target
      the old one allocated died with the old one (`gpuContext.ts`). So the
      assertion is that the ceiling participates, not that it is alone.
    */
    expect(composer.slice(0, composer.indexOf('>'))).toMatch(/key=\{[^}]*preset\.dprCap/);
  });
});

/**
 * TONE MAPPING WAS TRIED HERE AND TAKEN BACK OUT. This is a regression test for a
 * decision, not for a line.
 *
 * `onCreated` used to set `gl.toneMapping = ACESFilmicToneMapping`, which never did
 * anything: `@react-three/postprocessing` forces the renderer to `NoToneMapping`
 * for as long as a composer is mounted. Adding a real `<ToneMapping>` effect made
 * it take effect immediately — and the owner's report was that the disc went dark,
 * the background galaxy and the central dust cloud both gone.
 *
 * That is the correct behaviour of a filmic curve and the wrong change to make on
 * its own. Every colour in `galaxy/` was authored by eye against a linear
 * passthrough, and a curve's toe takes the faint end first — which in this scene is
 * most of the scene. A mapping goes in with a re-grade of those values or not at
 * all, and the next person to notice the missing ACES line will otherwise put it
 * straight back.
 */
describe('the composer applies no tone mapping', () => {
  const canvas = source(CANVAS);

  /** A mounted element, never the docblock that explains why there is not one. */
  it('mounts no tone mapping effect', () => {
    expect(canvas).not.toMatch(/^\s*<ToneMapping/m);
  });

  it('sets none on the renderer either, where it would be silently overridden', () => {
    expect(canvas).not.toMatch(/^\s*gl\.toneMapping\s*=/m);
  });

  it('says why, so it is not read as an omission', () => {
    expect(canvas).toMatch(/NO TONE MAPPING, ON PURPOSE/);
  });
});
