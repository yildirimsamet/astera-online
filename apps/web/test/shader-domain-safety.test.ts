import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cosmeticsInCategory } from '@astera/rules';
import { effectProgram } from '../src/galaxy/cosmeticEffects.js';

// Discover every shader-producing source, including material patches and future layers.
const shaderFiles = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .filter(file => /\.tsx?$/.test(file))
  .filter(file => /gl_Position|gl_FragColor|hazeColour|mainImage|onBeforeCompile/.test(readFileSync(`src/${file}`, 'utf8')));


it.each(shaderFiles)('%s keeps constant smoothstep edges in the GLSL-defined order', file => {
  const source = readFileSync(`src/${file}`, 'utf8');
  const literal = '([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:e[+-]?\\d+)?)';
  const calls = source.matchAll(new RegExp(`smoothstep\\(\\s*${literal}\\s*,\\s*${literal}\\s*,`, 'gi'));
  for (const call of calls) expect(Number(call[1]), call[0]).toBeLessThan(Number(call[2]));
});

it('Tempest arcs invert a defined smoothstep rather than swapping its edges', () => {
  expect(effectProgram('tempest', 1).fragmentShader).not.toMatch(/smoothstep\(width,\s*0\.0,/);
});

it('never feeds signed Gaussian distances into GLSL pow, even with an exponent of two', () => {
  for (const [kind, category] of [[0, 'RING'], [1, 'ENGINE'], [2, 'FLAG']] as const) {
    for (const item of cosmeticsInCategory(category)) {
      expect(effectProgram(item.style!, kind).fragmentShader, item.id).not.toMatch(/exp\(-pow\(/);
    }
  }
  expect(readFileSync('src/galaxy/RadiationBombEffects.tsx', 'utf8')).not.toMatch(/exp\(-pow\(/);
});

it('clamps dot products and interpolated tails before fractional powers', () => {
  expect(readFileSync('src/galaxy/cosmeticShaders.ts', 'utf8')).not.toMatch(/pow\(1\.0 - facing,/);
  expect(readFileSync('src/galaxy/cosmeticEffects.ts', 'utf8')).not.toMatch(/pow\(1\.0 - along,/);
  expect(readFileSync('src/galaxy/IntergalacticConvoy.tsx', 'utf8')).not.toMatch(/pow\(1\.0 - vAlong,/);
});

it('Aegis keeps its pole epsilon and derivative width representable and nonzero', () => {
  const aegis = readFileSync('src/galaxy/Satellites.tsx', 'utf8');
  const shader = aegis.slice(aegis.indexOf('const SHIELD_FRAG'), aegis.indexOf('const SHIELD_FRAG') + 4200);
  expect(shader).toContain('precision highp float;');
  expect(shader).toMatch(/float aa = max\(fwidth\(d\),\s*1e-5\)/);
});

it('impact scars do not evaluate atan at a planet pole', () => {
  const shader = readFileSync('src/galaxy/planetImpactMaterial.ts', 'utf8');
  expect(shader).toMatch(/abs\(impactDirection\.x\) \+ abs\(impactDirection\.z\) < 1e-6 \? 0\.0 : atan/);
});


it('keeps oscillating cosmetic power bases nonnegative despite floating-point rounding', () => {
  for (const category of ['RING', 'ENGINE', 'FLAG'] as const) {
    const kind = category === 'RING' ? 0 : category === 'ENGINE' ? 1 : 2;
    for (const item of cosmeticsInCategory(category)) {
      expect(effectProgram(item.style!, kind).fragmentShader, item.id).not.toMatch(/pow\(\.5 \+ \.5 \*/);
    }
  }
});
