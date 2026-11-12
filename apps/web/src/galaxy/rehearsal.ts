import * as THREE from 'three';

export interface Rehearsal {
  /** Shows the next part still to draw and the effect around it; false once there is none. */
  next(): boolean;
  /** Puts every part back as it was. The moment has come, or the rehearsal is over. */
  end(): void;
}

/**
 * A HIDDEN EFFECT THAT DRAWS ITSELF ONCE BEFORE ITS MOMENT. S22, 2026-11-13.
 *
 * The first nuclear strike of a session froze 151–182 ms on the frame of impact: that frame compiled
 * the strike's shaders and uploaded its art. Compiling ahead with `compileAsync` would prepare other
 * programs than the scene asks for (the composer draws into a target, and that is part of a program's
 * key), so the effect rehearses through the scene's own pipeline instead: one part a drawn frame,
 * each shown until it has really been drawn (`onAfterRender`), its parts drawing nothing visible
 * because they start at zero. The cost is spread over a few ordinary frames before the moment.
 */
export function createRehearsal(root: THREE.Object3D): Rehearsal {
  const parts: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Sprite || node instanceof THREE.Points) parts.push(node);
  });
  const shown = parts.map((part) => part.visible);
  const listeners = parts.map((part) => part.onAfterRender.bind(part));
  let index = 0;
  let drawn = false;
  let over = parts.length === 0;
  parts.forEach((part, i) => {
    const listener = listeners[i];
    part.onAfterRender = (renderer, scene, camera, geometry, material, group) => {
      if (i === index) drawn = true;
      listener?.(renderer, scene, camera, geometry, material, group);
    };
  });

  const end = (): void => {
    if (over) return;
    over = true;
    parts.forEach((part, i) => {
      part.visible = shown[i] ?? part.visible;
      const listener = listeners[i];
      if (listener) part.onAfterRender = listener;
    });
    root.visible = false;
  };

  return {
    next() {
      if (over) return false;
      if (drawn) { drawn = false; index += 1; }
      if (index >= parts.length) { end(); return false; }
      parts.forEach((part, i) => { part.visible = i === index; });
      root.visible = true;
      return true;
    },
    end,
  };
}
