import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useFrame, useStore, useThree } from '@react-three/fiber';
import { Html, OrbitControls, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type {
  AsteroidView,
  Contact,
  GalaxyPlanet,
  MiningRun,
  PendingThread,
  StrategicInterception,
  StrategicInterceptionImpact,
} from '../api/schemas.js';
import type { Focus } from './FocusPanel.js';
import {
  easedCameraRange,
  focusIdentity,
  initialHomeCameraPosition,
  rigAction,
  rigGestureState,
  sphericalLeashCorrection,
} from './follow.js';
import {
  BrightStars,
  Core,
  Disc,
  Dust,
  Meteors,
  Nebula,
  Starfield,
} from './Environment.jsx';
import { useAmbientFrames, useCommittedDemandFrame } from './frames.jsx';
import { Wrecks, type WreckView } from './Wrecks.js';
import { Asteroids, InterceptMarks } from './Asteroids.jsx';
import { OwnFleets, Traffic } from './Fleets.jsx';
import { threadKey } from './threadKey.js';
import { DeathStarImpacts } from './DeathStarImpact.jsx';
import {
  StrategicInterceptions,
  strategicInterceptionMissilePosition,
} from './StrategicInterception.jsx';
import { PlanetField } from './PlanetField.jsx';
import { DysonShells } from './DysonShells.jsx';
import { Satellites, Shields } from './Satellites.jsx';
import { MiningFlights } from './MiningFlights.jsx';
import { OwnershipFilaments } from './OwnershipFilaments.jsx';
import { SensorRings, type ReachRing } from './SensorRings.jsx';
import {
  DISC_RADIUS,
  activeWorldPosition,
  asteroidWorldPosition,
  contactPosition,
  isRivalNode,
  legStandoff,
  planetNodes,
  runHomePosition,
  runPosition,
  threadPosition,
  toWorld,
  type PlanetNode,
} from './scene.js';
import { installTapGuard, wasMiss, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';
import { staleness } from '../lib/time.js';
import { commanderLabel } from '../lib/identity.js';
import { RankBadge } from './RankBadge.jsx';
import { useTranslation } from 'react-i18next';

/**
 * THE GAME SURFACE.
 *
 * Not a screen the player visits — the thing every other screen is drawn on top
 * of. `decisions.md` D1 puts it plainly: the information game "makes the 3D galaxy
 * an interface rather than a target list".
 *
 * PERFORMANCE SHAPE, which is what keeps this from being a slideshow on a phone:
 *
 *   · The galaxy is instanced — one draw call per distinct planet render rather
 *     than four meshes per planet.
 *   · Rendering is ON DEMAND. A loop running sixty times a second is the biggest
 *     battery drain a page can have, and this scene is usually still. The camera
 *     invalidates itself while it moves; a slow ticker invalidates for the
 *     asteroids and the dust. When nothing is happening, nothing renders.
 *   · Display resolution stays fixed while the player moves the camera. Thin
 *     trails and small hulls cannot visibly blur during the most tactile gesture.
 *     Performance is bought by batching and effect density, not temporary blur.
 */

/**
 * The whole sphere, minus the two poles.
 *
 * You may fly under the galaxy and look up at it. The earlier clamp stopped at
 * 0.46π — just above the disc's own plane — which meant half of every orbit was a
 * wall: you could tilt to look down and then the camera simply refused. Space has
 * no floor and a galaxy has an underside.
 *
 * The poles themselves stay excluded by a hair. Exactly overhead, azimuth becomes
 * undefined and the view snaps a quarter turn for no reason the player can see.
 */
const MIN_POLAR = Math.PI * 0.04;
const MAX_POLAR = Math.PI * 0.96;

/** How far past the rim you may drift before the camera is quietly walked back. */
const LEASH = DISC_RADIUS * 1.15;

/** Seconds spent easing onto a new subject. Long enough to follow, short enough not to wait. */
const EASE = 0.5;

/**
 * How close the camera comes whenever it flies home. D56.
 *
 * MUCH CLOSER THAN THE ORDINARY FRAMING, on the owner's instruction, and the
 * reason is what the flight is FOR. A returning commander may open wider because
 * they want their neighbourhood. Pressing Home is different: it explicitly asks
 * to see the active world. Moving only the pivot while preserving a disc-wide
 * camera range technically centred the coordinate and visibly showed empty space.
 *
 * Well clear of `minDistance`, so the rig lands rather than being caught by a
 * clamp — and the player can pull straight back out, because the approach is
 * one-way (see `rangeTo`) and never pushes anybody off a view they went and got.
 */
const HOME_DISTANCE = 7;

/**
 * World units from the camera to a focused craft or rock.
 *
 * Close enough that a 0.3-unit hull fills a readable part of the frame, far enough
 * that a squadron's whole formation and the world it is heading for both stay in
 * shot. Planets are exempt: they are already the size the map is drawn at.
 */
const CRAFT_DISTANCE = 7;

/** Distance and angle of the opening whole-disc composition. */
const WIDE_TILT = Math.hypot(1.15, 1.75);
const WHOLE_DISC_DISTANCE = DISC_RADIUS * WIDE_TILT;

export interface GalaxyCanvasProps {
  planets: readonly GalaxyPlanet[];
  /** Your own missions. Inbound attacks carry no path and are not drawn as one. */
  pending: readonly PendingThread[];
  /** Everyone else's sensed craft plus effect-only public engagements. */
  contacts: readonly Contact[];
  /** Anti-strategic launches the caller participates in or identifies by Telescope. */
  interceptions?: readonly StrategicInterception[];
  /** Public collision fire; carries no craft or route. */
  interceptionImpacts?: readonly StrategicInterceptionImpact[];
  /** Rocks crossing the disc right now, and your craft working them. D19. */
  asteroids: readonly AsteroidView[];
  runs: readonly MiningRun[];
  /** Wreck fields left by battles, visible to the whole galaxy. D32. */
  wrecks: readonly WreckView[];
  /**
   * The caller's own sensor boundaries, one per controlled world. D125/D126.
   *
   * Drawn so the ladder is a thing in the galaxy rather than a fact in a payload
   * (D124). Absent draws nothing, which is right for a client ahead of its server.
   */
  sensors?: readonly ReachRing[];
  /**
   * Whether each instrument's boundaries are drawn AT ALL. Owner instruction.
   *
   * One flag each, covering every controlled world — see `GalaxyView` for why the
   * per-world set that preceded them was wrong. Both default to off: the galaxy is
   * the subject and the instruments are something the player asks for.
   */
  showTelescopeReach?: boolean;
  showRadarReach?: boolean;
  /** Where your own craft launch from, for drawing mining legs. */
  homePosition: { x: number; y: number; z: number } | undefined;
  /** The controlled world Camera Home resolves inside the rendered galaxy list. */
  activePlanetId?: string | null;
  /** Your Aegis level. Only ever your own — D15 keeps everyone else's private. */
  aegisLevel: number;
  seasonStart: Date | undefined;
  /** The one commander whose history is pinned for this season. */
  rivalPlanetId?: string | null;
  rivalPlayerId?: string | null;
  focus: Focus | null;
  onFocus: (focus: Focus | null) => void;
  /** Bumped by the HOME button to re-centre on the player's own world. */
  homeSignal: number;
  /**
   * Open on the whole disc, with nothing selected. D56.
   *
   * For the onboarding rehearsal only. See `Rig` for why the ordinary first frame
   * snaps to the player's own world and why that is the wrong opening for somebody
   * who has never seen this galaxy.
   */
  openWide?: boolean;
  /** Exact camera range for an animated wide re-frame. Defaults to the whole disc. */
  wideDistance?: number;
  /**
   * Which worlds may be selected at all. D56.
   *
   * Absent means every world, which is the game. The rehearsal narrows it beat by
   * beat — first to the visitor's own world, then to everybody else's, then to the
   * ones inside the tier band — so that a step cannot be completed by tapping the
   * wrong thing and leaving the instruction on screen contradicting the world.
   *
   * FILTERED AT THE TAP ROUTER RATHER THAN BY MASKING THE SCREEN. A world is a
   * moving point inside a canvas the player can orbit; a hole cut in an overlay
   * drifts off it the moment the camera does. This cannot drift — it is the same
   * decision the router already makes, with one more question asked of it.
   */
  allowFocus?: (planetId: string) => boolean;
  /**
   * Called once, after the first frame that has every model in it is on screen.
   *
   * The cover over this canvas cannot be lifted on "the request came back": the
   * models still have to decode, compile and upload after that. See `FirstFrame`.
   */
  onReady?: () => void;
}

export function GalaxyCanvas({
  planets,
  pending,
  contacts,
  interceptions,
  interceptionImpacts,
  asteroids,
  runs,
  wrecks,
  sensors,
  showTelescopeReach = false,
  showRadarReach = false,
  homePosition,
  activePlanetId = null,
  aegisLevel,
  seasonStart,
  rivalPlanetId = null,
  rivalPlayerId = null,
  focus,
  onFocus,
  homeSignal,
  openWide = false,
  wideDistance = WHOLE_DISC_DISTANCE,
  allowFocus,
  onReady,
}: GalaxyCanvasProps) {
  const nodes = useMemo(() => planetNodes(planets), [planets]);
  const home = useMemo<[number, number, number]>(
    () => activeWorldPosition(planets, activePlanetId, homePosition),
    [activePlanetId, homePosition, planets],
  );

  const selfId = useMemo(() => planets.find((p) => p.isSelf)?.id, [planets]);
  const selectedId = focus?.kind === 'planet' ? focus.id : null;

  /**
   * The camera's subject.
   *
   * A PLANET is a fixed point and the rig can ease onto it once. EVERYTHING ELSE
   * MOVES — a rock crossing the disc, a squadron on its way to a raid, a
   * Prospector coming home — so focusing one has to keep following, or the thing
   * you tapped drifts out of frame mid-sentence. That is what `subject` is: a live
   * position, read fresh each frame, rather than a destination.
   *
   * SQUADRONS AND MINING RUNS WERE MISSING FROM THIS LIST, and the symptom was
   * exact: tapping a rock flew the camera to it and tracked it, tapping your own
   * fleet selected it, opened its panel, and left the camera wherever it was — so
   * the two gestures behaved differently for no reason a player could see. They
   * are the same gesture and they now do the same thing.
   *
   * Every branch reads the SAME interpolation the renderer uses, so the camera and
   * the craft agree to the frame. Deriving a second position here — even a very
   * close one — would show as the subject creeping out of centre over a long leg.
   */
  const subject = useMemo<(() => [number, number, number] | null) | null>(() => {
    if (!focus) return null;

    if (focus.kind === 'planet') {
      const node = nodes.find((n) => n.id === focus.id);
      return node ? () => node.position : null;
    }

    if (focus.kind === 'asteroid' && seasonStart) {
      const rock = asteroids.find((a) => a.id === focus.id);
      if (!rock) return null;
      return () => asteroidWorldPosition(rock, seasonStart, serverNow());
    }

    /**
     * A wreck sits at the planet the battle happened over, so the camera goes to
     * the planet's position. Without this branch the camera silently does nothing
     * when a player taps one — the failure mode the switch is exhaustive against.
     */
    if (focus.kind === 'debris') {
      const wreck = wrecks.find((w) => w.id === focus.id);
      const node = wreck ? nodes.find((n) => n.id === wreck.planetId) : undefined;
      return node ? () => node.position : null;
    }

    if (focus.kind === 'thread') {
      const thread = pending.find((t, i) => threadKey(t, i) === focus.key);
      const path = thread?.path;
      if (!thread || !path) return null;
      /**
       * THE SAME STANDOFF THE RENDERER USES. D44.
       *
       * A leg now stops in orbit rather than at a world's centre, and the camera
       * has to read the identical number — a rig that tracked the old endpoint
       * would let a focused squadron drift a planet-radius off centre over the
       * last minute of its approach, and then sit looking past it for the whole
       * engagement.
       */
      const standoff = legStandoff(thread, nodes);
      return () => threadPosition(path, serverNow(), standoff);
    }

    if (focus.kind === 'run' && homePosition) {
      const run = runs.find((r) => r.id === focus.id);
      if (!run) return null;
      const origin = runHomePosition(run, nodes, homePosition);
      return () => runPosition(run, origin, serverNow(), nodes);
    }

    if (focus.kind === 'interception') {
      const event = interceptions?.find((candidate) => candidate.id === focus.id);
      if (!event) return null;
      return () => strategicInterceptionMissilePosition(
        event,
        nodes,
        serverNow(),
      );
    }

    if (focus.kind === 'interceptionImpact') {
      const impact = interceptionImpacts?.find((candidate) => candidate.id === focus.id);
      if (!impact) return null;
      const collision = toWorld(impact.collision);
      return () => collision;
    }

    /**
     * Somebody else's craft is followed from its BEARING WINDOW rather than from a
     * route, because a window is all the server sends (D24). The camera therefore
     * tracks it exactly as far ahead as the payload knows, and re-anchors on the
     * next poll — which is the same thing the renderer does, from the same numbers.
     */
    if (focus.kind === 'contact') {
      const contact = contacts.find((c) => c.id === focus.id);
      // An effect-only engagement is deliberately not a craft: it has no hit box,
      // no focus target and no authoritative orbit point for the camera to follow.
      if (!contact || contact.effectOnly === true) return null;
      // The window is already on the server's shared visual leg; nodes remain for
      // the landed engagement hold, which still reads the target's drawn radius.
      return () => contactPosition(contact, serverNow(), nodes);
    }

    return null;
  }, [
    focus,
    nodes,
    asteroids,
    seasonStart,
    pending,
    runs,
    homePosition,
    contacts,
    interceptions,
    interceptionImpacts,
  ]);

  /**
   * How close the camera is pulled in when it takes a new subject.
   *
   * A world is drawn between 0.44 and 1.4 units across and a craft is a fraction
   * of that, so the distance at which a planet is comfortably framed is one at
   * which a squadron is three pixels. Focusing something small therefore has to
   * DOLLY as well as pivot — the owner's note was that tapping a fleet did not
   * zoom, and a camera that only re-centres on something invisible has technically
   * obeyed and practically done nothing.
   *
   * Only ever pulls IN, and only when the camera is further out than this. A
   * player who has deliberately gone close keeps their framing.
   */
  const approach = focus === null || focus.kind === 'planet' ? null : CRAFT_DISTANCE;

  /**
   * WHAT IS FOCUSED, AS A STABLE STRING — and it is the fix for a camera that
   * re-framed itself while the player sat still. Owner-reported bug.
   *
   * `subject` above is a memo over `nodes`, `asteroids`, `pending`, `runs`,
   * `contacts` and `wrecks`. Every one of those is a fresh array on every refetch,
   * and in a live galaxy they refetch on every shard broadcast as well as on the
   * sixty-second net — so the memo produced a NEW FUNCTION several times a minute
   * without the player touching anything. The rig's "ease onto a new subject"
   * effect was keyed on that function, so it fired each time: the pivot re-eased
   * and, worse, `rangeTo` dollied the camera back in to `CRAFT_DISTANCE`, undoing
   * whatever framing the player had chosen. The docblock on that effect claimed it
   * "fires on a change of subject and not on every render", which was the
   * intention and was never true.
   *
   * This is what a change of subject actually is: the player picked something
   * else. It moves when they act and at no other time.
   */
  const focusKey = useMemo(() => focusIdentity(focus), [focus]);

  useEffect(() => installTapGuard(), []);

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: initialHomeCameraPosition(...home), fov: 45, near: 0.1, far: 600 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        /**
         * THE COLOUR CONTRACT, stated rather than inherited from library defaults.
         *
         * Three works in linear-sRGB; the display is sRGB; ACES compresses values
         * above one into photographed highlights instead of clipping them white.
         * R3F currently chooses these defaults too, but a premium renderer cannot
         * let a dependency upgrade silently change what every texture and plume
         * means. The post-process target below is half-float so those highlights
         * survive long enough for bloom to read them.
         */
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1;
      }}
      onPointerMissed={() => {
        /**
         * Clear the selection ONLY when the gesture genuinely hit nothing.
         *
         * `wasMiss()` is the scene's own answer, set by the pick handlers, rather
         * than R3F's inference — which counted a tap on an object as a miss and
         * cleared the very selection that tap had just made, at random, depending
         * on which state update React flushed last.
         */
        // A rehearsal that is holding a world for a beat must not have it cleared
        // by a tap on empty space: the instruction would still be on screen with
        // nothing selected behind it.
        if (wasTap() && wasMiss() && !allowFocus) onFocus(null);
      }}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={['#04060c']} />
      {/*
        Atmospheric perspective. Distant worlds fade into the nebula instead of
        staying crisp, which is most of what makes a scene read as deep rather than
        as objects on a black sheet. Far enough out that nothing interactive hides.
      */}
      <fog attach="fog" args={['#070c18', 55, 210]} />

      {/* One key light, from the same upper-left the planet renders assume, so the
          asteroids are shaded consistently with everything else. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[-8, 12, 9]} intensity={2.2} />

      <Nebula />
      <Core />
      <Starfield />
      <BrightStars />
      <Dust />
      <Meteors />
      <Disc />

      <Suspense fallback={null}>
        {/* Wreckage is independent of the rock field — a battle can leave one on a
            day when nothing is crossing the disc. D32. */}
        <Wrecks
          wrecks={wrecks}
          nodes={nodes}
          focusedId={focus?.kind === 'debris' ? focus.id : null}
          onSelect={(id) => {
            onFocus({ kind: 'debris', id });
          }}
        />

        {seasonStart && asteroids.length > 0 && (
          <Asteroids
            asteroids={asteroids}
            seasonStart={seasonStart}
            focusedId={focus?.kind === 'asteroid' ? focus.id : null}
            onSelect={(id) => {
              onFocus({ kind: 'asteroid', id });
            }}
          />
        )}

        {/*
          THE BOUNDARIES, DRAWN. D125/D126. Before the worlds, so the rings sit
          behind the things they are about rather than over them.
        */}
        {sensors && sensors.length > 0 && (
          <SensorRings
            posts={sensors}
            showTelescope={showTelescopeReach}
            showRadar={showRadarReach}
          />
        )}
        <OwnershipFilaments nodes={nodes} selectedId={selectedId} />
        <PlanetField
          nodes={nodes}
          selectedId={selectedId}
          rivalPlanetId={rivalPlanetId}
          rivalPlayerId={rivalPlayerId}
          onSelect={(id) => {
            // D56. Absent means every world, which is the game; the rehearsal
            // narrows it per beat so a step cannot be finished on the wrong world.
            if (allowFocus && !allowFocus(id)) return;
            onFocus({ kind: 'planet', id });
          }}
        />
        {/*
          After the worlds, because the structure has to interleave with the
          billboard it wraps by depth rather than by draw order, and before the
          orbiting hardware, which is drawn small and must not be buried under it.
        */}
        <DysonShells nodes={nodes} />
        <Satellites nodes={nodes} />
        <Shields nodes={nodes} ownLevel={aegisLevel} ownId={selfId} />
        <OwnFleets
          pending={pending}
          nodes={nodes}
          focusedKey={focus?.kind === 'thread' ? focus.key : null}
          onSelect={(key) => {
            onFocus({ kind: 'thread', key });
          }}
        />
        {homePosition && (
          <MiningFlights
            runs={runs}
            home={homePosition}
            nodes={nodes}
            focusedId={focus?.kind === 'run' ? focus.id : null}
            onSelect={(id) => {
              onFocus({ kind: 'run', id });
            }}
          />
        )}
        <InterceptMarks runs={runs} />
        <Traffic
          contacts={contacts}
          nodes={nodes}
          focusedId={focus?.kind === 'contact' ? focus.id : null}
          onSelect={(id) => {
            onFocus({ kind: 'contact', id });
          }}
        />
        <DeathStarImpacts pending={pending} contacts={contacts} nodes={nodes} />
        <StrategicInterceptions
          events={interceptions ?? []}
          impacts={interceptionImpacts ?? []}
          nodes={nodes}
        />
        <Labels
          nodes={nodes}
          selectedId={selectedId}
          rivalPlanetId={rivalPlanetId}
          rivalPlayerId={rivalPlayerId}
        />
        <Preload all />
        {onReady && <FirstFrame onDrawn={onReady} />}
      </Suspense>

      {/*
        Bloom is the difference between "lights" and "light". It is the one
        post-process worth its cost here: everything bright in this scene is
        additive already, so a small mipmap kernel does all the work.
      */}
      <EffectComposer
        enableNormalPass={false}
        frameBufferType={THREE.HalfFloatType}
        // Two samples preserve the small hull silhouettes without paying the
        // package default of eight samples on every full-screen mobile buffer.
        multisampling={2}
      >
        <Bloom
          intensity={0.62}
          luminanceThreshold={0.78}
          luminanceSmoothing={0.22}
          mipmapBlur
          radius={0.72}
          levels={6}
        />
        <Vignette eskil={false} offset={0.24} darkness={0.7} />
      </EffectComposer>

      <DevBridge />
      <Rig
        home={home}
        homeSignal={homeSignal}
        subject={subject}
        focusKey={focusKey}
        approach={approach}
        openWide={openWide}
        wideDistance={wideDistance}
      />
      <AmbientTicker />
    </Canvas>
  );
}

/**
 * Names, only where they earn the pixels — AND ONLY WHERE THEY FIT.
 *
 * Semantic zoom was the whole idea and only half of it was implemented. The
 * filter picked which worlds DESERVE a name — yours, an open window, the current
 * selection, your marked rival, a world in recovery, a claim on the clock — and
 * then drew every one of them, at every distance, with no idea where the others
 * had landed. Three recovering worlds falling into the same corner of the disc
 * wrote three names into the same forty pixels, and the map's most important
 * labels became a smear that also ran off the left edge of a phone.
 *
 * A LABEL IS PLACED IN SCREEN SPACE, NOT WORLD SPACE, so this is settled where the
 * collision actually happens:
 *
 *   · PRIORITY, highest first — the selection, then your own worlds, then the
 *     rival, then a world that is on a clock (recovery or an open claim), then an
 *     open window. When two labels cannot both be drawn, the one the player is
 *     less likely to be looking for is the one that goes.
 *   · A GREEDY KEEP. Walk that order, project each anchor to CSS pixels, and drop
 *     any whose box would overlap one already placed. Nothing is ever half drawn.
 *   · OFF-SCREEN AND FAR-AWAY GO FIRST, because a name you cannot read is a name
 *     that is only costing the frame.
 *
 * It runs in `useFrame` against DOM refs rather than through React state: the
 * camera moves every frame, and re-rendering the label set at frame rate would put
 * a list rebuild on the disc's own budget. Nothing above this re-renders at all.
 */
const LABEL_BOX = { w: 132, h: 46 };
/** Past this the type is smaller than the disc's own dust. */
const LABEL_MAX_RANGE = 26;

function labelRank(
  node: PlanetNode,
  selectedId: string | null,
  rivalPlanetId: string | null,
  rivalPlayerId: string | null,
): number {
  if (node.id === selectedId) return 0;
  if (node.isOwned) return 1;
  if (node.isClanmate) return 2;
  if (node.dominionRank) return 3;
  if (isRivalNode(node, rivalPlanetId, rivalPlayerId)) return 4;
  if (node.state.kind === 'RECOVERY') return 5;
  if (node.claimUntil && node.claimUntil.getTime() > serverNow()) return 5;
  return 6;
}

function Labels({
  nodes,
  selectedId,
  rivalPlanetId,
  rivalPlayerId,
}: {
  nodes: readonly PlanetNode[];
  selectedId: string | null;
  rivalPlanetId: string | null;
  rivalPlayerId: string | null;
}) {
  const { t } = useTranslation();
  /**
   * AN UNKNOWN WORLD CARRIES NOTHING AT ALL. D127, owner's instruction.
   *
   * Not a name, not a rank, not even the eye. Everything in this container is a
   * READING, and the whole claim about a world nobody has looked at is that you
   * have not read it — a mark saying "unread" is still a mark, and a hundred of
   * them is a wall of marks over a galaxy whose faded bodies already say it.
   *
   * A REMEMBERED world DOES get one: a probe went and looked, and the name it
   * brought back is exactly what it paid for. What that label must also carry is
   * its AGE, because a record shown as a reading is the map asserting something it
   * cannot know — see `seenAt`.
   *
   * THE EYE STAYS, ON THE WORLDS THAT HAVE ONE. It is in the label's own element
   * rather than a mesh beside it, which is what fixed its scaling: a 3D quad had
   * to reproduce drei's `distanceFactor` by hand and got it inverted — smaller on
   * zoom in, larger on zoom out, drifting sideways the whole time. In the container
   * it simply IS the label's scale, for free and for ever.
   */
  const marked = nodes.filter(
    (node) => node.id === selectedId
      || ((node.intel !== 'UNKNOWN') && (
      node.isOwned
      || node.isClanmate
      || Boolean(node.dominionRank)
      || node.stance === 'window'
      || isRivalNode(node, rivalPlanetId, rivalPlayerId)
      || node.state.kind === 'RECOVERY'
      || Boolean(node.claimUntil && node.claimUntil.getTime() > serverNow()))),
  );

  const labelIdentity = marked
    .map((node) => `${node.id}:${node.state.kind}`)
    .join('|');

  // Recovery labels can join this list after the camera has rendered its last
  // demand frame. Give every newly committed label one projection frame so its
  // distanceFactor is correct before the player can see or touch it.
  useCommittedDemandFrame(labelIdentity);

  /**
   * The draw order, and it is also the DROP order.
   *
   * Deliberately NOT memoised. A handful of worlds carry a name and sorting them
   * costs nothing, while a memo would have to be keyed on every field the label
   * reads — stance, claim clock, controller, position — and the first one left
   * out is a label frozen at a value that has already changed.
   */
  const ordered = [...marked].sort(
    (a, b) =>
      labelRank(a, selectedId, rivalPlanetId, rivalPlayerId)
      - labelRank(b, selectedId, rivalPlanetId, rivalPlayerId),
  );

  const boxes = useRef(new Map<string, HTMLElement | null>());
  const anchor = useRef(new THREE.Vector3());
  const placed = useRef<{ x: number; y: number }[]>([]);
  const clock = useRef(0);

  useFrame(({ camera, size }, delta) => {
    // Ten times a second. The camera eases rather than jumps, so a label that
    // settles a frame late is invisible; a projection per world per frame is not.
    clock.current += delta;
    if (clock.current < 0.1) return;
    clock.current = 0;

    placed.current.length = 0;
    for (const node of ordered) {
      const element = boxes.current.get(node.id);
      if (!element) continue;
      anchor.current.set(node.position[0], node.position[1], node.position[2]);
      const range = camera.position.distanceTo(anchor.current);
      anchor.current.project(camera);
      const x = ((anchor.current.x + 1) / 2) * size.width;
      const y = ((1 - anchor.current.y) / 2) * size.height;

      const onScreen =
        anchor.current.z < 1
        && x > -LABEL_BOX.w
        && x < size.width + LABEL_BOX.w
        && y > 0
        && y < size.height;
      let show = onScreen && range < LABEL_MAX_RANGE;
      if (show) {
        for (const other of placed.current) {
          if (Math.abs(other.x - x) < LABEL_BOX.w && Math.abs(other.y - y) < LABEL_BOX.h) {
            show = false;
            break;
          }
        }
      }
      if (show) placed.current.push({ x, y });
      // `visibility` rather than `display`: drei keeps measuring the wrapper, and
      // a box that collapses to zero would flip the answer on the next frame.
      const next = show ? 'visible' : 'hidden';
      if (element.style.visibility !== next) element.style.visibility = next;
    }
  });

  return (
    <>
      {ordered.map((node) => (
        <Html
          key={node.id}
          position={[node.position[0], node.position[1] + node.radius * 1.85, node.position[2]]}
          center
          distanceFactor={6}
          // OrbitControls zooms a perspective camera by moving it, so a centred
          // recovery label can keep the same projected x/y while its distance
          // changes. Force Drei to refresh the HTML scale on every requested
          // demand frame, including the first committed recovery-label frame.
          eps={-1}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          {/*
            THE WHOLE BLOCK SITS ABOVE THE ANCHOR. drei centres an `Html` on its
            point, so half of a three-line label hung BELOW it — across the world's
            own selection marker and over the top of the sphere. Translating by
            half its own height puts its baseline on the standoff instead, which
            is what the standoff was measured for.
          */}
          <span
            ref={(element) => {
              boxes.current.set(node.id, element);
            }}
            className="flex -translate-y-1/2 flex-col items-center whitespace-nowrap"
            style={{ textShadow: '0 0 10px rgba(0,0,0,0.95)' }}
          >
            {/*
              THE EYE IS NOT HERE. D126. It sits in the marker stack instead, one
              step above the pin and on the pin's own scale law — the owner's
              instruction, and the only arrangement in which the two stay in step
              at every zoom. See `EyeMarks` in `PlanetField`.
            */}
            {/*
              A SELECTED UNKNOWN WORLD SAYS ONE TRUE THING. D127.

              Tapping a world selects it, and selection is the one route into this
              container that does not test `intel` — so an unsurveyed world came
              through here and was printed from the schema's DEFAULTS: an empty
              name, an empty commander, and the kind row falling through its two
              branches to read NEUTRAL. The map was answering a question the player
              had just been told it could not answer, and answering it wrong.

              The fog hides and never lies, so the label states the state. It stays
              rather than disappearing because the player asked for it by tapping,
              and a tap that produces nothing reads as a broken control.
            */}
            {node.intel === 'UNKNOWN' ? (
              <span className="legend text-faint">{t('galaxy.unsurveyed')}</span>
            ) : (
            <>
            <span className="legend flex items-center gap-2">
              <span className={node.kind === 'CAPITAL' ? 'text-crystal' : node.kind === 'COLONY' ? 'text-opportunity' : 'text-dim'}>
                {t(node.kind === 'CAPITAL'
                  ? 'galaxy.kindCapital'
                  : node.kind === 'COLONY'
                    ? 'galaxy.kindColony'
                    : 'galaxy.kindNeutral', { tier: node.neutralTier ?? 1 })}
              </span>
              {node.isOwned && <span className="text-crystal">· {t('galaxy.owned')}</span>}
              {node.isClanmate && <span className="text-opportunity">· {t('galaxy.clanmate')}</span>}
              {isRivalNode(node, rivalPlanetId, rivalPlayerId) && (
                <span className="text-alloy-glow">· {t('galaxy.rival')}</span>
              )}
              {node.state.kind === 'RECOVERY' && <span className="text-threat-ink">· {t('galaxy.recovery')}</span>}
              {node.claimUntil && node.claimUntil.getTime() > serverNow() && (
                <span className="text-opportunity">· {t('galaxy.claimOpen')}</span>
              )}
            </span>
            <span className={`name flex items-center gap-1.5 ${node.isClanmate || node.stance === 'window' ? 'text-opportunity' : 'text-bone'}`}>
              {node.dominionRank ? <RankBadge rank={node.dominionRank} /> : null}
              <span>{commanderLabel(node.owner, node.clan?.tag)}</span>
            </span>
            <span className="legend">{node.name}</span>
            {/*
              A RECORD SAYS WHEN IT WAS TAKEN. D127.
              Everything above this line on a remembered world is what a probe saw,
              and it may have been wrong for hours. Printing it without its age
              would be the map asserting something it cannot know — the fog hides,
              it never lies. Same string the Telescope already uses for a stale
              reading, so the two ages read as one idea.
            */}
            {node.intel === 'REMEMBERED' && node.seenAt && (
              <span className="legend text-faint">
                {staleness(Math.max(0, (serverNow() - node.seenAt.getTime()) / 60_000))}
              </span>
            )}
            </>
            )}
          </span>
        </Html>
      ))}
    </>
  );
}

/**
 * Camera behaviour.
 *
 * Free to roam the whole galaxy — an earlier version tethered the camera near the
 * player's own planet, which left half the galaxy unreachable and unclickable.
 * Three things make free roaming comfortable rather than merely possible:
 *
 * ORBIT AROUND WHAT YOU TAPPED. The single biggest comfort factor in an orbit
 * camera is whether the pivot is the thing you are looking at. Rotating a distant
 * pivot swings your subject across the screen and out of frame, and the player
 * fights the camera the whole way. Selecting a world eases the pivot onto it.
 *
 * ZOOM WHERE YOU POINT. Pinching or scrolling moves toward the cursor rather than
 * the centre of the screen, so reaching a world in the corner is one gesture
 * instead of zoom-then-pan-then-zoom.
 *
 * A LEASH RATHER THAN A WALL. Panning is unrestricted in the moment; drift far
 * enough outside the playable sphere and the pivot is eased back over the next
 * second. You cannot get lost in empty space, and you are never stopped dead
 * mid-gesture.
 */
function Rig({
  home,
  homeSignal,
  subject,
  focusKey,
  approach,
  openWide = false,
  wideDistance,
}: {
  home: [number, number, number];
  homeSignal: number;
  /**
   * Where the camera should be looking, read fresh each frame.
   *
   * A function rather than a point because the subject may be MOVING: an asteroid
   * crosses the disc while the player reads its panel, and a rig that eased onto
   * where it used to be would let the thing they tapped slide out of frame.
   */
  subject: (() => [number, number, number] | null) | null;
  /**
   * WHAT IS FOCUSED, AND THE ONLY THING THAT MAY RE-FRAME THE CAMERA.
   *
   * `subject` changes identity whenever any of the six lists behind it refetches,
   * which in a live galaxy is several times a minute. Keying the ease on it made
   * the rig re-frame itself while the player sat watching. This changes when the
   * player picks something else, and at no other time.
   */
  focusKey: string | null;
  /** Pull the camera in to at most this distance while easing. Null leaves it. */
  approach: number | null;
  /**
   * OPEN ON THE WHOLE DISC RATHER THAN ON YOUR OWN DOORSTEP. D56.
   *
   * The first frame normally snaps to the player's world, which is right for a
   * commander coming back to a season and wrong for somebody who has never seen
   * this galaxy: it answers "where am I" before they have asked it, and it makes
   * "show me my world" a control with nothing left to do. Opening wide is what
   * gives that first instruction something to be.
   */
  openWide?: boolean;
  /** The range an animated wide re-frame must reach, even when that means pulling back. */
  wideDistance: number;
}) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate = useThree((state) => state.invalidate);
  /** Where the pivot is heading, how much ease is left, and how to frame it. */
  const ease = useRef<{
    to: THREE.Vector3;
    left: number;
    rangeTo: number | null;
    exactRange: boolean;
  } | null>(null);

  /**
   * The live getter, mirrored so the frame loop reads the current one WITHOUT the
   * effects below depending on its identity.
   *
   * Assigned during render on purpose. A `useEffect` would land after this
   * component's own effects — and after the ease effect that has to read it on the
   * frame the focus changes — so the first frame of every new subject would track
   * the previous one's position.
   */
  const live = useRef(subject);
  live.current = subject;

  /**
   * THE SUBJECT IS GONE AND THE CAMERA STAYS WHERE IT IS. Owner-reported bug.
   *
   * A followed craft stops existing the moment it lands, turns for home, or gets
   * back — `pending`, `runs` and `contacts` simply stop carrying it. The rig read
   * that as "nothing is focused", which handed the frame straight to the LEASH
   * below: a camera that had followed a squadron out toward the rim was yanked
   * back toward the middle of the disc, at a new angle, for no reason the player
   * could connect to anything they did.
   *
   * What they asked for is what a camera should do anyway: *"focus nerede nasıl
   * kaldıysa öylece kalsın, free looking mode'una geçsin."* So losing a subject
   * releases the rig — no ease, no leash, no re-frame — and it simply stops
   * driving. The leash is a comfort rule about a player PANNING into the void, and
   * it resumes the moment they touch the controls again.
   */
  const mode = useRef<'follow' | 'released' | 'manual'>('manual');
  /** Whether this exact selection has existed in the scene at least once. */
  const acquired = useRef(false);
  /** Distinguishes initial `null` from a selection disappearing or being cleared. */
  const previousFocusKey = useRef<string | null>(null);
  const [homeX, homeY, homeZ] = home;

  const goTo = (
    x: number,
    y: number,
    z: number,
    rangeTo: number | null = null,
    exactRange = false,
  ): void => {
    ease.current = {
      to: new THREE.Vector3(x, y, z),
      left: EASE,
      rangeTo,
      exactRange,
    };
    invalidate();
  };

  /**
   * TAKE A NEW SUBJECT. Keyed on `focusKey`, never on `subject` — see the prop.
   *
   * A fresh selection also clears the release latch: the player has just told the
   * rig what to look at, so it is driving again and the leash is back on duty.
   */
  useEffect(() => {
    const previous = previousFocusKey.current;
    previousFocusKey.current = focusKey;
    if (focusKey === null) {
      if (previous !== null) {
        // Losing/clearing a selection is not permission to finish an old zoom.
        ease.current = null;
        mode.current = 'released';
        acquired.current = false;
      }
      return;
    }

    mode.current = 'follow';
    acquired.current = false;
    ease.current = null;
    const at = live.current?.();
    if (at) {
      acquired.current = true;
      goTo(at[0], at[1], at[2], approach);
    }
    // `live` is read through a ref by design: this must not re-run when the data
    // behind the subject refetches, only when the player picks something else.
  }, [focusKey, approach]);

  /**
   * HOME re-frames rather than teleports: an instant cut loses every sense of
   * where you were, and re-orienting afterwards costs more than the half second.
   *
   * This effect deliberately follows the focus effect. Home clears selection and
   * bumps the signal in one render; the explicit home instruction must therefore
   * win over the selection's passive disappearance.
   */
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    mode.current = 'manual';
    acquired.current = false;
    if (openWide) {
      if (homeSignal === 0) {
        controls.target.set(0, 0, 0);
        controls.object.position.set(
          0,
          wideDistance * (1.15 / WIDE_TILT),
          wideDistance * (1.75 / WIDE_TILT),
        );
        controls.update();
        // The scene renders on demand. `<Html distanceFactor>` measured the
        // default camera on its first frame and otherwise kept that stale scale
        // until the first gesture. Draw once more after the initial camera snap
        // so world labels and WebGL start on the same projection.
        invalidate();
      } else {
        // Returning to a wide tutorial beat must also be allowed to pull the
        // camera OUT. Ordinary focus ranges are one-way so a deliberate close
        // view is preserved; this is a scripted change of framing, not a focus.
        goTo(0, 0, 0, wideDistance, true);
      }
      return;
    }
    if (homeSignal === 0) {
      controls.target.set(homeX, homeY, homeZ);
      controls.object.position.set(...initialHomeCameraPosition(homeX, homeY, homeZ));
      controls.update();
      invalidate();
      return;
    }
    goTo(homeX, homeY, homeZ, HOME_DISTANCE);
    // Primitive coordinates are deliberate. `home` is rebuilt from every live
    // galaxy refetch; depending on the tuple identity made broadcasts press Home.
  }, [homeX, homeY, homeZ, homeSignal, openWide, wideDistance]);

  useFrame((_, delta) => {
    const controls = ref.current;
    if (!controls) return;

    /**
     * KEEP UP WITH A MOVING SUBJECT.
     *
     * Once the initial ease has landed, a focused asteroid is tracked directly:
     * the pivot and the camera both take the subject's per-frame delta, so the
     * rock stays put on screen and the player keeps whatever angle they chose.
     * Applied as a delta rather than a lerp-to-point so it does not fight a player
     * who is orbiting at the same time.
     */
    const follow = live.current;
    const at = follow?.() ?? null;

    /** Every decision the rig makes on its own, in one pure call. See `follow.ts`. */
    const act = rigAction({
      easing: ease.current !== null,
      focused: focusKey !== null,
      positioned: at !== null,
      acquired: acquired.current,
      mode: mode.current,
    });
    if (act.cancelEase) ease.current = null;
    if (act.release) {
      mode.current = 'released';
      return;
    }
    if (act.acquire && at) {
      acquired.current = true;
      goTo(at[0], at[1], at[2], approach);
    }

    if (act.track && at) {
      const target = new THREE.Vector3(at[0], at[1], at[2]);
      const drift = target.clone().sub(controls.target);
      if (drift.lengthSq() > 1e-10) {
        controls.target.add(drift);
        controls.object.position.add(drift);
        controls.update();
        invalidate();
      }
    }

    /**
     * The leash. Checked continuously rather than on release, because a player who
     * has flung the camera into the void wants it back before they let go — and
     * because the correction is a lerp, it reads as the galaxy pulling rather than
     * as an edge they hit.
     */
    /**
     * The leash. Off while the rig is released, and off on the frame a subject
     * ends — see `rigAction`, which is where that rule lives and is tested.
     */
    if (act.leash) {
      const t = controls.target;
      const correction = sphericalLeashCorrection(t.x, t.y, t.z, LEASH);
      if (correction) goTo(correction[0], correction[1], correction[2]);
    }

    const move = ease.current;
    if (!move) return;

    // Frame-rate independent easing: the same curve at 30fps and at 120.
    const step = 1 - Math.pow(0.001, delta / Math.max(0.001, move.left + delta));
    const previous = controls.target.clone();
    controls.target.lerp(move.to, Math.min(1, step));
    // The camera follows its pivot, so the framing is preserved and only the
    // subject changes. Moving the pivot alone would swing the view instead.
    controls.object.position.add(controls.target.clone().sub(previous));

    /**
     * And adjust the distance, on the same curve.
     *
     * Applied along the camera's own view vector, so the angle the player chose is
     * untouched and only the range changes. Focus is one-way: if they are already
     * closer than the approach distance, nothing happens. A scripted overview is
     * exact and may pull back, because the wider composition is the instruction.
     */
    if (move.rangeTo !== null) {
      const out = controls.object.position.clone().sub(controls.target);
      const range = out.length();
      if (move.exactRange || range > move.rangeTo) {
        const wanted = easedCameraRange(
          range,
          move.rangeTo,
          Math.min(1, step),
          move.exactRange,
        );
        controls.object.position.copy(
          controls.target.clone().add(out.setLength(wanted)),
        );
      }
    }

    controls.update();
    invalidate();

    move.left -= delta;
    if (move.left <= 0 || controls.target.distanceToSquared(move.to) < 0.0004) {
      const out = controls.object.position.clone().sub(controls.target);
      controls.target.copy(move.to);
      if (move.exactRange && move.rangeTo !== null && out.lengthSq() > 1e-10) {
        controls.object.position.copy(controls.target.clone().add(out.setLength(move.rangeTo)));
      }
      controls.update();
      ease.current = null;
    }
  });

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.9}
      panSpeed={0.9}
      zoomToCursor
      minPolarAngle={MIN_POLAR}
      maxPolarAngle={MAX_POLAR}
      minDistance={1.2}
      // Far enough to see the whole disc at once, and no further — past this the
      // galaxy is a smudge and the player has lost their bearings.
      maxDistance={DISC_RADIUS * 3}
      screenSpacePanning
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }}
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      /**
       * Touching the controls ends free-look and puts the leash back on duty.
       *
       * Without this a camera released by a vanished fleet would stay unleashed for
       * the rest of the session, and a player could then pan into empty space with
       * nothing to walk them back. The release is about not being moved WITHOUT
       * asking; the moment they ask, the ordinary rules apply again.
       */
      onStart={() => {
        // A gesture changes the framing, not the selection. Keep translating the
        // camera with a moving focused subject after the player orbits or zooms;
        // only a missing/unfocused subject becomes genuine free-look.
        const at = live.current?.() ?? null;
        const next = rigGestureState(focusKey !== null, at !== null);
        mode.current = next.mode;
        acquired.current = next.acquired;
        ease.current = null;
      }}
    />
  );
}

/**
 * A handle on the scene, in development only.
 *
 * R3F stopped exposing its store on the canvas element, and a 3D scene cannot be
 * debugged from the outside — "the planets are missing" has a dozen possible
 * causes and only the live scene graph distinguishes them. Stripped from
 * production builds by the `DEV` guard.
 */
interface DebugWindow {
  __galaxy?: unknown;
  __galaxyMetrics?: {
    snapshot: () => GalaxyMetricSnapshot;
    reset: () => void;
  };
}

interface GalaxyMetricSnapshot {
  continuous: boolean;
  frameIntervalMs: { samples: number; p50: number; p95: number; p99: number; max: number };
  longTaskMs: { samples: number; p50: number; p95: number; p99: number; max: number };
  heap: { usedBytes: number; totalBytes: number; limitBytes: number } | null;
  renderer: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number;
  };
  scene: { objects: number; meshes: number; instancedMeshes: number; instances: number };
}

const metricSummary = (input: readonly number[]) => {
  if (input.length === 0) return { samples: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...input].sort((a, b) => a - b);
  const at = (percentile: number): number =>
    sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentile / 100) - 1)] ?? 0;
  return { samples: sorted.length, p50: at(50), p95: at(95), p99: at(99), max: at(100) };
};

function DevBridge() {
  // The store object is stable. Subscribing to the entire RootState here made
  // this component re-render whenever R3F replaced that state, repeatedly
  // recreating a buffered PerformanceObserver and counting old long tasks again.
  const store = useStore();
  const frameTimes = useRef(new Float64Array(2048));
  const longTasks = useRef(new Float64Array(512));
  const frameCount = useRef(0);
  const frameCursor = useRef(0);
  const longTaskCount = useRef(0);
  const longTaskCursor = useRef(0);
  const lastFrameAt = useRef<number | null>(null);
  const enabled = import.meta.env.DEV || import.meta.env.VITE_VISUAL_TEST === '1';
  const continuous = import.meta.env.VITE_VISUAL_TEST === '1';

  useFrame(({ invalidate }) => {
    if (!enabled) return;
    const now = performance.now();
    if (lastFrameAt.current !== null) {
      frameTimes.current[frameCursor.current] = now - lastFrameAt.current;
      frameCursor.current = (frameCursor.current + 1) % frameTimes.current.length;
      frameCount.current = Math.min(frameCount.current + 1, frameTimes.current.length);
    }
    lastFrameAt.current = now;
    // `frameloop="demand"` intentionally idles in the real game. A visual test
    // requests a continuous sample so frame intervals measure rendering capacity
    // rather than the ambient ticker's chosen sleep.
    if (continuous) invalidate();
  });

  useEffect(() => {
    if (!enabled) return;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.current[longTaskCursor.current] = entry.duration;
          longTaskCursor.current = (longTaskCursor.current + 1) % longTasks.current.length;
          longTaskCount.current = Math.min(longTaskCount.current + 1, longTasks.current.length);
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Firefox and older WebViews do not expose the Long Tasks API. The rest of
      // the bridge remains useful and reports an empty window.
    }
    if (continuous) store.getState().invalidate();
    const debug = window as unknown as DebugWindow;
    // Existing visual harnesses inspect the live RootState directly. A proxy
    // keeps that API while reading the latest Zustand snapshot on every access.
    const exposedState = new Proxy(store.getState(), {
      get: (_target, property): unknown => {
        const value: unknown = Reflect.get(store.getState(), property);
        return value;
      },
    });
    debug.__galaxy = exposedState;
    const bridge = {
      snapshot: (): GalaxyMetricSnapshot => {
        const state = store.getState();
        let objects = 0;
        let meshes = 0;
        let instancedMeshes = 0;
        let instances = 0;
        state.scene.traverse((object) => {
          objects += 1;
          if (object instanceof THREE.Mesh) meshes += 1;
          if (object instanceof THREE.InstancedMesh) {
            instancedMeshes += 1;
            instances += object.count;
          }
        });
        const info = state.gl.info;
        const memory = (performance as Performance & {
          memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
        }).memory;
        return {
          continuous,
          frameIntervalMs: metricSummary(Array.from(frameTimes.current.slice(0, frameCount.current))),
          longTaskMs: metricSummary(Array.from(longTasks.current.slice(0, longTaskCount.current))),
          heap: memory
            ? {
                usedBytes: memory.usedJSHeapSize,
                totalBytes: memory.totalJSHeapSize,
                limitBytes: memory.jsHeapSizeLimit,
              }
            : null,
          renderer: {
            calls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? 0,
          },
          scene: { objects, meshes, instancedMeshes, instances },
        };
      },
      reset: (): void => {
        frameCount.current = 0;
        frameCursor.current = 0;
        longTaskCount.current = 0;
        longTaskCursor.current = 0;
        lastFrameAt.current = null;
      },
    };
    debug.__galaxyMetrics = bridge;
    return () => {
      observer?.disconnect();
      if (debug.__galaxy === exposedState) delete debug.__galaxy;
      if (debug.__galaxyMetrics === bridge) delete debug.__galaxyMetrics;
    };
  }, [continuous, enabled, store]);
  return null;
}

/**
 * Requests frames for the things that move on their own.
 *
 * With `frameloop="demand"` nothing renders unless something asks. The camera asks
 * while it is moving; this asks slowly and constantly, so the asteroids and the
 * dust keep drifting without paying for sixty frames a second of a still scene.
 *
 * The asking itself lives in `frames.tsx` — it used to be a `setInterval`, which
 * beat against the display's refresh and was throttled by the browser whenever it
 * decided the page was not being looked at. See that file for the measurements.
 */
function AmbientTicker() {
  useAmbientFrames();
  return null;
}

/**
 * THE FRAME THAT PROVES THE GALAXY IS ACTUALLY UP. Owner decision.
 *
 * A preloader that fetches urls can only tell you the BYTES have arrived. Eleven
 * GLTFs then have to be parsed, their materials compiled and their buffers pushed
 * to the GPU, and on a phone that is the visible part of the wait — the part where
 * worlds appear without their instruments and each hull lands with a stutter. The
 * old cover came off on `assets.ready`, which is the moment before all of that
 * rather than after it.
 *
 * This sits INSIDE the same Suspense boundary as everything it is vouching for, so
 * it cannot mount until every `useGLTF` in the subtree has resolved; `<Preload all/>`
 * immediately above it forces the compile. Then it waits for a real animation frame
 * to be painted before it says so — `useFrame` runs BEFORE the draw, so reporting
 * from inside it would be one frame early, which is exactly the frame the stutter
 * is in.
 *
 * Fires once and never again. A cover that can come back is a flash.
 */
function FirstFrame({ onDrawn }: { onDrawn: () => void }) {
  const fired = useRef(false);
  useFrame(() => {
    if (fired.current) return;
    fired.current = true;
    requestAnimationFrame(() => {
      onDrawn();
    });
  });
  return null;
}
