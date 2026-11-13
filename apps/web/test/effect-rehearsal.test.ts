import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createRehearsal } from '../src/galaxy/rehearsal.js';

/**
 * A HIDDEN EFFECT DRAWS ITSELF ONCE BEFORE ITS MOMENT (S22, 2026-11-13). The first nuclear strike of
 * a session froze 151–182 ms on the frame of impact, compiling its shaders and uploading its art on
 * that frame. While the weapon is still in flight the strike now draws each of its parts once, one a
 * frame, through the scene's own pipeline, so the frame of impact only draws.
 */
describe('a hidden effect rehearses before its moment', () => {
  const build = () => {
    const root = new THREE.Group();
    root.visible = false;
    const mesh = new THREE.Mesh();
    const sprite = new THREE.Sprite();
    sprite.visible = false;
    const points = new THREE.Points();
    const inner = new THREE.Group();
    inner.add(sprite, points);
    root.add(mesh, inner);
    return { root, inner, parts: [mesh, sprite, points] as const };
  };
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshBasicMaterial();
  // jsdom has no WebGL; the callback never reads its renderer.
  const renderer = {} as THREE.WebGLRenderer;
  const draw = (part: THREE.Object3D) => { part.onAfterRender(renderer, scene, camera, geometry, material, new THREE.Group()); };
  const shown = (parts: readonly THREE.Object3D[]) => parts.map((part) => part.visible);

  it('shows one part at a time, with the effect itself showing while it rehearses', () => {
    const { root, inner, parts } = build();
    const rehearsal = createRehearsal(root);
    expect(rehearsal.next()).toBe(true);
    expect(root.visible).toBe(true);
    expect(inner.visible).toBe(true);
    expect(shown(parts)).toEqual([true, false, false]);
  });

  it('moves on only once the part it shows has really been drawn', () => {
    const { root, parts } = build();
    const rehearsal = createRehearsal(root);
    rehearsal.next();
    rehearsal.next();
    expect(shown(parts)).toEqual([true, false, false]);
    draw(parts[0]);
    rehearsal.next();
    expect(shown(parts)).toEqual([false, true, false]);
  });

  it('a draw of a part it is not showing does not count', () => {
    const { root, parts } = build();
    const rehearsal = createRehearsal(root);
    rehearsal.next();
    draw(parts[0]);
    rehearsal.next();
    draw(parts[2]);
    rehearsal.next();
    expect(shown(parts)).toEqual([false, true, false]);
  });

  it('once every part has drawn, puts each back as it was and hides the effect', () => {
    const { root, parts } = build();
    const rehearsal = createRehearsal(root);
    for (const part of parts) { rehearsal.next(); draw(part); }
    expect(rehearsal.next()).toBe(false);
    expect(root.visible).toBe(false);
    expect(shown(parts)).toEqual([true, false, true]);
    expect(rehearsal.next()).toBe(false);
  });

  it('ending early, because the moment has come, puts everything back the same way', () => {
    const { root, parts } = build();
    const rehearsal = createRehearsal(root);
    rehearsal.next();
    rehearsal.end();
    expect(shown(parts)).toEqual([true, false, true]);
    expect(rehearsal.next()).toBe(false);
    expect(shown(parts)).toEqual([true, false, true]);
  });

  it('what was already listening for a draw hears each one once, during the rehearsal and after it', () => {
    const { root, parts } = build();
    let heard = 0;
    parts[0].onAfterRender = () => { heard += 1; };
    const rehearsal = createRehearsal(root);
    rehearsal.next();
    draw(parts[0]);
    expect(heard).toBe(1);
    rehearsal.end();
    draw(parts[0]);
    expect(heard).toBe(2);
  });

  it('nothing to draw is nothing to rehearse', () => {
    const root = new THREE.Group();
    root.visible = false;
    expect(createRehearsal(root).next()).toBe(false);
    expect(root.visible).toBe(false);
  });
});
