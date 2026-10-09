import type { CosmeticStyle } from '@astera/rules';
import type { Vec3Tuple } from './scene.js';

/** Raise the flag above the hulls; +Z is the nose and the cloth streams down -Z. */
export function fleetFlagPose(formationScale: number): { position: Vec3Tuple; rotation: Vec3Tuple; scale: number } {
  const scale = formationScale * 0.55;
  return {
    position: [0, formationScale * 0.7 + 0.95 * scale, formationScale * 0.5 - 0.83 * scale],
    rotation: [0, Math.PI / 2, 0],
    scale,
  };
}

/** Fixed geometry budgets; animation updates uniforms rather than allocating particles. */
export const cosmeticEffectRecipe = (style: CosmeticStyle) => {
  switch (style) {
    case 'titan': return { bands: 2, particles: 0, radius: 1.35, motion: 10, colour: '#ff8f47', secondary: '#c4efff' };
    case 'reaper': return { bands: 1, particles: 0, radius: 1.5, motion: 5, colour: '#ebd8c1', secondary: '#fff0d6' };
    case 'ravager': return { bands: 1, particles: 0, radius: 1.5, motion: 6, colour: '#ff655c', secondary: '#fff0d6' };
    case 'serpent': return { bands: 1, particles: 0, radius: 1.5, motion: 7, colour: '#b8ef65', secondary: '#fff0d6' };
    case 'phoenix': return { bands: 1, particles: 0, radius: 1.5, motion: 8, colour: '#ff984f', secondary: '#fff0d6' };
    case 'ironfang': return { bands: 1, particles: 0, radius: 1.5, motion: 9, colour: '#a8c8e4', secondary: '#fff0d6' };
    case 'vanguard': return { bands: 1, particles: 0, radius: 1.5, motion: 3, colour: '#879db3', secondary: '#c0ccd7' };
    case 'orbit': return { bands: 1, particles: 0, radius: 1.5, motion: 4, colour: '#567c92', secondary: '#b0ccd8' };
    case 'helios': return { bands: 3, particles: 72, radius: 1.6, motion: 1, colour: '#ffaf46', secondary: '#ffeac1' };
    case 'singularity': return { bands: 2, particles: 96, radius: 1.7, motion: 2, colour: '#987aff', secondary: '#bcdfff' };
    default: return { bands: 4, particles: 112, radius: 1.55, motion: 0, colour: '#44eac1', secondary: '#75abff' };
  }
};

export const effectVertex = `
  attribute float aEnvelope;
  varying float vEnvelope;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uKind;
  uniform float uStyle;
  void main() {
    vUv = uv;
    vEnvelope = aEnvelope;
    vec3 p = position;
    if (uKind < .5 && uStyle < .5) {
      float angle = atan(p.y, p.x);
      float radial = length(p.xy);
      p.z += sin(angle * 3.0 - uTime * .8) * .10 + sin(angle * 7.0 + radial * 6.0 - uTime * 1.2) * .045;
    }
    if (uKind > .5 && uKind < 1.5) {
      float travel = uv.y;
      float envelope = sin(travel * 26.0 - uTime * 8.0 + uv.x * 6.283185);
      float motion = uStyle < .5 ? 1.0 : (uStyle < 1.5 ? .18 : .4);
      p.xy *= 1.0 + envelope * .16 * sin(travel * 3.14159) * motion;
      p.x += sin(travel * 13.0 - uTime * 3.7) * .045 * travel * motion;
      p.y += cos(travel * 16.0 - uTime * 4.3) * .035 * travel * motion;
    }
    if (uKind > 1.5) {
      float freeEdge = pow(uv.x, 1.2);
      p.z += (sin(uv.x * 9.0 - uTime * 2.4 + uv.y * 2.0) * .10
        + sin(uv.x * 17.0 - uTime * 3.1 + uv.y * 4.0) * .035) * freeEdge;
      p.y += sin(uv.x * 6.0 - uTime * 1.4) * .035 * freeEdge;
    }
    vec4 transformed = vec4(p, 1.0);
    #ifdef USE_INSTANCING
      transformed = instanceMatrix * transformed;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * transformed;
  }
`;
export const effectFragment = `
  varying float vEnvelope;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uKind;
  uniform float uStyle;
  uniform sampler2D uBanner;
  uniform float uHasBanner;
  uniform vec3 uColour;
  uniform vec3 uSecondary;
  #define TAU 6.28318530718
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise21(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(cell), hash21(cell + vec2(1.0, 0.0)), f.x),
      mix(hash21(cell + vec2(0.0, 1.0)), hash21(cell + vec2(1.0)), f.x), f.y);
  }
  float line(float x, float width) { return 1.0 - smoothstep(width, width * 2.0, abs(x)); }
  void main() {
    vec2 uv = vUv;
    vec3 colour = uColour;
    float alpha = 0.0;
    if (uKind < .5) {
      vec2 p = uv * 2.0 - 1.0;
      float r = length(p);
      float a = atan(p.y, p.x);
      float flow = sin(a * 7.0 + r * 54.0 - uTime * 1.2);
      float band = exp(-pow((r - .79 - flow * .025) * 22.0, 2.0));
      float fine = pow(.5 + .5 * sin(r * 290.0 + a * 3.0 - uTime), 10.0);
      if (uStyle < .5) {
        float sweep = a - uTime * .32;
        float curtain = sin(sweep * 3.0) * .035 + sin(sweep * 7.0 + uTime) * .015;
        float mainArc = exp(-pow((r - .77 - curtain) * 28.0, 2.0));
        float outerArc = exp(-pow((r - .9 - curtain * .45) * 75.0, 2.0));
        float silk = .45 + .55 * pow(.5 + .5 * sin(sweep * 18.0 + r * 70.0), 3.0);
        float comet = pow(.5 + .5 * cos(a - uTime * .75), 24.0);
        alpha = mainArc * silk * .85 + outerArc * .55 + comet * exp(-pow((r - .77) * 18.0, 2.0));
        colour = mix(uColour, uSecondary, .5 + .5 * sin(sweep * 2.0 + r * 18.0));
        colour += vec3(.55,.8,1.0) * comet * .6;
      } else if (uStyle < 1.5) {
        float segments = smoothstep(.1, .22, abs(sin(a * 12.0 + uTime * .12)));
        alpha = (line(r - .69, .0025) + line(r - .92, .003)
          + band * segments * (.35 + fine * .8)) * .8;
        colour = mix(uColour, uSecondary, fine);
      } else {
        float spiral = sin(a * 2.0 + r * 28.0 - uTime * .8);
        alpha = exp(-pow((r - .81) * 30.0, 2.0)) * (.12 + pow(.5 + .5 * spiral, 9.0))
          + line(r - .69, .003) * .7;
        colour = mix(uColour, uSecondary, pow(.5 + .5 * spiral, 6.0));
      }
    } else if (uKind < 1.5) {
      float along = uv.y;
      float angle = uv.x * TAU;
      float start = vEnvelope;
      float end = 1.0;
      float flow = .5 + .5 * sin(along * 35.0 - uTime * 10.0 + sin(angle * 3.0 + uTime));
      float filament = pow(.5 + .5 * sin(angle * 3.0 + along * 17.0 - uTime * 5.0), 7.0);
      float hot = exp(-along * 5.0);
      if (uStyle > 9.5) {
        // Wrapped noise flows down the actual 3D tube. No particles or extra lights.
        vec2 flowAt = vec2(cos(angle) * 2.0 + along * 9.0, sin(angle) * 2.0 - uTime * 3.2);
        float turbulence = (noise21(flowAt) + noise21(flowAt * 2.3 + uTime * .6) * .45) / 1.45;
        float density = smoothstep(.21, .78, turbulence);
        vec3 ignition = mix(vec3(.16, .52, 1.25), vec3(1.5, 1.5, 1.32), smoothstep(.01, .1, along));
        vec3 fire = mix(vec3(1.45, .72, .13), vec3(1.15, .16, .025), smoothstep(.3, .9, along));
        colour = mix(ignition, fire, smoothstep(.1, .32, along)) * (.55 + turbulence * .75);
        alpha = (.10 + density * .72) * start * pow(1.0 - along, .32);
        if (uv.x > 1.5) {
          colour = mix(vec3(.45, .95, 1.55), vec3(1.6, 1.5, 1.25), smoothstep(.04, .22, along));
          alpha = start * (.9 + flow * .15) * exp(-along * 8.0);
        }
      } else {
      if (uStyle < .5) {
        alpha = (.13 + filament * .52 + flow * .13) * start * end;
        colour = mix(uColour, uSecondary, .5 + .5 * sin(angle + along * 8.0 - uTime * 1.8));
      } else if (uStyle < 1.5) {
        float diamonds = pow(.5 + .5 * cos(along * 46.0 - uTime * 6.0), 5.0);
        alpha = (.15 + diamonds * .5 + flow * .16) * start * end;
        colour = mix(uColour, uSecondary, diamonds * .75);
      } else {
        float pulse = pow(.5 + .5 * sin(along * 30.0 - uTime * 7.0), 8.0);
        alpha = (.08 + filament * .4 + pulse * .5) * start * end;
        colour = mix(uColour, uSecondary, pulse);
      }
      colour = mix(colour, vec3(1.0,.96,.88), hot * .85);
      if (uv.x > 1.5) {
        alpha = start * end * (.7 + flow * .3);
        colour = mix(uSecondary * 1.5, vec3(1.6,1.65,1.7), .6 + hot * .4);
      }
      }

    } else {
      if (uStyle < 2.5) {
        float tail = max(0.0, uv.x - .78) / .22;
        if (uStyle > .5 && uStyle < 1.5 && abs(uv.y - .5) < tail * .17) discard;
        if (uStyle > 1.5 && abs(uv.y - .5) > .5 - tail * .19) discard;
      }
      vec2 p = (uv - .5) * vec2(1.5, 1.0);
      float border = max(line(abs(uv.x - .5) - .46, .004), line(abs(uv.y - .5) - .44, .004));
      float inset = max(line(abs(uv.x - .5) - .43, .002), line(abs(uv.y - .5) - .40, .002));
      float emblem;
      if (uStyle < .5) {
        emblem = line(abs(p.x) + abs(p.y) - .22, .012) + line(length(p) - .12, .008);
      } else if (uStyle < 1.5) {
        float a = atan(p.y,p.x);
        emblem = line(length(p) - .15, .012) + line(length(p) - .24, .007) * pow(abs(cos(a * 6.0)), 14.0);
      } else if (uStyle < 2.5) {
        emblem = line(length(p * vec2(1.0,1.65)) - .23, .012) + line(abs(p.x) + abs(p.y) - .12, .012);
      } else if (uStyle < 3.5) {
        emblem = line(p.y + abs(p.x) - .1, .025) * (1.0 - smoothstep(.2,.25,abs(p.x)));
      } else {
        emblem = line(length(p) - .18, .018) + line(p.y, .009) * (1.0 - smoothstep(.23,.28,abs(p.x)));
      }
      float weave = .5 + .5 * sin(uv.y * 550.0);
      float scan = pow(.5 + .5 * sin(uv.y * 20.0 - uTime * 1.1), 16.0);
      colour = mix(uColour * .045, uColour, clamp(emblem + border * .7 + inset * .25, 0.0, 1.0));
      colour += uSecondary * (emblem * .45 + scan * .045 + weave * .012);
      if (uStyle > 2.5) colour = mix(uColour * .055, uSecondary * .5, clamp(emblem,0.0,1.0));
      if (uHasBanner > .5) {
        float tail = smoothstep(.77, 1.0, uv.x);
        float shape = mod(uStyle, 3.0);
        if (shape < 1.0 && abs(uv.y - .5) < tail * .22) discard;
        if (shape >= 1.0 && shape < 2.0 && abs(uv.y - .5) > .5 - tail * .24) discard;
        if (shape >= 2.0 && uv.x > .91 + .07 * cos(uv.y * 5.0 * TAU)) discard;
        vec3 ink = pow(texture2D(uBanner, uv).rgb, vec3(2.2));
        float fold = .78 + .22 * sin(uv.x * 9.0 - uTime * 2.4 + uv.y * 2.0);
        float glint = pow(.5 + .5 * sin(uv.x * 9.0 - uTime * 2.4 + uv.y * 2.0), 16.0);
        colour = ink * fold + uSecondary * glint * .035;
      }
      alpha = 1.0;
    }
    if (alpha < .005) discard;
    gl_FragColor = vec4(colour, min(alpha, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
