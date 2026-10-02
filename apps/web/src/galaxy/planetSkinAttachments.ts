import type { PlanetPaletteId, SkinAttachment } from '@astera/rules';
import * as THREE from 'three';

export interface PlanetSkinAttachmentAsset extends SkinAttachment {
  readonly palette: PlanetPaletteId;
  readonly url: string;
  /** Largest model extent as a share of the planet radius. */
  readonly size: number;
}

export const PLANET_SKIN_FULL_ANGULAR_RADIUS = 1 / 28;
export const PLANET_SKIN_MODEL_ANGULAR_RADIUS = 1 / 90;
export const PLANET_SKIN_BODY_SCALE = 0.96;
export const PLANET_SKIN_SPIN_RATE = 0.08;
/** One authored prop, repeated as a clearly small, original, and large landmark. */
export const PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS = [0.68, 1, 1.34] as const;

export const planetSkinPhase = (id: string): number => {
  let value = 2166136261;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return ((value >>> 0) / 0x1_0000_0000) * Math.PI * 2;
};

export const planetSkinRotation = (id: string, offset: number, elapsedTime: number, still: boolean): number =>
  planetSkinPhase(id) + offset + (still ? 0 : elapsedTime * PLANET_SKIN_SPIN_RATE);

const asset = (
  assetId: string,
  palette: PlanetPaletteId,
  file: string,
  placementId: string,
  size: number,
): PlanetSkinAttachmentAsset => ({
  assetId,
  palette,
  url: `/assets/models/optimized-models-${palette}/${file}_low.glb`,
  placementId,
  size,
});

/**
 * Four authored landmark types per skin. Placement repeats each geometry at the
 * three scale variants above, while instances of the same mesh share one draw call.
 */
export const PLANET_SKIN_ATTACHMENT_ASSETS: Readonly<Record<string, PlanetSkinAttachmentAsset>> = {
  'lava-arch': asset('lava-arch', 'lava', 'lava_arch_1', 'surface-primary', 0.26),
  'lava-pillar': asset('lava-pillar', 'lava', 'lava_pillar_1', 'surface-secondary', 0.21),
  'lava-spikes': asset('lava-spikes', 'lava', 'lava_spikes_1', 'surface-tertiary', 0.19),
  'lava-volcano': asset('lava-volcano', 'lava', 'lava_volcano_1', 'surface-quaternary', 0.24),
  'ice-arch': asset('ice-arch', 'ice', 'ice_arch_1', 'surface-primary', 0.26),
  'ice-cave': asset('ice-cave', 'ice', 'ice_cave_1', 'surface-secondary', 0.25),
  'ice-pillar': asset('ice-pillar', 'ice', 'ice_pillar_1', 'surface-tertiary', 0.21),
  'ice-spikes': asset('ice-spikes', 'ice', 'ice_spikes_1', 'surface-quaternary', 0.19),
  'toxic-eggs': asset('toxic-eggs', 'toxic', 'toxic_eggs_1', 'surface-primary', 0.18),
  'toxic-flower': asset('toxic-flower', 'toxic', 'toxic_flower_1', 'surface-secondary', 0.21),
  'toxic-mushroom': asset('toxic-mushroom', 'toxic', 'toxic_mushroom_1', 'surface-tertiary', 0.2),
  'toxic-spike': asset('toxic-spike', 'toxic', 'toxic_spike_1', 'surface-quaternary', 0.2),
  'desert-bones': asset('desert-bones', 'desert', 'desert_bones_1', 'surface-primary', 0.22),
  'desert-hill': asset('desert-hill', 'desert', 'desert_hill_1', 'surface-secondary', 0.26),
  'desert-monument-1': asset(
    'desert-monument-1', 'desert', 'desert_monument_1', 'surface-tertiary', 0.23,
  ),
  'desert-monument-2': asset(
    'desert-monument-2', 'desert', 'desert_monument_2', 'surface-quaternary', 0.21,
  ),
};

const ATTACHMENTS_BY_ID = new Map<string, PlanetSkinAttachmentAsset>(
  Object.values(PLANET_SKIN_ATTACHMENT_ASSETS).map((entry) => [entry.assetId, entry]),
);

/** Unknown or mismatched recipe entries fail closed without taking the planet down. */
export function resolvePlanetSkinAttachments(
  attachments: readonly SkinAttachment[],
): PlanetSkinAttachmentAsset[] {
  const resolved: PlanetSkinAttachmentAsset[] = [];
  for (const attachment of attachments) {
    const entry = ATTACHMENTS_BY_ID.get(attachment.assetId);
    if (entry?.placementId === attachment.placementId) resolved.push(entry);
  }
  return resolved;
}

/** Props disappear before they become sub-pixel triangle work. */
export const planetSkinAttachmentsVisible = (lod: 'full' | 'low' | 'billboard'): boolean =>
  lod === 'full';

const UNIT_ATTACHMENT_GEOMETRY = new WeakMap<THREE.Mesh, THREE.BufferGeometry>();

/** Bake exporter transforms in floats, then make every prop stand on the same unit footprint. */
export function unitAttachmentGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const cached = UNIT_ATTACHMENT_GEOMETRY.get(mesh);
  if (cached) return cached;
  mesh.updateWorldMatrix(true, false);
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(mesh.geometry.attributes)) {
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      const at = i * attribute.itemSize;
      values[at] = attribute.getX(i);
      if (attribute.itemSize > 1) values[at + 1] = attribute.getY(i);
      if (attribute.itemSize > 2) values[at + 2] = attribute.getZ(i);
      if (attribute.itemSize > 3) values[at + 3] = attribute.getW(i);
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box) {
    const span = new THREE.Vector3();
    box.getSize(span);
    geometry.translate(
      -(box.min.x + box.max.x) / 2,
      -box.min.y,
      -(box.min.z + box.max.z) / 2,
    );
    const scale = 1 / (Math.max(span.x, span.y, span.z) || 1);
    geometry.scale(scale, scale, scale);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  UNIT_ATTACHMENT_GEOMETRY.set(mesh, geometry);
  return geometry;
}

export interface PlanetSurfaceProbe {
  readonly direction: THREE.Vector3;
  readonly radius: number;
  readonly normal: THREE.Vector3;
  /** Angular distance to the nearest hole or non-outward fractured face. */
  readonly clearance: number;
  /** Positive on the hemisphere containing the dominant opening. */
  readonly fractureAlignment: number;
}

const SURFACE_PROBES = new WeakMap<THREE.BufferGeometry, readonly PlanetSurfaceProbe[]>();
const SURFACE_PROBE_COUNT = 384;

/**
 * Raycast the real crust instead of assuming a sphere. Rays that pass through a
 * fracture and hit the far inner shell are rejected, as are detached shards and
 * steep break walls that cannot support a prop.
 */
export function planetSurfaceProbes(
  geometry: THREE.BufferGeometry,
): readonly PlanetSurfaceProbe[] {
  const cached = SURFACE_PROBES.get(geometry);
  if (cached) return cached;
  const target = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const directions: THREE.Vector3[] = [];
  const candidates: ({ direction: THREE.Vector3; radius: number; normal: THREE.Vector3 } | null)[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < SURFACE_PROBE_COUNT; i++) {
    const y = 1 - (i / (SURFACE_PROBE_COUNT - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const direction = new THREE.Vector3(
      Math.cos(golden * i) * ring,
      y,
      Math.sin(golden * i) * ring,
    ).normalize();
    directions.push(direction);
    from.copy(direction).multiplyScalar(4);
    ray.set(from, direction.clone().negate());
    const hit = ray.intersectObject(target, false)[0];
    const radius = hit?.point.dot(direction) ?? -1;
    const normal = hit?.face?.normal.clone().normalize();
    candidates.push(
      hit && normal && radius > 0.45 && normal.dot(direction) > 0.12
        ? { direction, radius, normal }
        : null,
    );
  }
  target.material.dispose();

  const invalid = directions.filter((_, index) => candidates[index] === null);
  const valid = candidates.filter((candidate): candidate is NonNullable<typeof candidate> =>
    candidate !== null);
  const sortedRadii = valid.map(({ radius }) => radius).sort((a, b) => a - b);
  const referenceRadius = sortedRadii[Math.floor((sortedRadii.length - 1) * 0.7)] ?? 0;
  const lowRadius = sortedRadii[Math.floor((sortedRadii.length - 1) * 0.1)] ?? referenceRadius;
  const radialSpan = referenceRadius - lowRadius;
  const radialOpening = new THREE.Vector3();
  const radialEvidence: THREE.Vector3[] = [];
  if (radialSpan > 0.06) {
    const cutoff = referenceRadius - Math.max(0.035, radialSpan * 0.18);
    for (const candidate of valid) {
      const deficit = referenceRadius - candidate.radius;
      if (candidate.radius >= cutoff) continue;
      radialOpening.addScaledVector(candidate.direction, deficit * deficit);
      radialEvidence.push(candidate.direction);
    }
  }

  const missingOpening = new THREE.Vector3();
  for (const missing of invalid) missingOpening.add(missing);
  const fractureDirection = new THREE.Vector3();
  const hasRadialOpening = radialOpening.lengthSq() > 1e-8;
  const hasMissingOpening = invalid.length >= SURFACE_PROBE_COUNT * 0.04;
  if (hasRadialOpening) fractureDirection.copy(radialOpening).normalize();
  if (hasMissingOpening) {
    missingOpening.normalize();
    if (!hasRadialOpening || fractureDirection.dot(missingOpening) > 0.2) {
      fractureDirection.add(missingOpening).normalize();
    }
  }
  // A lone missed ray is sampling noise on a shattered shell, not its opening.
  const unsafe = hasMissingOpening ? [...invalid, ...radialEvidence] : radialEvidence;
  const hasFractureDirection = fractureDirection.lengthSq() > 1e-8;
  if (fractureDirection.lengthSq() > 0) fractureDirection.normalize();
  const probes: PlanetSurfaceProbe[] = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    let clearance = Math.PI;
    for (const missing of unsafe) {
      clearance = Math.min(
        clearance,
        Math.acos(THREE.MathUtils.clamp(candidate.direction.dot(missing), -1, 1)),
      );
    }
    probes.push({
      ...candidate,
      clearance,
      fractureAlignment: hasFractureDirection
        ? candidate.direction.dot(fractureDirection)
        : -1,
    });
  }
  SURFACE_PROBES.set(geometry, probes);
  return probes;
}

interface PlannedPlacement {
  readonly nodeIndex: number;
  readonly local: THREE.Matrix4;
}

export interface PlannedAttachmentGroup {
  readonly asset: PlanetSkinAttachmentAsset;
  readonly placements: PlannedPlacement[];
}

const seededUnit = (id: string, salt: number): number => {
  let value = 2166136261 ^ salt;
  for (const char of id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  return ((value ^ (value >>> 13)) >>> 0) / 0x1_0000_0000;
};

const foundation = (
  probes: readonly PlanetSurfaceProbe[],
  anchor: PlanetSurfaceProbe,
  footprint: number,
): { position: THREE.Vector3; up: THREE.Vector3 } => {
  const up = new THREE.Vector3();
  let lowest = anchor.radius;
  const reach = Math.cos(Math.asin(Math.min(0.9, footprint / Math.max(anchor.radius, 0.001))));
  for (const probe of probes) {
    if (probe.direction.dot(anchor.direction) < reach) continue;
    up.add(probe.normal);
    lowest = Math.min(lowest, probe.radius);
  }
  if (up.lengthSq() === 0) up.copy(anchor.normal);
  up.normalize().add(anchor.direction).normalize();
  const bed = Math.max(lowest, anchor.radius - footprint * 0.3) - 0.012;
  return { position: anchor.direction.clone().multiplyScalar(bed), up };
};

/**
 * Seeded best-candidate placement: random per world, but maximally separated and
 * stable across reloads. Insufficient clearance means omission, never a prop over
 * the fractured opening.
 */
export function planPlanetSkinAttachments(
  nodeIds: readonly string[],
  probes: readonly PlanetSurfaceProbe[],
  assets: readonly PlanetSkinAttachmentAsset[],
  options: {
    readonly fractureClearance?: number;
    readonly avoidFractureHemisphere?: boolean;
  } = {},
): PlannedAttachmentGroup[] {
  const groups: PlannedAttachmentGroup[] = assets.map((entry) => ({ asset: entry, placements: [] }));
  const worldUp = new THREE.Vector3(0, 1, 0);
  for (let nodeIndex = 0; nodeIndex < nodeIds.length; nodeIndex++) {
    const nodeId = nodeIds[nodeIndex];
    if (!nodeId) continue;
    const chosen: PlanetSurfaceProbe[] = [];
    for (let variantIndex = 0; variantIndex < PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS.length; variantIndex++) {
      const sizeVariant = PLANET_SKIN_ATTACHMENT_SCALE_VARIANTS[variantIndex];
      for (let assetIndex = 0; assetIndex < assets.length; assetIndex++) {
        const entry = assets[assetIndex];
        const group = groups[assetIndex];
        if (!entry || !group || sizeVariant === undefined) continue;
        const slot = variantIndex * assets.length + assetIndex;
        const size = entry.size * sizeVariant;
        const footprint = size * 0.5;
        const minimumClearance = Math.max(
          Math.asin(Math.min(0.9, footprint * 0.8)),
          options.fractureClearance ?? 0,
        );
        let anchor: PlanetSurfaceProbe | undefined;
        let best = -Infinity;
        for (let candidateIndex = 0; candidateIndex < probes.length; candidateIndex++) {
          const candidate = probes[candidateIndex];
          if (
            !candidate
            || candidate.clearance < minimumClearance
          || (options.avoidFractureHemisphere && candidate.fractureAlignment > -0.2)
            || chosen.includes(candidate)
          ) continue;
          const separation = chosen.length === 0
            ? 1
            : Math.min(...chosen.map((other) => 1 - candidate.direction.dot(other.direction)));
          const jitter = seededUnit(nodeId, 701 + slot * 977 + candidateIndex * 37) * 0.04;
          const score = separation + jitter;
          if (score > best) {
            best = score;
            anchor = candidate;
          }
        }
        if (!anchor) continue;
        chosen.push(anchor);
        const seat = foundation(probes, anchor, footprint);
        const stand = new THREE.Quaternion().setFromUnitVectors(worldUp, seat.up);
        const turn = new THREE.Quaternion().setFromAxisAngle(
          worldUp,
          seededUnit(nodeId, 1901 + slot * 71) * Math.PI * 2,
        );
        const scale = new THREE.Vector3(size, size, size);
        const local = new THREE.Matrix4().compose(seat.position, stand.multiply(turn), scale);
        group.placements.push({ nodeIndex, local });
      }
    }
  }
  return groups;
}
