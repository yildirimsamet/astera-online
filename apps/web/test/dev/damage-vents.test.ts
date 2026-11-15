import { describe, expect, it } from 'vitest';
import { pickVents, SMOKE_PUFFS } from '../../src/dev/lab/damage.js';

type P = [number, number, number];

describe('damage vents (vfx lab)', () => {
  const deck: P[] = Array.from({ length: 200 }, (_, i) => [((i * 37) % 200) / 100 - 1, 0.2 + ((i * 13) % 7) / 100, ((i * 53) % 40) / 100 - 0.2]);

  it('picks the asked number of vents from the surface it was given', () => {
    const vents = pickVents(deck, 3);
    expect(vents).toHaveLength(3);
    for (const v of vents) expect(deck.some((p) => p[0] === v[0] && p[1] === v[1] && p[2] === v[2])).toBe(true);
  });

  it('spreads them along the hull, never two on one spot', () => {
    const vents = pickVents(deck, 3);
    for (let i = 0; i < vents.length; i++) {
      for (let j = i + 1; j < vents.length; j++) {
        const a = vents[i]!, b = vents[j]!;
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeGreaterThan(0.4);
      }
    }
  });

  it('is the same every time for the same hull', () => {
    expect(pickVents(deck, 3)).toEqual(pickVents(deck, 3));
  });

  it('asks for more than there is and gets what there is', () => {
    expect(pickVents(deck.slice(0, 2), 3)).toHaveLength(2);
    expect(pickVents([], 3)).toEqual([]);
  });
});

describe('hull deck (vfx lab)', () => {
  const deckOf = async () => (await import('../../src/dev/lab/damage.js')).hullDeck;

  it('finds the upward faces of a plain mesh', async () => {
    const THREE = await import('three');
    const hullDeck = await deckOf();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1, 4, 1, 4));
    const deck = hullDeck(box);
    expect(deck.length).toBeGreaterThan(0);
    for (const [, up] of deck) expect(up).toBeCloseTo(0.5, 5);
  });

  it('reads interleaved glTF vertex data too', async () => {
    const THREE = await import('three');
    const hullDeck = await deckOf();
    // Two triangles facing up, position and normal packed in one buffer as glTF often stores them.
    const data = new Float32Array([
      0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0,
      1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0,
    ]);
    const buffer = new THREE.InterleavedBuffer(data, 6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
    expect(hullDeck(new THREE.Mesh(geometry), 1).length).toBe(6);
  });
});

describe('seamless flame loop (vfx lab)', () => {
  it('two layers always add up to one full flame', async () => {
    const { loopLayers } = await import('../../src/dev/lab/damage.js');
    for (let t = 0; t < 5; t += 0.037) {
      const [a, b] = loopLayers(t, 24, 36, 0.3);
      expect(a.weight + b.weight).toBeCloseTo(1, 6);
      for (const layer of [a, b]) { expect(layer.frame).toBeGreaterThanOrEqual(0); expect(layer.frame).toBeLessThan(36); }
    }
  });

  it('a layer jumps from the last frame back to the first only while it is invisible', async () => {
    const { loopLayers } = await import('../../src/dev/lab/damage.js');
    const step = 1 / 240;
    for (let t = 0; t < 4; t += step) {
      const now = loopLayers(t, 24, 36, 0), next = loopLayers(t + step, 24, 36, 0);
      for (const i of [0, 1] as const) {
        if (next[i].frame < now[i].frame) expect(Math.max(now[i].weight, next[i].weight)).toBeLessThan(0.02);
      }
    }
  });
});

describe('smoke puffs (vfx lab)', () => {
  const puffIndexes = Array.from({ length: SMOKE_PUFFS }, (_, k) => k);

  it('puffs of one vent are reborn one at a time, never together', async () => {
    const { puffState } = await import('../../src/dev/lab/damage.js');
    let last = puffIndexes.map((k) => puffState(0, k, 0).cycle);
    for (let t = 0.01; t < 20; t += 0.01) {
      const now = puffIndexes.map((k) => puffState(0, k, t).cycle);
      expect(now.filter((cycle, k) => cycle !== last[k]).length).toBeLessThanOrEqual(1);
      last = now;
    }
  });

  it('the plume never breaks: a vent always has smoke showing', async () => {
    const { puffState } = await import('../../src/dev/lab/damage.js');
    for (let t = 0; t < 30; t += 0.05) {
      for (const vent of [0, 1, 2]) {
        const shown = puffIndexes.reduce((sum, k) => sum + puffState(vent, k, t).alpha, 0);
        expect(shown).toBeGreaterThan(2);
      }
    }
  });

  it('the column has no holes: puffs stay spread along it instead of bunching up', async () => {
    const { puffState } = await import('../../src/dev/lab/damage.js');
    for (let t = 0; t < 60; t += 0.1) {
      for (const vent of [0, 1, 2]) {
        const ages = puffIndexes.map((k) => puffState(vent, k, t).age).sort((x, y) => x - y);
        const gaps = ages.map((age, i) => (i === 0 ? age + 1 - ages[ages.length - 1]! : age - ages[i - 1]!));
        expect(Math.max(...gaps)).toBeLessThan(0.25);
      }
    }
  });

  it('a puff fades fully out before it is born again, somewhere new', async () => {
    const { puffState } = await import('../../src/dev/lab/damage.js');
    let last = puffState(1, 2, 0);
    for (let t = 0.01; t < 12; t += 0.01) {
      const now = puffState(1, 2, t);
      if (now.cycle !== last.cycle) {
        expect(last.alpha).toBeLessThan(0.05);
        expect(now.drift).not.toBeCloseTo(last.drift, 3);
      }
      last = now;
    }
  });

  it('bad clocks give a quiet puff, never NaN', async () => {
    const { puffState } = await import('../../src/dev/lab/damage.js');
    for (const t of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const p = puffState(0, 0, t);
      expect(Object.values(p).every(Number.isFinite)).toBe(true);
      expect(p.alpha).toBe(0);
    }
  });
});
