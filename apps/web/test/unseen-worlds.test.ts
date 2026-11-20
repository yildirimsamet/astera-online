import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  CLOUD, cardGroups, cloudAttributes, cloudLayout, greyColour, greyFragment, greyObject, greyUnseenMaterial, isUnseen, modelTint, planetDrawGroups,
} from '../src/galaxy/unseenWorld.js';

type Intel = 'RESOLVED' | 'REMEMBERED' | 'UNKNOWN';
const world = (id: string, intel: Intel, extra: Record<string, unknown> = {}) =>
  ({ id, intel, position: [1, 2, 3] as [number, number, number], radius: 0.5, ...extra });

describe('which worlds are outside live sight', () => {
  it('is every world without a live reading, remembered or never seen', () => {
    expect(isUnseen(world('a', 'RESOLVED'))).toBe(false);
    expect(isUnseen(world('b', 'REMEMBERED'))).toBe(true);
    expect(isUnseen(world('c', 'UNKNOWN'))).toBe(true);
  });
});

describe('the draw groups of the default worlds', () => {
  it('keeps live and unseen worlds of one impact level in separate draws, so only the unseen ones turn grey', () => {
    const groups = planetDrawGroups([world('a', 'RESOLVED'), world('b', 'UNKNOWN'), world('c', 'RESOLVED'), world('d', 'REMEMBERED')]);
    const byKey = new Map(groups.map(group => [group.key, group]));
    expect(byKey.get('0:live')?.nodes.map(node => node.id)).toEqual(['a', 'c']);
    expect(byKey.get('0:grey')?.nodes.map(node => node.id)).toEqual(['b', 'd']);
    expect(byKey.get('0:grey')?.grey).toBe(true);
    expect(byKey.get('0:live')?.grey).toBe(false);
  });

  it('draws nothing extra when every world is live', () => {
    expect(planetDrawGroups([world('a', 'RESOLVED'), world('b', 'RESOLVED')]).map(group => group.key)).toEqual(['0:live']);
  });
});

describe('the grey material', () => {
  const compileWith = (material: THREE.Material) => {
    const shader = {
      uniforms: {},
      vertexShader: 'void main() {}',
      fragmentShader: 'void main() {\n#include <map_fragment>\n#include <dithering_fragment>\n}',
    };
    material.onBeforeCompile(shader as never, null as never);
    return shader.fragmentShader;
  };

  it('turns the final colour to its luminance with contrast: black and white, never washed out', () => {
    const material = new THREE.MeshStandardMaterial();
    greyUnseenMaterial(material);
    const fragment = compileWith(material);
    expect(fragment).toContain('void unseenColourMain() {');
    expect(fragment).toMatch(/void main\(\) \{\s*unseenColourMain\(\);\s*float unseenLuma = dot\(gl_FragColor\.rgb, vec3\(0\.2126, 0\.7152, 0\.0722\)\);/);
    expect(fragment).toMatch(/unseenLuma = max\(0\.0, \(unseenLuma - 0\.\d+\) \* 1\.\d+ \+ 0\.\d+\)/);
    expect(fragment).toContain('gl_FragColor.rgb = vec3(unseenLuma);');
  });

  it('greys any fragment shader, a hand-written one too: the original main runs first, once', () => {
    const source = 'uniform float uTime;\nvoid main(void) {\n  if (uTime < 0.0) discard;\n  gl_FragColor = vec4(1.0, 0.2, 0.1, 1.0);\n}\n';
    const grey = greyFragment(source);
    expect(grey.match(/void main\s*\(/g)).toHaveLength(1);
    expect(grey).toContain('void unseenColourMain() {\n  if (uTime < 0.0) discard;');
    expect(grey.indexOf('void unseenColourMain()')).toBeLessThan(grey.indexOf('void main()'));
    expect(greyFragment(grey)).toBe(grey);
  });

  it('greys a shader material the same way', () => {
    const material = new THREE.ShaderMaterial({ fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' });
    greyUnseenMaterial(material);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: material.fragmentShader };
    material.onBeforeCompile(shader as never, null as never);
    expect(shader.fragmentShader).toContain('unseenColourMain();');
  });

  it('keeps what the material already did before it, such as an impact scar', () => {
    const material = new THREE.MeshStandardMaterial();
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n// scar');
    };
    greyUnseenMaterial(material);
    expect(compileWith(material)).toContain('// scar');
  });

  it('compiles its own program: a grey world never shares a colour world\'s shader', () => {
    const material = new THREE.MeshStandardMaterial();
    material.customProgramCacheKey = () => 'planet-surface';
    greyUnseenMaterial(material);
    expect(material.customProgramCacheKey()).toBe('planet-surface|unseen-grey');
  });
});

describe('a whole object outside live sight, such as a world\'s cosmetic ring', () => {
  it('greys every material under it, each once', () => {
    const root = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }' }));
    const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    const pair = new THREE.Mesh(new THREE.PlaneGeometry(), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]);
    root.add(ring, dust, pair);
    greyObject(root);
    greyObject(root);
    const all = [ring.material, dust.material, ...pair.material];
    for (const material of all) expect(material.customProgramCacheKey()).toMatch(/\|unseen-grey$/);
    expect(all.every(material => !material.customProgramCacheKey().includes('unseen-grey|unseen-grey'))).toBe(true);
  });
});

describe('a colour seen outside live sight', () => {
  it('keeps its brightness and loses its hue', () => {
    const colour = greyColour(new THREE.Color(0.8, 0.4, 0.2));
    expect(colour.r).toBeCloseTo(colour.g, 6);
    expect(colour.g).toBeCloseTo(colour.b, 6);
    expect(colour.r).toBeCloseTo(0.2126 * 0.8 + 0.7152 * 0.4 + 0.0722 * 0.2, 6);
  });
});

describe('the card stand-ins a world shows while its model loads', () => {
  it('splits each art into live and unseen cards, so an unseen world never flashes its colours', () => {
    const groups = cardGroups([world('a', 'RESOLVED'), world('b', 'UNKNOWN'), world('c', 'REMEMBERED'), world('d', 'RESOLVED')],
      node => (node.id === 'd' ? 'art-2' : 'art-1'));
    expect(groups.map(group => [group.texture, group.grey, group.nodes.map(node => node.id)])).toEqual([
      ['art-1', false, ['a']],
      ['art-1', true, ['b', 'c']],
      ['art-2', false, ['d']],
    ]);
  });
});

describe('how bright a world model is drawn', () => {
  it('keeps a live world at its own light', () => {
    expect(modelTint(world('a', 'RESOLVED'), 1.25)).toEqual([1.25, 1.25, 1.25]);
  });

  it('draws an unseen world at full, neutral light: black and white, not dimmed, not tinted', () => {
    expect(modelTint(world('b', 'UNKNOWN'), 0.4)).toEqual([1, 1, 1]);
    expect(modelTint(world('c', 'REMEMBERED'), 0.4)).toEqual([1, 1, 1]);
  });
});

describe('the cloud over an unseen world', () => {
  it('covers only worlds outside live sight, one band each', () => {
    const layout = cloudLayout([world('a', 'RESOLVED'), world('b', 'UNKNOWN'), world('c', 'REMEMBERED')]);
    expect(layout.map(cloud => cloud.id)).toEqual(['b', 'c']);
  });

  it('crosses the world near its middle, leaving its edges showing', () => {
    const [cloud] = cloudLayout([world('b', 'UNKNOWN', { radius: 2 })]);
    expect(cloud!.radius).toBe(2);
    expect(Math.abs(cloud!.offset[0])).toBeLessThan(0.3);
    expect(Math.abs(cloud!.offset[1])).toBeLessThan(0.3);
    expect(cloud!.size).toBeGreaterThan(1);
    expect(Math.abs(cloud!.angle)).toBeLessThan(0.6);
    expect(CLOUD.lift).toBeGreaterThan(1);
    // A thin band, not a puff: wider than tall.
    expect(CLOUD.stretch[0]).toBeGreaterThan(CLOUD.stretch[1] * 2);
    expect(CLOUD.opacity).toBeGreaterThan(0.3);
    expect(CLOUD.opacity).toBeLessThan(0.9);
  });

  it('is the same for the same world every time, and not the same for every world', () => {
    const once = cloudLayout([world('b', 'UNKNOWN'), world('z', 'UNKNOWN')]);
    const again = cloudLayout([world('b', 'UNKNOWN'), world('z', 'UNKNOWN')]);
    expect(again).toEqual(once);
    expect(once[0]!.angle).not.toBe(once[1]!.angle);
  });
});

describe('the clouds on the GPU', () => {
  it('packs every cloud into one draw: centre, shape and world per instance', () => {
    const layout = cloudLayout([world('b', 'UNKNOWN', { position: [4, 5, 6], radius: 2 }), world('c', 'UNKNOWN')]);
    const packed = cloudAttributes(layout);
    expect(packed.count).toBe(2);
    expect([...packed.centre.slice(0, 3)]).toEqual([4, 5, 6]);
    expect(packed.shape[0]).toBeCloseTo(layout[0]!.offset[0], 6);
    expect(packed.shape[2]).toBeCloseTo(layout[0]!.size, 6);
    expect(packed.shape[3]).toBeCloseTo(layout[0]!.angle, 6);
    expect(packed.world[0]).toBe(2);
    expect(packed.world[3]).toBeCloseTo(layout[1]!.phase, 6);
  });

  it('packs nothing when every world is live', () => {
    expect(cloudAttributes(cloudLayout([world('a', 'RESOLVED')])).count).toBe(0);
  });
});
