import { planetArt } from './assets.js';
import i18n from '../i18n/index.js';

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
export function PlanetSigil({
  seed,
  size = 128,
  shielded = false,
  /** Dims the world and drops its glow — used for a planet you cannot see into. */
  dark = false,
}: {
  seed: string;
  size?: number;
  shielded?: boolean;
  dark?: boolean;
}) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={i18n.t('surface.planetSigil')}
    >
      {/* Atmospheric bloom, outside the disc. The only real glow in the interface. */}
      {!dark && (
        <div
          className="absolute -inset-[12%] rounded-full"
          style={{
            background:
              'radial-gradient(circle at 42% 38%, rgba(126,180,230,0.20) 0%, rgba(126,180,230,0.06) 46%, transparent 68%)',
          }}
        />
      )}

      <img
        src={planetArt(seed)}
        alt=""
        aria-hidden
        loading="lazy"
        className="relative size-full object-contain"
        style={dark ? { filter: 'brightness(0.62) saturate(0.72)' } : undefined}
      />

      {shielded && (
        <>
          <div
            className="absolute inset-[-6%] rounded-full border border-crystal/35"
            style={{ boxShadow: '0 0 18px rgba(111,211,224,0.22) inset' }}
          />
          <div className="absolute inset-[-6%] rounded-full border border-dashed border-crystal/25 motion-safe:animate-[spin_48s_linear_infinite]" />
        </>
      )}
    </div>
  );
}
