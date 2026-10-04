/** Offline atlas baking: sample the untouched high mesh, never interpolate its split UV islands. */
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';

export function applyUvTransform(u, v, transform) {
  const x = u * transform.scale[0];
  const y = v * transform.scale[1];
  const c = Math.cos(transform.rotation);
  const s = Math.sin(transform.rotation);
  return [x * c - y * s + transform.offset[0], x * s + y * c + transform.offset[1]];
}

function wrap(value, mode) {
  if (mode === 33071) return Math.max(0, Math.min(1, value));
  if (mode === 33648) return 1 - Math.abs(((value % 2 + 2) % 2) - 1);
  return (value % 1 + 1) % 1;
}

export function sampleMap(map, u, v, sampler, result = new Float32Array(4)) {
  const x = wrap(u, sampler.wrapS) * map.width - 0.5;
  const y = wrap(v, sampler.wrapT) * map.height - 0.5;
  const left = Math.floor(x);
  const top = Math.floor(y);
  const fx = x - left;
  const fy = y - top;
  const coordinate = (value, length, mode) => mode === 10497
    ? (value % length + length) % length : Math.max(0, Math.min(length - 1, value));
  const a = (coordinate(top, map.height, sampler.wrapT) * map.width + coordinate(left, map.width, sampler.wrapS)) * 4;
  const b = (coordinate(top, map.height, sampler.wrapT) * map.width + coordinate(left + 1, map.width, sampler.wrapS)) * 4;
  const c = (coordinate(top + 1, map.height, sampler.wrapT) * map.width + coordinate(left, map.width, sampler.wrapS)) * 4;
  const d = (coordinate(top + 1, map.height, sampler.wrapT) * map.width + coordinate(left + 1, map.width, sampler.wrapS)) * 4;
  for (let channel = 0; channel < 4; channel += 1) {
    result[channel] = (map.data[a + channel] * (1 - fx) + map.data[b + channel] * fx) * (1 - fy)
      + (map.data[c + channel] * (1 - fx) + map.data[d + channel] * fx) * fy;
  }
  return result;
}

export function reframeNormal(normal, source, target, result = new Float32Array(3)) {
  const x = normal[0] * source[0] + normal[1] * source[3] + normal[2] * source[6];
  const y = normal[0] * source[1] + normal[1] * source[4] + normal[2] * source[7];
  const z = normal[0] * source[2] + normal[1] * source[5] + normal[2] * source[8];
  result[0] = x * target[0] + y * target[1] + z * target[2];
  result[1] = x * target[3] + y * target[4] + z * target[5];
  result[2] = x * target[6] + y * target[7] + z * target[8];
  const length = Math.hypot(...result) || 1;
  for (let axis = 0; axis < 3; axis += 1) result[axis] /= length;
  return result;
}

const textureTransform = (info) => {
  const transform = info.getExtension('KHR_texture_transform');
  return { scale: transform?.getScale() ?? [1, 1], offset: transform?.getOffset() ?? [0, 0], rotation: transform?.getRotation() ?? 0 };
};

export async function captureMonumentSurface(primitive, fromCli) {
  const sharp = fromCli('sharp');
  const material = primitive.getMaterial();
  const maps = [];
  for (const [kind, texture, info] of [
    ['color', material.getBaseColorTexture(), material.getBaseColorTextureInfo()],
    ['normal', material.getNormalTexture(), material.getNormalTextureInfo()],
    ['metallicRoughness', material.getMetallicRoughnessTexture(), material.getMetallicRoughnessTextureInfo()],
  ]) {
    if (!texture) continue;
    const decoded = await sharp(texture.getImage()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    maps.push({ kind, texture, transform: textureTransform(info), sampler: { wrapS: info.getWrapS(), wrapT: info.getWrapT() },
      width: decoded.info.width, height: decoded.info.height, data: decoded.data });
  }
  return {
    positions: new Float32Array(primitive.getAttribute('POSITION').getArray()),
    normals: new Float32Array(primitive.getAttribute('NORMAL').getArray()),
    uv: new Float32Array(primitive.getAttribute('TEXCOORD_0').getArray()),
    indices: new Uint32Array(primitive.getIndices().getArray()),
    normalScale: material.getNormalScale(), maps,
  };
}

/** Fill mip/filter gutters without replacing any texel actually sampled from the surface. */
function padAtlas(images, mask, size) {
  for (let pass = 0; pass < 8; pass += 1) {
    const next = mask.slice();
    for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      if (mask[index]) continue;
      const neighbor = [x > 0 ? index - 1 : -1, x + 1 < size ? index + 1 : -1,
        y > 0 ? index - size : -1, y + 1 < size ? index + size : -1].find((candidate) => candidate >= 0 && mask[candidate]);
      if (neighbor === undefined) continue;
      for (const image of images) image.copy(image, index * 4, neighbor * 4, neighbor * 4 + 4);
      next[index] = 1;
    }
    mask = next;
  }
}

export async function bakeMonumentSurface(document, primitive, high, size) {
  const fromCli = createRequire(`${realpathSync('node_modules/@gltf-transform/cli')}/`);
  const web = createRequire(new URL('../apps/web/package.json', import.meta.url));
  const THREE = web('three');
  const { MeshBVH } = createRequire(web.resolve('@react-three/drei'))('three-mesh-bvh');
  const watlas = fromCli('watlas');
  const sharp = fromCli('sharp');
  await watlas.Initialize();
  const atlas = new watlas.Atlas();
  const position = primitive.getAttribute('POSITION');
  const normal = primitive.getAttribute('NORMAL');
  const oldIndices = primitive.getIndices();
  atlas.addMesh({ vertexCount: position.getCount(), vertexPositionData: new Float32Array(position.getArray()), vertexPositionStride: 12,
    vertexNormalData: new Float32Array(normal.getArray()), vertexNormalStride: 12,
    indexData: new Uint32Array(oldIndices.getArray()), indexCount: oldIndices.getCount() });
  try {
    atlas.generate({}, { resolution: size, padding: 4, bilinear: true, blockAlign: true });
    if (atlas.atlasCount !== 1) throw new Error('Monument requires more than one material atlas');
    const mesh = atlas.getMesh(0);
    for (const attribute of primitive.listAttributes()) {
      const values = new Float32Array(mesh.vertexCount * attribute.getElementSize());
      const element = [];
      for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
        attribute.getElement(mesh.getVertex(vertex).xref, element);
        values.set(element, vertex * attribute.getElementSize());
      }
      const copy = document.createAccessor().setType(attribute.getType()).setArray(values);
      primitive.swap(attribute, copy);
    }
    const uv = new Float32Array(mesh.vertexCount * 2);
    for (let vertex = 0; vertex < mesh.vertexCount; vertex += 1) {
      const mapped = mesh.getVertex(vertex).uv;
      uv[vertex * 2] = mapped[0] / atlas.width;
      uv[vertex * 2 + 1] = mapped[1] / atlas.height;
    }
    primitive.setAttribute('TEXCOORD_0', document.createAccessor().setType('VEC2').setArray(uv));
    const indices = new Uint32Array(mesh.indexCount);
    mesh.getIndexArray(indices);
    primitive.setIndices(document.createAccessor().setType('SCALAR').setArray(indices));

    const sourceGeometry = new THREE.BufferGeometry();
    sourceGeometry.setAttribute('position', new THREE.BufferAttribute(high.positions, 3));
    sourceGeometry.setIndex(new THREE.BufferAttribute(high.indices, 1));
    const bvh = new MeshBVH(sourceGeometry, { indirect: true });
    const images = high.maps.map(() => Buffer.alloc(size * size * 4));
    const mask = new Uint8Array(size * size);
    const lowPositions = primitive.getAttribute('POSITION').getArray();
    const lowNormals = primitive.getAttribute('NORMAL').getArray();
    const vector = () => new THREE.Vector3();
    const a = vector(), b = vector(), c = vector(), ha = vector(), hb = vector(), hc = vector();
    const point = vector(), bary = vector(), hn = vector(), ln = vector(), edge1 = vector(), edge2 = vector(), tangent = vector(), bitangent = vector();
    const hit = { point: vector() };
    const sample = new Float32Array(4), mappedNormal = new Float32Array(3), encodedNormal = new Float32Array(3);
    const highFrame = new Float32Array(9), lowFrame = new Float32Array(9);
    const frame = (pa, pb, pc, ta, tb, tc, n, output) => {
      edge1.subVectors(pb, pa); edge2.subVectors(pc, pa);
      const du1 = tb[0] - ta[0], dv1 = tb[1] - ta[1], du2 = tc[0] - ta[0], dv2 = tc[1] - ta[1];
      const determinant = du1 * dv2 - du2 * dv1;
      tangent.copy(edge1).multiplyScalar(dv2).addScaledVector(edge2, -dv1);
      if (determinant < 0) tangent.negate();
      tangent.addScaledVector(n, -tangent.dot(n)).normalize();
      if (tangent.lengthSq() === 0) {
        tangent.set(Math.abs(n.x) < 0.9 ? 1 : 0, Math.abs(n.x) < 0.9 ? 0 : 1, 0);
        tangent.addScaledVector(n, -tangent.dot(n)).normalize();
      }
      bitangent.crossVectors(n, tangent).multiplyScalar(determinant < 0 ? -1 : 1);
      output.set([tangent.x, tangent.y, tangent.z, bitangent.x, bitangent.y, bitangent.z, n.x, n.y, n.z]);
    };
    const interpolateNormal = (values, ia, ib, ic, wa, wb, wc, out) => out.set(
      values[ia * 3] * wa + values[ib * 3] * wb + values[ic * 3] * wc,
      values[ia * 3 + 1] * wa + values[ib * 3 + 1] * wb + values[ic * 3 + 1] * wc,
      values[ia * 3 + 2] * wa + values[ib * 3 + 2] * wb + values[ic * 3 + 2] * wc,
    ).normalize();
    console.log(`  baking ${high.maps.length} surface maps into ${size}px atlas`);
    for (let face = 0; face < indices.length; face += 3) {
      const ia = indices[face], ib = indices[face + 1], ic = indices[face + 2];
      a.fromArray(lowPositions, ia * 3); b.fromArray(lowPositions, ib * 3); c.fromArray(lowPositions, ic * 3);
      const ta = [uv[ia * 2], uv[ia * 2 + 1]], tb = [uv[ib * 2], uv[ib * 2 + 1]], tc = [uv[ic * 2], uv[ic * 2 + 1]];
      const den = (tb[1] - tc[1]) * (ta[0] - tc[0]) + (tc[0] - tb[0]) * (ta[1] - tc[1]);
      if (Math.abs(den) < 1e-15) continue;
      const minX = Math.max(0, Math.floor(Math.min(ta[0], tb[0], tc[0]) * size));
      const maxX = Math.min(size - 1, Math.ceil(Math.max(ta[0], tb[0], tc[0]) * size));
      const minY = Math.max(0, Math.floor(Math.min(ta[1], tb[1], tc[1]) * size));
      const maxY = Math.min(size - 1, Math.ceil(Math.max(ta[1], tb[1], tc[1]) * size));
      for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
        const u = (x + 0.5) / size, v = (y + 0.5) / size;
        const wa = ((tb[1] - tc[1]) * (u - tc[0]) + (tc[0] - tb[0]) * (v - tc[1])) / den;
        const wb = ((tc[1] - ta[1]) * (u - tc[0]) + (ta[0] - tc[0]) * (v - tc[1])) / den;
        const wc = 1 - wa - wb;
        if (Math.min(wa, wb, wc) < 0) continue;
        point.copy(a).multiplyScalar(wa).addScaledVector(b, wb).addScaledVector(c, wc);
        if (!bvh.closestPointToPoint(point, hit)) throw new Error('No high-resolution surface for atlas texel');
        const sa = high.indices[hit.faceIndex * 3], sb = high.indices[hit.faceIndex * 3 + 1], sc = high.indices[hit.faceIndex * 3 + 2];
        ha.fromArray(high.positions, sa * 3); hb.fromArray(high.positions, sb * 3); hc.fromArray(high.positions, sc * 3);
        if (!THREE.Triangle.getBarycoord(hit.point, ha, hb, hc, bary)) bary.set(1, 0, 0);
        const sourceU = high.uv[sa * 2] * bary.x + high.uv[sb * 2] * bary.y + high.uv[sc * 2] * bary.z;
        const sourceV = high.uv[sa * 2 + 1] * bary.x + high.uv[sb * 2 + 1] * bary.y + high.uv[sc * 2 + 1] * bary.z;
        const pixel = (y * size + x) * 4;
        for (let mapIndex = 0; mapIndex < high.maps.length; mapIndex += 1) {
          const map = high.maps[mapIndex];
          const [su, sv] = applyUvTransform(sourceU, sourceV, map.transform);
          sampleMap(map, su, sv, map.sampler, sample);
          if (map.kind === 'normal') {
            interpolateNormal(high.normals, sa, sb, sc, bary.x, bary.y, bary.z, hn);
            interpolateNormal(lowNormals, ia, ib, ic, wa, wb, wc, ln);
            frame(ha, hb, hc, [high.uv[sa * 2], high.uv[sa * 2 + 1]], [high.uv[sb * 2], high.uv[sb * 2 + 1]], [high.uv[sc * 2], high.uv[sc * 2 + 1]], hn, highFrame);
            frame(a, b, c, ta, tb, tc, ln, lowFrame);
            mappedNormal.set([(sample[0] / 127.5 - 1) * high.normalScale, (sample[1] / 127.5 - 1) * high.normalScale, sample[2] / 127.5 - 1]);
            reframeNormal(mappedNormal, highFrame, lowFrame, encodedNormal);
            for (let channel = 0; channel < 3; channel += 1) sample[channel] = (encodedNormal[channel] + 1) * 127.5;
          }
          for (let channel = 0; channel < 3; channel += 1) images[mapIndex][pixel + channel] = Math.round(sample[channel]);
          images[mapIndex][pixel + 3] = 255;
        }
        mask[y * size + x] = 1;
      }
      if (face % 3000 === 0) console.log(`    ${Math.round(face / indices.length * 100)}%`);
    }
    padAtlas(images, mask, size);
    for (let i = 0; i < high.maps.length; i += 1) {
      high.maps[i].texture.setImage(await sharp(images[i], { raw: { width: size, height: size, channels: 4 } }).removeAlpha().png().toBuffer()).setMimeType('image/png');
    }
    // All supplied material maps share a transform. Keep it by inverse-mapping
    // the new atlas coordinates, after baking has finished in [0,1] atlas space.
    const transform = high.maps[0].transform;
    if (high.maps.some((map) => JSON.stringify(map.transform) !== JSON.stringify(transform))) throw new Error('Monument maps use different UV transforms');
    const cos = Math.cos(transform.rotation), sin = Math.sin(transform.rotation);
    for (let vertex = 0; vertex < uv.length; vertex += 2) {
      const x = uv[vertex] - transform.offset[0], y = uv[vertex + 1] - transform.offset[1];
      uv[vertex] = (x * cos + y * sin) / transform.scale[0];
      uv[vertex + 1] = (-x * sin + y * cos) / transform.scale[1];
    }
    primitive.getMaterial().setNormalScale(1);
    sourceGeometry.dispose();
  } finally {
    atlas.delete();
  }
}
