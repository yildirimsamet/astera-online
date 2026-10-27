/**
 * The class ships' files and the bits every scene that draws one needs: the hangar, and the galaxy
 * where the ship parks beside its capital (KG-A20). They share the page's one KTX2 transcoder, or
 * take the webp copies where it cannot start.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { SHIP_CLASSES, type ShipClass } from '@astera/rules/arena';
import { memoryTight, packsFor } from '../assets/load.js';
import { parseReferenceManifest } from '../assets/manifest.js';
import { ktx2Ready, sharedKtx2 } from '../assets/memory.js';

/**
 * `ktx2`: the file is KTX2, read through the page's transcoder; false for the webp copy. A flag, not
 * the loader: the Yarık lets the loader go once its pack is in, and a ship file loaded after that
 * through the old one waited on a worker that could never start (review 2026-10-27).
 */
export interface ShipModel { url: string; engines: [number, number, number][]; nozzle: number; ktx2: boolean }

/** A ship's GLTF decoders: meshopt always, and the page's transcoder as it is now for a KTX2 file. */
export function shipDecoders(loader: { setMeshoptDecoder(decoder: typeof MeshoptDecoder): unknown; setKTX2Loader(loader: KTX2Loader): unknown }, model: Pick<ShipModel, 'ktx2'>): void {
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (model.ktx2) loader.setKTX2Loader(sharedKtx2());
}

/** The class ships' files in the pack this device can hold, and can decode (`ktx2Ready`). */
export function useShipModels(enabled: boolean, lite = memoryTight(navigator)): Partial<Record<ShipClass, ShipModel>> | null {
  const [models, setModels] = useState<Partial<Record<ShipClass, ShipModel>> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const run = { live: true };
    void (async () => {
      const ktx2 = await ktx2Ready();
      for (const url of packsFor(lite, ktx2 !== null)) {
        try {
          const response = await fetch(url, { credentials: 'same-origin' });
          if (!response.ok) continue;
          const classes = parseReferenceManifest(await response.json())?.ships.classes;
          if (!classes) continue;
          const found: Partial<Record<ShipClass, ShipModel>> = {};
          for (const ship of SHIP_CLASSES) {
            const d = classes[ship];
            found[ship] = { url: d.model, engines: d.engines ?? [], nozzle: d.nozzle ?? 0.03, ktx2: ktx2 !== null };
          }
          if (run.live) setModels(found);
          return;
        } catch { /* The next manifest, or the hangar without a ship. */ }
      }
    })();
    return () => { run.live = false; };
  }, [enabled, lite]);
  return models;
}

/** A soft round sprite drawn once: the engine glow, the contact shadow and the pad's light. */
export function radial(stops: [number, string][]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  if (g) {
    const fill = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    for (const [at, colour] of stops) fill.addColorStop(at, colour);
    g.fillStyle = fill; g.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
