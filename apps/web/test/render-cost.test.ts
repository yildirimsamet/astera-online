import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * WHAT THE GPU IS ASKED FOR, AND WHAT IT IS ASKED FOR TWICE.
 *
 * Two invariants, both about paying once. Neither is visible in a screenshot,
 * which is exactly why they need a test: a wasted full-screen buffer and a second
 * copy of Three both look perfect and cost a phone its battery.
 */

const file = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const CANVASES = [
  'src/galaxy/GalaxyCanvas.tsx',
  'src/landing/LandingScene.tsx',
] as const;

it('holds the Academy opening until the compiled scene has painted, without spending the loading delta', () => {
  const source = file('src/galaxy/GalaxyCanvas.tsx');
  expect(source).toContain('sceneReady.current = true');
  expect(source).toContain('sceneReady={sceneReady}');
  expect(source).toContain('openingMark={openingMark}');
  expect(source).toContain('data-academy-home-ready="false"');
  expect(source.slice(source.indexOf('if (progress.done)'))).toContain("openingMark.current.dataset.academyHomeReady = 'true'");
  const waiting = source.indexOf('if (move.waitForScene)');
  expect(waiting).toBeGreaterThan(0);
  const gate = source.slice(waiting, source.indexOf('const progress = cameraEaseStep', waiting));
  expect(gate).toContain('sceneReady.current');
  expect(gate).toContain('return;');
});

describe('one antialiasing pass, not two', () => {
  /**
   * ANTIALIASING BELONGS TO WHOEVER ACTUALLY DRAWS THE SCENE.
   *
   * `postprocessing`'s `EffectComposer` renders the scene into its OWN multisampled
   * render target — that is what the `multisampling` prop sets — and then draws a
   * single full-screen quad to the canvas. So `gl={{ antialias: true }}` allocates
   * a second, multisampled default framebuffer, resolves it on every present, and
   * antialiases the edges of one rectangle that has none.
   *
   * It is invisible and it is not free: on a phone at device pixel ratio 2 that is
   * a full-screen MSAA buffer of tile memory and a resolve every frame, for nothing.
   * The scene's real edges are already smoothed by the composer.
   *
   * IT HAS TO BE SAID OUT LOUD, WHICH IS THE WHOLE POINT OF THIS TEST.
   *
   * `@react-three/fiber` builds the renderer from
   * `{ canvas, powerPreference: 'high-performance', antialias: true, alpha: true }`
   * and merges the `gl` prop ON TOP of that. So deleting the key does nothing at
   * all — the default is `true` and the wasted buffer is still allocated. Only an
   * explicit `antialias: false` turns it off, and a test that merely checked the
   * key was absent would have passed on a change that did nothing.
   *
   * This does NOT say "never antialias". It says the two must not both be on: a
   * canvas with no composer is welcome to ask the context for it.
   */
  it.each(CANVASES)('%s turns off the context AA its composer already does', (path) => {
    const source = file(path);

    // Only a canvas that hands its scene to a composer is under this rule.
    expect(source, `${path} no longer uses an EffectComposer — revisit this test`)
      .toMatch(/<EffectComposer/);

    const glProp = /gl=\{\{([^}]*)\}\}/.exec(source);
    expect(glProp, `${path} has no gl={{...}} prop to check`).not.toBeNull();
    expect(
      glProp![1],
      `${path} must say antialias: false — omitting it leaves fiber's default of true`,
    ).toMatch(/antialias\s*:\s*false/);
  });
});

describe('one Three, not two', () => {
  /**
   * A SECOND COPY OF THREE IS A SILENT, TOTAL FAILURE.
   *
   * Every `instanceof` across the boundary returns false, two renderers race the
   * same GPU state, and the only warning is a console line most players never see.
   * Today the graph resolves to a single copy — but nothing was holding it there,
   * and `three` is a peer dependency of five packages here (fiber, drei,
   * postprocessing, three-stdlib, troika), any one of which can pull a second one
   * in on an upgrade.
   *
   * `dedupe` is the statement that there is one.
   */
  it('pins the bundler to a single three', () => {
    const config = file('vite.config.ts');
    const dedupe = /dedupe\s*:\s*\[([^\]]*)\]/.exec(config);
    expect(dedupe, 'vite.config.ts declares no resolve.dedupe').not.toBeNull();
    expect(dedupe![1]).toMatch(/['"]three['"]/);
  });
});
