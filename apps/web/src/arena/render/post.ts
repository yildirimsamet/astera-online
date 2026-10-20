import * as THREE from 'three';
import { guardBloomInput } from '../../galaxy/finiteGuard.js';
import { BloomEffect, Effect, EffectAttribute, EffectComposer, EffectPass, RenderPass, ToneMappingEffect,
  ToneMappingMode, VignetteEffect } from 'postprocessing';

/**
 * The lens: a radial speed blur for turbo (the centre stays sharp, the edges streak
 * outward) and the chromatic kick of a hit. One convolution effect, so it shares the
 * single merged pass; at rest it returns its input after one uniform test.
 */
class LensEffect extends Effect {
  readonly zoom: THREE.Uniform<number>;
  readonly aberration: THREE.Uniform<number>;
  constructor() {
    const zoom = new THREE.Uniform(0); const aberration = new THREE.Uniform(0);
    super('LensEffect', `uniform float zoom; uniform float aberration;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (zoom + aberration < 0.0005) { outputColor = inputColor; return; }
        vec2 dir = uv - vec2(0.5);
        float edge = smoothstep(0.1, 0.75, length(dir * vec2(aspect, 1.0)));
        float spread = zoom * 0.1 * edge;
        vec3 col = vec3(0.0);
        for (int i = 0; i < 6; i++) col += texture2D(inputBuffer, uv - dir * spread * (float(i) / 5.0)).rgb;
        col /= 6.0;
        if (aberration > 0.0005) {
          vec2 ca = dir * aberration * 0.03 * (0.3 + edge);
          col.r = mix(col.r, texture2D(inputBuffer, uv + ca).r, 0.8);
          col.b = mix(col.b, texture2D(inputBuffer, uv - ca).b, 0.8);
        }
        outputColor = vec4(col, inputColor.a);
      }`, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([['zoom', zoom], ['aberration', aberration]]),
    });
    this.zoom = zoom; this.aberration = aberration;
  }
}

/**
 * Belt haze: inside a dense field light scatters, so the whole view takes on the
 * nebula's colour and loses its deepest blacks. One full-screen veil instead of a stack
 * of overlapping cloud sprites (each of which used to cost a full-screen of fill).
 */
class HazeEffect extends Effect {
  readonly tint: THREE.Color;
  readonly amount: THREE.Uniform<number>;
  constructor() {
    const color = new THREE.Color('#2a4f86'); const amount = new THREE.Uniform(0);
    super('HazeEffect', `uniform vec3 color; uniform float amount;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        float edge = smoothstep(0.0, 0.85, length((uv - vec2(0.5, 0.55)) * vec2(aspect, 1.0)) * 1.3);
        float veil = amount * (0.7 + 0.3 * edge);
        outputColor = vec4(inputColor.rgb * (1.0 - veil * 0.35) + color * veil, inputColor.a);
      }`, {
      uniforms: new Map<string, THREE.Uniform>([['color', new THREE.Uniform(color)], ['amount', amount]]),
    });
    this.tint = color; this.amount = amount;
  }
}

/**
 * The frame: scene into a multisampled half-float target (geometry edges stay clean at
 * any pixel ratio), mipmap bloom for engines, bolts and crystals, AgX tone mapping, a
 * vignette that frames the portrait view, a lens for turbo and hits, and belt haze.
 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, samples: number) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: samples });
  const render = new RenderPass(scene, camera);
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.72, luminanceSmoothing: 0.22, intensity: 1.05, radius: 0.7 });
  // One non-finite pixel must never become a black block (galaxy/finiteGuard.ts).
  guardBloomInput(bloom);
  const vignette = new VignetteEffect({ offset: 0.3, darkness: 0.62 });
  const lens = new LensEffect();
  const haze = new HazeEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  composer.addPass(render);
  // The lens samples the raw frame, so it goes first; bloom and the rest build on its output.
  composer.addPass(new EffectPass(camera, lens, bloom, haze, vignette, tone));
  let kick = 0; let speed = 0; let speedTarget = 0;
  return {
    composer,
    setSize(width: number, height: number): void { composer.setSize(width, height, false); },
    hurt(amount: number): void { kick = Math.min(1, kick + amount); },
    /** 0 at rest, 1 in full turbo; `punch` adds a brief overshoot when turbo lights. */
    speed(level: number, punch = 0): void { speedTarget = level; speed = Math.min(1.6, speed + punch); },
    haze(color: THREE.Color, amount: number): void {
      haze.tint.copy(color); haze.amount.value = amount;
    },
    render(dt: number): void {
      kick = Math.max(0, kick - dt * 3.5);
      speed += (speedTarget - speed) * (1 - Math.exp(-dt * (speedTarget > speed ? 5 : 2.5)));
      lens.zoom.value = Math.max(0, speed); lens.aberration.value = kick + Math.max(0, speed - 1) * 0.6;
      composer.render(dt);
    },
    dispose(): void { composer.dispose(); },
  };
}
export type Post = ReturnType<typeof createPost>;
