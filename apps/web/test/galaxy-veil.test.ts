import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { VEIL_TONE, setVeilTime, veilMaterial, veiledFlight } from '../src/galaxy/veil.js';

/*
  G17 (owner 2026-11-25): an Optik Örtü flight is drawn cloaked to those who still see it — its owner and the
  owner's clan — in the Yarık's invisibility language, in Asteryum's lavender.
*/
describe('the veil on the galaxy', () => {
  it('cloaks only a leg the server marked veiled', () => {
    expect(veiledFlight({ veiled: true })).toBe(true);
    expect(veiledFlight({})).toBe(false);
  });

  // Owner 2026-11-25: capsules are not all purple. The veil wears Optik Örtü's own pearl, the Yarık cloak's family.
  it('draws the hull as a pearl rim in the Optik Örtü tone, through the instanced batches, never writing depth', () => {
    const material = veilMaterial();
    expect(material).toBeInstanceOf(THREE.ShaderMaterial);
    expect(material.vertexShader).toContain('instanceMatrix');
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(THREE.AdditiveBlending);
    expect(VEIL_TONE).toBe('#bfe6f7');
    expect(material.uniforms.tone?.value).toEqual(new THREE.Color('#bfe6f7'));
  });

  it('ripples with the clock, and leaves any other material alone', () => {
    const material = veilMaterial();
    setVeilTime(material, 3);
    expect(material.uniforms.time?.value).toBe(3);
    const plain = new THREE.MeshBasicMaterial();
    expect(() => { setVeilTime([plain], 3); }).not.toThrow();
  });
});
