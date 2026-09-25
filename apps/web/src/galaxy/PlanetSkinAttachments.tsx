import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { SkinAttachment } from '@astera/rules';
import type { PlanetSkinVisual } from '../ui/planetSkins.js';
import type { PlanetNode } from './scene.js';
import { bodyLight } from './PlanetField.jsx';
import { sphereInFrustum } from './frustum.js';
import { createPlanetSkinAttachmentMaterial } from './planetSkinMaterial.js';
import {
  PLANET_SKIN_BODY_SCALE,
  PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS,
  PLANET_SKIN_FULL_ANGULAR_RADIUS,
  PLANET_SKIN_SPIN_RATE,
  planPlanetSkinAttachments,
  planetSkinPhase,
  planetSurfaceProbes,
  resolvePlanetSkinAttachments,
  unitAttachmentGeometry,
  type PlanetSkinAttachmentAsset,
} from './planetSkinAttachments.js';

type AttachmentNode = Pick<PlanetNode, 'id' | 'position' | 'radius' | 'stance' | 'intel'>;

interface AttachmentModel {
  readonly asset: PlanetSkinAttachmentAsset;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
}

const firstMesh = (scene: THREE.Object3D): THREE.Mesh | null => {
  let found: THREE.Mesh | null = null;
  scene.traverse((node) => {
    if (!found && node instanceof THREE.Mesh) found = node;
  });
  return found;
};

/** Resolve recipe ids before entering the loader hook; a stale entry is simply absent. */
export function PlanetSkinAttachments({
  attachments,
  finish,
  planetGeometry,
  nodes,
  galaxyLod,
  avoidFractures,
}: {
  attachments: readonly SkinAttachment[];
  finish: PlanetSkinVisual['finish'];
  planetGeometry: THREE.BufferGeometry;
  nodes: readonly AttachmentNode[];
  galaxyLod: boolean;
  avoidFractures: boolean;
}) {
  const assets = useMemo(() => resolvePlanetSkinAttachments(attachments), [attachments]);
  if (assets.length === 0) return null;
  return (
    <LoadedPlanetSkinAttachments
      assets={assets}
      finish={finish}
      planetGeometry={planetGeometry}
      nodes={nodes}
      galaxyLod={galaxyLod}
      avoidFractures={avoidFractures}
    />
  );
}

function LoadedPlanetSkinAttachments({
  assets,
  finish,
  planetGeometry,
  nodes,
  galaxyLod,
  avoidFractures,
}: {
  assets: readonly PlanetSkinAttachmentAsset[];
  finish: PlanetSkinVisual['finish'];
  planetGeometry: THREE.BufferGeometry;
  nodes: readonly AttachmentNode[];
  galaxyLod: boolean;
  avoidFractures: boolean;
}) {
  const urls = useMemo(() => assets.map((entry) => entry.url), [assets]);
  const loaded = useGLTF(urls, false);
  const models = useMemo<(AttachmentModel | null)[]>(() => assets.map((entry, index) => {
    const scene = loaded[index]?.scene;
    const mesh = scene ? firstMesh(scene) : null;
    if (!mesh) return null;
    const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!source) return null;
    const material = finish.kind === 'PALETTE'
      ? createPlanetSkinAttachmentMaterial(source, finish).material
      : source.clone();
    return {
      asset: entry,
      geometry: unitAttachmentGeometry(mesh),
      material,
    };
  }), [assets, loaded, finish]);
  const probes = useMemo(() => planetSurfaceProbes(planetGeometry), [planetGeometry]);
  const plans = useMemo(
    () => planPlanetSkinAttachments(
      nodes.map((node) => node.id),
      probes,
      assets,
      {
        fractureClearance: avoidFractures ? 0.45 : 0,
        avoidFractureHemisphere: avoidFractures,
      },
    ),
    [nodes, probes, assets, avoidFractures],
  );
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const helper = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const projection = useMemo(() => new THREE.Matrix4(), []);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const roots = useMemo(() => nodes.map(() => new THREE.Matrix4()), [nodes]);
  const visible = useMemo(() => new Uint8Array(nodes.length), [nodes.length]);
  const lights = useMemo(() => new Float32Array(nodes.length * 3), [nodes.length]);

  useEffect(() => () => {
    // The cached GLTF owns geometry and textures; each look owns only its material clone.
    for (const model of models) model?.material.dispose();
  }, [models]);

  useLayoutEffect(() => {
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.count = 0;
      mesh.visible = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, tint.setRGB(1, 1, 1));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (!Array.isArray(mesh.material)) mesh.material.needsUpdate = true;
    }
  }, [models, tint]);

  useFrame(({ camera, clock }) => {
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    visible.fill(0);
    nodes.forEach((node, index) => {
      const distance = camera.position.distanceTo(helper.position.set(...node.position));
      const full = !galaxyLod || node.radius >= distance * PLANET_SKIN_FULL_ANGULAR_RADIUS;
      if (!full || !sphereInFrustum(frustum, node.position, node.radius * 1.3)) return;
      helper.position.set(...node.position);
      helper.rotation.set(0, planetSkinPhase(node.id) + clock.elapsedTime * PLANET_SKIN_SPIN_RATE, 0);
      helper.scale.setScalar(node.radius * PLANET_SKIN_BODY_SCALE);
      helper.updateMatrix();
      roots[index]?.copy(helper.matrix);
      visible[index] = 1;
      const light = bodyLight(node.stance, node.intel);
      const cool = node.intel === 'RESOLVED' ? [1, 1, 1] : [0.72, 0.84, 1];
      const offset = index * 3;
      lights[offset] = light * cool[0]!;
      lights[offset + 1] = light * cool[1]!;
      lights[offset + 2] = light * cool[2]!;
    });

    plans.forEach((plan, groupIndex) => {
      const mesh = meshes.current[groupIndex];
      if (!mesh) return;
      let count = 0;
      for (const placement of plan.placements) {
        if (visible[placement.nodeIndex] !== 1) continue;
        const root = roots[placement.nodeIndex];
        if (!root) continue;
        matrix.multiplyMatrices(root, placement.local);
        mesh.setMatrixAt(count, matrix);
        const offset = placement.nodeIndex * 3;
        mesh.setColorAt(count, tint.setRGB(
          lights[offset] ?? 1,
          lights[offset + 1] ?? 1,
          lights[offset + 2] ?? 1,
        ));
        count += 1;
      }
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });

  return (
    <>
      {models.map((model, index) => model ? (
        <instancedMesh
          key={model.asset.assetId}
          ref={(mesh) => { meshes.current[index] = mesh; }}
          name={`planet-skin-attachment-${model.asset.assetId}`}
          args={[
            model.geometry,
            model.material,
            nodes.length * PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS.length,
          ]}
          frustumCulled={false}
          raycast={() => null}
        />
      ) : null)}
    </>
  );
}
