import { expect, it } from 'vitest';
import { legStandoff, threadPosition } from '../src/galaxy/scene.js';
import { flightRecallInput, flightTitle } from '../src/lib/flights.js';
import { pendingSchema, galaxySchema } from '../src/api/schemas.js';
import { planetNodes } from '../src/galaxy/scene.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { MODEL_FACING } from '../src/ui/assets.js';
import { orientedCraft } from '../src/galaxy/model.js';
import { nativeEngineAnchors } from '../src/galaxy/engineAnchors.js';

it('embeds visible radiation trefoils in every flight model with markings batched into one draw', async () => {
  for (const level of [1, 2, 3]) {
    const bytes = readFileSync(resolve(`public/assets/models/missiles/radiation-bomb-l${String(level)}.glb`));
    const { scene } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
    let markingDraws = 0;
    let markingVertices = 0;
    let draws = 0;
    scene.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      draws++;
      if (node.material instanceof THREE.MeshStandardMaterial && node.material.name === 'Radiation trefoil warning paint') {
        const geometry: unknown = node.geometry;
        if (!(geometry instanceof THREE.BufferGeometry)) throw new Error('Missing radiation marking geometry');
        const position: unknown = geometry.getAttribute('position');
        if (!(position instanceof THREE.BufferAttribute)) throw new Error('Missing radiation marking vertices');
        markingDraws++;
        markingVertices += position.count;
      }
    });
    expect(markingDraws, `L${String(level)} has physical warning marks`).toBe(1);
    expect(markingVertices).toBeGreaterThan(30);
    expect(draws).toBeLessThanOrEqual(10);
  }
});

it('uses the server-frozen surface trajectory without applying a second fleet orbit offset and never offers recall', () => {
  const nodes = planetNodes([galaxySchema.shape.planets.element.parse({ id: 'target', isSelf: false, position: { x: 1000, y: 0, z: 0 }, coreTier: 1, satellites: [], shielded: false, intel: 'RESOLVED', state: { kind: 'NORMAL' } })]);
  const endX = 1000 - (nodes[0]!.radius + .84 / 2) * 50;
  const [thread] = pendingSchema.parse({ pending: [{ id: 'bomb', kind: 'radiation_bomb', radiationBombLevel: 3,
    targetName: 'Asterion', arriveAt: new Date(60000), minutesRemaining: 1, leg: 'outbound',
    path: { from: { x: 0, y: 0, z: 0 }, to: { x: endX, y: 0, z: 0 }, departAt: new Date(0), arriveAt: new Date(60000) } }] }).pending;
  expect(legStandoff(thread!, nodes)).toEqual({ start: 0, end: 0 });
  const [x] = threadPosition(thread!.path!, 60000, legStandoff(thread!, nodes));
  expect(nodes[0]!.position[0] - (x + .84 / 2)).toBeCloseTo(nodes[0]!.radius, 8);
  expect(flightRecallInput(thread!)).toBeUndefined();
  expect(flightTitle(thread!)).toContain('Radiation Bomb · L3');
});

it('points the actual M1 warhead forward with its glowing drive behind it for every level', async () => {
  const colours = new Set<string>();
  const widths: number[] = [];
  for (const level of [1, 2, 3]) {
    const url = `/assets/models/missiles/radiation-bomb-l${String(level)}.glb`;
    const bytes = readFileSync(resolve(`public${url}`));
    const { scene } = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
    const craft = orientedCraft(scene, MODEL_FACING[url]!);
    craft.updateWorldMatrix(true, true);
    const nose = craft.getObjectByName('Warhead_tip');
    const drive = craft.getObjectByName('Isotope_drive_throat');
    expect(nose, 'The real nose has an authored witness, not a guessed bounding-box facing').toBeDefined();
    expect(drive).toBeDefined();
    expect(nose!.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(.4);
    const nozzle = drive!.getWorldPosition(new THREE.Vector3());
    expect(nozzle.z).toBeLessThan(-.35);
    expect(nativeEngineAnchors(url)?.[0]?.[2]).toBeCloseTo(nozzle.z, 2);
    const warhead = craft.getObjectByName('Warhead_armour');
    expect(warhead).toBeInstanceOf(THREE.Mesh);
    if (!(warhead instanceof THREE.Mesh) || !(warhead.material instanceof THREE.MeshStandardMaterial)) throw new Error('Missing authored warhead');
    colours.add(warhead.material.color.getHexString());
    widths.push(new THREE.Box3().setFromObject(warhead).getSize(new THREE.Vector3()).x);
  }
  expect(colours.size).toBe(3);
  expect(widths[1]!).toBeGreaterThan(widths[0]! * 1.15);
  expect(widths[2]!).toBeGreaterThan(widths[1]! * 1.15);
});
