/**
 * Catalogue previews are opaque screenshots. Keep their planet and halo while
 * cutting away the dark rectangular card background when they become far LODs.
 */
export function maskOpaquePlanetBillboard(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <alphatest_fragment>',
    `
      float skinBillboardRadius = length(vMapUv - vec2(0.5));
      float skinBillboardCircle = 1.0 - smoothstep(0.44, 0.5, skinBillboardRadius);
      float skinBillboardCore = 1.0 - smoothstep(0.34, 0.43, skinBillboardRadius);
      float skinBillboardLight = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
      float skinBillboardEdge = smoothstep(0.025, 0.09, skinBillboardLight);
      diffuseColor.a *= skinBillboardCircle * max(skinBillboardCore, skinBillboardEdge);
      #include <alphatest_fragment>
    `,
  );
}

export const opaquePlanetBillboardProgramKey = (): string => 'opaque-planet-billboard-v1';
