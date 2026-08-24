import type { ReactNode } from 'react';

/**
 * THE ICON SET.
 *
 * Drawn to the brief in `docs/visual-design.md` § "Icon set brief", which is worth
 * reading before touching any path in here: every shape encodes a rule, and a few of
 * them are deliberately NOT the obvious symbol.
 *
 *   · `intel` is an aperture, not an eye — an eye reads as surveillance OF you, and
 *     this is your own instrument.
 *   · `aegis` is an energy dome with a gap, not a medieval shield.
 *   · `veil` dissolves rather than blocks, because the Veil hides and never lies.
 *   · `orbital-ring`'s two nubs ARE the satellite slots.
 *   · `bastion` sits on a base plate because the plate is what says it can never leave.
 *
 * The law these obey, unchanged from the original direction: **icons carry shape, the
 * interface carries colour.** Hue means category and luminance means certainty
 * everywhere else in this UI, so a pre-coloured icon would fight that system. Every
 * glyph here is single-colour line art on `currentColor` with no fill, no gradient and
 * no glow, and is tinted at the point of use.
 *
 * Drawn on a 24 grid at stroke 1.5. Test at 20px on #04060C before changing one — if a
 * detail turns to mush at that size it is worse than a detail that was never drawn.
 */

export interface IconProps {
  /** Sizing and colour both arrive through here. Defaults to 20px, the list size. */
  className?: string;
  /** Supply only when the glyph is the sole label; otherwise it stays decorative. */
  title?: string;
}

/**
 * 1.75, not the 1.5 the brief first specified.
 *
 * The brief also says to test every icon at 20px on near-black and simplify anything
 * that turns to mush. At list size a 1.5 stroke on a 24 grid resolves to 1.25
 * device-independent pixels, which on a `#04060C` ground is a grey suggestion rather
 * than a line — the first render of this set proved it. `docs/visual-design.md` has
 * been updated to match rather than left to disagree with the code.
 */
const STROKE = 1.75;

function Glyph({
  children,
  className = 'size-5',
  title,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title === undefined ? { 'aria-hidden': true } : { role: 'img' })}
    >
      {title === undefined ? null : <title>{title}</title>}
      {children}
    </svg>
  );
}

/* ── 1 · Resources ──────────────────────────────────────────────
   The two most-used icons in the game. Alloy is common, heavy and builds
   everything — chunky bars, and explicitly NOT a coin. Crystal is scarce and
   sharp and gates the good things — one asymmetric shard, NOT a cut diamond. */

export function AlloyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/* Two bars with real air between them. The first draft had them sharing an
          edge and they fused into one pyramid. */}
      <path d="M2.8 19.4 5.2 14.4h13.6l2.4 5Z" />
      <path d="M7.4 13.2 9.4 8.4h5.2l2 4.8Z" />
    </Glyph>
  );
}

export function CrystalIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 2.6 17.6 10.4 13.4 21.4 7.4 17 6.4 9.1Z" />
      <path d="M12 2.6 10.8 12.2 13.4 21.4" />
      <path d="M10.8 12.2 17.6 10.4M10.8 12.2 6.4 9.1" />
    </Glyph>
  );
}

/* ── 2 · Navigation ─────────────────────────────────────────────
   The world is a thin DISC, not a spiral — the galaxy mark says so. */

export function PlanetIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.6" />
      {/*
        The terminator. `rx` is small on purpose: at rx=11 the arc bulged all the way
        to x≈3.6, landed exactly on the circle's own outline, and the crescent
        vanished. rx=5.2 puts the shadow edge ~3 units inside the rim, where it can
        actually be seen.
      */}
      <path d="M9.6 3.8a5.2 9.2 0 0 0 0 16.4" />
    </Glyph>
  );
}

export function GalaxyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/*
        Flatter and wider than the Ring's band, with the worlds scattered along it and
        deliberately NOTHING at the centre — the two marks sat side by side in the
        first render and read as the same object. This one is a disc of places; that
        one is one place wearing a band.
      */}
      <ellipse cx="12" cy="12" rx="10" ry="2.9" transform="rotate(-18 12 12)" />
      {/* Inside the band, not on it. The first set was computed to sit exactly ON the
          ellipse and merged into its own stroke — five invisible worlds. */}
      <circle cx="6.5" cy="14.5" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="11.8" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="12.1" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="17.9" cy="9.7" r="1.05" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

export function IntelIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.6" />
      {/* Six blades sweeping in to a hexagonal opening. The hexagon is implied by
          where the blades stop, not drawn — one line fewer, and it reads cleaner. */}
      <path d="M16.9 12 19.4 7.8M14.5 7.8 12 3.5M9.5 7.8H4.6" />
      <path d="M7.1 12 4.6 16.3M9.5 16.3 12 20.5M14.5 16.3h4.9" />
      <path d="M16.9 12 14.5 7.8H9.5L7.1 12l2.4 4.3h5Z" />
    </Glyph>
  );
}

/** Two live voices, without turning the galaxy's conversation into a notification bell. */
export function ChatIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 5.5h16v10.2H9l-5 3.2Z" />
      <path d="M8 9.2h8M8 12.2h5" />
    </Glyph>
  );
}

/* ── 3 · Buildings ──────────────────────────────────────────────
   Each shape encodes what the building DECIDES, not what it looks like. */

/** Nested hexagons under a bar: the Core is the level ceiling for everything else. */
export function CoreIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 5h15" />
      <path d="M12 8.4 18 11.7v6.6L12 21.6 6 18.3v-6.6Z" />
      <path d="M12 12.2 15 13.8v2.9L12 18.3 9 16.7v-2.9Z" strokeOpacity=".5" />
    </Glyph>
  );
}

/** Squat furnace, one chimney, a pour spout: turns nothing into alloy, forever. */
export function RefineryIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.6 19.6v-7.4h11.8v7.4" />
      <path d="M10.4 12.2V6.1h3.3v6.1" />
      <path d="M15.4 14.9h4.2l1.5 3" />
      <path d="M2.4 19.6h19.2" />
    </Glyph>
  );
}

/** A mine headframe over a shard: slow, deep, scarce. */
export function ExtractorIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/* The apex was a circle and the whole mark read as a pair of drawing
          compasses. A hoist house squares it off and makes it a headframe. */}
      <path d="M4.8 20.6 12 6.9l7.2 13.7" />
      <path d="M8 14.4h8" />
      <path d="M12 6.9v5.6" />
      <path d="M10 3.4h4v3.5h-4z" />
      <path d="M9.9 20.6 12 16.4l2.1 4.2Z" />
    </Glyph>
  );
}

/** Thick walls and a heavy door: stock a raid can never reach. Weight, not wealth. */
export function VaultIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.2" y="4" width="17.6" height="16" rx="1.8" />
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 5.6v2.1M12 16.3v2.1M4.9 12H7M17 12h2.1" />
      {/* Two hinges on the leading edge. Cheap, and the only mark saying THICK. */}
      <path d="M3.2 8.6h1.9M3.2 15.4h1.9" />
    </Glyph>
  );
}

/** An open gantry with a bare hull held inside it. */
export function ShipyardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 4.6v14.8M20 4.6v14.8" />
      <path d="M4 8.2h16M4 16.4h16" strokeOpacity=".45" />
      <path d="M12 8.6 15.4 12.5 12 16.4 8.6 12.5Z" />
    </Glyph>
  );
}

/** A band around a world, and the two nubs on it ARE the satellite slots. */
export function RingIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="4.1" />
      <ellipse cx="12" cy="12" rx="9" ry="3.3" transform="rotate(-20 12 12)" />
      <circle cx="20.5" cy="8.9" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="15.1" r="1.25" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/* ── 4 · Satellites ─────────────────────────────────────────────
   Five types and about four slots. What a player leaves out is who they are, so
   these five must separate instantly at 20px. */

/** A refractor on a two-leg mount. Watching is silent — the target is never told. */
export function TelescopeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 14.9 15.9 4.5l2.7 2.7L8.2 17.6Z" />
      <path d="M11 12.3 8.3 20.6M12.9 14.2l2.8 6.4" />
      <path d="M6.4 20.6h11" />
    </Glyph>
  );
}

/** A dish and the arcs it throws. Catches probes; at L3 it warns of fleets. */
export function RadarIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <ellipse cx="9.2" cy="10.8" rx="5.6" ry="3.1" transform="rotate(-38 9.2 10.8)" />
      <path d="M10.9 13.4 12.3 19.4" />
      <path d="M9.3 19.7h6.2" />
      <path d="M15 7.3a5 5 0 0 1 0 6.9" />
      <path d="M16.9 5.2a7.6 7.6 0 0 1 0 11.1" strokeOpacity=".55" />
    </Glyph>
  );
}

/** A dome over a horizon with one gap. An energy shield — not a medieval shield. */
export function AegisIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 17.4a7.5 7.5 0 0 1 4.3-6.8" />
      <path d="M15.2 10.6a7.5 7.5 0 0 1 4.3 6.8" />
      <path d="M3.4 17.4h17.2" />
    </Glyph>
  );
}

/** A circle whose right half dissolves. You become unreadable — it hides, never lies. */
export function VeilIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17" strokeDasharray="2.4 2.9" strokeOpacity=".75" />
    </Glyph>
  );
}

/** A helical bit descending toward an angular rock. */
export function DrillIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/* A wide cone with flutes that narrow toward the tip. The first two drafts —
          a thin shaft, then a shaft with a collar — read as a lollipop and then as a
          trophy. The taper is what makes it an auger. */}
      <path d="M12 2.4v3" />
      <path d="M8.2 5.4h7.6" />
      <path d="M8.2 5.4 12 17.2l3.8-11.8" />
      {/* Slanted, not horizontal. Horizontal bands read as the tiers of a trophy;
          only a slant reads as a thread wrapping round. */}
      <path d="M9.1 8.2 14.6 9.6M10 11.2 13.9 12.4M10.8 14 13.2 14.8" />
      <path d="M7.6 21.6 10 18.2l4.2.6 1.6 2.8Z" />
    </Glyph>
  );
}

/* ── 5 · Events ─────────────────────────────────────────────────
   There are exactly four notification types and there will never be a fifth. */

/** An arrow INTO a circle. The most urgent mark in the game. */
export function IncomingIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="15.4" cy="12" r="5.4" />
      <path d="M2.6 12h7.4" />
      <path d="M7.2 8.8 10.4 12l-3.2 3.2" />
    </Glyph>
  );
}

/** An arrow curving BACK to a circle. */
export function ReturnedIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="16.2" cy="13.4" r="4.8" />
      <path d="M3.4 15.6A8.4 8.4 0 0 1 11 4.6" />
      <path d="M3 11.5 3.4 15.9l4.4-.7" />
    </Glyph>
  );
}

/** A circle with a chunk broken out of its edge, and stock falling out of it. */
export function RaidedIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/*
        A world with a chunk bitten out of its rim and stock falling away from the
        hole. The arrow used to sit INSIDE the circle, which read as refresh or
        download — the loss has to leave the planet to say it was taken.
      */}
      <path d="M16.2 4.9a8.3 8.3 0 1 0 3.1 4.3" />
      <path d="M16.2 4.9 14.6 9.8l5-.6Z" />
      <circle cx="19.6" cy="15.4" r="1.05" fill="currentColor" stroke="none" />
      <circle cx="21.5" cy="19.4" r="0.85" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** A dot with one arc over it — a ping. Small, cold, unsettling. */
export function ScanIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="15.6" r="1.6" fill="currentColor" stroke="none" />
      <path d="M7.6 12.4a6.2 6.2 0 0 1 8.8 0" />
      <path d="M4.8 9.2a10.2 10.2 0 0 1 14.4 0" strokeOpacity=".5" />
    </Glyph>
  );
}

/* ── 6 · Status ─────────────────────────────────────────────────── */

/** Surface works knocked offline by ordinary raids; strategic damage is rendered elsewhere. */
export function DisruptedIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.8 19.4v-7.1l4.4 2.6v-2.6l4.4 2.6V7.9h7.6v11.5Z" />
      <path d="M4.6 4.4 19.6 19.9" />
    </Glyph>
  );
}

/** The aegis dome, closed rather than gapped. */
export function ShieldedIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4.5 17.4a7.5 7.5 0 0 1 15 0" />
      <path d="M3.4 17.4h17.2" />
    </Glyph>
  );
}

/* ── 7 · Interface furniture ────────────────────────────────────
   Not in the original brief. These are the marks the shell needs to stop being
   a text-only tab bar, and nothing here carries gameplay meaning. */

/** A real unmet prerequisite. Terminal owned states use `UnlockIcon`. */
export function LockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="1.6" />
      <path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 7.2 0v2.5" />
    </Glyph>
  );
}

/** The gate was opened and there is nothing left to buy. */
export function UnlockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4.8" y="10.4" width="14.4" height="9.8" rx="1.6" />
      <path d="M8.4 10.4V7.9a3.6 3.6 0 0 1 6.6-2" />
    </Glyph>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 5.5 15.5 12 9 18.5" />
    </Glyph>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 12h17" />
      <path d="M14.5 6 20.5 12l-6 6" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 6 18 18M18 6 6 18" />
    </Glyph>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.3 2" />
    </Glyph>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6.4 10.4a5.6 5.6 0 0 1 11.2 0c0 4.2 1.4 5.6 1.4 5.6H5s1.4-1.4 1.4-5.6Z" />
      <path d="M10.2 19a2 2 0 0 0 3.6 0" />
    </Glyph>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Glyph>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5.5 12h13" />
    </Glyph>
  );
}

/**
 * HOME IS A PLANET, NOT A HOUSE.
 *
 * This was a pitched roof — the universal "back to start" glyph, and wrong here.
 * The button does not return you to a menu, it flies the camera back to the one
 * world you own, and that world is the stake the whole game is played for. A house
 * says "front page". A ringed planet says "yours", which is the feeling the control
 * is actually for.
 *
 * Drawn as three arcs of one ellipse plus the sphere, so the ring passes IN FRONT
 * of the planet below the equator and vanishes BEHIND it above — the occlusion is
 * what makes it read as a body in space rather than a circle with a line through it.
 *
 * The four endpoints are not eyeballed: they are where the ellipse (rx 9.1, ry 1.9,
 * tilt 20°) actually meets the r=5.1 sphere, so the arcs terminate exactly on the
 * silhouette and the join disappears. The ring is deliberately narrow — three ratios
 * were rendered at 20px on #04060C per the brief, and the wider ones ran the near
 * arc within a pixel of the sphere's lower edge, where two strokes become one.
 */
export function HomeworldIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="5.1" />
      {/* right of the sphere, sweeping under */}
      <path d="M17.1 12.14A9.1 1.9 20 0 1 16 15.17" />
      {/* the near side, crossing in front */}
      <path d="M16 15.17A9.1 1.9 20 0 1 6.9 11.86" />
      {/* left of the sphere, sweeping over */}
      <path d="M6.9 11.86A9.1 1.9 20 0 1 8 8.83" />
    </Glyph>
  );
}

/* ── 8 · Verbs ──────────────────────────────────────────────────
   WHY THESE EXIST. Every action in this game used to be a slab with a word on
   it: RAISE, BUILD, INSTALL, COLLECT, all identical. A player scanning a list
   could not tell what kind of act each one was without reading, and reading is
   the thing an icon exists to save. Each verb now has a shape, and the shape says
   what the act DOES to the thing it acts on.

   They are deliberately not decorative variations of one another — an upgrade
   grows something that exists, a build adds a new unit, an install seats a part
   into a socket, a claim takes something away with you. Four different acts. */

/** RAISE — the thing you have, made taller. Stacked bars, growing. */
export function RaiseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 20V7" />
      <path d="m7.5 11.5 4.5-4.5 4.5 4.5" />
      <path d="M6 20h12" />
    </Glyph>
  );
}

/** BUILD — a new unit added to a row of them. A plus that is part of the set. */
export function BuildIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3.5" y="13" width="6" height="7" rx="1" />
      <rect x="11" y="13" width="6" height="7" rx="1" />
      <path d="M18.5 4v7" />
      <path d="M15 7.5h7" />
    </Glyph>
  );
}

/** INSTALL — a part seated into a socket. The socket is the Ring slot. */
export function InstallIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3v8" />
      <path d="m8.5 7.5 3.5 3.5 3.5-3.5" />
      <path d="M4.5 14.5h15v4a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5Z" />
    </Glyph>
  );
}

/** CLAIM — take it away with you. An arrow leaving a vessel. */
/**
 * MENU — three rules, and the middle one is short.
 *
 * A hamburger, and deliberately the plainest one in the set. Everything else here
 * encodes a rule about the game; this encodes nothing, because the moment a menu
 * control tries to be clever about what is behind it, it stops reading as the
 * place where the things you cannot find are kept. The unequal middle bar is the
 * only concession — three identical rules at 20px read as a texture.
 */
/**
 * A PROBE — AN EYE, AND THIS IS THE ONE PLACE AN EYE IS RIGHT.
 *
 * The set's own rule says `intel` is an aperture and NOT an eye, because an eye
 * reads as surveillance OF you and the Intel centre is your own instrument
 * pointed outward. That reasoning holds, and it is exactly why this glyph is the
 * opposite: a probe is surveillance of SOMEBODY ELSE'S world, it is the loud half
 * of the fog ("watching is silent; probing is loud"), and the target is told it
 * happened. The two icons disagreeing is the two acts disagreeing.
 *
 * The pupil is a ring rather than a filled dot — at 20px a solid pupil closes the
 * lid shape into a blob, and this glyph sits inside a button next to text where
 * it has less room than a list icon does.
 */
export function EyeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M2.6 12S6.4 5.8 12 5.8 21.4 12 21.4 12 17.6 18.2 12 18.2 2.6 12 2.6 12Z" />
      <circle cx="12" cy="12" r="2.9" />
    </Glyph>
  );
}

/**
 * SOUND, ON AND OFF — two glyphs rather than one that is tinted differently.
 *
 * A speaker that means "off" only by being dimmer is a control a player has to
 * reason about; a speaker with a cross through it is one they read. The set's law
 * is that icons carry SHAPE and the interface carries colour, and a mute switch is
 * the clearest case there is for obeying it.
 *
 * The cone is the same in both so the pair reads as one object in two states, and
 * the waves are drawn at two lengths so the "on" glyph still says something at
 * 18px when the second arc closes up.
 */
/**
 * OUT OF THE GAME AND INTO A NEW TAB.
 *
 * The one icon in this set that describes what a control DOES to the browser
 * rather than what it means in the galaxy — because leaving the game is exactly
 * what a player needs warning about before they press it. The arrow leaves the
 * box; the box has a gap where it leaves, which is what stops it reading as a
 * "send" glyph.
 */
export function ExternalIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M13.4 4.6H19.4V10.6" />
      <path d="m19.4 4.6-8.2 8.2" />
      <path d="M18 14.2v4.6a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V7.6A1.6 1.6 0 0 1 5.2 6h4.6" />
    </Glyph>
  );
}

export function SpeakerOnIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4Z" />
      <path d="M15.6 9.4a3.8 3.8 0 0 1 0 5.2" />
      <path d="M18.2 6.8a7.4 7.4 0 0 1 0 10.4" />
    </Glyph>
  );
}

export function SpeakerOffIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 9.4h3.2L12 5.4v13.2l-4.8-4H4Z" />
      <path d="m16 9.6 4.8 4.8M20.8 9.6 16 14.4" />
    </Glyph>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16M4 12h11M4 17h16" />
    </Glyph>
  );
}

/**
 * A REWARD WAITING TO BE TAKEN — an open hand, not a trophy or a gift box.
 *
 * A trophy says "you were the best", which is what the Dominion ladder is for and
 * is not what this panel does. A gift box says the game is giving something away.
 * Both are wrong: every one of these was earned by an act, and the honest picture
 * of "come and take it" is something held out.
 */
export function RewardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      {/* The palm, open and slightly cupped. */}
      <path d="M4.6 12.6a7.4 7.4 0 0 0 14.8 0" />
      <path d="M4.6 12.6h14.8" />
      {/* What is standing in it. Off-centre so it reads as an object rather than
          as a decorative diamond centred on the axis. */}
      <path d="M12 3.2 14.4 7 12 10.4 9.6 7Z" />
    </Glyph>
  );
}

/** The Dominion ladder: a podium, not a generic analytics chart. */
export function LeaderboardIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 20v-6h5v6M9 20V8h6v12M15 20v-9h5v9" />
      <path d="M11 4h2M12 3v3" />
    </Glyph>
  );
}

export function ClaimIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 4.5h12v11a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4Z" />
      <path d="M12 8.5v6" />
      <path d="m9 11.5 3 3 3-3" />
    </Glyph>
  );
}

/** SEND — commit something outward, irreversibly. */
export function SendIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 12h13" />
      <path d="m12 7 5 5-5 5" />
      <path d="M20 5v14" />
    </Glyph>
  );
}

/* ── 9 · Combat statistics ──────────────────────────────────────
   Four numbers decide every fleet decision in the game and they were printed as
   four identical grey figures under four identical grey labels. These give each
   one a shape AND a fixed colour role at the point of use — attack is the threat
   hue, hull is bone, speed is crystal, cargo is alloy — so a hull can be read as
   a silhouette of four bars rather than as a paragraph. */

/** ATTACK — a point, arriving. */
export function AttackIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m4 20 8.5-8.5" />
      <path d="M11 5.5 18.5 3 16 10.5Z" />
      <path d="m13.5 10.5 5 5" />
    </Glyph>
  );
}

/**
 * HULL — structure that absorbs. A plated shield, not a heart.
 *
 * Redrawn: the first path closed badly and rendered as a circle with a bar
 * through it, which at list size read as a "forbidden" sign sitting next to a
 * ship's hit points. Explicit line segments now, no implicit commands.
 */
export function HullIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 3.2 L19.2 6.4 L19.2 12 C19.2 16.4 16.2 19.6 12 20.8 C7.8 19.6 4.8 16.4 4.8 12 L4.8 6.4 Z" />
      <path d="M12 8.2 L15.2 10.1 L12 12 L8.8 10.1 Z" />
    </Glyph>
  );
}

/** SPEED — distance covered. Motion lines, not a clock. */
export function SpeedIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3 8h11" />
      <path d="M3 12h7" />
      <path d="M3 16h9" />
      <path d="m16 6 5 6-5 6" />
    </Glyph>
  );
}

/** CARGO — what comes home. A hold with a load in it. */
export function CargoIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M3.5 9.5 12 5l8.5 4.5v7L12 21l-8.5-4.5Z" />
      <path d="M12 12.5v8.5" />
      <path d="m3.5 9.5 8.5 3 8.5-3" />
    </Glyph>
  );
}
