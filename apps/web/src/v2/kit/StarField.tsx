/**
 * A STILL SKY BEHIND A SECTION. Owner, 2026-09-24: the mock's research map and the world
 * at the top of its Base sit on the galaxy — scattered stars, a haze of nebula. Only
 * those two sections; never a whole scrolling page.
 *
 * STILL AND CHEAP ON PURPOSE. The live scene is right behind the page, but showing it
 * through a blur costs the GPU every frame of a scroll on a phone; this is two hundred
 * and twenty circles and four gradients, drawn once. It is the same sky every time
 * (a seeded stream, never `Math.random`), so the page never reshuffles on a rerender.
 *
 * ROUND ON ANY PANEL. No `viewBox`: the stars are placed in percentages and sized in
 * pixels, so a tall sheet stretches the sky, never the stars.
 */

/** Mulberry32: a small seeded stream, deterministic across renders and machines. */
function stream(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Star { x: number; y: number; r: number; o: number; tone: string; glow: boolean }

/**
 * Mostly faint pinpricks, a few brighter, a handful with a halo — how a deep field reads.
 *
 * A BACKDROP, NOT A SUBJECT (owner, 2026-09-24): the sky behind the world read too loud,
 * and on the research map its stars competed with the projects'. Radius at most 0.95 px
 * and brightness at most 0.6, so anything drawn on it stands in front of it.
 */
const STARS: readonly Star[] = (() => {
  const next = stream(0x5eed_2026);
  return Array.from({ length: 220 }, () => {
    const x = next() * 100;
    const y = next() * 100;
    const size = next();
    const hue = next();
    return {
      x,
      y,
      r: size > 0.97 ? 0.95 : size > 0.8 ? 0.65 : 0.4,
      o: 0.18 + next() * 0.42,
      // Blue-white through white to a rare warm one: temperature, not a rainbow.
      tone: hue > 0.9 ? 'var(--color-v2-sky-warm)' : hue > 0.6 ? 'var(--color-v2-sky-cool)' : 'var(--color-v2-ink)',
      glow: size > 0.97,
    };
  });
})();

/** The haze: a teal-blue drift high on the left, a violet one low on the right, as the mock has. */
/*
  Each variable is written out whole: Tailwind publishes a theme variable only when it
  finds its full name in the source, and a name built from parts reaches the browser empty.
*/
const haze = (variable: string, share: number): string =>
  `color-mix(in srgb, var(${variable}) ${String(share)}%, transparent)`;
const NEBULA = [
  `radial-gradient(60% 32% at 16% 20%, ${haze('--color-v2-sky-blue', 22)}, transparent 70%)`,
  `radial-gradient(50% 30% at 88% 66%, ${haze('--color-v2-sky-violet', 19)}, transparent 70%)`,
  `radial-gradient(40% 22% at 60% 38%, ${haze('--color-v2-self', 7)}, transparent 75%)`,
  `radial-gradient(90% 30% at 40% 52%, ${haze('--color-v2-sky-drift', 16)}, transparent 75%)`,
].join(', ');

export function StarField({ className = '' }: { className?: string }) {
  return (
    <div data-sky aria-hidden="true" className={`pointer-events-none overflow-hidden bg-v2-deep ${className}`} style={{ backgroundImage: NEBULA }}>
      <svg width="100%" height="100%" className="block">
        {/* A soft falloff, never a disc: a ring around a dot would read as a project star. */}
        <defs>
          <radialGradient id="v2-sky-glow">
            <stop offset="0%" style={{ stopColor: 'var(--color-v2-sky-cool)', stopOpacity: 0.3 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-v2-sky-cool)', stopOpacity: 0 }} />
          </radialGradient>
        </defs>
        {STARS.map((star, index) => (
          <g key={index}>
            {star.glow && <circle cx={`${String(star.x)}%`} cy={`${String(star.y)}%`} r={star.r * 4} fill="url(#v2-sky-glow)" />}
            <circle cx={`${String(star.x)}%`} cy={`${String(star.y)}%`} r={star.r} style={{ fill: star.tone }} opacity={star.o} />
          </g>
        ))}
      </svg>
    </div>
  );
}
