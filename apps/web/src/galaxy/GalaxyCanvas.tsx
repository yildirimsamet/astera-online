import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Html, OrbitControls, Preload } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type {
  AsteroidView,
  Contact,
  GalaxyPlanet,
  MiningRun,
  PendingThread,
} from '../api/schemas.js';
import type { Focus } from './FocusPanel.js';
import { focusIdentity, rigAction } from './follow.js';
import { BrightStars, Core, Disc, Dust, Meteors, Nebula, Starfield } from './Environment.jsx';
import { useAmbientFrames } from './frames.jsx';
import { Wrecks, type WreckView } from './Wrecks.js';
import { Asteroids, InterceptMarks } from './Asteroids.jsx';
import { OwnFleets, Traffic, WatchBeams, threadKey } from './Fleets.jsx';
import { PlanetField } from './PlanetField.jsx';
import { Satellites, Shields } from './Satellites.jsx';
import { MiningFlights } from './MiningFlights.jsx';
import {
  DISC_RADIUS,
  asteroidWorldPosition,
  clearOfWorlds,
  contactPosition,
  legStandoff,
  planetNodes,
  runPosition,
  threadPosition,
  toWorld,
  type PlanetNode,
} from './scene.js';
import { installTapGuard, wasMiss, wasTap } from './tap.js';
import { serverNow } from '../lib/clock.js';

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
 *   · `AdaptiveDpr` drops resolution while the camera moves and restores it when
 *     it settles, which is where a mid-range phone actually wins its frames.
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
 * How close the camera comes when it flies home from the wide opening. D56.
 *
 * MUCH CLOSER THAN THE ORDINARY FRAMING, on the owner's instruction, and the
 * reason is what the flight is FOR. A returning commander opens at about 26 units
 * because they want their neighbourhood: their world and everything they might
 * send a fleet at. A stranger pressing "show me my world" is being answered, and
 * an answer that stops a disc-width away shows them a dot among dots.
 *
 * Well clear of `minDistance`, so the rig lands rather than being caught by a
 * clamp — and the player can pull straight back out, because the approach is
 * one-way (see `pullTo`) and never pushes anybody off a view they went and got.
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

export interface GalaxyCanvasProps {
  planets: readonly GalaxyPlanet[];
  /** Your own missions. Inbound attacks carry no path and are not drawn as one. */
  pending: readonly PendingThread[];
  /** Everyone else's, already stripped of anything identifying by the server. */
  contacts: readonly Contact[];
  /** Ids of the planets your telescopes are pointed at. Yours alone to know. */
  watching: readonly string[];
  /** Rocks crossing the disc right now, and your craft working them. D19. */
  asteroids: readonly AsteroidView[];
  runs: readonly MiningRun[];
  /** Wreck fields left by battles, visible to the whole galaxy. D32. */
  wrecks: readonly WreckView[];
  /** Where your own craft launch from, for drawing mining legs. */
  homePosition: { x: number; y: number; z: number } | undefined;
  /** Your Aegis level. Only ever your own — D15 keeps everyone else's private. */
  aegisLevel: number;
  seasonStart: Date | undefined;
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
  watching,
  asteroids,
  runs,
  wrecks,
  homePosition,
  aegisLevel,
  seasonStart,
  focus,
  onFocus,
  homeSignal,
  openWide = false,
  allowFocus,
  onReady,
}: GalaxyCanvasProps) {
  const nodes = useMemo(() => planetNodes(planets), [planets]);
  const home = useMemo<[number, number, number]>(() => {
    const self = planets.find((p) => p.isSelf);
    return self ? toWorld(self.position) : [0, 0, 0];
  }, [planets]);

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
      const rock = asteroids.find((a) => a.index === focus.index);
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
      return () => runPosition(run, homePosition, serverNow());
    }

    /**
     * Somebody else's craft is followed from its BEARING WINDOW rather than from a
     * route, because a window is all the server sends (D24). The camera therefore
     * tracks it exactly as far ahead as the payload knows, and re-anchors on the
     * next poll — which is the same thing the renderer does, from the same numbers.
     */
    if (focus.kind === 'contact') {
      const contact = contacts.find((c) => c.id === focus.id);
      if (!contact) return null;
      // Corrected exactly as the renderer corrects it, or the rig would centre on
      // a point inside a world while the craft is drawn on its surface.
      return () => clearOfWorlds(nodes, contactPosition(contact, serverNow(), nodes));
    }

    return null;
  }, [focus, nodes, asteroids, seasonStart, pending, runs, homePosition, contacts]);

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
   * and, worse, `pullTo` dollied the camera back in to `CRAFT_DISTANCE`, undoing
   * whatever framing the player had chosen. The docblock on that effect claimed it
   * "fires on a change of subject and not on every render", which was the
   * intention and was never true.
   *
   * This is what a change of subject actually is: the player picked something
   * else. It moves when they act and at no other time.
   */
  const focusKey = useMemo(() => focusIdentity(focus), [focus]);

  const watched = useMemo(() => {
    const wanted = new Set(watching);
    return planets.filter((p) => wanted.has(p.id)).map((p) => toWorld(p.position));
  }, [planets, watching]);

  useEffect(() => installTapGuard(), []);

  return (
    <Canvas
      frameloop="demand"
      camera={{ position: [home[0] + 12, 16, home[2] + 20], fov: 45, near: 0.1, far: 600 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
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
            focusedIndex={focus?.kind === 'asteroid' ? focus.index : null}
            onSelect={(index) => {
              onFocus({ kind: 'asteroid', index });
            }}
          />
        )}

        <PlanetField
          nodes={nodes}
          selectedId={selectedId}
          onSelect={(id) => {
            // D56. Absent means every world, which is the game; the rehearsal
            // narrows it per beat so a step cannot be finished on the wrong world.
            if (allowFocus && !allowFocus(id)) return;
            onFocus({ kind: 'planet', id });
          }}
        />
        <Satellites nodes={nodes} />
        <Shields nodes={nodes} ownLevel={aegisLevel} ownId={selfId} />
        <WatchBeams from={home} targets={watched} />
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
        <Labels nodes={nodes} selectedId={selectedId} />
        <Preload all />
        {onReady && <FirstFrame onDrawn={onReady} />}
      </Suspense>

      {/*
        Bloom is the difference between "lights" and "light". It is the one
        post-process worth its cost here: everything bright in this scene is
        additive already, so a small mipmap kernel does all the work.
      */}
      <EffectComposer enableNormalPass={false}>
        <Bloom intensity={0.55} luminanceThreshold={0.62} luminanceSmoothing={0.35} mipmapBlur />
        <Vignette eskil={false} offset={0.24} darkness={0.7} />
      </EffectComposer>

      <AdaptiveDpr pixelated={false} />
      <DevBridge />
      <Rig
        home={home}
        homeSignal={homeSignal}
        subject={subject}
        focusKey={focusKey}
        approach={approach}
        openWide={openWide}
      />
      <AmbientTicker />
    </Canvas>
  );
}

/**
 * Names, only where they earn the pixels.
 *
 * Semantic zoom: labelling every world at every distance is how a galaxy map
 * becomes unreadable. Your own planet, an open window and the current selection
 * are the only three things a player looks for by name.
 */
function Labels({ nodes, selectedId }: { nodes: readonly PlanetNode[]; selectedId: string | null }) {
  const marked = nodes.filter(
    (node) => node.id === selectedId || node.stance === 'self' || node.stance === 'window',
  );

  return (
    <>
      {marked.map((node) => (
        <Html
          key={node.id}
          position={[node.position[0], node.position[1] + node.radius * 1.85, node.position[2]]}
          center
          distanceFactor={6}
          zIndexRange={[10, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <span
            className={`whitespace-nowrap font-display text-[12px] uppercase tracking-[0.16em] ${
              node.stance === 'window' ? 'text-opportunity' : 'text-bone'
            }`}
            style={{ textShadow: '0 0 10px rgba(0,0,0,0.95)' }}
          >
            {node.name}
          </span>
        </Html>
      ))}
    </>
  );
}

/**
 * Camera behaviour.
 *
 * Free to roam the whole disc — an earlier version tethered the camera near the
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
 * enough past the rim and the pivot is eased back over the next second. You cannot
 * get lost in empty space, and you are never stopped dead mid-gesture.
 */
function Rig({
  home,
  homeSignal,
  subject,
  focusKey,
  approach,
  openWide = false,
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
}) {
  const ref = useRef<ComponentRef<typeof OrbitControls>>(null);
  const invalidate = useThree((state) => state.invalidate);
  /** Where the pivot is heading, how much ease is left, and how close to come. */
  const ease = useRef<{ to: THREE.Vector3; left: number; pullTo: number | null } | null>(null);

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
  const released = useRef(false);

  const goTo = (x: number, y: number, z: number, pullTo: number | null = null): void => {
    ease.current = { to: new THREE.Vector3(x, y, z), left: EASE, pullTo };
    invalidate();
  };

  /**
   * HOME re-frames rather than teleports: an instant cut loses every sense of
   * where you were, and re-orienting afterwards costs more than the half second.
   *
   * Note the caller clears the SELECTION before bumping this. Without that, the
   * ease ran, finished, and then the subject-tracking below immediately dragged
   * the camera back to whatever was focused — the button appeared to do nothing.
   */
  useEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    // An explicit instruction, so the rig is driving again.
    released.current = false;
    if (homeSignal === 0) {
      if (openWide) {
        // The disc entire, from above and outside it. Nothing is selected, so the
        // leash below leaves this alone until the player moves.
        controls.target.set(0, 0, 0);
        controls.object.position.set(0, DISC_RADIUS * 1.15, DISC_RADIUS * 1.75);
        controls.update();
        return;
      }
      controls.target.set(home[0], home[1], home[2]);
      controls.object.position.set(home[0] + 12, 16, home[2] + 20);
      controls.update();
      return;
    }
    /**
     * COMING HOME CLOSES THE RANGE AS WELL AS MOVING THE PIVOT.
     *
     * Easing the pivot alone keeps whatever distance the camera was at, which is
     * correct for the header's own "centre on your planet" — the player is already
     * among the worlds and only wants re-centring. From the wide opening it is
     * not: the pivot would arrive at a world still a disc-width away, and the
     * flight that was supposed to show them their planet would show them a dot.
     */
    goTo(home[0], home[1], home[2], openWide ? HOME_DISTANCE : null);
  }, [home, homeSignal, openWide]);

  /**
   * TAKE A NEW SUBJECT. Keyed on `focusKey`, never on `subject` — see the prop.
   *
   * A fresh selection also clears the release latch: the player has just told the
   * rig what to look at, so it is driving again and the leash is back on duty.
   */
  useEffect(() => {
    released.current = false;
    const at = live.current?.();
    if (at) goTo(at[0], at[1], at[2], approach);
    // `live` is read through a ref by design: this must not re-run when the data
    // behind the subject refetches, only when the player picks something else.
  }, [focusKey, approach]);

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
      following: follow !== null,
      positioned: at !== null,
      released: released.current,
    });
    if (act.release) released.current = true;

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
      const flat = Math.hypot(t.x, t.z);
      if (flat > LEASH || Math.abs(t.y) > LEASH * 0.5) {
        const k = flat > LEASH ? LEASH / flat : 1;
        goTo(t.x * k, THREE.MathUtils.clamp(t.y, -LEASH * 0.5, LEASH * 0.5), t.z * k);
      }
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
     * And close the distance, on the same curve.
     *
     * Applied along the camera's own view vector, so the angle the player chose is
     * untouched and only the range changes. One-way: if they are already closer
     * than the approach distance, nothing happens — the rig never pushes a player
     * back out of a view they went and got.
     */
    if (move.pullTo !== null) {
      const out = controls.object.position.clone().sub(controls.target);
      const range = out.length();
      if (range > move.pullTo) {
        const wanted = Math.max(move.pullTo, range + (move.pullTo - range) * Math.min(1, step));
        controls.object.position.copy(
          controls.target.clone().add(out.setLength(wanted)),
        );
      }
    }

    controls.update();
    invalidate();

    move.left -= delta;
    if (move.left <= 0 || controls.target.distanceToSquared(move.to) < 0.0004) {
      controls.target.copy(move.to);
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
        released.current = false;
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
}

function DevBridge() {
  const state = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as DebugWindow).__galaxy = state;
  }, [state]);
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
