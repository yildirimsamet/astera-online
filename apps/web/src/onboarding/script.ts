import type { Focus } from '../galaxy/FocusPanel.jsx';
import type { PlanetGroup } from '../lib/directives.js';
import type { Panel } from '../screens/GalaxyView.jsx';
import type { RehearsalWorld } from './world.js';

/**
 * THE REHEARSAL, AS A LIST OF THINGS THE PLAYER DOES. D56.
 *
 * NINETY SECONDS, AND THE SHAPE IS DELIBERATE. The premise comes before the
 * economy, because "you cannot see what they hold" is the product and a refinery
 * is not; the budget comes before the fleet, because the fleet is what the budget
 * turns out to have been for; and the whole thing ends with something in flight,
 * because Design Law #6 says a session that ends with nothing pending is a session
 * with no reason to return — and the FIRST one is the one that decides.
 *
 * A BEAT ADVANCES ON WHAT WAS DONE, NEVER ON A "NEXT" BUTTON. That is the whole
 * difference between this and a slideshow: `achieved` reads the rehearsal's world
 * and the player's own selection, so the only way past a beat is to do the thing.
 * The two beats that are genuinely only a sentence say so by having no `achieved`
 * at all, and carry a control instead.
 *
 * AND ONLY ONE THING IS PRESSABLE WHILE IT RUNS. `gate` names it. A beat that
 * asks for the Command Core while every other control still works is a
 * suggestion, and a stranger who presses something else is left looking at an
 * instruction that no longer describes the screen. See `Gate.tsx` for why this is
 * done by cancelling activations rather than by covering the screen — the panel
 * still scrolls and the disc still orbits, because finding the thing is the part
 * the player is supposed to do.
 *
 * NOTHING HERE MOVES THE CAMERA EXCEPT ONCE, ON REQUEST. The opening frames the
 * whole disc with nothing selected, and the first beat's control is what flies in.
 * After that the camera belongs to the player: a tutorial that drives the view,
 * opens the panel and presses the button is a video with extra steps.
 *
 * WHY NO TAB TOUR. Four tabs explained one after another teaches menu geography at
 * the moment attention is most expensive, and `lib/directives.ts` already answers
 * "what should I do next" for the whole rest of the season. Only GROW and REACH
 * are visited, because they are the only two the opening grant can act in; the
 * other two introduce themselves when the player can afford them.
 */

export type BeatId =
  | 'wide'
  | 'yours'
  | 'core'
  | 'refinery'
  | 'extractor'
  | 'fleet'
  | 'fog'
  | 'target'
  | 'claim';

export interface BeatState {
  world: RehearsalWorld;
  focus: Focus | null;
  /** Beats already completed. A transient fact, once true, stays true. */
  done: ReadonlySet<BeatId>;
  /** Worlds this planet may legally attack right now. */
  targets: readonly string[];
}

/**
 * What may be pressed while a beat runs.
 *
 * `disc` — the galaxy canvas, and the beat card. The canvas stays live so the
 * player can orbit and look, which is most of what the opening beats are for;
 * which WORLDS may be SELECTED is a separate question answered by `worlds` below,
 * because a world is a moving point inside the canvas and cannot be described by
 * a rectangle.
 * `element` — a short list of CSS selectors, ALL of them live. Always the row's
 * own `data-act` rather than the row itself: a row opens a detail sheet whose
 * commit button would then be outside the gate, and the player would be sealed
 * inside a surface they could not act on. The list exists for the same reason in
 * reverse — pressing "build" opens a sheet with a count picker on it, and that
 * sheet has to be live or the beat cannot be finished.
 * `open` — nothing is blocked. For the beats where the player is working the real
 * interface: choosing a target opens the focus rail and then the launch sheet, and
 * gating those would be gating the game itself. The world filter still applies,
 * which is the part that matters.
 */
export type GateTarget =
  | { kind: 'disc' }
  | {
      kind: 'element';
      /** What may be PRESSED. Everything else is refused. */
      selectors: readonly string[];
      /**
       * What is LIT, if that is not the same list.
       *
       * The two questions are different, and conflating them is what put the beat
       * card over a build sheet's controls on a short screen. What may be pressed
       * has to include the whole sheet — the count picker is on it — while what
       * the light points at must stay the one control the beat is asking for, or
       * there is nothing for the card to get out of the way OF.
       *
       * The last entry that resolves is the SUBJECT: it carries the dimming, and
       * the card places itself against it. The ones before it are context — the
       * tab a beat is working in, so a screen dimmed to a single live button still
       * says where that button is.
       */
      lit?: readonly string[];
      /**
       * Whether to darken everything that is not lit. Defaults to true.
       *
       * FALSE WHEN THE WHOLE SURFACE IS THE DECISION. Choosing a target is made by
       * READING THE DISC — every world inside the tier band is a legal answer — and
       * a scrim over it greys out the one thing the beat is asking to be looked at.
       * The rings still say where the controls are.
       */
      dim?: boolean;
    }
  | { kind: 'open' };

export interface Beat {
  id: BeatId;
  /**
   * What finishes this beat. Absent means the beat is a sentence and its card
   * carries the only way past it.
   */
  achieved?: (s: BeatState) => boolean;
  /** Which surface is open while it runs. The beat opens it; the player works it. */
  panel: Panel;
  /** Which decision group the planet panel lands on. */
  group?: PlanetGroup;
  gate: GateTarget;
  /** Which worlds may be selected. Absent means none — the disc is scenery. */
  worlds?: (s: BeatState) => (planetId: string) => boolean;
}

/** How many Wasps the opening grant buys, exactly. Asserted in `rehearsal.test.ts`. */
export const OPENING_WASPS = 2;

export const BEATS: readonly Beat[] = [
  /**
   * THE DISC, WHOLE, WITH NOTHING SELECTED.
   *
   * The first thing this game has to prove to a stranger is that the room is not
   * empty, and the way to prove it is to let them look at it. No instruction and
   * nothing to find yet — the only live control is the one that flies them in.
   */
  {
    id: 'wide',
    panel: null,
    gate: { kind: 'disc' },
    // Look all you like; nothing is selectable yet, so a curious tap costs
    // nothing and the one live control is the card's.
    worlds: () => () => false,
  },

  /**
   * One world is theirs, and they tap it themselves. The camera has put them in
   * the neighbourhood; finding it is the first act of ownership, and the gate
   * makes sure the first world they successfully tap is that one.
   */
  {
    id: 'yours',
    panel: null,
    gate: { kind: 'disc' },
    worlds: (s) => (id) => id === s.world.reserved.id,
    achieved: (s) => s.focus?.kind === 'planet' && s.focus.id === s.world.reserved.id,
  },

  /**
   * The Core first, because nothing else can be. A new planet holds the Core and
   * the Refinery both at 1, so `1 >= 1` refuses the first upgrade a commander
   * reaches for — and being told why is the first rule of the game they learn.
   */
  {
    id: 'core',
    panel: 'planet',
    group: 'grow',
    gate: {
      kind: 'element',
      selectors: ['#row-CORE [data-act]'],
      lit: ['[data-tab="grow"]', '#row-CORE [data-act]'],
    },
    achieved: (s) => s.world.buildings.CORE >= 2,
  },
  {
    id: 'refinery',
    panel: 'planet',
    group: 'grow',
    gate: {
      kind: 'element',
      selectors: ['#row-REFINERY [data-act]'],
      lit: ['[data-tab="grow"]', '#row-REFINERY [data-act]'],
    },
    achieved: (s) => s.world.buildings.REFINERY >= 2,
  },
  /** The third one empties the crystal exactly, which is the beat's whole line. */
  {
    id: 'extractor',
    panel: 'planet',
    group: 'grow',
    gate: {
      kind: 'element',
      selectors: ['#row-EXTRACTOR [data-act]'],
      lit: ['[data-tab="grow"]', '#row-EXTRACTOR [data-act]'],
    },
    achieved: (s) => s.world.buildings.EXTRACTOR >= 2,
  },

  /** What the leftover alloy was always for. */
  {
    id: 'fleet',
    panel: 'planet',
    group: 'reach',
    gate: {
      kind: 'element',
      /**
       * The row's control opens the build sheet, and BOTH stay live — gating only
       * the first would seal the player inside the very sheet it told them to
       * open. `[data-sheet-panel]` rather than the marker itself, because the
       * wrapper has no box of its own: its child is the sheet's `fixed inset-0`
       * root, and measuring the wrapper gives an empty rectangle.
       */
      selectors: ['#row-WASP [data-act]', '[data-build-sheet] [data-sheet-panel]'],
      /**
       * The light follows the DECISION rather than the surface: the tab, then the
       * row's control, then — once the sheet is up — the CEILING option, because
       * the grant buys exactly two and spending it one at a time is the one way to
       * get this beat wrong. Lighting the whole sheet instead lit nothing at all.
       */
      lit: [
        '[data-tab="reach"]',
        '#row-WASP [data-act]',
        '[data-build-sheet] [data-count-max]',
        // Resolves only once the ceiling is chosen, which is what moves the light
        // from "how many" to "do it" without a second beat to carry the change.
        '[data-build-sheet] [data-commit][data-ready]',
      ],
    },
    achieved: (s) => (s.world.fleet.WASP ?? 0) >= OPENING_WASPS,
  },

  /**
   * THE PREMISE, AND IT LANDS THE MOMENT BEFORE IT IS NEEDED.
   *
   * They tap somebody else's world and the rail tells them almost nothing: a name,
   * a tier, and no answer to the only question worth asking. It used to come
   * second, before the economy, and it had to move for a reason that turned out to
   * be the better argument as well as the necessary one:
   *
   *   · NECESSARY. Selecting your own world opens the planet surface and clears
   *     the selection (`GalaxyView`), so a beat that follows it wanting the disc
   *     slammed that surface shut in the same tick the player opened it. The beat
   *     after `yours` has to be one that WANTS the panel open.
   *   · BETTER. "You cannot see what they are holding" is the setup for "choose one
   *     anyway", and the two now sit next to each other. A stranger reads the fog
   *     as the reason the next decision is hard, rather than as a fact mentioned a
   *     minute earlier about somebody they have since forgotten.
   */
  {
    id: 'fog',
    panel: null,
    gate: { kind: 'disc' },
    worlds: (s) => (id) => id !== s.world.reserved.id,
    achieved: (s) => s.focus?.kind === 'planet' && s.focus.id !== s.world.reserved.id,
  },


  /**
   * The bet. The panel closes, the disc comes back, and the choice is made on the
   * only thing that is public — how developed a world is, and how far away.
   *
   * ONLY WORLDS INSIDE THE TIER BAND ARE LIVE, which is not the tutorial being
   * protective: it is the same rule the launch endpoint enforces, applied where
   * the player can see it rather than as a refusal after they have picked.
   */
  {
    id: 'target',
    panel: null,
    /**
     * THE GATE FOLLOWS THE COMMITMENT DOWN.
     *
     * Choosing is a tap on the disc, but SENDING is two surfaces deeper: the focus
     * rail carries the order and the launch sheet carries the fleet. Listing all
     * three shallow-to-deep leaves every step of the one decision live and nothing
     * else — and it is also what lets the light move with the player, since the
     * spotlight takes whichever of them is on top.
     */
    gate: {
      kind: 'element',
      /**
       * THE DISC, THE RAIL'S TOGGLE, THE ATTACK, AND THE SHEET — and nothing else
       * on the rail.
       *
       * A dossier offers a probe and a telescope beside the attack, and NEITHER is
       * affordable out of the opening grant: the three mandatory upgrades spend
       * every unit of crystal, and a probe costs fifty of it. Leaving them
       * pressable let a player buy something the rehearsal cannot honour and meet a
       * raw refusal on the one screen that is supposed to be teaching them.
       */
      selectors: [
        'canvas',
        '[data-focus-rail] button[aria-expanded]',
        '[data-focus-rail] [data-attack]',
        '[data-launch-sheet] [data-sheet-panel]',
      ],
      /**
       * THE LIGHT FOLLOWS THE RAIL OPEN.
       *
       * A rail arrives COLLAPSED — a name, what is known, and a toggle — and the
       * commitment is inside it. Lighting only the attack meant the rail itself sat
       * unmarked at the bottom of the screen with nothing to say it was the way in.
       * The two selectors are mutually exclusive by `aria-expanded`, so exactly one
       * of them resolves at a time and the light moves from "open this" to "press
       * this" without a second beat to carry the change.
       *
       * The canvas is deliberately not on this list: it is the surface the decision
       * is READ from, not a control.
       */
      lit: [
        '[data-focus-rail] button[aria-expanded="false"]',
        '[data-focus-rail] [data-attack]',
        '[data-launch-sheet] [data-sheet-panel]',
      ],
      // The disc IS the decision here; see `dim` on `GateTarget`.
      dim: false,
    },
    worlds: (s) => (id) => s.targets.includes(id),
    achieved: (s) => s.world.launch !== null,
  },

  /** The wall, at the one moment the player wants something. */
  { id: 'claim', panel: null, gate: { kind: 'open' } },
];

/**
 * Which beat is running.
 *
 * The first one that is not finished. Order is the script and there is no
 * branching in it: a beat that could be skipped would leave the next one talking
 * about something that never happened.
 */
export function currentBeat(s: BeatState): Beat {
  return BEATS.find((b) => !s.done.has(b.id)) ?? BEATS[BEATS.length - 1]!;
}

/**
 * Whether this beat's condition is now satisfied.
 *
 * Separated from `currentBeat` so the caller can record the achievement before
 * asking again — the conditions on `yours` and `fog` are true only while a
 * selection is HELD, and a beat that un-finished itself when the player tapped
 * away would be unplayable.
 */
export const beatAchieved = (beat: Beat, s: BeatState): boolean =>
  beat.achieved ? beat.achieved(s) : false;

/**
 * Which worlds this beat allows, as the canvas wants the question.
 *
 * A beat with no `worlds` allows none: during the three upgrades the disc is
 * behind an open panel and selecting anything there would close it.
 */
export const beatAllowsWorld = (beat: Beat, s: BeatState): ((id: string) => boolean) =>
  beat.worlds ? beat.worlds(s) : () => false;
