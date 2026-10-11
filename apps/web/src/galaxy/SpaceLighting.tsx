import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/** Small prefiltered sky light for metal. Baked once, no shadows or per-frame lighting pass. */
export function SpaceLighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  useLayoutEffect(() => {
    const faces = Array.from({ length: 6 }, (_, face) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return canvas;
      ctx.fillStyle = '#273447';
      ctx.fillRect(0, 0, 64, 64);
      const key = ctx.createRadialGradient(24, 18, 1, 24, 18, 44);
      key.addColorStop(0, face === 2 ? '#e0e8f1' : face === 0 ? '#adc7df' : '#53647b');
      key.addColorStop(1, '#192332');
      ctx.fillStyle = key;
      ctx.fillRect(0, 0, 64, 64);
      if (face === 5) {
        const warm = ctx.createRadialGradient(46, 36, 0, 46, 36, 32);
        warm.addColorStop(0, '#a88a63');
        warm.addColorStop(1, 'rgba(25,35,50,0)');
        ctx.fillStyle = warm;
        ctx.fillRect(0, 0, 64, 64);
      }
      return canvas;
    });
    const cube = new THREE.CubeTexture(faces);
    cube.colorSpace = THREE.SRGBColorSpace;
    cube.needsUpdate = true;
    const generator = new THREE.PMREMGenerator(gl);
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    let target: THREE.WebGLRenderTarget | null = null;
    const bake = () => {
      target?.dispose();
      target = generator.fromCubemap(cube);
      scene.environment = target.texture;
      scene.environmentIntensity = 0.42;
      invalidate();
    };
    bake();
    gl.domElement.addEventListener('webglcontextrestored', bake);
    return () => {
      gl.domElement.removeEventListener('webglcontextrestored', bake);
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      target?.dispose();
      generator.dispose();
      cube.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}
