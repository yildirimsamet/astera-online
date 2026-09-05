import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetCount } from '@astera/rules';
import { useMining, usePending, useTraffic } from '../api/queries.js';
import type { Contact, MiningRun, PendingThread } from '../api/schemas.js';
import { threadKey } from '../galaxy/threadKey.js';
import type { CraftFocus } from '../galaxy/ownCraft.js';
import type { Focus } from '../galaxy/FocusPanel.js';
import i18n from '../i18n/index.js';
import { countdown, useNow } from '../lib/time.js';
import { FlightBar } from '../ui/FlightBar.js';
import {
  AttackIcon,
  DrillIcon,
  HomeworldIcon,
  IncomingIcon,
  ScanIcon,
  SendIcon,
  WarBannerIcon,
} from '../ui/icons/index.js';
import { Sheet } from '../ui/kit/index.js';

/**
 * WHAT THIS STRIP CAN ASK THE CAMERA TO LOOK AT. D162.
 *
 * Your own craft (a thread), your own drills (a run) — and, since the inbound
 * warning became pressable, somebody else's craft as a public CONTACT. The third
 * is not a craft you own, so it is not a `CraftFocus`; it is the same focus state
 * the disc already uses when a player taps a foreign fleet.
 */
export type StripFocus = CraftFocus | Extract<Focus, { kind: 'contact' }>;

/**
 * DESIGN LAW #1, made visible.
 *
 * "Every session must end with something in flight." A player can only act on
 * that if they can see it, so this strip is always on screen, counting down. Its
 * sheet is the complete owned-flight roster: mission threads and mining runs meet
 * here even though the API keeps them separate. When it is empty it says so
 * plainly — an empty strip is a prompt, not decoration.
 */
export function PendingStrip({ onFocus }: { onFocus?: (focus: StripFocus) => void }) {
  const { t } = useTranslation();
  const { data } = usePending();
  const mining = useMining();
  /**
   * THE DISC'S OWN CONTACT LIST, READ HERE FOR ONE THING ONLY. D162.
   *
   * An inbound warning carries no path, so the only way this strip can offer to
   * LOOK at the fleet coming for you is to check whether the caller's circles are
   * covering it — and the honest answer to that is the contact list itself, not a
   * second sight calculation on the client. Present means focusable; absent means
   * the row stays a statement.
   */
  const traffic = useTraffic();
  const now = useNow(1000);
  const threads = data?.pending ?? [];
  const runs = (mining.data?.runs ?? []).filter((run) => run.status !== 'done');
  const seen = traffic.data?.contacts ?? [];
  const [open, setOpen] = useState(false);

  const items: AirborneItem[] = [
    ...threads.map((thread, index): AirborneItem => ({
      key: `thread:${threadKey(thread, index)}`,
      title: title(thread),
      detail: incomingDetail(thread, contactFor(thread, seen)) ?? (thread.fleet
        ? t('pendingStrip.craftCount', { count: fleetCount(thread.fleet) })
        : t('pendingStrip.craftUnknown')),
      arrival: arrivalOf(thread),
      leg: thread.leg,
      incoming: thread.kind === 'incoming',
      engages: thread.kind === 'fleet' && thread.leg === 'outbound',
      mark: thread.kind,
      /*
        THE LEG'S OWN TWO INSTANTS, and null for an inbound attack — the server
        sends no `path` for somebody else's fleet, deliberately (D123), so there
        is no honest position to draw and `FlightBar` says so with a dashed track
        rather than inventing one.
      */
      span: thread.path
        ? { from: thread.path.departAt.getTime(), to: thread.path.arriveAt.getTime() }
        : null,
      /*
        TWO WAYS TO LOOK AT A CRAFT, AND AN INBOUND WARNING HAS THE SECOND. D162.

        Your own craft is focused by its thread. A warning has no path — the route
        is what Radar L5 does not sell — so it is focused through the CONTACT the
        disc is already drawing, and only when there is one. No contact, no
        control: the fog is enforced in the contact query, not here.
      */
      ...(thread.path
        ? { focus: { kind: 'thread' as const, key: threadKey(thread, index) } }
        : contactFor(thread, seen)
          ? { focus: { kind: 'contact' as const, id: thread.contactId! } }
          : {}),
    })),
    ...runs.map((run): AirborneItem => ({
      key: `run:${run.id}`,
      title: runTitle(run),
      detail: t('pendingStrip.drillCount', { count: run.craft }),
      arrival: runArrival(run),
      leg: run.status === 'returning' ? 'return' : 'outbound',
      incoming: false,
      engages: false,
      mark: run.targetKind === 'debris' ? 'salvage' : 'mining',
      /*
        A RUN HAS TWO LEGS AND THEY ARE DIFFERENT SPANS. Out is depart → arrive;
        home is arrive → `homeAt`, which is only set once the rock has been
        worked. Reusing the outbound span for the return would draw a craft
        already home the moment it started back.
      */
      span: run.status === 'returning'
        ? run.homeAt
          ? { from: run.arriveAt.getTime(), to: run.homeAt.getTime() }
          : null
        : { from: run.departAt.getTime(), to: run.arriveAt.getTime() },
      focus: { kind: 'run', id: run.id },
    })),
  ].sort((a, b) => a.arrival - b.arrival || a.key.localeCompare(b.key));

  const incoming = items.find((item) => item.incoming);
  const soonest = items[0];
  const shown = incoming ?? soonest;

  return (
    <>
      <button
        type="button"
        aria-label={t('pendingStrip.openFlights')}
        onClick={() => { setOpen(true); }}
        className={`w-full border-t px-2 py-2 text-left transition-colors hover:bg-raised/60 ${
          incoming ? 'border-alert/40 bg-alert/10' : 'border-line-soft bg-deep/80'
        }`}
      >
        {shown ? (
          <span className="flex items-center gap-2">
            {/*
              THE KIND, THEN THE NAME. A raid, a probe and a mining run were three
              sentences that differed only in wording; the glyph says which before
              the title is read, and it is the same glyph the notification, the
              report and the disc use for that act.
            */}
            <Mark of={shown.mark} incoming={shown.incoming} />
            <span className={`legend min-w-0 truncate ${incoming ? 'text-threat-ink' : ''}`}>
              {shown.title}
            </span>
            {/*
              THE LEG REPLACED ITS OWN LABEL. This slot held a hairline rule and,
              beside it, a chip reading OUTBOUND or RETURN — a spacer and a word
              where the same width can carry the actual journey. The marker's
              position is the progress and its direction is the leg, so the chip
              has nothing left to say that the picture does not.
            */}
            <span className="min-w-0 flex-1">
              <FlightBar
                progress={progressOf(shown.span, now)}
                direction={
                  shown.incoming ? 'incoming' : shown.leg === 'return' ? 'back' : 'out'
                }
                tone={incoming ? 'threat' : 'crystal'}
              />
            </span>
            <span className={`num text-caption whitespace-nowrap ${incoming ? 'text-threat-ink' : 'text-bone'}`}>
              {shown.arrival <= now && shown.engages
                ? t('pendingStrip.engaging')
                : countdown(shown.arrival - now)}
            </span>
            {items.length > 1 && (
              <span className="num text-label text-faint">
                {t('pendingStrip.more', { count: items.length - 1 })}
              </span>
            )}
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        ) : (
          <span className="flex items-center justify-between gap-2">
            <span className="legend text-faint">{t('pendingStrip.empty')}</span>
            <span aria-hidden className="text-faint">⌃</span>
          </span>
        )}
      </button>

      {open && (
        <Sheet
          eyebrow={t('pendingStrip.sheetEyebrow')}
          title={t('pendingStrip.sheetTitle')}
          onClose={() => { setOpen(false); }}
        >
          {items.length === 0 ? (
            <p className="pt-2 text-body text-dim">{t('pendingStrip.sheetEmpty')}</p>
          ) : (
            <div className="space-y-2 pt-2">
              {items.map((item) => {
                const focus = item.focus;
                const body = (
                  <>
                    <Mark of={item.mark} incoming={item.incoming} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="name min-w-0 flex-1 truncate text-bone">
                          {item.title}
                        </span>
                        <span
                          className={`num shrink-0 text-caption ${
                            item.incoming ? 'text-threat-ink' : 'text-crystal'
                          }`}
                        >
                          {countdown(item.arrival - now)}
                        </span>
                      </span>
                      {/*
                        THE JOURNEY, UNDER THE NAME AND ACROSS THE FULL ROW.

                        "12m" is the same string for a fleet two minutes from a
                        target and a fleet two minutes from home carrying the
                        loot, and those are opposite situations. The leg says
                        which, so the countdown finally means one thing.
                      */}
                      <span className="mt-1.5 block">
                        <FlightBar
                          progress={progressOf(item.span, now)}
                          direction={
                            item.incoming ? 'incoming' : item.leg === 'return' ? 'back' : 'out'
                          }
                          tone={item.incoming ? 'threat' : 'crystal'}
                        />
                      </span>
                      <span className="mt-1 block text-label text-faint">{item.detail}</span>
                    </span>
                    {focus && <span aria-hidden className="self-center text-faint">›</span>}
                  </>
                );
                return focus ? (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onFocus?.(focus);
                    }}
                    className="plate flex min-h-14 w-full items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                  >
                    {body}
                  </button>
                ) : (
                  <div key={item.key} className="plate flex min-h-14 items-start gap-2 px-3 py-3">
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

interface AirborneItem {
  key: string;
  title: string;
  detail: string;
  arrival: number;
  leg?: 'outbound' | 'return';
  incoming: boolean;
  engages: boolean;
  /** Which of the seven things this is, so the row can wear its own glyph. */
  mark: FlightMark;
  /** The leg's departure and arrival instants, or null where it is fogged. */
  span: { from: number; to: number } | null;
  focus?: StripFocus;
}

/**
 * WHAT KIND OF FLIGHT THIS IS, AS A PICTURE. Owner instruction.
 *
 * The roster listed a raid, a probe, a settlement fleet, a transfer, a Death
 * Star, a mining run and an inbound attack as seven grey sentences that differed
 * only in their wording — so the one question a player scanning the list has,
 * which is *what am I looking at*, was the one thing they had to read for. Each
 * now leads with the glyph the rest of the game already uses for that act.
 */
type FlightMark =
  | 'fleet' | 'probe' | 'incoming' | 'transfer' | 'settlement' | 'death_star'
  | 'mining' | 'salvage' | 'pirate' | 'trade';

const MARK: Record<FlightMark, (props: { className?: string }) => ReactNode> = {
  fleet: AttackIcon,
  probe: ScanIcon,
  incoming: IncomingIcon,
  transfer: SendIcon,
  settlement: HomeworldIcon,
  death_star: WarBannerIcon,
  mining: DrillIcon,
  salvage: DrillIcon,
  // A pirate raid IS a raid: same glyph, because the act is the same act and a
  // second symbol would say it is a different kind of commitment. D150.
  pirate: AttackIcon,
  // A convoy IS a transfer: cargo leaving a world under escort. Same reasoning as
  // the pirate line above — the glyph names the ACT, not the destination. D156.
  trade: SendIcon,
};

/**
 * HOW FAR ALONG, AS A FRACTION OF THIS LEG. Null where the leg is not knowable.
 *
 * Clamped at both ends: a payload can be a few seconds stale on either side of a
 * departure or an arrival, and a marker drawn past the end of its own track reads
 * as a bug rather than as a late read.
 */
const progressOf = (span: { from: number; to: number } | null, now: number): number | null => {
  if (!span) return null;
  const length = span.to - span.from;
  if (length <= 0) return 1;
  return Math.max(0, Math.min(1, (now - span.from) / length));
};

/**
 * ONE GLYPH IN A WELL, and the well is what makes it read as a subject rather
 * than as decoration. An inbound attack is the only one that takes threat red,
 * because it is the only one being done TO the commander.
 */
function Mark({ of, incoming }: { of: FlightMark; incoming: boolean }) {
  const Glyph = MARK[of];
  return (
    <span
      aria-hidden
      data-flight-mark-kind={of}
      className={`socket grid size-8 shrink-0 place-items-center rounded-control ${
        incoming ? 'socket-threat text-threat-ink' : 'text-dim'
      }`}
    >
      <Glyph className="size-4" />
    </span>
  );
}

/**
 * WHOSE FLIGHT THIS IS, SAID OUT LOUD.
 *
 * The strip is a permanent bar at the foot of the screen and the focus rail opens
 * directly above it, so the two stack into what reads as one panel — and this row's
 * countdown then reads as belonging to whatever the player has just tapped. Focus
 * anything that is NOT yours, which is most of the disc, and the strip was quietly
 * attributing your own fleet's clock to somebody else's craft.
 *
 * Every owned line therefore names the owner; the anonymous inbound warning is
 * the deliberate exception.
 */
/**
 * WHAT A DEFENDER'S RADAR HAS ACTUALLY BOUGHT THEM. D123.
 *
 * Three rungs, in the order the ladder sells them, and each one replaces the line
 * below it rather than adding to it: the roster at L5, the size band at L4, and
 * the bare warning available from L1. Returns null for anything that is not an inbound thread,
 * so an owned craft falls through to its own manifest — which is free, because you
 * packed it.
 */
const incomingDetail = (thread: PendingThread, seen: Contact | undefined): string | null => {
  if (thread.kind !== 'incoming') return null;
  const fleet = thread.fleet ?? seen?.fleet;
  if (fleet) return i18n.t('pendingStrip.craftCount', { count: fleetCount(fleet) });
  const mass = thread.mass ?? seen?.mass;
  if (mass === 'HEAVY') return i18n.t('pendingStrip.massHeavy');
  if (mass === 'MEDIUM') return i18n.t('pendingStrip.massMedium');
  if (mass === 'LIGHT') return i18n.t('pendingStrip.massLight');
  /*
    "ORIGIN HIDDEN BY FOG" IS ONLY TRUE OF A CRAFT NOBODY CAN SEE. D162.

    Owner report: the line kept saying the source was fogged while the fleet was
    plainly drawn on the disc — because the row only ever read the RADAR ladder's
    own fields and never the sight the commander already had. Where a circle is
    covering the craft, the honest line is that it is on the disc and can be looked
    at; the origin genuinely stays unsold, and the row no longer implies that the
    craft itself is unseen.
  */
  return i18n.t(seen ? 'pendingStrip.incomingVisible' : 'pendingStrip.incomingHint');
};

/**
 * THE CONTACT THIS WARNING IS ABOUT, IF ANY CIRCLE IS COVERING IT. D162.
 *
 * Matched on the mission uuid the two payloads share. It is the client's only
 * statement of "can I look at this", and it is a LOOKUP rather than a sight
 * calculation on purpose: the server decided what is visible, and a second opinion
 * about sight on this side is exactly what `sight.ts` exists to prevent.
 */
const contactFor = (
  thread: PendingThread,
  contacts: readonly Contact[],
): Contact | undefined => (thread.contactId === undefined
  ? undefined
  : contacts.find((c) => c.id === thread.contactId));

const title = (thread: PendingThread): string => {
  if (thread.kind === 'incoming') {
    /**
     * WHICH OF YOUR WORLDS, AND — AT RADAR L5 — WHERE FROM.
     *
     * The two are different products and they were collapsed into one. The origin
     * is the top of the radar ladder and stays there; the TARGET is your own world
     * and was simply missing, so a commander with four worlds was told a fleet was
     * six minutes out and could not tell which world to defend.
     *
     * `targetPlanetId` gates the pair rather than `targetName`, because the server
     * used to send the literal string "inbound fleet" in that field and a client
     * running against an older build must not print it.
     */
    const world = thread.targetPlanetId === undefined ? undefined : thread.targetName;
    if (world === undefined) {
      return thread.originName === undefined
        ? i18n.t('pendingStrip.incoming')
        : i18n.t('pendingStrip.incomingFrom', { origin: thread.originName });
    }
    return thread.originName === undefined
      ? i18n.t('pendingStrip.incomingAt', { world })
      : i18n.t('pendingStrip.incomingFromAt', { world, origin: thread.originName });
  }
  if (thread.kind === 'probe') return i18n.t('pendingStrip.probe', { target: thread.targetName });
  if (thread.kind === 'death_star') return i18n.t('pendingStrip.deathStar', { target: thread.targetName });
  if (thread.kind === 'settlement') return i18n.t('pendingStrip.settlement', { target: thread.targetName });
  if (thread.kind === 'transfer') return i18n.t('pendingStrip.transfer', { target: thread.targetName });
  /*
    THE MERCHANT IS NAMED FROM THE LOCALE FILES, never from `targetName`. D156.

    That field carries the stable event-kind identifier `TRADE_SHIP` — there is no
    world on the far end to borrow a name from — and printing a wire identifier at
    a player is the failure this branch exists to prevent.
  */
  if (thread.kind === 'trade') {
    return i18n.t(thread.leg === 'return' ? 'pendingStrip.tradeHome' : 'pendingStrip.tradeOut');
  }
  if (thread.kind === 'pirate') {
    /*
      NAMED FROM THE LEVEL AND THE CALLSIGN, never from a server sentence. There is
      no world on the far end to borrow a name from, and the copy that names a
      pirate belongs in the locale files like every other user-facing string.
    */
    const name = thread.pirate
      ? i18n.t('pirate.name', { level: thread.pirate.level, callsign: thread.pirate.callsign })
      : i18n.t('pirate.title');
    return i18n.t(
      thread.leg === 'return' ? 'pendingStrip.pirateHome' : 'pendingStrip.pirateOut',
      { target: name },
    );
  }
  return i18n.t(thread.leg === 'return' ? 'pendingStrip.fleetHome' : 'pendingStrip.fleetOut', {
    target: thread.targetName,
  });
};

const runTitle = (run: MiningRun): string => {
  if (run.status === 'returning') return i18n.t('pendingStrip.drillHome');
  if (run.targetKind === 'debris') return i18n.t('pendingStrip.salvageOut');
  return i18n.t('pendingStrip.drillOut');
};

const runArrival = (run: MiningRun): number =>
  (run.status === 'returning' ? run.homeAt ?? run.arriveAt : run.arriveAt).getTime();

/**
 * THE INSTANT ITSELF, not a figure rebuilt from a rounded one.
 *
 * This used to be `answeredAt + minutesRemaining * 60_000`, which is accurate to
 * within half a minute and no better. The attacker's own strip read the exact
 * `arriveAt` off the thread's path, and a defender — whose inbound thread has no
 * path, deliberately — got the reconstruction. So the two players watching the
 * same fleet counted down to instants up to thirty seconds apart, which reads as
 * the game being unable to agree with itself about when it will land.
 *
 * `answeredAt` is no longer needed at all: an absolute timestamp does not have to
 * be anchored to anything.
 */
export const arrivalOf = (thread: PendingThread): number => thread.arriveAt.getTime();
