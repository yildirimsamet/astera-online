import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { DYSON_MODEL } from '../ui/assets.js';
import { unitModel } from './model.js';
import { STANCE_LIGHT, type PlanetNode } from './scene.js';
import { resolvedOnly } from './Satellites.jsx';

/**
 * WHAT A SEASON OF DEVELOPMENT LOOKS LIKE FROM ORBIT.
 *
 * A world's Core is already in the picture as one of three sizes (`worldRadius`),
 * and that read is deliberately coarse — the exact level is what a probe is for.
 * The shells are the same public fact said louder, one stage per tier, from a
 * single ring up to a finished structure in black and silver. A world that has
 * been played reads as a world that has been played, from anywhere on the disc.
 *
 * IT READS THE EXACT CORE LEVEL, AND THAT IS A FOG DECISION RATHER THAN A DRAWING
 * ONE. `/api/galaxy` used to publish only a coarse tier, so that a world's precise
 * development stayed something a probe was sold for. The owner's ladder steps the
 * ring count every three levels and the colour every one, and a tier spans three
 * levels — so it cannot draw either. The level is published now; `publicGalaxy` on
 * the server states what that trades away and what a probe still sells alone.
 *
 * A STAGE IS NOT A MODEL. Owner idea, and the best structural one in the feature:
 * the ladder is ONE asset — a single ring — drawn one, two, three or four times at
 * equal angles. It downloads nothing extra, costs no extra draw call (each copy is
 * another instance in the same instanced mesh), and it makes the ladder read as
 * one construction project rather than four unrelated objects: they put up a ring,
 * then a cross-ring, and only after that does the structure start becoming a
 * shell. A stage is therefore a ring count plus a colour, and `SHELL_STAGE` is the
 * whole ladder in one table.
 *
 * FOUR SEPARATE MEGASTRUCTURES WERE BUILT FIRST, AND REJECTED. Each had its own
 * inner opening — 0.51 to 0.63 — so each needed its own size, and the ring, which
 * is mostly hole, came out largest on the smallest world: a tier-2 world was drawn
 * half again as big as a tier-5 one. The three world sizes are "the only reason a
 * glance at the galaxy tells you anything" and a shell that reverses them is worse
 * than no shell. One asset with one opening cannot make that mistake, which is the
 * quiet second reason this shape is right.
 *
 * DRAWN AS: two instanced meshes per STAGE that a galaxy actually contains — the
 * body and its silhouette rim — so the whole disc's construction costs at most
 * twenty-six draw calls however many worlds wear one, and usually far fewer. A
 * stage drawing four rings per world is simply four times the instances in the
 * same two meshes.
 */

/**
 * THE INNER OPENING OF THE RING, as a share of the radius `unitModel` gives it.
 *
 * MEASURED, NOT GUESSED — where the structure's inner face actually sits, over the
 * whole vertex buffer, divided by the bounding-sphere radius everything is
 * normalised to. That is the number `unitModel` cannot give you, and the reason it
 * is declared rather than derived: a bounding volume knows the OUTSIDE of a model
 * and nothing at all about the hole through the middle. Same rule as
 * `MODEL_FACING` — measured once, from the file, and written down.
 *
 * IT IS THE SURFACE, NOT THE NEAREST VERTEX, and getting that wrong is what put
 * the worlds in the middle of a pile of empty space for three passes. The ring's
 * vertices cluster at 0.51 but a few inward spar TIPS reach 0.36, and sizing on
 * the tips inflates the shell by 42% — which moves the part anyone can see, the
 * ring band at 0.67, out to 2.1 world radii. The eye reads the band, not the spar.
 *
 * AND A SPAR TIP INSIDE THE WORLD'S OWN RADIUS IS CORRECT, not a clipping bug. A
 * world is a camera-facing billboard, not a sphere — there is no volume for a spar
 * to pierce. The billboard writes depth, so the half of a spar behind it is masked
 * and the half in front draws over it, which is exactly how the ring bands already
 * cross the planet and exactly what a structure wrapped around a world does.
 *
 * `node tools/dyson.mjs --measure` prints the distribution; take `p01`. Re-run it
 * whenever the ring is re-exported or the pipeline's simplifier moves, because a
 * strut trimmed off the inside face changes this and nothing else would notice.
 */
const SHELL_OPENING = 0.513;

/**
 * AND ONE RULE OVER ALL THREE: the structure clears the world by a quarter of the
 * world's own radius.
 *
 * A ratio rather than a distance, for the reason the invariants table already
 * states about minutes: worlds are drawn at three sizes 3.2× apart, so one
 * clearance in world units would graze a heavyweight and leave a small world
 * rattling around inside its own ring.
 *
 * A QUARTER WAS TOO MUCH, and so was 1.15 — owner call, twice. The gap read as
 * the world rattling around inside its structure rather than being held by it.
 *
 * I CLAIMED A FLOOR HERE THAT DOES NOT EXIST. The argument was that a world's
 * atmosphere limb is drawn out to `LIMB_SCALE` = 1.1, so anything under that puts
 * the structure inside the glow. It does — and it does not matter, because of the
 * order the two are drawn in: the limb is `renderOrder = -1` with `depthWrite`
 * off, and the shell is depth-tested on top of it. The structure OCCLUDES the
 * glow, it does not mix into it, so a strut in front of the limb reads as a strut
 * in front of a lit atmosphere. There was never a merged silhouette to avoid.
 *
 * So the number is set by what it looks like, and 1.0 is where it lands: with the
 * opening measured at the structural surface, the ring band sits at about 1.25
 * world radii. Above about 1.4 the structure stops belonging to the world it is
 * around. Every stage is the same ring, so this is now one number governing one
 * shape rather than four that had to be balanced against each other.
 */
const CLEARANCE = 1.0;

/** How big the shell is drawn, in the same units `worldRadius` speaks. */
const shellRadius = (planetRadius: number): number =>
  (planetRadius * CLEARANCE) / SHELL_OPENING;

/**
 * IT TUMBLES ON TWO AXES, AT TWO PERIODS THAT DO NOT DIVIDE. Owner call.
 *
 * One axis is a turntable, and a turntable reads as a model being presented rather
 * than as a structure holding station. Two axes at 150 and 233 seconds never
 * return to the same attitude inside a session, so the face a player sees on their
 * second visit is genuinely one they have not seen.
 *
 * Slow, because this is a megastructure and not a craft. The read is "it is
 * turning", never "it is spinning": half a minute of watching should move it
 * visibly and no further. It rotates about the world's own centre, so the planet
 * stays inside it at every attitude by construction.
 *
 * This movement is unconditional. A full turn takes two and a half minutes,
 * which is under a degree and a half per second. A structure that never moves is
 * the thing the north star calls a modelling artefact rather than an object.
 */
const PERIOD_Y = 150;
const PERIOD_X = 233;

/**
 * THE LADDER, IN ONE TABLE — AND IT IS ONE ASSET, FOUR TIMES OVER.
 *
 * Owner decision, and it is the best structural idea in the feature. Every stage
 * is the SAME ring from `dyson_1.glb`, drawn one, two, three or four times at
 * equal angles about a shared axis. Nothing else is downloaded, nothing else is
 * decoded, and a stage costs no extra draw call — a second ring is another
 * instance in the same instanced mesh.
 *
 * WHY IT BEATS FOUR SEPARATE MODELS, which is what this was two passes ago. Four
 * unrelated megastructures read as four unrelated objects, and a player watching a
 * neighbour develop saw the thing in their orbit REPLACED. One ring becoming two
 * becoming three reads as the same project being extended, which is what a Core
 * going up actually is. It also means a re-export of one file re-skins the whole
 * ladder, and that `SHELL_OPENING` is a single measured number rather than four.
 *
 * EQUAL ANGLES ABOUT AN AXIS IN THE RING'S OWN PLANE. The ring lies in XY and is
 * thin through Z, so turning a copy about X stands it on edge. N rings want
 * 180°/N between them — a half turn brings a ring back onto itself, so a full turn
 * would draw the second half of the set on top of the first.
 */
const RING = DYSON_MODEL[0];

/** N copies of the ring, evenly spaced through a half turn about its own X. */
const spokes = (count: number): readonly THREE.Euler[] =>
  Array.from({ length: count }, (_, i) => new THREE.Euler((i * Math.PI) / count, 0, 0));

/**
 * THE COLOUR SCALE, blue through red. Owner call.
 *
 * It runs cool to hot, so a world climbing the ladder heats up — the ordering
 * carries the direction of travel on its own. These six are ANCHORS, not the six
 * colours drawn: a stage lands between two of them, so a disc of worlds shows a
 * continuous ramp rather than six buckets.
 *
 * THEY ARE DESATURATED ON PURPOSE — about a third of the way to a cool steel grey
 * from where they started. Owner call: at full chroma a disc of three hundred
 * worlds, each at its own rung, was "a colour circus". A hue here has to identify
 * a stage from across the map, which needs SEPARATION between the anchors and not
 * saturation; what saturation actually bought was every world shouting at once,
 * and the worlds are supposed to be the subject rather than their scaffolding.
 * Muting the anchors, the seam and the rim together keeps the ladder legible while
 * the structures read as tinted metal instead of coloured plastic.
 *
 * ONE CAUTION, WRITTEN DOWN RATHER THAN DESIGNED AROUND. The last two anchors are
 * amber and red, and both already mean something here: amber is a rival's pin
 * (`Highlights`) and `--color-threat` is `#e2412c`. These are metal structures two
 * world-radii across rather than eleven-pixel type, and nothing else on the disc is
 * shaped like them — but red means "attack" everywhere else in this game. Worth
 * re-checking on a crowded disc with real worlds.
 */
const SCALE = ['#5f9ae3', '#9977e3', '#54c68d', '#ccc167', '#dc915c', '#c65f5d'] as const;

/**
 * WHERE THE LADDER STARTS AND WHERE IT ENDS. Owner decision, revised.
 *
 * IT STARTS AT CORE 9, NOT 3 — "this should be on the more solid players". A ring
 * is meant to mark a commander who has actually built something, and starting at 3
 * put one on nearly every world in the disc within a day, which says nothing. The
 * shape then gains a ring every `BAND` levels and the colour eases the whole way
 * from the first anchor to the last across the reachable range:
 *
 *   9,10,11 → one ring
 *   12,13,14 → two rings
 *   15,16,17 → three rings
 *   18,19,20 → four rings
 *   21 → four rings, the last colour
 *   22+ → unreachable, and clamped there anyway
 *
 * IT ENDS AT CORE 21 BECAUSE THE ECONOMY ENDS THERE. Nothing caps the Command Core
 * in `build.ts` — only non-CORE buildings are held under it — but the invariant
 * `upgradeCost(L).alloy < storageCap(L, vault)` breaks between 21 and 22 (591,044
 * against a full store of 590,789), so 21 is as far as anyone can get. Anchoring
 * the last colour there means the top of the ladder is the top of the GAME.
 *
 * NO NEUTRAL WORLD WEARS ONE, and that falls out rather than being special-cased:
 * the three neutral tiers are seeded at Core 2, 5 and 8 (`ABUSE.neutral`), all
 * below the first rung. Scenery stays scenery and a ring always means a player.
 *
 * FOUR RINGS IS THE LAST SHAPE. Past it the structure stops growing and the colour
 * carries the rest alone, because a fifth ring at equal angles is 36° from its
 * neighbours — under the width of the ring band itself, so it would read as a
 * thicker shell rather than as another ring, and the openwork that tells the stages
 * apart would start closing.
 */
const FIRST_LEVEL = 9;
const LAST_LEVEL = 21;
const BAND = 3;
const MAX_RINGS = 4;
/** Steps between the first rung and the last — the span the colour eases over. */
const RUNGS = LAST_LEVEL - FIRST_LEVEL;

interface Stage {
  /** How many rings, at equal angles. */
  rings: number;
  colour: string;
}

/**
 * THE SEAMS, LIT — GENTLY, and this number was the whole lesson of the pass.
 *
 * The ring arrives with a seam running through every strut and NO emissive map, so
 * the seam is just a bright patch of base colour: under one key light it is a
 * slightly lighter grey and the structure reads as unpowered plastic. Handing the
 * base colour map to `emissiveMap` and tinting it with the stage colour is the fix
 * — emissive is MULTIPLIED by the map, so a panel only glows as much as it is
 * already bright and the seam is the only bright thing in the sheet. It is also
 * what makes one grey asset wear thirteen different colours.
 *
 * AT 0.85 IT IS FAR TOO MUCH. The panelling is mid-grey rather than dark, so a
 * strong emissive lifts the whole sheet along with the seam: an early version drew
 * neon wireframe toys and the worlds inside them disappeared. 0.18 was still too
 * much once every world on the disc wore one — see `SCALE` on the colour circus.
 *
 * Tone-mapped like everything else in the frame, deliberately. An unmapped
 * emissive would let a hundred worlds' worth of seams become the brightest thing
 * in the galaxy, and the fog would stop meaning anything.
 */
const SEAM = 0.10;

/**
 * A WORLD THAT HAS TAKEN A DEATH STAR WEARS A DEAD STRUCTURE. D121a, owner call.
 *
 * `recoveryUntil` is set in exactly one place — `applyDeathStarStrike` — so
 * `state.kind === 'RECOVERY'` means a rocket landed here and nothing else. The
 * strike lowers the Core (D113), so the ladder usually takes a ring or the whole
 * structure away on its own; this is for the case where the Core is still above
 * `FIRST_LEVEL` and the rings survive the thing that wrecked the world under them.
 *
 * TWO THINGS GO, AND THEY ARE THE TWO THINGS THAT SAY "POWERED".
 *
 *   · THE TUMBLE. A structure holding station is station-keeping; a structure that
 *     has stopped is adrift. The per-world `tilt` is kept, so wrecks do not all
 *     snap to the same attitude — each one is frozen where it happened to be, at
 *     an angle nothing else on the disc shares.
 *   · THE COLOUR. The stage hue reaches the eye through the seam emissive and the
 *     silhouette rim, and both are switched to unpowered. `SEAM` is what makes the
 *     panelling read as lit at all — the ring ships with no emissive map of its
 *     own, so at zero the seams fall back to being the brightest patch of an
 *     unlit sheet, which is exactly the "unpowered plastic" the seam docblock
 *     describes as the failure case. Here it is the point.
 *
 * THE RIM STAYS, GREY AND DIMMER, and that is deliberate rather than an oversight.
 * It is not decoration: it is the only thing separating a few thousand dark
 * triangles from the nebula behind them, and deleting it would make a wrecked
 * megastructure invisible rather than dead. Grey carries no stage information, so
 * the ladder still cannot be read off a wreck — which is correct, because a world
 * in recovery is not at the rung its ring count implies.
 */
const WRECK_RIM = '#8d949c';
/** Dimmer than a live rim, because a wreck should recede rather than announce itself. */
const WRECK_RIM_ALPHA = 0.14;

/**
 * The scale sampled at `t` in [0, 1], walking the anchors evenly.
 *
 * The span is clamped one short of the end so `t === 1` resolves to the LAST
 * anchor exactly rather than indexing past it. That is not a detail: the first cut
 * of this table left the final colour unreachable, which is a bug in the scale —
 * a declared colour nobody can ever see.
 */
function sample(t: number): string {
  const spans = SCALE.length - 1;
  const span = Math.min(Math.floor(t * spans), spans - 1);
  return blend(SCALE[span]!, SCALE[span + 1]!, t * spans - span);
}

/** Mixes two scale anchors in sRGB, which is where these hues were chosen. */
function blend(from: string, to: string, t: number): string {
  const a = new THREE.Color(from);
  const b = new THREE.Color(to);
  return `#${a.lerp(b, t).getHexString()}`;
}

/**
 * ONE RUNG PER CORE LEVEL, from `FIRST_LEVEL` to `LAST_LEVEL`.
 *
 * THE COLOUR RAMP AND THE RING BANDS ARE INDEPENDENT, which is what changed when
 * the ladder moved to Core 9. There are thirteen rungs and only four ring counts, so
 * the anchors cannot sit on the band boundaries the way they used to — the colour
 * eases continuously across the whole reachable range instead, reaching the last
 * anchor exactly at `LAST_LEVEL`. The shape says roughly how far along a commander
 * is; the colour says precisely.
 *
 * A stage rather than a formula because a stage is also a DRAW GROUP: the body's
 * emissive tint and the rim's colour are material uniforms, not per-instance
 * attributes, so worlds sharing a colour have to share a material. Thirteen rungs
 * is thirteen possible groups of two instanced meshes, and only the ones a galaxy
 * actually contains are ever built.
 */
const SHELL_STAGE: readonly Stage[] = Array.from({ length: RUNGS + 1 }, (_, step) => ({
  rings: Math.min(Math.floor(step / BAND) + 1, MAX_RINGS),
  colour: sample(step / RUNGS),
}));

/**
 * Has a rocket landed on this world and not yet finished doing its damage?
 *
 * `state` is optional on the payload, so a server that predates it reads as a
 * world in one piece — which is the safe way round: a live structure drawn on a
 * wreck is a cosmetic miss, and a dead one drawn on a healthy world would say a
 * commander had been hit when they had not.
 */
export const isWrecked = (node: PlanetNode): boolean => node.state.kind === 'RECOVERY';

/** The stage a world is at, or null while it has not built one. */
const stageIndexFor = (coreLevel: number): number | null => {
  if (coreLevel < FIRST_LEVEL) return null;
  return Math.min(Math.trunc(coreLevel) - FIRST_LEVEL, SHELL_STAGE.length - 1);
};

/**
 * WHAT A STAGE LOOKS LIKE, LIVE OR WRECKED — ONE DEFINITION, THREE USES.
 *
 * The body's emissive, the rim's shader and the frame loop's rotation all have to
 * agree about whether a structure has power, and they are three different places
 * in this file. Answering it once is what stops a future edit switching the colour
 * off and leaving the ring turning, or the other way round — which would read as a
 * bug rather than as a wreck.
 *
 * It is also the whole of what a test can meaningfully assert here: the rest of
 * this component is instanced-mesh plumbing that only a GPU can confirm.
 */
export interface ShellLook {
  /** Emissive multiplier on the seams. Zero is an unpowered structure. */
  seam: number;
  /** The silhouette rim's colour, and how strongly it traces the contour. */
  rim: string;
  rimAlpha: number;
  /** Station-keeping, or adrift. A world in recovery does not turn. */
  turning: boolean;
}

/**
 * TWO REASONS A STRUCTURE HAS NO POWER, AND THEY LOOK THE SAME. D121a and D127.
 *
 * A WRECK is a world that has been struck: its rings survive, stop and go cold.
 * A RECORD is a world you probed once and cannot currently see: the rings you are
 * looking at are the ones the probe found, and they may have been added to,
 * struck, or turned off since. Neither is a live reading, and the honest picture
 * for both is the same — still and colourless — because a moving, lit structure is
 * an assertion about RIGHT NOW that neither state can make.
 *
 * They are one parameter rather than two because nothing downstream distinguishes
 * them, and a second boolean nobody reads is a branch waiting to be got wrong.
 */
export const shellLook = (index: number, unpowered: boolean): ShellLook =>
  unpowered
    ? { seam: 0, rim: WRECK_RIM, rimAlpha: WRECK_RIM_ALPHA, turning: false }
    : { seam: SEAM, rim: SHELL_STAGE[index]!.colour, rimAlpha: RIM_ALPHA, turning: true };

/** The copies each stage draws, built once rather than per frame. */
const STAGE_COPIES: readonly (readonly THREE.Euler[])[] = SHELL_STAGE.map((stage) =>
  spokes(stage.rings),
);

/**
 * A SILHOUETTE RIM, for the reason `Satellites` already states about a body in
 * orbit: a few thousand dark triangles, unlit on the far side, against a nebula
 * that is itself bright, is a smudge you find by watching it move. The rim is what
 * makes it an object, and it is where each stage's colour actually lands.
 *
 * DEPTH-TESTED, unlike the satellites' rim, and that difference matters. Theirs
 * draws over everything because a satellite is small and never contains anything.
 * A shell wraps a world: with the test off, the expanded back faces of every strut
 * BEHIND the planet would glow straight through it. Tested, the planet's own
 * billboard — which writes depth (see `PlanetField`) — masks them, and the body
 * drawn after masks the rest, so light is left only on the true outer contour.
 *
 * The expansion is small and the alpha is low because this is an EDGE. A shell is
 * openwork: expand far enough and neighbouring struts' rims meet across the holes,
 * which fills in the very thing that tells the stages apart.
 */
const RIM_EXPANSION = 0.007;
/**
 * Muted along with the seam and the anchors. The rim is the brightest thing the
 * structure has — it is additive and it traces the whole silhouette — so it is
 * what a crowded disc notices first, and it was carrying most of the shouting.
 */
const RIM_ALPHA = 0.26;

/**
 * DRAWN WHILE IT IS BIG ENOUGH TO BE A STRUCTURE, AND NOT AFTER.
 *
 * An ANGULAR gate rather than one in world units: keep the shell while its radius
 * is at least this share of its distance from the camera. Every ringed world is
 * tier 3 or above, so shells are drawn at exactly two sizes — 1.60 and 2.73 world
 * units — and the bigger one survives further out, which is right because it is
 * the bigger object.
 *
 * 1/90 is a PIXEL rule underneath. At the galaxy's 45° field of view a shell spans
 * roughly `2038 · radius / distance` pixels on a tall phone, so this keeps one
 * while it is about twenty-two pixels across and drops it below that, where it is
 * a smudge rather than a structure.
 *
 * WHAT IT DOES NOT DO IS BOUND THE TRIANGLES. The disc is only fifty units in
 * radius, so nothing in a galaxy is ever far enough away for this to bite, and
 * `frustumCulled` is off for the reason every instanced mesh here has it off — one
 * mesh spans the whole disc. A late-season galaxy where sixty worlds have reached
 * Core 18 therefore submits sixty × four × 6,970 triangles every frame, on screen
 * or not. That is the heaviest thing in the scene by a wide margin and it wants a
 * per-instance frustum test before it matters; it cannot matter yet, because Core
 * 9 is days of play away and the simulator's peak over a whole season is 18.
 */
const MIN_ANGULAR_RADIUS = 1 / 90;

useGLTF.preload(RING, false);

interface Wearer {
  planet: PlanetNode;
  /** Fixed per world, so no two shells in the disc are ever in step. */
  tilt: THREE.Quaternion;
  phaseY: number;
  phaseX: number;
}

export interface ShellGroup {
  key: string;
  index: number;
  wrecked: boolean;
  planets: PlanetNode[];
}

/**
 * Bucketed by STAGE and not by model. Every stage is the same ring, so keying on
 * the file would collapse the whole ladder into one bucket and one colour.
 *
 * AND BY WHETHER THE WORLD IS WRECKED, which is a draw-group question rather than
 * a per-world one. A stage's colour reaches the eye through two MATERIAL uniforms
 * — the body's emissive tint and the rim's colour — and a material is shared by
 * every instance in its mesh. Per-instance colour cannot reach either
 * (`instanceColor` multiplies the DIFFUSE, which is why the fog's dimming can use
 * it and this cannot), so a wreck needs its own pair of materials or it would keep
 * glowing in its neighbours' hue.
 *
 * It costs at most one extra pair of instanced meshes per stage, and only for
 * stages that actually contain a struck world — which is rare by construction,
 * since it takes a Death Star to put one there.
 */
export function shellGroups(nodes: readonly PlanetNode[]): ShellGroup[] {
  const byStage = new Map<string, ShellGroup>();
  for (const node of nodes) {
    const index = stageIndexFor(node.coreLevel);
    if (index === null) continue;
    /**
     * A REMEMBERED WORLD'S RINGS ARE DRAWN LIKE A WRECK'S. D127. They are what a
     * probe found, not what is there — still and colourless, because the alternative
     * is the map animating a structure it cannot currently see.
     */
    const wrecked = isWrecked(node) || node.intel === 'REMEMBERED';
    const key = `${String(index)}:${wrecked ? 'wreck' : 'live'}`;
    const bucket = byStage.get(key);
    if (bucket) bucket.planets.push(node);
    else byStage.set(key, { key, index, wrecked, planets: [node] });
  }
  return [...byStage.values()];
}

export function DysonShells({ nodes }: { nodes: readonly PlanetNode[] }) {
  /**
   * ONLY ON WORLDS YOU CAN RESOLVE. D126.
   *
   * The rings are the most legible reading in the game — count and colour give the
   * exact Command Core level (D119). Handing that out for a world outside your
   * sensor reach, while its body is faded for being unreadable, would be the
   * interface contradicting itself in one frame.
   */
  const groups = useMemo(() => shellGroups(resolvedOnly(nodes)), [nodes]);

  return (
    <>
      {groups.map((group) => (
        <Shell
          key={group.key}
          index={group.index}
          wrecked={group.wrecked}
          planets={group.planets}
        />
      ))}
    </>
  );
}

/** The same hash the satellites use, so a world's hardware and its shell agree. */
function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i++) value = (Math.imul(value, 31) + text.charCodeAt(i)) | 0;
  return Math.abs(value);
}

function Shell({
  index,
  wrecked,
  planets,
}: {
  index: number;
  /** Every world in this group has taken a Death Star and is still in recovery. */
  wrecked: boolean;
  planets: readonly PlanetNode[];
}) {
  const look = shellLook(index, wrecked);
  const copies = STAGE_COPIES[index]!;
  const body = useRef<THREE.InstancedMesh>(null);
  const rim = useRef<THREE.InstancedMesh>(null);
  const camera = useThree((state) => state.camera);
  const { scene } = useGLTF(RING, false);

  // Quantised exactly like the satellites and the rocks, so the raw geometry would
  // be sized by an arbitrary integer range rather than by the number below.
  const source = useMemo(() => unitModel(scene), [scene]);

  const bodyMaterial = useMemo(() => {
    if (!source) return null;
    const clone = source.material.clone();
    /**
     * OPAQUE, AND IT WRITES DEPTH. That is what puts the near half of the shell in
     * front of the world and hides the far half behind it — the planet body is an
     * alpha-tested billboard that writes depth too, so the two interleave by depth
     * and the structure reads as being AROUND the world rather than painted over
     * it. Anything translucent here would draw the back struts through the planet.
     */
    clone.transparent = false;
    clone.depthWrite = true;
    /**
     * Openwork seen from both sides. These are strut cages, not closed hulls: at
     * any angle the camera looks through the near face at the inside of the far
     * one, and back-face culling turns that into holes in the structure.
     */
    clone.side = THREE.DoubleSide;
    // Light the seams off the base colour, as above. Guarded because `unitModel`
    // hands back whatever material the file carried, and only a standard-family
    // material has these.
    if (clone instanceof THREE.MeshStandardMaterial) {
      clone.emissiveMap = clone.map;
      /*
        A WRECK'S SEAMS ARE UNLIT — `shellLook` returns a seam of zero. That is the
        appearance the SEAM docblock above describes as the failure it fixed, an
        unpowered sheet of plastic, and it is exactly the picture a struck world
        wants. The tint is still assigned and simply not multiplied by anything, so
        the material has the same shape on both branches.
      */
      clone.emissive = new THREE.Color(look.rim);
      clone.emissiveIntensity = look.seam;
    }
    return clone;
  }, [source, look.rim, look.seam]);

  const rimMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColour: { value: new THREE.Color(look.rim) } },
        transparent: true,
        depthWrite: false,
        // Tested, unlike the satellites' — see the RIM docblock for why.
        depthTest: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          void main() {
            vec4 expanded = vec4(position + normal * ${String(RIM_EXPANSION)}, 1.0);
            #ifdef USE_INSTANCING
              expanded = instanceMatrix * expanded;
            #endif
            gl_Position = projectionMatrix * modelViewMatrix * expanded;
          }
        `,
        fragmentShader: `
          uniform vec3 uColour;
          void main() { gl_FragColor = vec4(uColour, ${String(look.rimAlpha)}); }
        `,
        toneMapped: false,
      }),
    [look.rim, look.rimAlpha],
  );

  useEffect(
    () => () => {
      rimMaterial.dispose();
      bodyMaterial?.dispose();
    },
    [bodyMaterial, rimMaterial],
  );

  const wearers = useMemo<Wearer[]>(
    () =>
      planets.map((planet) => {
        const h = hash(planet.id);
        const tilt = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            ((h % 90) / 90 - 0.5) * 1.1,
            (((h >> 4) % 360) / 360) * Math.PI * 2,
            (((h >> 9) % 60) / 60 - 0.5) * 0.9,
          ),
        );
        return {
          planet,
          tilt,
          phaseY: (((h >> 13) % 1000) / 1000) * Math.PI * 2,
          phaseX: (((h >> 21) % 1000) / 1000) * Math.PI * 2,
        };
      }),
    [planets],
  );

  /**
   * Ignorance is dark here as well.
   *
   * The bodies and the limbs are both dimmed per instance by `STANCE_LIGHT`, so a
   * world the player cannot see is literally darker. A shell at full brightness
   * would undo that on the largest object attached to the world — and it is the
   * one that catches the key light, so it would be the brightest thing in the fog.
   *
   * Via `setColorAt`, because three decides whether to compile the instance-colour
   * path when the material is built; an attribute attached afterwards is ignored.
   */
  const tint = useMemo(() => new THREE.Color(), []);

  /**
   * ALLOCATION ONLY. The values are written in the frame loop, and they have to be.
   *
   * This effect used to fill the whole buffer in wearer order, and that was a bug:
   * the frame loop writes matrices only for the worlds that pass the angular gate
   * and COMPACTS them into the low slots, so the moment one world was gated out
   * every world after it drew with its neighbour's colour — which is the fog's own
   * dimming, so an unwatched world could light up at full brightness. `PlanetField`
   * never hit this because it writes every instance every frame in a fixed order,
   * and `Satellites` compacts but colours by material rather than per instance.
   * Compacting AND colouring per instance is what makes the two go out of step, so
   * the colour is written beside the matrix it belongs to and nowhere else.
   *
   * The one write here exists because three decides whether to compile the
   * instance-colour path when the material is built; an attribute attached
   * afterwards is silently ignored, which is a whole galaxy at full brightness.
   */
  useLayoutEffect(() => {
    const node = body.current;
    if (!node) return;
    node.setColorAt(0, tint.setRGB(1, 1, 1));
    if (node.instanceColor) node.instanceColor.needsUpdate = true;
    if (!Array.isArray(node.material)) node.material.needsUpdate = true;
  }, [tint]);

  useFrame(({ clock }) => {
    const shell = body.current;
    const edge = rim.current;
    if (!shell || !edge) return;
    const t = clock.elapsedTime;
    const spinY = (t / PERIOD_Y) * Math.PI * 2;
    const spinX = (t / PERIOD_X) * Math.PI * 2;
    let drawn = 0;

    wearers.forEach((wearer) => {
      const [px, py, pz] = wearer.planet.position;
      const light = STANCE_LIGHT[wearer.planet.stance];
      const radius = shellRadius(wearer.planet.radius);
      const distance = Math.hypot(
        camera.position.x - px,
        camera.position.y - py,
        camera.position.z - pz,
      );
      if (radius < distance * MIN_ANGULAR_RADIUS) return;

      /**
       * Tilt first, then the world's own two spins, so the tumble happens about the
       * MODEL's axes rather than about the disc's — turned the other way round the
       * two rotations fight and the shell wobbles instead of turning.
       *
       * A WRECK KEEPS THE TILT AND LOSES THE SPINS. The tilt is hashed from the
       * world's id and never changes, so every struck structure is frozen at its
       * own angle rather than all of them snapping to a shared one — which is what
       * makes a stopped ring read as adrift instead of as a rendering fault. It
       * starts turning again by itself when recovery ends, because `state` comes
       * off the galaxy payload and nothing here caches it.
       */
      if (!look.turning) {
        ATTITUDE.copy(wearer.tilt);
      } else {
        SPIN_Y.setFromAxisAngle(AXIS_Y, spinY + wearer.phaseY);
        SPIN_X.setFromAxisAngle(AXIS_X, spinX + wearer.phaseX);
        ATTITUDE.copy(wearer.tilt).multiply(SPIN_Y).multiply(SPIN_X);
      }

      // The stage's fixed copies go INSIDE the tumble, so a set of crossed rings
      // turns as one rigid structure rather than as N rings drifting past each
      // other. That is the whole difference between a second ring and a moiré.
      for (const copy of copies) {
        COPY.setFromEuler(copy);
        DUMMY.quaternion.copy(ATTITUDE).multiply(COPY);
        DUMMY.position.set(px, py, pz);
        DUMMY.scale.setScalar(radius);
        DUMMY.updateMatrix();
        shell.setMatrixAt(drawn, DUMMY.matrix);
        edge.setMatrixAt(drawn, DUMMY.matrix);
        // Beside the matrix, never in a separate pass — see the effect above.
        shell.setColorAt(drawn, tint.setRGB(light, light, light));
        drawn += 1;
      }
    });

    shell.count = drawn;
    edge.count = drawn;
    if (shell.instanceColor) shell.instanceColor.needsUpdate = true;
    shell.instanceMatrix.needsUpdate = true;
    edge.instanceMatrix.needsUpdate = true;
  });

  if (!source || !bodyMaterial || wearers.length === 0) return null;

  const instances = wearers.length * copies.length;

  return (
    <>
      {/*
        The rim goes FIRST so the body, drawn after and writing depth, paints over
        every expanded face that is not on the outer contour. Same ordering the
        satellites use, and the reason both meshes are needed rather than one.

        One instanced mesh spans the whole disc, so a bounding sphere around the
        unit geometry at the origin would cull every shell in the galaxy the moment
        the camera looked away from the centre — same reason as the worlds.
      */}
      <instancedMesh
        ref={rim}
        args={[source.geometry, rimMaterial, instances]}
        frustumCulled={false}
        renderOrder={1}
        name="dyson-shell-rim"
        raycast={() => null}
      />
      <instancedMesh
        ref={body}
        args={[source.geometry, bodyMaterial, instances]}
        frustumCulled={false}
        renderOrder={2}
        name="dyson-shells"
        raycast={() => null}
      />
    </>
  );
}

const DUMMY = new THREE.Object3D();
const SPIN_Y = new THREE.Quaternion();
const SPIN_X = new THREE.Quaternion();
/** The world's own attitude, before a stage's fixed copies are applied inside it. */
const ATTITUDE = new THREE.Quaternion();
const COPY = new THREE.Quaternion();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
