/**
 * THE MEDALS, AND THEY ARE DRAWN RATHER THAN COLOURED. Owner instruction:
 * *"şöyle kupalar, madalyalar vs kullanmalısın"*.
 *
 * A place used to be a number tinted gold. A tinted number is a number; a medal
 * is an object, and an object is the thing a player screenshots. So these are
 * real shapes — a struck coin with a laurel, and a cup — and they carry the
 * numeral instead of standing next to it.
 *
 * NO NEW BITMAPS, AND THAT IS DELIBERATE. Every one of these is inline SVG on the
 * theme's own tokens, so it is sharp at any size, on any background, in both
 * themes, and it costs one request that was already being made. The game's
 * painted art is for things that exist in the galaxy — a hull, a drill, a vault.
 * A medal is not in the galaxy; it is what the galaxy is played for.
 *
 * THREE METALS AND NOTHING ELSE. Gold, silver, bronze — the vocabulary every
 * person on earth already reads without being taught. Fourth place gets no
 * object, because a podium everybody stands on is not a podium.
 */

export type Place = 1 | 2 | 3;

interface Metal {
  /** Bright face, deep face: the two stops that make a disc look struck. */
  light: string;
  dark: string;
  rim: string;
  ink: string;
}

const METAL: Record<Place, Metal> = {
  1: { light: '#ffe9a8', dark: '#c08a1d', rim: '#ffd977', ink: '#4a3006' },
  2: { light: '#eaf6ff', dark: '#8fa6b8', rim: '#d6e8f7', ink: '#26333d' },
  3: { light: '#f4c9a0', dark: '#a25f2e', rim: '#e8ad78', ink: '#3d2210' },
};

export const isPlace = (rank: number): rank is Place =>
  rank === 1 || rank === 2 || rank === 3;

/**
 * A STRUCK COIN, carrying its own numeral.
 *
 * The gradient runs top-left to bottom-right so every medal on a page is lit from
 * the same direction as the plates behind them — one light source, which is the
 * rule the whole surface vocabulary is built on.
 */
export function Medal({
  place,
  size = 28,
  plain = false,
  className = '',
}: {
  place: Place;
  size?: number;
  /** Drop the numeral: for a row of metals that stands for "a podium", not a place. */
  plain?: boolean;
  className?: string;
}) {
  const metal = METAL[place];
  const id = `medal-${String(place)}${plain ? '-plain' : ''}`;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role="img"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-face`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={metal.light} />
          <stop offset="48%" stopColor={metal.rim} />
          <stop offset="100%" stopColor={metal.dark} />
        </linearGradient>
      </defs>
      {/*
        A COIN, NOT A ROSETTE.

        The first draft hung the disc from a ribbon, which is what a medal looks
        like on a chest and NOT what it looks like at fourteen pixels in a table
        row: the two tails read as notches bitten out of whatever sat behind them,
        and over a planet render they read as damage. A struck coin survives every
        size this is used at, which is the only test that matters here.
      */}
      <circle cx="16" cy="16" r="15" fill={`url(#${id}-face)`} />
      {/* Outer rim, then an inner bevel: the two edges that make metal read as metal. */}
      <circle cx="16" cy="16" r="15" fill="none" stroke={metal.dark} strokeWidth="1.4" opacity="0.8" />
      <circle cx="16" cy="16" r="11.4" fill="none" stroke={metal.ink} strokeWidth="0.9" opacity="0.32" />
      {/* A laurel arc along the foot, so first place reads as an award and not a token. */}
      <path
        d="M8.4 23.6a9.4 9.4 0 0 0 15.2 0"
        fill="none"
        stroke={metal.ink}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.28"
      />
      {plain ? null : (
        <text
          x="16"
          y="15.4"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="13"
          fontWeight="700"
          fill={metal.ink}
        >
          {place}
        </text>
      )}
    </svg>
  );
}

/**
 * A CUP, FOR THE ONE THING A CAREER IS COUNTED IN.
 *
 * Championships are the only figure on a career shelf that is worth an object of
 * its own — podiums and top tens are counts, a championship is a trophy. Drawn
 * once and tinted by how many there are, so an empty shelf still shows the shape
 * of what is missing.
 */
export function Trophy({
  won,
  size = 22,
  className = '',
}: {
  won: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 ${won ? 'text-opportunity' : 'text-line'} ${className}`}
      role="img"
      aria-hidden
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* The bowl, the two handles, the stem and the plinth. */}
      <path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" fill={won ? 'currentColor' : 'none'} opacity={won ? 0.22 : 1} />
      <path d="M7 3h10v5a5 5 0 0 1-10 0V3Z" />
      <path d="M7 5H4.5a2.5 2.5 0 0 0 2.5 2.5" />
      <path d="M17 5h2.5A2.5 2.5 0 0 1 17 7.5" />
      <path d="M12 13v4" />
      <path d="M8.5 21h7l-.8-4h-5.4l-.8 4Z" fill={won ? 'currentColor' : 'none'} opacity={won ? 0.22 : 1} />
      <path d="M8.5 21h7l-.8-4h-5.4l-.8 4Z" />
    </svg>
  );
}
