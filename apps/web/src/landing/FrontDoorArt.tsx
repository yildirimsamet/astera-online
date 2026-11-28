import { useRef } from 'react';
import { FRONT_DOOR_ART } from '../ui/assets.js';

const SHIPS = ['escortLeft', 'escortRight', 'flagship'] as const;

/**
 * The front door's picture (owner, 2026-11-28): painted key art, cut into a world and three ships so
 * the fleet can hold its own course over it. It replaced the live 3D scene.
 *
 * VFX brief: the fleet burns its drives toward the sunrise while the camera closes on it. The fire is
 * the painting's own exhaust (`frontdoor/*-fire-v1.webp`), flickering on each hull's nozzles.
 *
 * `onReady` fires once every layer has settled; a layer that failed to arrive counts as settled.
 */
export function FrontDoorArt({ onReady }: { onReady: () => void }) {
  const settled = useRef(new Set<string>());
  const layer = (src: string, className?: string) => {
    const settle = (): void => {
      settled.current.add(src);
      if (settled.current.size === Object.keys(FRONT_DOOR_ART).length) onReady();
    };
    return <img src={src} alt="" draggable={false} className={className} onLoad={settle} onError={settle} />;
  };
  return (
    <div className="gk-frontdoor__art" aria-hidden="true">
      <div className="gk-frontdoor__frame">
        <div className="gk-frontdoor__camera">
          {layer(FRONT_DOOR_ART.world, 'gk-frontdoor__world')}
          {SHIPS.map((ship) => (
            <div key={ship} className="gk-frontdoor__ship" data-ship={ship}>
              {layer(FRONT_DOOR_ART[ship])}
              {layer(FRONT_DOOR_ART[`${ship}Fire`], 'gk-frontdoor__fire')}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
