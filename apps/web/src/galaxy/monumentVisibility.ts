import { Raycaster, Sphere, Vector2, Vector3, type Camera } from 'three';
import type { PlanetNode, Vec3Tuple } from './scene.js';
import { PLANET_SKIN_BODY_SCALE } from './planetSkinAttachments.js';
import { createViewMemo, viewChanged } from './viewMemo.js';

interface Caption {
  id: string;
  position: Vec3Tuple;
}

type PlanetBody = Pick<PlanetNode, 'position' | 'radius'>;

/** Body spheres keep caption visibility independent of touch-target padding and LOD mesh churn. */
export function createMonumentVisibility(initial: ReadonlySet<string> = new Set<string>()) {
  const view = createViewMemo();
  const ray = new Raycaster();
  const point = new Vector3();
  const projected = new Vector3();
  const screen = new Vector2();
  const hit = new Vector3();
  let spheres: Sphere[] = [];
  let hidden = initial;
  let subjects: { captions: readonly Caption[]; planets: readonly PlanetBody[] } | null = null;

  return {
    update(camera: Camera, captions: readonly Caption[], planets: readonly PlanetBody[]): ReadonlySet<string> {
      camera.updateWorldMatrix(true, false);
      if (!subjects || subjects.captions !== captions || subjects.planets !== planets) {
        if (subjects?.planets !== planets) {
          spheres = planets.map(planet => new Sphere(new Vector3(...planet.position), planet.radius * PLANET_SKIN_BODY_SCALE));
        }
        subjects = { captions, planets };
      }
      if (!viewChanged(view, camera, subjects, 0)) return hidden;
      const next = new Set<string>();
      for (const caption of captions) {
        point.fromArray(caption.position);
        projected.copy(point).project(camera);
        screen.set(projected.x, projected.y);
        // setFromCamera also preserves the parallel rays of an orthographic view.
        ray.setFromCamera(screen, camera);
        const range = point.distanceTo(ray.ray.origin);
        for (const sphere of spheres) {
          if (ray.ray.intersectSphere(sphere, hit) && hit.distanceTo(ray.ray.origin) < range) {
            next.add(caption.id);
            break;
          }
        }
      }
      if (next.size !== hidden.size || [...next].some(id => !hidden.has(id))) hidden = next;
      return hidden;
    },
  };
}
