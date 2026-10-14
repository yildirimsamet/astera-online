import { useState } from 'react';
import { cardScene, type AtmosphereArt } from './atmosphere.js';

/** A decorative image never owns content, layout height, or interaction. */
export function AtmosphereImage({ art, className = '' }: { art: AtmosphereArt; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === art.src) return null;
  return <img src={art.src} alt="" aria-hidden="true" draggable={false} data-atmosphere-image=""
    className={`pointer-events-none atmosphere-image ${className}`} style={{ objectPosition: art.position }}
    decoding="async" onError={() => { setFailed(art.src); }} />;
}

/** One complete scene, with the original object as a clean load-failure fallback. */
export function CardArtwork({ src, locked, unowned }: { src: string; locked: boolean; unowned: boolean }) {
  const scene = cardScene(src);
  const [failed, setFailed] = useState<string | null>(null);
  const complete = scene !== undefined && failed !== scene.src;
  return <img src={complete ? scene.src : src} alt="" aria-hidden="true" draggable={false}
    data-complete-scene={complete ? '' : undefined} data-scene-fit={complete ? scene.fit : undefined} data-art-state={locked ? 'locked' : unowned ? 'unowned' : 'owned'}
    className={`${complete ? 'building-scene-art' : 'size-[84px] object-contain'} ${locked ? 'opacity-20' : unowned ? 'opacity-65' : ''}`}
    loading="lazy" decoding="async"
    onError={complete ? () => { setFailed(scene.src); } : undefined} />;
}
