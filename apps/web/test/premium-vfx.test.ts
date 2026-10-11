import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { atlasFrame, ownedAtlas } from '../src/galaxy/atlas.js';
import { strategicEjecta, strategicLayers, bombardmentLayers } from '../src/galaxy/strategicLayers.js';

describe('atlas playback', () => {
  it('clamps the entire lifetime, including exact end and invalid clocks, within the declared grid', () => {
    const texture = new THREE.Texture();
    for (const progress of [-1, 0, 0.49, 1, 20, Number.NaN]) {
      atlasFrame(texture, progress, 7);
      expect(texture.offset.x).toBeGreaterThanOrEqual(0);
      expect(texture.offset.x).toBeLessThan(1);
      expect(texture.offset.y).toBeGreaterThanOrEqual(0);
      expect(texture.offset.y).toBeLessThan(1);
    }
    atlasFrame(texture, 1, 7);
    expect(texture.offset.x).toBeCloseTo(6 / 7);
    expect(texture.offset.y).toBe(0);
  });

  it('owns UV transforms but shares pixel storage; one simultaneous explosion cannot advance another', () => {
    const source = new THREE.Texture();
    const first = ownedAtlas(source, 8), second = ownedAtlas(source, 8);
    expect(first.source).toBe(source.source);
    atlasFrame(first, 0.7, 8);
    expect(second.offset.toArray()).toEqual([0, 0.875]);
    expect(source.repeat.toArray()).toEqual([1, 1]);
    expect(first.generateMipmaps).toBe(false);
    expect(first.repeat.toArray()).toEqual([0.125, 0.125]);
    first.dispose(); second.dispose();
  });
});

describe('server-clock strategic impact layers', () => {
  it('shows nothing before the event or after its eight-second lifetime', () => {
    for (const seconds of [-2, 8, 100]) {
      const frame = strategicLayers(seconds, 'surface');
      expect(frame.flash + frame.fire + frame.shock + frame.smoke + frame.debris).toBe(0);
    }
  });

  it('stages hot ignition, moving fire and cooling smoke instead of keeping every layer on', () => {
    const opening = strategicLayers(0.04, 'surface');
    const burning = strategicLayers(0.7, 'surface');
    const cooling = strategicLayers(3.5, 'surface');
    expect(opening.flash).toBeGreaterThan(burning.flash);
    expect(burning.fire).toBeGreaterThan(0);
    expect(cooling.fire).toBe(0);
    expect(cooling.smoke).toBeGreaterThan(opening.smoke);
    expect(strategicLayers(7.9, 'surface').smoke).toBe(0);
  });

  it('never paints a surface shock front or long smoke when the missile is intercepted in space', () => {
    for (const seconds of [0.05, 0.5, 1, 2, 4, 7]) {
      const frame = strategicLayers(seconds, 'interception');
      expect(frame.shock).toBe(0);
      if (seconds >= 2) expect(frame.fire + frame.smoke + frame.debris).toBe(0);
    }
  });

  it('evaluates the same late/revisited timestamp identically without accumulating delta', () => {
    const frame = strategicLayers(2.45, 'surface');
    strategicLayers(0.1, 'surface');
    expect(strategicLayers(2.45, 'surface')).toEqual(frame);
  });
});


describe('destructive cinematic timing and ejecta', () => {
  it('keeps the strategic fire energetic at the start, then spends the retained tail on cooling dust', () => {
    expect(strategicLayers(0.3, 'surface').fire).toBeGreaterThan(0.85);
    expect(strategicLayers(1.3, 'surface').fire).toBeGreaterThan(0.55);
    expect(strategicLayers(5.2, 'surface').smoke).toBeGreaterThan(0.12);
    expect(strategicLayers(6.8, 'surface').debris).toBeGreaterThan(0);
  });

  it('rejects corrupt clocks instead of writing NaN transforms or opacity to the GPU', () => {
    for (const at of [Number.NaN, Infinity, -Infinity]) {
      expect(Object.values(strategicLayers(at, 'surface')).every(Number.isFinite)).toBe(true);
      const frame = bombardmentLayers(at);
      expect(frame.fire + frame.smoke + frame.flash + frame.ejecta).toBe(0);
    }
  });

  it('breaks ejecta into an irregular repeatable cloud with real depth, varied speed and silhouette', () => {
    const fragments = strategicEjecta('impact-1', 24);
    expect(fragments).toEqual(strategicEjecta('impact-1', 24));
    expect(fragments).not.toEqual(strategicEjecta('impact-2', 24));
    expect(fragments).toHaveLength(24);
    for (const fragment of fragments) {
      expect(Math.hypot(...fragment.direction)).toBeCloseTo(1, 8);
      expect(fragment.speed).toBeGreaterThan(0.8);
      expect(fragment.size).toBeGreaterThan(0);
      expect(fragment.delay).toBeGreaterThanOrEqual(0);
    }
    expect(new Set(fragments.map((bit) => bit.speed.toFixed(3))).size).toBeGreaterThan(18);
    expect(fragments.some((bit) => bit.direction[2] > 0.5)).toBe(true);
    expect(fragments.some((bit) => bit.direction[2] < -0.5)).toBe(true);
  });

  it('fits violent missile ignition, turbulent fire and dark cooling dust inside the existing one-second burn', () => {
    expect(bombardmentLayers(-0.1).fire).toBe(0);
    expect(bombardmentLayers(0.03).flash).toBeGreaterThan(0.7);
    expect(bombardmentLayers(0.22).fire).toBeGreaterThan(0.85);
    expect(bombardmentLayers(0.78).smoke).toBeGreaterThan(0.25);
    expect(bombardmentLayers(0.78).fire).toBeLessThan(0.15);
    const after = bombardmentLayers(1.01);
    expect(after.fire + after.smoke + after.flash + after.ejecta).toBe(0);
  });
});
