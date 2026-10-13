import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';

interface GltfScene { readonly scene: Group }

/** Start both tiers together and reuse the single-URL cache used by preloads/previews. */
export function useGltfPair(fullUrl: string, lowUrl: string): readonly [GltfScene, GltfScene] {
  useGLTF.preload(fullUrl, false);
  if (lowUrl !== fullUrl) useGLTF.preload(lowUrl, false);
  const full = useGLTF(fullUrl, false);
  const low = useGLTF(lowUrl, false);
  return [full, low] as const;
}
