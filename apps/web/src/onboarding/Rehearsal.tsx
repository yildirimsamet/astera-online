import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from '../api/client.js';
import { ApiProvider } from '../api/context.js';
import type { ClaimIntent, Preview } from '../api/schemas.js';
import type { Focus } from '../galaxy/FocusPanel.jsx';
import { describe } from '../ui/Toast.js';
import { hullLabel } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { GalaxyView, type Panel } from '../screens/GalaxyView.jsx';
import { PendingStrip } from '../shell/PendingStrip.js';
import { StatusBar } from '../shell/StatusBar.js';
import { BeatCard } from './BeatCard.jsx';
import { ClaimDialog } from './ClaimDialog.jsx';
import { Spotlight, useGate, usePlacement, useScrollIntoView } from './Gate.jsx';
import { rehearsalFetch } from './rehearsalFetch.js';
import {
  BEATS,
  beatAchieved,
  beatAllowsWorld,
  currentBeat,
  type BeatId,
  type BeatState,
} from './script.js';
import { openWorld, type RehearsalWorld } from './world.js';

/**
 * NINETY SECONDS OF THE REAL GAME, BEFORE THERE IS AN ACCOUNT. D56.
 *
 * THE SCREENS ARE NOT REBUILT. This renders the same `StatusBar`, the same
 * `GalaxyView`, the same `PlanetScreen` and the same focus rail the game does — it
 * simply hands them an `Api` whose `fetch` never leaves the device. A tutorial
 * built out of its own mock surfaces teaches an interface that does not exist, and
 * the first thing a player does after it is look for controls that were never
 * there.
 *
 * ITS OWN `QueryClient`, ON PURPOSE. Everything the rehearsal cached is a planet
 * that does not exist, and it must never be read by the session that follows. A
 * separate client is thrown away whole when this unmounts; sharing the app's and
 * clearing it afterwards is the same thing with a step somebody can forget.
 *
 * THE BEATS ARE DERIVED, NEVER STORED AS A CURSOR. `currentBeat` is a function of
 * the rehearsal's world and what the player has selected, so there is no
 * "tutorial step" to get out of sync with what is on screen — the same reasoning
 * as A5, applied to a state machine rather than to a database.
 *
 * AND ONE THING IS PRESSABLE AT A TIME. `useGate` cancels every activation outside
 * the beat's own target, so a step cannot be finished by pressing the wrong thing
 * and leaving an instruction on screen that no longer describes the world. See
 * `Gate.tsx` for why that is done by capturing events rather than by covering the
 * screen.
 */
/** Roughly how tall the beat card is with its controls. See `place` below. */
const CARD_BAND = 260;

/**
 * The neighbourhood range for “Learn first, risk later”.
 *
 * The opening overview shows the whole disc, but repeating that view here makes
 * the world the player must tap too small. Staying at the seven-unit Home range
 * has the opposite problem: the selected neighbour fills the view. Eighteen
 * keeps several nearby worlds readable while leaving the tapped world in context.
 */
const LEARN_FIRST_DISTANCE = 18;

export function Rehearsal({
  preview,
  onClaim,
  onSignIn,
  onLeave,
}: {
  preview: Preview;
  /**
   * Turn the rehearsal into a season: an account, a seat and the opening.
   *
   * IT IS THE SESSION'S CALL, NOT THIS COMPONENT'S. The `Api` in scope here is one
   * whose `fetch` never leaves the device — it would answer a claim with
   * `REHEARSAL_ONLY` — and even reaching the server through it would leave the
   * access token on a client the game is about to discard.
   */
  onClaim: (username: string, password: string, intents: readonly ClaimIntent[]) => Promise<void>;
  /** They already have a commander. The rehearsal is discarded. */
  onSignIn: () => void;
  /** Out, without an account. Back to the front door. */
  onLeave: () => void;
}) {
  const { t } = useTranslation();

  /**
   * THE WORLD LIVES IN A REF AND IS MIRRORED INTO STATE.
   *
   * The ref is what `rehearsalFetch` reads, and it has to be correct the instant
   * after a write — two upgrades pressed inside one frame would otherwise both
   * read the pre-render world and the second would be priced against a budget the
   * first already spent. State is only for rendering.
   */
  const worldRef = useRef<RehearsalWorld>(openWorld(preview));
  const [world, setWorld] = useState<RehearsalWorld>(worldRef.current);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [done, setDone] = useState<ReadonlySet<BeatId>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  /** Bumped once, by the opening beat's control, to fly in from the wide view. */
  const [goHome, setGoHome] = useState(0);

  /**
   * Skip the guided play, not the account claim it was leading toward.
   *
   * Marking the playable beats complete keeps this on the same derived state
   * machine as an ordinary finish. Any intents already staged remain intact, and
   * the final credentials dialog becomes the next (and only) unfinished beat.
   */
  const skipToClaim = useCallback((): void => {
    setDone(new Set(BEATS.filter(({ id }) => id !== 'claim').map(({ id }) => id)));
  }, []);

  const api = useMemo(
    () =>
      new Api({
        fetch: rehearsalFetch(
          () => ({ preview, world: worldRef.current }),
          (next) => {
            worldRef.current = next;
            setWorld(next);
          },
        ),
      }),
    [preview],
  );

  /**
   * Retries are off inside a rehearsal.
   *
   * Every answer is computed locally and synchronously, so a failure is a refusal
   * the player caused — asking again cannot change it, and a retry only delays the
   * message.
   */
  const client = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [preview],
  );

  const state: BeatState = { world, focus, done };
  const beat = currentBeat(state);

  /**
   * Record a beat the moment its condition is met.
   *
   * The conditions on `yours` and `fog` are true only while a selection is HELD,
   * so the achievement has to be written down rather than re-derived — a beat that
   * un-finished itself when the player tapped somewhere else would be unplayable.
   */
  useEffect(() => {
    // Idempotent, and deliberately so: this effect has no dependency list — the
    // conditions read a whole state object — so it runs on every render, and
    // `new Set(previous)` is never `Object.is` to the old one. Without the guard a
    // beat whose condition stayed true would set state forever.
    if (done.has(beat.id)) return;
    if (!beatAchieved(beat, state)) return;
    setDone((previous) => new Set(previous).add(beat.id));
  });

  /** Each beat opens the surface it is about; the player is free after that. */
  useEffect(() => {
    setPanel(beat.panel);
  }, [beat.id, beat.panel]);

  /* ── the gate ─────────────────────────────────────────────── */

  /**
   * The one element that is live, resolved fresh on every check.
   *
   * A selector rather than a ref because the target lives inside `PlanetScreen`,
   * which the rehearsal renders but does not own — reaching a ref through it would
   * mean threading a callback through four components for a tutorial's benefit.
   */
  const resolve = (selectors: readonly string[]): readonly Element[] =>
    selectors
      .map((selector) => document.querySelector(selector))
      .filter((el): el is Element => el !== null);

  /**
   * ONLY THE TOPMOST SURFACE IS LIT.
   *
   * A beat's list spans more than one layer on purpose — the tab, the row's
   * control, and then whatever that control opened. All of them keep RESOLVING
   * once the sheet is up, so the rings for the two underneath were drawn over the
   * sheet covering them: two lights floating on a surface they belong nowhere near.
   *
   * Sheets NEST — the build sheet renders inside the planet panel — so "topmost"
   * is the deepest `[data-sheet-panel]` in the tree, not the last one in document
   * order. With no sheet open the whole list stands, which is the disc's case.
   */
  const inTopSurface = (found: readonly Element[]): readonly Element[] => {
    const panels = [...document.querySelectorAll('[data-sheet-panel]')];
    if (panels.length === 0) return found;
    const depth = (el: Element): number => {
      let n = 0;
      for (let at = el.parentElement; at; at = at.parentElement) n += 1;
      return n;
    };
    const top = panels.reduce((deepest, panel) =>
      depth(panel) > depth(deepest) ? panel : deepest,
    );
    const inside = found.filter((el) => top.contains(el));
    return inside.length > 0 ? inside : found;
  };

  /** What may be pressed. */
  const gateTargets = useCallback((): readonly Element[] => {
    const gate = beat.gate;
    if (gate.kind === 'open') return [document.body];
    if (gate.kind === 'disc') {
      const canvas = document.querySelector('canvas');
      return canvas ? [canvas] : [];
    }
    return resolve(gate.selectors);
  }, [beat]);

  /** What is lit. Narrower than what is allowed, wherever the two differ. */
  const litTargets = useCallback((): readonly Element[] => {
    const gate = beat.gate;
    if (gate.kind !== 'element') return [];
    return inTopSurface(resolve(gate.lit ?? gate.selectors));
  }, [beat]);

  /**
   * A refused press pulses the card rather than doing nothing.
   *
   * Silence reads as a broken button, and a stranger's first conclusion about a
   * broken button is that the game is broken. One nudge per press, pointing at
   * the sentence that says what to do instead.
   */
  const [nudge, setNudge] = useState(0);
  const refuse = useCallback(() => {
    setNudge((n) => n + 1);
  }, []);

  useGate(gateTargets, beat.gate.kind !== 'open', refuse);

  /**
   * And put it where the player can see it. The subject is the LAST lit target,
   * which is the one the beat is actually asking for.
   */
  const subject = useCallback((): Element | null => {
    const found = litTargets();
    return found.length > 0 ? (found[found.length - 1] ?? null) : null;
  }, [litTargets]);
  useScrollIntoView(subject, beat.id);

  /**
   * WHICH EDGE THE CARD SITS ON, decided by where the live target actually is.
   *
   * Two questions: is there anything to be in the way of — a target that fills the
   * screen is the disc itself, and the card belongs where it always is — and would
   * the card land on it, measured against the band the card actually occupies. An
   * open SHEET settles it outright: its commitment lives on the bottom edge, and no
   * threshold gets that right for every sheet height.
   */
  const place = usePlacement(litTargets, CARD_BAND);

  /**
   * Which worlds the disc will accept a tap on, right now.
   *
   * STABLE IDENTITY, LIVE VALUES. Anything that renders the disc takes stable
   * props — `GalaxyView` holds a clock and re-renders on a timer whether or not
   * the galaxy moved, so a predicate rebuilt every render is a new prop on the
   * heaviest component in the app several times a second. The ref carries the
   * current beat to a callback that never changes.
   */
  const live = useRef({ beat, state });
  live.current = { beat, state };
  const allowFocus = useCallback(
    (id: string) => beatAllowsWorld(live.current.beat, live.current.state)(id),
    [],
  );

  const claim = useCallback(
    async (username: string, password: string): Promise<void> => {
      setRefusal(undefined);
      try {
        await onClaim(username, password, worldRef.current.intents);
      } catch (err) {
        setRefusal(describe(err));
        throw err;
      }
    },
    [onClaim],
  );

  const alone = !preview.galaxy.planets.some((planet) => !planet.isSelf && planet.owner !== '');
  const copy = COPY[wording(beat.id, alone)];
  const step = BEATS.findIndex((b) => b.id === beat.id);

  /**
   * Every figure a beat can name, resolved once.
   *
   * Numbers go through `format.ts` rather than into the string raw: `1.234` and
   * `1,234` are different numbers in the two languages this game ships in (D55).
   */
  const values = {
    shard: preview.shard.name,
    name: preview.reserved.name,
    planets: full(preview.shard.planets),
    capacity: full(preview.shard.capacity),
    free: full(Math.max(0, preview.shard.capacity - preview.shard.planets)),
    online: full(preview.shard.online),
    alloy: full(world.alloy),
    crystal: full(world.crystal),
    /**
     * The ship's name from the glossary rather than typed into the sentence.
     *
     * It was typed in, and the Turkish copy called a Wasp "Yaban Arısı" while the
     * rest of the game — and the row the beat is pointing at — called it Atmaca.
     * A name that exists in two places is a name that disagrees with itself.
     */
    ship: hullLabel('DART'),
  };

  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        {/**
         * EVERYTHING THE REHEARSAL DRAWS LIVES IN ONE STACKING CONTEXT. D56.
         *
         * This wrapper is `relative z-10`, which MAKES one — so every z-index
         * inside it is measured against its siblings and not against the page. The
         * beat card sat outside it at `z-50` and therefore painted over the whole
         * subtree, loading cover included: the cover is `z-[60]`, but sixty inside
         * a box at ten still loses to fifty outside it. Raising the number would
         * have fixed the symptom and left the trap for the next overlay.
         */}
        <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
          <StatusBar
            commander={preview.reserved.name}
            onOpen={setPanel}
            onFocusPlanet={(planetId) => { void planetId; }}
          />

          <main className="relative flex-1">
            <GalaxyView
              showChat={false}
              panel={panel}
              onPanel={setPanel}
              commander={preview.reserved.name}
              onSignOut={onLeave}
              onFocused={setFocus}
              openWide={beat.id === 'wide' || beat.id === 'fog'}
              {...(beat.id === 'fog' ? { wideDistance: LEARN_FIRST_DISTANCE } : {})}
              allowFocus={allowFocus}
              goHome={goHome}
              {...(beat.group ? { planetGroup: beat.group } : {})}
            />
          </main>

          <div className="shrink-0">
            <PendingStrip />
          </div>

        {/* The light on the one live control. Never over the disc — see `Spotlight`. */}
        {beat.gate.kind === 'element' && (
          <Spotlight targets={litTargets} dim={beat.gate.dim ?? true} />
        )}

        {beat.id !== 'claim' && (
          <BeatCard
            title={t(copy.title, values)}
            line={t(copy.line, values)}
            {...('action' in copy
              ? {
                  action: t(copy.action),
                  onAction: () => {
                    // The opening beat's control is also the one camera move the
                    // rehearsal makes: it flies the player in from the wide view.
                    if (beat.id === 'wide') setGoHome((n) => n + 1);
                    setDone((previous) => new Set(previous).add(beat.id));
                  },
                }
              : {})}
            progress={{ step, total: BEATS.length }}
            nudge={nudge}
            {...(beat.id === 'briefing'
              ? {
                  concept: {
                    steps: [
                      t('onboarding.beats.briefing.mapGrow'),
                      t('onboarding.beats.briefing.mapIntel'),
                      t('onboarding.beats.briefing.mapDefend'),
                      t('onboarding.beats.briefing.mapReach'),
                    ],
                    outcome: t('onboarding.beats.briefing.mapOutcome'),
                  },
                }
              : {})}
            place={place}
            skipLabel={t('onboarding.skip')}
            onSkip={skipToClaim}
            secondary={t('onboarding.haveAccount')}
            onSecondary={onSignIn}
          />
        )}

        {beat.id === 'claim' && (
          <ClaimDialog
            planetName={preview.reserved.name}
            onClaim={claim}
            onSignIn={onSignIn}
            {...(refusal === undefined ? {} : { error: refusal })}
          />
        )}
        </div>
      </ApiProvider>
    </QueryClientProvider>
  );
}

/**
 * Which copy a beat uses, once the state of the galaxy is taken into account.
 *
 * Only two beats have a second version, and both are the ones that talk about
 * other people: what to say when there are none.
 */
type Wording = BeatId | 'fogAlone';

function wording(id: BeatId, alone: boolean): Wording {
  if (!alone) return id;
  if (id === 'fog') return 'fogAlone';
  return id;
}

/**
 * EVERY KEY WRITTEN OUT, RATHER THAN BUILT FROM THE BEAT'S NAME.
 *
 * A template — `onboarding.beats.${id}.action` — compiles to a union that includes
 * keys which do not exist, and the typed `t()` is what catches it. Spelling them
 * out costs a dozen lines and buys the guarantee that every beat on this list has
 * copy in both languages, checked at build time rather than by a missing string
 * appearing on a stranger's first screen.
 *
 * A BEAT WITH AN `action` IS A BEAT WITH NOTHING TO DO. The presence of the key IS
 * the rule: a beat the player can finish by playing must never carry a control
 * beside it, because a "next" is an invitation to read the tutorial instead of
   * doing the thing. The wide opening and an empty galaxy's fog sentence qualify.
 */
const COPY = {
  wide: {
    title: 'onboarding.beats.wide.title',
    line: 'onboarding.beats.wide.line',
    action: 'onboarding.beats.wide.action',
  },
  yours: { title: 'onboarding.beats.yours.title', line: 'onboarding.beats.yours.line' },
  briefing: {
    title: 'onboarding.beats.briefing.title',
    line: 'onboarding.beats.briefing.line',
    action: 'onboarding.beats.briefing.action',
  },
  fog: { title: 'onboarding.beats.fog.title', line: 'onboarding.beats.fog.line' },
  fogAlone: {
    title: 'onboarding.beats.fogAlone.title',
    line: 'onboarding.beats.fogAlone.line',
    action: 'onboarding.beats.fogAlone.action',
  },
  core: { title: 'onboarding.beats.core.title', line: 'onboarding.beats.core.line' },
  refinery: {
    title: 'onboarding.beats.refinery.title',
    line: 'onboarding.beats.refinery.line',
  },
  extractor: {
    title: 'onboarding.beats.extractor.title',
    line: 'onboarding.beats.extractor.line',
  },
  fleet: { title: 'onboarding.beats.fleet.title', line: 'onboarding.beats.fleet.line' },
  /** The claim beat has no card: the dialog is the whole of it. */
  claim: { title: 'onboarding.beats.fleet.title', line: 'onboarding.beats.fleet.line' },
} as const satisfies Record<Wording, { title: string; line: string; action?: string }>;
