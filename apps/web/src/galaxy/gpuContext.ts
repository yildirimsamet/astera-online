import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * THE PHONE TAKES THE GPU BACK, AND THE SCENE HAS TO SURVIVE IT.
 *
 * A mobile browser sent to the background may drop the WebGL context to reclaim
 * GPU memory, then hand a fresh one back when the tab returns. Every phone does
 * this; it is ordinary and it is not an error.
 *
 * What it used to be here was a crash, reported live from an Android phone:
 *
 *     TypeError: Cannot read properties of null (reading 'alpha')
 *       at addPass …
 *
 * `postprocessing` reads `renderer.getContext().getContextAttributes().alpha`
 * when a composer takes a renderer (`EffectComposer.setRenderer`), and the WebGL
 * spec says `getContextAttributes()` returns **null** on a lost context. So the
 * first React render after the loss dereferenced null and took the whole app into
 * the crash screen — for a condition the browser considers routine, and one
 * nothing in this app had ever listened for.
 *
 * TWO FACTS SHAPE THIS HOOK, and neither is obvious from the API:
 *
 * · WITHOUT `preventDefault()` THE BROWSER NEVER RESTORES. `webglcontextrestored`
 *   is dispatched only if the `webglcontextlost` handler cancelled the event.
 *   A listener that merely records the loss turns a crash into a permanently
 *   black scene, which is not an improvement.
 * · A RESTORED CONTEXT IS A NEW ONE. Every buffer, texture and program belonged
 *   to the context that died. three.js re-initialises its own on restore, but a
 *   composer holds render targets of its own and has to be rebuilt — which is
 *   what `epoch` is for: it is a React key, not a counter anybody reads.
 *
 * The scene freezes on its last frame while the context is gone. That is the
 * correct behaviour and it is what the browser is doing anyway — `frameloop` is
 * `demand`, so nothing is being drawn into a dead context in the meantime.
 */
export interface GpuContext {
  /** False between a loss and its restore. Gate the composer on this. */
  live: boolean;
  /** Changes on every restore. Use it in the composer's `key`. */
  epoch: number;
  /**
   * Start listening on the renderer's canvas. Safe to call again with a
   * different canvas — a quality change rebuilds the renderer — and the previous
   * one is released.
   */
  watch: (canvas: HTMLCanvasElement) => void;
}

export function useGpuContext(): GpuContext {
  const [live, setLive] = useState(true);
  const [epoch, setEpoch] = useState(0);
  /**
   * Whether a loss is outstanding, held in a ref rather than read off `live`.
   * The listeners are installed once per canvas and would otherwise close over
   * a stale value, and a restore with no loss before it must change nothing.
   */
  const lost = useRef(false);
  /** How to let go of the canvas currently being watched. */
  const release = useRef<(() => void) | null>(null);

  const watch = useCallback((canvas: HTMLCanvasElement) => {
    release.current?.();

    const onLost = (event: Event): void => {
      // The one line the whole fix rests on: an uncancelled loss is permanent.
      event.preventDefault();
      lost.current = true;
      setLive(false);
    };
    const onRestored = (): void => {
      if (!lost.current) return;
      lost.current = false;
      setEpoch((n) => n + 1);
      setLive(true);
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    release.current = () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, []);

  useEffect(() => () => {
    release.current?.();
    release.current = null;
  }, []);

  return { live, epoch, watch };
}
