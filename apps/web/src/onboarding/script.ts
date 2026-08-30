import type { Focus } from '../galaxy/FocusPanel.jsx';
import type { PlanetGroup } from '../lib/directives.js';
import type { Panel } from '../screens/GalaxyView.jsx';
import { queuedCount, type RehearsalWorld } from './world.js';

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
 * other two introduce themselves when the player can afford them. D4 changes the
 * ending: the rehearsal stages paid queue commitments and never invents their
 * completion or an in-flight fleet before the server has created either one.
 */

export type BeatId =
  | 'wide'
  | 'yours'
  | 'briefing'
  | 'core'
  | 'refinery'
  | 'extractor'
  | 'fleet'
  | 'fog'
  | 'claim';

export interface BeatState {
  world: RehearsalWorld;
  focus: Focus | null;
  /** Beats already completed. A transient fact, once true, stays true. */
  done: ReadonlySet<BeatId>;
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
 * `open` — nothing is blocked. The claim dialog is the whole surface at that point.
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
       * FALSE WHEN THE WHOLE SURFACE IS THE DECISION. The rings still say where the
       * controls are.
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

/** How many Wasps the opening grant commits, exactly. Asserted in onboarding tests. */
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
   * THE FOUR MENUS, AS ONE PURPOSE.
   *
   * This is the missing sentence between finding a world and spending its stock:
   * upgrades are not the game, they prepare information, protection and reach for
   * the next irreversible fleet decision. It is a reading beat because no single
   * tap can honestly demonstrate all four relationships.
   */
  {
    id: 'briefing',
    panel: 'planet',
    group: 'grow',
    gate: { kind: 'disc' },
    worlds: () => () => false,
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
      selectors: ['#row-CORE [data-open-item]', '[data-item-sheet] [data-sheet-panel]'],
      lit: ['[data-tab="grow"]', '#row-CORE [data-open-item]', '[data-item-sheet] [data-act]'],
      dim: false,
    },
    achieved: (s) => queuedCount(s.world, 'CONSTRUCTION', 'BUILDING', 'CORE') >= 1,
  },
  {
    id: 'refinery',
    panel: 'planet',
    group: 'grow',
    gate: {
      kind: 'element',
      selectors: ['#row-REFINERY [data-open-item]', '[data-item-sheet] [data-sheet-panel]'],
      lit: ['[data-tab="grow"]', '#row-REFINERY [data-open-item]', '[data-item-sheet] [data-act]'],
      dim: false,
    },
    achieved: (s) => queuedCount(s.world, 'CONSTRUCTION', 'BUILDING', 'REFINERY') >= 1,
  },
  /** The third one empties the crystal exactly, which is the beat's whole line. */
  {
    id: 'extractor',
    panel: 'planet',
    group: 'grow',
    gate: {
      kind: 'element',
      selectors: ['#row-EXTRACTOR [data-open-item]', '[data-item-sheet] [data-sheet-panel]'],
      lit: ['[data-tab="grow"]', '#row-EXTRACTOR [data-open-item]', '[data-item-sheet] [data-act]'],
      dim: false,
    },
    achieved: (s) => queuedCount(s.world, 'CONSTRUCTION', 'BUILDING', 'EXTRACTOR') >= 1,
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
      selectors: ['#row-WASP [data-open-item]', '[data-build-sheet] [data-sheet-panel]'],
      /**
       * The light follows the DECISION rather than the surface: the tab, then the
       * row's control, then — once the sheet is up — the CEILING option, because
       * the grant buys exactly two and spending it one at a time is the one way to
       * get this beat wrong. Lighting the whole sheet instead lit nothing at all.
       */
      lit: [
        '[data-tab="reach"]',
        '#row-WASP [data-open-item]',
        '[data-build-sheet] [data-count-max]',
        // Resolves only once the ceiling is chosen, which is what moves the light
        // from "how many" to "do it" without a second beat to carry the change.
        '[data-build-sheet] [data-commit][data-ready]',
      ],
      dim: false,
    },
    achieved: (s) => queuedCount(s.world, 'YARD', 'HULL', 'WASP') >= OPENING_WASPS,
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
  /** The wall, once every opening resource has an honest queued destination. */
  { id: 'claim', panel: null, gate: { kind: 'open' } },
];

/**
 * Which beat is running.
 *
 * The first one that is not finished. Order is the script and no individual beat
 * branches: the global skip marks every guided beat complete and lands directly
 * on `claim`, rather than leaving a later instruction talking about something
 * that never happened.
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
