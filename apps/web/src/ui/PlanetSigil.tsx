import { planetArt } from './assets.js';
import i18n from '../i18n/index.js';
import { planetSkinById } from '@astera/rules';
import { PLANET_SKIN_CATALOG } from './skinCatalog.js';

/**
 * A planet.
 *
 * This used to be a procedural SVG — two gradients, some turbulence and an honest
 * admission that it was temporary. It carried the ownership pillar and it looked
 * like a marble. There are sixteen photographic renders now, picked
 * deterministically from the planet id, so a world looks the same to its owner and
 * to everyone watching it.
 *
 * The atmosphere and shield are drawn AROUND the art rather than baked into it,
 * which is what lets the same sixteen renders serve every planet in the galaxy at
 * every state.
 */
/** Black and white, a little steeper than plain grey: the galaxy's unseen look, never faded. */
const UNSEEN_STYLE = { filter: 'grayscale(1) contrast(1.15)' } as const;

export function PlanetSigil({
  seed,
  size = 128,
  shielded = false,
  /**
   * A world outside live sight: black and white, bold, and without its glow — the same sign the
   * galaxy draws on it (`galaxy/unseenWorld.ts`).
   */
  unseen = false,
  skinId = null,
}: {
  seed: string;
  size?: number;
  shielded?: boolean;
  unseen?: boolean;
  skinId?: string | null;
}) {
  const skin = skinId ? planetSkinById(skinId) : null;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={i18n.t('surface.planetSigil')}
    >
      {/* Atmospheric bloom, outside the disc. The only real glow in the interface. */}
      {!unseen && (
        <div
          className="absolute -inset-[12%] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 42% 38%, rgba(126,180,230,0.20) 0%, rgba(126,180,230,0.06) 46%, transparent 68%)',
          }}
        />
      )}

      {skin ? (
        <span className="absolute inset-0 overflow-hidden rounded-full">
          <img src={PLANET_SKIN_CATALOG[skin.id].image} alt="" aria-hidden loading="lazy"
            className="size-full scale-[1.18] object-cover"
            style={unseen ? UNSEEN_STYLE : undefined} />
        </span>
      ) : (
        <img src={planetArt(seed)} alt="" aria-hidden loading="lazy" className="relative size-full object-contain"
          style={unseen ? UNSEEN_STYLE : undefined} />
      )}

      {shielded && (
        <>
          <div
            className="absolute inset-[-6%] rounded-full border border-crystal/35"
            style={{ boxShadow: '0 0 18px rgba(111,211,224,0.22) inset' }}
          />
          <div className="absolute inset-[-6%] rounded-full border border-dashed border-crystal/25 animate-[spin_48s_linear_infinite]" />
        </>
      )}
    </div>
  );
}
