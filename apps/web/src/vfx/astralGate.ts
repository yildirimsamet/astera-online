/*!
00GameDevs exported assets — original code only (effect === 4: Gate of Astral Tracery)
Extracted strictly to the single Astral Gate effect (`utility-gate-frame` + `utility-star-membrane`)
to eliminate 560 KB of unused VFX library code while preserving the exact visual and MIT license.

The MIT License

Copyright (c) 2026 00GameDevs (@00vchannel)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import * as THREE from 'three';

export interface AstralGateOptions {
  speed?: number;
  detail?: number;
  color?: string | number;
  size?: number;
  density?: number;
}

export interface AstralGateInstance {
  readonly group: THREE.Group;
  readonly finished: boolean;
  readonly phase: 'start' | 'loop' | 'end' | 'finished';
  update(deltaSeconds: number): void;
  stop(): void;
  reset(): void;
  dispose(): void;
}

export const defaultOptions: Required<AstralGateOptions> = {
  speed: 1,
  detail: 1,
  color: '#c1b8ff',
  size: 1,
  density: 0.5,
};

const TAU = Math.PI * 2;
const START_DURATION = 0.8;
const END_DURATION = 0.8;

interface PartSpec {
  geometry: THREE.BufferGeometry;
  center: readonly [number, number, number];
  data: readonly [number, number, number, number];
  unit: number;
}

function buildArc(
  inner: number,
  outer: number,
  start: number,
  end: number,
  height: number,
  depth: number,
  segments = 3,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const point = (r: number, a: number, y: number): [number, number, number] => [
    y,
    Math.cos(a) * r * height,
    Math.sin(a) * r,
  ];
  const tri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    ua: [number, number],
    ub: [number, number],
    uc: [number, number],
  ) => {
    pos.push(...a, ...b, ...c);
    uv.push(...ua, ...ub, ...uc);
  };

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const n = (i + 1) / segments;
    const a = start + (end - start) * t;
    const b = start + (end - start) * n;
    const a0 = point(inner, a, -depth / 2);
    const a1 = point(outer, a, -depth / 2);
    const a2 = point(outer, a, depth / 2);
    const a3 = point(inner, a, depth / 2);
    const b0 = point(inner, b, -depth / 2);
    const b1 = point(outer, b, -depth / 2);
    const b2 = point(outer, b, depth / 2);
    const b3 = point(inner, b, depth / 2);
    const quads: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]][] = [
      [a0, b0, b1, a1],
      [a1, b1, b2, a2],
      [a2, b2, b3, a3],
      [a3, b3, b0, a0],
    ];
    for (const [q, r, s, v] of quads) {
      tri(q, r, s, [t, 0], [n, 0], [n, 1]);
      tri(q, s, v, [t, 0], [n, 1], [t, 1]);
    }
    if (i === 0) {
      tri(a0, a1, a2, [t, 0], [t, 1], [t, 1]);
      tri(a0, a2, a3, [t, 0], [t, 1], [t, 0]);
    }
    if (i === segments - 1) {
      tri(b0, b2, b1, [n, 0], [n, 1], [n, 1]);
      tri(b0, b3, b2, [n, 0], [n, 0], [n, 1]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function mergeParts(source: readonly PartSpec[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const centers: number[] = [];
  const data: number[] = [];
  const units: number[] = [];

  for (const item of source) {
    const geo = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry;
    const pos = geo.getAttribute('position');
    const norm = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      centers.push(item.center[0], item.center[1], item.center[2]);
      data.push(item.data[0], item.data[1], item.data[2], item.data[3]);
      units.push(item.unit);
    }
    if (geo !== item.geometry) geo.dispose();
    item.geometry.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setAttribute('aCenter', new THREE.Float32BufferAttribute(centers, 3));
  out.setAttribute('aData', new THREE.Float32BufferAttribute(data, 4));
  out.setAttribute('aUnit', new THREE.Float32BufferAttribute(units, 1));
  return out;
}

const COMMON_GLSL = /* glsl */ `
  uniform float uTime, uLifeStart, uLifeEnd, uSize, uDetail;
  float sat(float a){return clamp(a,0.0,1.0);}
  float fadeEnd(){return 1.0-smoothstep(.58,1.0,uLifeEnd);}
  float grow(){return smoothstep(0.0,1.0,uLifeStart);}
  float rand(float n){return fract(sin(n*127.1+311.7)*43758.5453);}
`;

function makeGateShader(
  uniforms: Record<string, THREE.IUniform>,
  deform: string,
  fragmentExtra: string,
): THREE.ShaderMaterial {
  const vertexShader = /* glsl */ `
    ${COMMON_GLSL}
    attribute vec3 aCenter;
    attribute vec4 aData;
    attribute float aUnit;
    varying vec2 vUv;
    varying vec3 vN, vP;
    varying float vAlpha, vTone, vPart;
    void main() {
      vec3 p = position;
      vec3 c = aCenter;
      vec3 q = p - c;
      vec3 n = normal;
      vUv = uv;
      vAlpha = 1.0;
      vTone = aData.w;
      vPart = aData.x;
      ${deform}
      vP = p;
      vN = normalize(normalMatrix * n);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const fragmentShader = /* glsl */ `
    ${COMMON_GLSL}
    uniform vec3 uColor;
    varying vec2 vUv;
    varying vec3 vN, vP;
    varying float vAlpha, vTone, vPart;
    void main() {
      // Lit the same from either side (Astera 2026-11-24): the warp camera looks at the gate's back.
      float light = dot(normalize(gl_FrontFacing ? vN : -vN), normalize(mat3(viewMatrix) * vec3(-.4, .8, .55))) * .5 + .5;
      float shade = mix(.28, .82, smoothstep(.38, .41, light));
      shade = mix(shade, 1.16, smoothstep(.7, .73, light));
      vec3 color = mix(uColor * shade, mix(uColor, vec3(1.0), .7), clamp(vTone, 0.0, 1.0));
      // The inner stones carry the gate's colour, so a closing gate never hangs as a dead grey ring.
      if (vTone < 0.0) color = mix(uColor * .34, vec3(.16, .17, .22), .45) * (.7 + shade * .5);
      float alpha = vAlpha;
      ${fragmentExtra}
      if (alpha < .003) discard;
      gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

export default function createAstralGate(options: AstralGateOptions = {}): AstralGateInstance {
  const opts = { ...defaultOptions, ...options };
  const color = new THREE.Color(opts.color);

  const uniforms: Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uLifeStart: { value: 0 },
    uLifeEnd: { value: 0 },
    uSize: { value: opts.size },
    uDetail: { value: opts.detail },
    uColor: { value: color },
  };

  // 16 segmented outer & inner Astral Tracery arch segments
  const frameParts: PartSpec[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16;
    const b = ((i + 0.8) * TAU) / 16;

    const outer = buildArc(0.92, 1.08, a, b, 1.35, 0.18, 3);
    outer.translate(0, 1.45, 0);
    frameParts.push({ geometry: outer, center: [0, 1.45, 0], data: [i / 16, a, 0, 0.18], unit: -1 });

    const inner = buildArc(0.975, 1.01, a + 0.025, b - 0.025, 1.35, 0.025, 3);
    inner.translate(0.107, 1.45, 0);
    frameParts.push({ geometry: inner, center: [0.107, 1.45, 0], data: [i / 16, a, 1, 0.92], unit: -1 });
  }

  const frameGeo = mergeParts(frameParts);
  const frameMat = makeGateShader(
    uniforms,
    `
      float s = smoothstep(aData.x * .3, aData.x * .3 + .64, uLifeStart);
      float e = smoothstep(aData.x * .15, .82 + aData.x * .15, uLifeEnd);
      float fold = (1.0 - s) * .17 + e * .15;
      p.y -= 1.45; p.yz *= 1.0 + fold; p.y += 1.45;
      p.x += (1.0 - s) * sin(aData.y * 2.0) * .28;
      p *= uSize;
      vAlpha = s * (1.0 - e) * fadeEnd();
    `,
    `color += uColor * .10 * sin(vPart * 25.13 - uTime * 1.4);`,
  );
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.name = 'utility-gate-frame';
  frameMesh.renderOrder = 6;
  frameMesh.frustumCulled = false;

  // Star-filled violet portal membrane
  const membrane = new THREE.CircleGeometry(0.94, 48);
  membrane.rotateY(Math.PI / 2);
  membrane.scale(1, 1.35, 1);
  membrane.translate(0, 1.45, 0);
  const membraneGeo = mergeParts([{ geometry: membrane, center: [0, 1.45, 0], data: [0, 0, 0, 0], unit: -1 }]);
  const membraneMat = makeGateShader(
    uniforms,
    `
      float s = grow();
      float close = 1.0 - smoothstep(0.0, .82, uLifeEnd);
      p.y -= 1.45; p.z *= max(.012, s * close); p.y *= .7 + .3 * s * close; p.y += 1.45;
      p *= uSize;
      vAlpha = s * close * fadeEnd();
    `,
    `
      vec2 q = (vUv - .5) * 2.0;
      float r = length(q);
      float a = atan(q.y, q.x);
      float swirl = .5 + .5 * sin(r * (10.0 + uDetail * 5.0) - a * 3.0 - uTime * 3.25);
      vec2 starUv = (q + vec2(sin(uTime * .08) * .1, uTime * .009)) * (12.0 + uDetail * 2.0);
      vec2 grid = floor(starUv);
      vec2 cell = fract(starUv) - .5;
      float cross = max(
        pow(max(0.0, 1.0 - abs(cell.x) * 13.0), 3.0) * max(0.0, 1.0 - abs(cell.y) * 3.2),
        pow(max(0.0, 1.0 - abs(cell.y) * 13.0), 3.0) * max(0.0, 1.0 - abs(cell.x) * 3.2)
      );
      float star = step(.963, rand(dot(grid, vec2(1.0, 71.0)))) * cross * (.72 + .28 * sin(uTime + grid.x));
      color = mix(uColor * .035, uColor * .23, swirl * .17 + smoothstep(.55, 1.0, r) * .55);
      color += mix(uColor, vec3(1.0), .8) * star * 2.0;
      alpha *= .62 * (1.0 - smoothstep(.96, 1.0, r));
    `,
  );
  const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
  membraneMesh.name = 'utility-star-membrane';
  membraneMesh.renderOrder = 6;
  membraneMesh.frustumCulled = false;

  const group = new THREE.Group();
  group.name = 'astral-gate';
  group.add(frameMesh, membraneMesh);

  let elapsed = 0;
  let stopTime = -1;
  let phase: 'start' | 'loop' | 'end' | 'finished' = 'start';
  let finished = false;

  const syncUniforms = () => {
    uniforms.uTime!.value = elapsed;
    uniforms.uLifeStart!.value = Math.min(1, elapsed / START_DURATION);
    if (stopTime < 0) {
      uniforms.uLifeEnd!.value = 0;
      phase = elapsed < START_DURATION ? 'start' : 'loop';
    } else {
      const endP = Math.min(1, Math.max(0, (elapsed - stopTime) / END_DURATION));
      uniforms.uLifeEnd!.value = endP;
      if (endP >= 1) {
        phase = 'finished';
        finished = true;
      } else {
        phase = 'end';
      }
    }
  };

  return {
    group,
    get finished() { return finished; },
    get phase() { return phase; },
    update(deltaSeconds: number) {
      if (finished) return;
      elapsed += Math.max(0, deltaSeconds) * opts.speed;
      syncUniforms();
    },
    stop() {
      if (stopTime < 0) stopTime = elapsed;
    },
    reset() {
      elapsed = 0;
      stopTime = -1;
      phase = 'start';
      finished = false;
      syncUniforms();
    },
    dispose() {
      frameGeo.dispose();
      frameMat.dispose();
      membraneGeo.dispose();
      membraneMat.dispose();
    },
  };
}
