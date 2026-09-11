import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { useGpuContext } from '../src/galaxy/gpuContext.js';

/**
 * THE PHONE TAKES THE GPU BACK, AND THE GAME CAME BACK DEAD. Owner report, live:
 *
 *   TypeError: Cannot read properties of null (reading 'alpha')
 *     at addPass … Android, Chrome 151, 360x738
 *
 * A mobile browser sent to the background may drop the WebGL context to reclaim
 * GPU memory. That is ordinary — every phone does it, and this one had been doing
 * it to us for as long as the scene has existed.
 *
 * What made it a crash rather than a blank frame is one line in `postprocessing`
 * (`build/index.js:994`, `EffectComposer.setRenderer`):
 *
 *     const alpha = renderer.getContext().getContextAttributes().alpha;
 *
 * `getContextAttributes()` returns **null** on a lost context — that is the WebGL
 * spec, not a bug in the library — so the composer dereferences null the moment
 * React re-renders it against a dead context, and the whole app unmounts into the
 * crash screen. Nothing in `apps/web/src` had ever listened for the event.
 *
 * Two facts this rests on, and both are the reason a state flag alone is not the
 * fix:
 *
 * · WITHOUT `preventDefault()` THE BROWSER NEVER RESTORES. `webglcontextrestored`
 *   is only dispatched if the `webglcontextlost` handler cancelled the event.
 *   A listener that merely records the loss guarantees the scene stays dead.
 * · A RESTORED CONTEXT IS A NEW ONE. Every buffer the composer allocated belongs
 *   to the context that died, so it has to be rebuilt rather than resumed — which
 *   is what `epoch` is for, as a React key.
 */
describe('a lost GPU context is survived, not crashed on', () => {
  const attached = () => {
    const canvas = document.createElement('canvas');
    const hook = renderHook(() => useGpuContext());
    act(() => { hook.result.current.watch(canvas); });
    return { canvas, hook };
  };

  const lose = (canvas: HTMLCanvasElement): Event => {
    const event = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(event);
    return event;
  };

  it('starts live', () => {
    const { hook } = attached();
    expect(hook.result.current.live).toBe(true);
  });

  /**
   * THE ONE LINE THE WHOLE FIX RESTS ON. An uncancelled loss is permanent: the
   * browser takes it as "this application is done with the GPU" and never fires
   * the restore. Recording the loss without cancelling it would trade a crash for
   * a scene that is black until the player force-quits.
   */
  it('cancels the loss so the browser will restore the context', () => {
    const { canvas } = attached();
    let event!: Event;
    act(() => { event = lose(canvas); });
    expect(event.defaultPrevented).toBe(true);
  });

  it('reports the context as gone', () => {
    const { canvas, hook } = attached();
    act(() => { lose(canvas); });
    expect(hook.result.current.live).toBe(false);
  });

  it('comes back live when the browser restores it', () => {
    const { canvas, hook } = attached();
    act(() => { lose(canvas); });
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    expect(hook.result.current.live).toBe(true);
  });

  /**
   * The epoch is a React key, so it must move on every restore — a composer
   * rebuilt under the old key would keep the buffers of the context that died.
   */
  it('hands back a new epoch for every restore', () => {
    const { canvas, hook } = attached();
    const first = hook.result.current.epoch;

    act(() => { lose(canvas); });
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    const second = hook.result.current.epoch;
    expect(second).not.toBe(first);

    act(() => { lose(canvas); });
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    expect(hook.result.current.epoch).not.toBe(second);
  });

  /** A restore with no loss before it changes nothing: there is nothing to rebuild. */
  it('ignores a restore that follows no loss', () => {
    const { canvas, hook } = attached();
    const before = hook.result.current.epoch;
    act(() => { canvas.dispatchEvent(new Event('webglcontextrestored')); });
    expect(hook.result.current.epoch).toBe(before);
    expect(hook.result.current.live).toBe(true);
  });

  /**
   * `onCreated` runs once per canvas, but a canvas can be replaced — a quality
   * change rebuilds the renderer. Watching the new one must not leave the old
   * one's listeners behind, firing into an unmounted tree.
   */
  it('lets go of a canvas it stops watching', () => {
    const { canvas, hook } = attached();
    const second = document.createElement('canvas');
    act(() => { hook.result.current.watch(second); });

    act(() => { lose(canvas); });
    expect(hook.result.current.live, 'the abandoned canvas still reports losses').toBe(true);

    act(() => { lose(second); });
    expect(hook.result.current.live).toBe(false);
  });

  it('removes its listeners when the scene unmounts', () => {
    const { canvas, hook } = attached();
    hook.unmount();
    // Nothing to assert on the hook itself; what must not happen is a React
    // state update on an unmounted component, which the runner reports as an
    // error. Dispatching after unmount is the whole test.
    expect(() => { lose(canvas); }).not.toThrow();
  });
});

describe('the composer is not mounted against a dead context', () => {
  const canvasSource = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');

  /**
   * The crash is in `EffectComposer`'s constructor path, so the fix is that the
   * element does not exist while the context is gone. A flag the composer reads
   * as a prop would still construct it.
   */
  it('gates the composer on a live context', () => {
    expect(canvasSource).toMatch(/\{\s*gpu\.live\s*&&\s*\(?\s*<EffectComposer/);
  });

  /** And rebuilds it on the far side, because the restored context is a new one. */
  it('keys the composer on the epoch as well as the resolution ceiling', () => {
    const key = /key=\{`?\$\{[^}]*dprCap[^}]*\}[^`]*\$\{[^}]*epoch[^}]*\}`?\}/;
    expect(canvasSource).toMatch(key);
  });

  it('watches the canvas the renderer was created with', () => {
    expect(canvasSource).toContain('gpu.watch(gl.domElement)');
  });

  /**
   * AND DRAWS A FRAME ON THE FAR SIDE. `frameloop` is `demand`, so nothing is
   * rendered until something asks. A restored context with no request against it
   * is a scene frozen on the last frame it managed before the phone took the GPU
   * away — the crash traded for a still picture, which is not the fix either.
   */
  it('asks for a frame once the context comes back', () => {
    expect(canvasSource).toMatch(/<RedrawOnRestore\s+epoch=\{gpu\.epoch\}/);
    expect(canvasSource).toMatch(/function RedrawOnRestore[\s\S]{0,400}invalidate\(\)/);
  });
});
