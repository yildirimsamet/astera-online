import { useEffect, useRef, useState } from 'react';
import { ASTEROID_MODELS, MODEL, PLANET_ART, SATELLITE_MODEL } from '../ui/assets.js';
import { SATELLITE_IDS } from '@blindspace/rules';

/**
 * WAITING, DONE HONESTLY.
 *
 * The front door renders a 3D sky: a nebula, six hulls, three rock bodies, four
 * satellites and three planet renders. On a phone on mobile data that is a couple
 * of seconds during which the page is a dark rectangle with a form on it, and the
 * craft pop in one at a time behind the password field afterwards. First
 * impressions of a game are made in exactly that window.
 *
 * So the door waits, and the wait is measured rather than mimed. This fetches the
 * assets the landing scene will ask for and counts them as they land, so the bar
 * on screen is the real fraction of a real list — not a timed animation pretending
 * to be one. A progress bar that lies is worse than a spinner.
 *
 * TWO RULES IT OBEYS, and both exist because the alternative is a player stuck at
 * the door:
 *
 *   · A FAILED ASSET COUNTS AS DONE. One 404 must never hold the game shut. The
 *     scene degrades on its own — a missing model simply does not draw.
 *   · THERE IS ALWAYS A DEADLINE. Past it the door opens regardless of what is
 *     still in the air. A slow network makes the sky arrive late; it does not make
 *     the game unreachable.
 */

/** Milliseconds after which the door opens whatever is still loading. */
export const PRELOAD_DEADLINE_MS = 6_000;

/**
 * Exactly what `LandingScene` draws, and nothing it does not.
 *
 * Kept as a literal list rather than derived from the scene, because the scene
 * reaches for these through `useGLTF` and `useLoader` inside a canvas and there is
 * no honest way to ask it in advance. If a body is added there and not here, the
 * only cost is that one object arrives late — which is why this is a list and not
 * a lock.
 */
export const LANDING_ASSETS: readonly string[] = [
  '/assets/images/planets/planet_4.png',
  '/assets/images/planets/planet_12.png',
  '/assets/images/planets/planet_9.png',
  MODEL.wasp,
  MODEL.lance,
  MODEL.bulwark,
  MODEL.hauler,
  MODEL.probe,
  ...ASTEROID_MODELS,
  ...SATELLITE_IDS.map((id) => SATELLITE_MODEL[id]),
];

/**
 * What the DISC is built from, as opposed to the front door.
 *
 * Every hull that can be drawn in transit, every instrument that can be in orbit
 * around any world, the three rock bodies — and every planet render.
 *
 * THE PLANET RENDERS USED TO BE LEFT OUT, on the reasoning that there are sixteen
 * of them, which world gets which is decided from its id, and a galaxy only shows
 * a handful. That was measurably the wrong trade. `PlanetField` loads each one
 * through `useLoader`, which SUSPENDS — so until they land the disc is not a
 * half-drawn galaxy, it is an empty one: stars, the core, the orbit rings and not
 * a single world. The cover came off over exactly that, which is the bug the owner
 * reported as "the loading screen goes before the map is ready".
 *
 * A galaxy of fifty worlds uses most of the sixteen anyway, they are ~60KB each,
 * and this list is measured on screen by a real progress bar. A second of honest
 * waiting is cheaper than a second of empty disc.
 *
 * DEDUPED, because one file now has two jobs: the drill is both the mining craft
 * and the Drill satellite's own body, so it appears twice in the sources above and
 * would otherwise be fetched twice and counted twice — a progress bar that reaches
 * 100% having done 92% of a list is exactly the lie this module refuses.
 */
export const GALAXY_ASSETS: readonly string[] = [
  ...new Set([
    MODEL.wasp,
    MODEL.lance,
    MODEL.bulwark,
    MODEL.hauler,
    MODEL.probe,
    MODEL.drill,
    ...ASTEROID_MODELS,
    // All four satellites orbit. The Drill is a craft and is listed above.
    ...SATELLITE_IDS.map((id) => SATELLITE_MODEL[id]),
    ...PLANET_ART,
  ]),
];

/** Fetches one asset and resolves either way. Injected, so the counting is testable. */
export type Loader = (url: string) => Promise<void>;

/**
 * The real one.
 *
 * Images go through `Image`, which puts them in the decoded image cache the
 * renderer will actually hit. Everything else goes through `fetch`, which warms
 * the HTTP cache so drei's own loader finds the model already there.
 */
export const fetchAsset: Loader = async (url) => {
  if (/\.(png|jpg|jpeg|webp|avif|gif)$/i.test(url)) {
    await new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = () => {
        resolve();
      };
      image.onerror = () => {
        resolve();
      };
      image.src = url;
    });
    return;
  }
  try {
    await fetch(url, { cache: 'force-cache' });
  } catch {
    // A network failure is still an answer. The scene degrades; the door opens.
  }
};

/**
 * Load every url, reporting after each one settles.
 *
 * Resolves when the list is exhausted — never rejects, because there is no
 * failure here a player could act on. `onProgress` is called with the number
 * settled so far, so a caller can render a fraction without owning a counter.
 */
export async function preloadAll(
  urls: readonly string[],
  load: Loader,
  onProgress?: (settled: number, total: number) => void,
): Promise<void> {
  const total = urls.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return;
  }

  let settled = 0;
  await Promise.all(
    urls.map(async (url) => {
      try {
        await load(url);
      } catch {
        // See above: a broken asset is not a reason to hold the door.
      }
      settled += 1;
      onProgress?.(settled, total);
    }),
  );
}

export interface Preload {
  /** 0 to 1. Reaches 1 when everything has settled or the deadline passed. */
  progress: number;
  ready: boolean;
}

/**
 * Preload a list once, and report how far along it is.
 *
 * TWO THINGS HAVE TO SURVIVE STRICTMODE, and the first draft got both wrong in the
 * same line. React mounts every effect twice in development — run, clean up, run —
 * and that draft skipped the second run entirely on a ref. The skip left the FIRST
 * run's cleanup as the last thing that had happened: the deadline had been
 * cleared, the guard had been flipped, and nothing was ever going to arm either
 * again. The door simply never opened, and only in development, which is the one
 * environment where nobody looks at the loading screen for six seconds.
 *
 * So the two concerns are separated. THE FETCH runs once, guarded by the ref,
 * because a second pass would double every request. THE DEADLINE is re-armed on
 * every run and cleared by every cleanup, because it is the safety net and a
 * safety net that can be cancelled is not one. Progress is written through a
 * functional update that only ever moves forward, so a report from the first
 * pass arriving during the second cannot walk the bar backwards.
 */
export function usePreload(
  urls: readonly string[],
  options: { load?: Loader; deadlineMs?: number } = {},
): Preload {
  const { load = fetchAsset, deadlineMs = PRELOAD_DEADLINE_MS } = options;
  const [progress, setProgress] = useState(urls.length === 0 ? 1 : 0);
  const [ready, setReady] = useState(urls.length === 0);
  const started = useRef(false);

  useEffect(() => {
    const done = (): void => {
      setProgress(1);
      setReady(true);
    };

    // Re-armed every run, so a cleanup can never leave the door with no way out.
    const deadline = setTimeout(done, deadlineMs);

    if (!started.current) {
      started.current = true;
      void preloadAll(urls, load, (settled, total) => {
        if (total === 0) return;
        setProgress((far) => Math.max(far, settled / total));
      }).then(done);
    }

    return () => {
      clearTimeout(deadline);
    };
    /*
     * Deliberately empty. The url list is a module constant and the loader is
     * fixed for the life of the screen; re-running on either would restart a
     * request the player is already waiting on.
     */

  }, []);

  return { progress, ready };
}
