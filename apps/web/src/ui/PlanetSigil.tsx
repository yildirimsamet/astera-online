import { useId } from 'react';

/**
 * The planet, as a portrait.
 *
 * TEMPORARY IMPLEMENTATION — procedural SVG. It is deterministic from the planet
 * id, costs nothing to load, and is good enough to build and play against, but a
 * rendered planet portrait would carry the ownership pillar far better. The asset
 * specification for the replacement is in `docs/visual-design.md`; this component
 * is the only thing that needs to change when it arrives.
 *
 * Two colour families only — cold ice and warm rust. A per-planet rainbow would
 * read as decoration; two families read as a galaxy with geology.
 */

const hash = (seed: string): number => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

export function PlanetSigil({
  seed,
  size = 128,
  shielded = false,
}: {
  seed: string;
  size?: number;
  shielded?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const h = hash(seed);
  const cold = h % 3 !== 0;
  const hue = cold ? 198 + (h % 42) : 18 + (h % 26);
  const sat = cold ? 34 + (h % 14) : 42 + (h % 12);

  const lit = `hsl(${String(hue)} ${String(sat)}% 56%)`;
  const mid = `hsl(${String(hue)} ${String(sat - 6)}% 24%)`;
  const dark = `hsl(${String(hue)} ${String(sat - 12)}% 6%)`;
  const rim = cold ? '#8fd6ea' : '#f0b070';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Your planet"
      className="block"
    >
      <defs>
        <radialGradient id={`body-${uid}`} cx="36%" cy="30%" r="72%">
          <stop offset="0%" stopColor={lit} />
          <stop offset="58%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
        {/* Two scales of noise: broad continental blotches, and a finer grain over
            the top. One octave of either on its own reads as a texture swatch. */}
        <filter id={`surface-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.019 0.045"
            numOctaves="5"
            seed={h % 1000}
            result="broad"
          />
          <feColorMatrix in="broad" type="saturate" values="0" result="grey" />
          {/* Pushes the midtones apart so the noise has edges instead of haze. */}
          <feComponentTransfer in="grey">
            <feFuncR type="gamma" exponent="2.2" amplitude="1.5" />
            <feFuncG type="gamma" exponent="2.2" amplitude="1.5" />
            <feFuncB type="gamma" exponent="2.2" amplitude="1.5" />
          </feComponentTransfer>
        </filter>
        <clipPath id={`disc-${uid}`}>
          <circle cx="50" cy="50" r="38" />
        </clipPath>
        {/* The lit limb: light wraps the edge facing the source, and only there. */}
        <radialGradient id={`limb-${uid}`} cx="30%" cy="26%" r="76%">
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor={rim} stopOpacity="0.34" />
        </radialGradient>
        <radialGradient id={`shadow-${uid}`} cx="26%" cy="24%" r="86%">
          <stop offset="34%" stopColor="#04060c" stopOpacity="0" />
          <stop offset="72%" stopColor="#04060c" stopOpacity="0.78" />
          <stop offset="100%" stopColor="#01030899" stopOpacity="0.97" />
        </radialGradient>
      </defs>

      {/* Atmosphere, outside the disc: the only glow in the whole interface. */}
      <circle cx="50" cy="50" r="41" fill={rim} opacity="0.05" />
      <circle cx="50" cy="50" r="38" fill={`url(#body-${uid})`} />

      <g clipPath={`url(#disc-${uid})`}>
        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          filter={`url(#surface-${uid})`}
          opacity="0.34"
          style={{ mixBlendMode: 'soft-light' }}
        />
        {/*
          A sphere is shaded by its angle to the light, not by a shape laid over
          it. The first version used an offset ellipse, which is why it read as a
          glass marble with a highlight rather than a lit world.
        */}
        <circle cx="50" cy="50" r="38" fill={`url(#shadow-${uid})`} />
        <circle cx="50" cy="50" r="38" fill={`url(#limb-${uid})`} />
      </g>

      <circle cx="50" cy="50" r="38" fill="none" stroke={rim} strokeOpacity="0.2" strokeWidth="0.5" />

      {shielded && (
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="#6fd3e0"
          strokeOpacity="0.4"
          strokeWidth="0.8"
          strokeDasharray="3 7"
          className="origin-center animate-[spin_36s_linear_infinite]"
        />
      )}
    </svg>
  );
}
