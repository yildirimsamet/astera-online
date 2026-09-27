import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetCount } from '@astera/rules';
import {
  useMining,
  usePending,
  useRecallMining,
  useRecallFlight,
  useTraffic,
} from '../api/queries.js';
import { threadKey } from '../galaxy/threadKey.js';
import {
  arrivalOf,
  contactFor,
  flightFocus,
  flightTitle,
  incomingDetail,
  runArrival,
  runTitle,
  type FlightFocus,
} from '../lib/flights.js';
import { legProgress } from '../lib/fleetPage.js';
import { countdown, useNow } from '../lib/time.js';
import { FlightBar } from '../ui/FlightBar.js';
import {
  AttackIcon,
  DrillIcon,
  HomeworldIcon,
  IncomingIcon,
  ReturnedIcon,
  ScanIcon,
  SendIcon,
  WarBannerIcon,
} from '../ui/icons/index.js';
import { Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * WHAT THIS STRIP CAN ASK THE CAMERA TO LOOK AT. D162.
 *
 * Your own craft (a thread), your own drills (a run) — and, since the inbound
 * warning became pressable, somebody else's craft as a public CONTACT. The third
 * is not a craft you own, so it is not a `CraftFocus`; it is the same focus state
 * the disc already uses when a player taps a foreign fleet.
 */
export type StripFocus = FlightFocus;

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
  const { items, now } = useAirborne();
  const [open, setOpen] = useState(false);

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
                progress={legProgress(shown.span, now)}
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
          <FlightList
            onFocus={(focus) => { onFocus?.(focus); }}
            onDone={() => { setOpen(false); }}
          />
        </Sheet>
      )}
    </>
  );
}

/**
 * EVERYTHING OF YOURS IN THE AIR, AND THE ENEMY COMING FOR YOU, SOONEST FIRST.
 *
 * Mission threads and mining runs meet here even though the API keeps them
 * separate. Read by the strip and by the v2 Fleet page, so both list the same rows.
 */
export function useAirborne(): { items: AirborneItem[]; now: number } {
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

  const items: AirborneItem[] = [
    ...threads.map((thread, index): AirborneItem => {
      const focus = flightFocus(thread, index, seen);
      return {
        key: `thread:${threadKey(thread, index)}`,
        title: flightTitle(thread),
        detail: incomingDetail(thread, contactFor(thread, seen)) ?? (thread.fleet
          ? t('pendingStrip.craftCount', { count: fleetCount(thread.fleet) })
          : t('pendingStrip.craftUnknown')),
        arrival: arrivalOf(thread),
        leg: thread.leg,
        ...(thread.pace === undefined ? {} : { pace: thread.pace }),
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
        ...(focus ? { focus } : {}),
        /*
          THE SERVER'S WORD, NOT A GUESS. `recallable` is only ever set on a transfer or a raid (K8)
          that is still turnable on this tick, and never twice.
        */
        ...(thread.recallable === true && thread.id !== undefined
          ? { recallMission: { missionId: thread.id } }
          : {}),
      };
    }),
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
      ...(run.status === 'outbound' && run.recalledAt === null && run.arriveAt.getTime() > now
        ? { recall: { runId: run.id, originPlanetId: run.planetId } }
        : {}),
    })),
  ].sort((a, b) => a.arrival - b.arrival || a.key.localeCompare(b.key));
  return { items, now };
}

/**
 * THE FLIGHT ROSTER: each row focusable where there is something to look at, and
 * the recall on the rows that can still be called back. `onDone` closes whatever
 * sheet holds the list before the camera moves.
 */
export function FlightList({ onFocus, onDone }: { onFocus: (focus: StripFocus) => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { items, now } = useAirborne();
  const recall = useRecallMining();
  const recallFleet = useRecallFlight();
  const say = useToast();

  return (
    <>
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
                    progress={legProgress(item.span, now)}
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
          /*
            THE SAME ROW, FOR THE SAME ACT. A commander who has learned to pull a drill back
            should not have to learn a second control to pull a squadron back, so the fleet
            recall wears the Prospector recall's shape — one glyph, one label, one tap, on
            the screen they are already looking at when a raid is inbound.
          */
          const recallMission = item.recallMission;
          if (recallMission) {
            return (
              <div key={item.key} className="plate flex min-h-14 w-full items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    onDone();
                    if (focus) onFocus(focus);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                >
                  {body}
                </button>
                <button
                  type="button"
                  aria-label={t('pendingStrip.recallFleet')}
                  disabled={recallFleet.isPending}
                  onClick={() => {
                    recallFleet.mutate(recallMission, {
                      onSuccess: () => { say(t('pendingStrip.recallFleetStarted')); },
                      onError: (error) => { say(describe(error), 'error'); },
                    });
                  }}
                  className="flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-line-soft px-3 text-label text-alloy transition-colors hover:bg-alloy/[0.06] disabled:opacity-50"
                >
                  <ReturnedIcon className="size-4" />
                  {recallFleet.isPending
                    ? t('pendingStrip.recallingFleet')
                    : t('pendingStrip.recallFleet')}
                </button>
              </div>
            );
          }
          const recallInput = item.recall;
          if (recallInput) {
            return (
              <div key={item.key} className="plate flex min-h-14 w-full items-stretch">
                <button
                  type="button"
                  onClick={() => {
                    onDone();
                    if (focus) onFocus(focus);
                  }}
                  className="flex min-w-0 flex-1 items-start gap-2 px-3 py-3 text-left transition-colors hover:bg-bone/[0.03] active:bg-raised/60"
                >
                  {body}
                </button>
                <button
                  type="button"
                  aria-label={t('pendingStrip.recallProspectors')}
                  disabled={recall.isPending}
                  onClick={() => {
                    recall.mutate(recallInput, {
                      onSuccess: () => {
                        say(t('pendingStrip.recallStarted'));
                      },
                      onError: (error) => {
                        say(describe(error), 'error');
                      },
                    });
                  }}
                  className="flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-l border-line-soft px-3 text-label text-alloy transition-colors hover:bg-alloy/[0.06] disabled:opacity-50"
                >
                  <ReturnedIcon className="size-4" />
                  {recall.isPending
                    ? t('pendingStrip.recallingProspectors')
                    : t('pendingStrip.recallProspectors')}
                </button>
              </div>
            );
          }
          return focus ? (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                onDone();
                onFocus(focus);
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
    </>
  );
}

export interface AirborneItem {
  key: string;
  title: string;
  detail: string;
  arrival: number;
  leg?: 'outbound' | 'return';
  /** The pace this leg flies at, 1 = full speed; your own threads only (S1). */
  pace?: number;
  incoming: boolean;
  engages: boolean;
  /** Which of the seven things this is, so the row can wear its own glyph. */
  mark: FlightMark;
  /** The leg's departure and arrival instants, or null where it is fogged. */
  span: { from: number; to: number } | null;
  focus?: StripFocus;
  recall?: { runId: string; originPlanetId: string | undefined };
  /** A transfer the SERVER says may still be turned around. Owner decision, 2026-09-21. */
  recallMission?: { missionId: string };
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
export type FlightMark =
  | 'fleet' | 'probe' | 'incoming' | 'transfer' | 'settlement' | 'death_star'
  | 'mining' | 'salvage' | 'pirate' | 'trade' | 'intergalactic_convoy';

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
  intergalactic_convoy: AttackIcon,
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
