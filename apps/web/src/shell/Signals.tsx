import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarkSeen, useNotifications, usePlanet } from '../api/queries.js';
import type { NotificationView, PlanetView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { describeNotification, isAlarming, notificationIdentity } from '../lib/notifications.js';
import { useProjected, type Projected } from '../lib/projection.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { Sheet } from '../ui/kit/index.js';
import type { Panel, PanelStop } from '../screens/GalaxyView.jsx';
import { serverNow } from '../lib/clock.js';
import {
  AlloyIcon,
  BellIcon,
  CrystalIcon,
  DisruptedIcon,
  IncomingIcon,
  RaidedIcon,
  RefineryIcon,
  ReturnedIcon,
  ScanIcon,
  UnlockIcon,
} from '../ui/icons/index.js';

/**
 * SIGNALS — everything the galaxy said while you were not reading.
 *
 * Two kinds of thing live here, and the difference is the point.
 *
 * EVENTS happened at a moment and are gone: a fleet landed, a probe was caught,
 * your ships came home. They carry an unseen count, because a number that goes to
 * zero is the only honest badge.
 *
 * STATUS is true right now and will stay true until the player acts: a full store
 * wasting production, a planet with its works knocked offline. These never enter
 * the count — a badge that can never be cleared teaches people to ignore badges —
 * and instead put a ring on the beacon for as long as they hold.
 *
 * What is deliberately NOT here, per `game-design.md`: streaks, login bonuses, "we
 * miss you", and anything else that exists to manufacture a reason to open the
 * app. Nothing in this list is ever pushed out of the game either. If the player
 * has no reason to come back, the fix is the game, not the reminder.
 */

export interface Status {
  kind: 'disrupted' | 'works-full' | 'alloy-full' | 'crystal-full';
  tone: 'threat' | 'alloy' | 'crystal';
  line: string;
  detail: string;
  go?: Panel;
}

export function Signals({
  onOpen,
  onFocusPlanet,
}: {
  onOpen: (panel: Panel, stop?: PanelStop) => void;
  onFocusPlanet: (planetId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  /**
   * WHAT WAS NEW WHEN YOU OPENED IT.
   *
   * Marking read is optimistic — the player HAS read them, and a badge that waits
   * for a round trip to clear is a badge that looks stuck. But the rows are drawn
   * from the same data, so the optimism greyed out every line in the same frame
   * the sheet appeared, and the one question the surface exists to answer — WHICH
   * of these is new — was unanswerable by the time it could be asked.
   *
   * The count comes from the live data and clears at once. The highlighting comes
   * from this snapshot and holds until the sheet is closed.
   */
  const [justRead, setJustRead] = useState<ReadonlySet<string>>(new Set());
  const { data } = useNotifications();
  const planet = usePlanet();
  const markSeen = useMarkSeen();
  const now = useNow(30_000);
  // Stock is projected forward between fetches, so "almost full" is judged
  // against what the player is actually holding rather than what we last read.
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 5000);

  /**
   * Only what this build can actually put into words.
   *
   * A kind from a newer server renders nothing, so counting it would light a
   * badge that reading cannot clear — and a badge that cannot be cleared is how
   * players learn to ignore badges. It is still marked seen when the sheet opens,
   * for the same reason.
   */
  const events = useMemo(
    () => (data?.notifications ?? []).filter((n) => describeNotification(n, now) !== null),
    [data, now],
  );
  const groups = useMemo(() => group(events), [events]);
  const unseen = events.filter((n) => !n.seen).length;
  const status = planet.data ? statusOf(planet.data, held) : [];

  return (
    <>
      <button
        type="button"
        aria-label={unseen > 0 ? t('signals.beaconUnread', { count: unseen }) : t('signals.beacon')}
        onClick={() => {
          haptic('tap');
          setOpen(true);
          // Opening is what marks them read. Loading the app is not: a player who
          // starts the game and immediately closes it has not been told anything.
          //
          // Every unseen id in the payload, not only the ones this build can
          // describe — a row nobody can be shown must not hold the badge open.
          const fresh = (data?.notifications ?? []).filter((n) => !n.seen).map((n) => n.id);
          setJustRead(new Set(fresh));
          if (fresh.length > 0) markSeen.mutate(fresh);
        }}
        /**
         * UNREAD IS LOUD. Owner decision.
         *
         * The beacon used to differ from its resting state by a faintly tinted
         * glyph, which on a phone in daylight is no difference at all — the one
         * control whose whole job is to say "something happened while you were
         * away" was the quietest thing in the header.
         *
         * Unread now takes the threat colour and pulses. Status alone (a full
         * works, a disrupted planet) stays warm and still: it is true rather than
         * new, and a badge that can never be cleared teaches people to ignore
         * badges.
         */
        className={`relative flex size-11 items-center justify-center rounded-chip border transition-colors ${
          unseen > 0
            ? 'border-threat/70 bg-threat/15 motion-safe:animate-pulse'
            : status.length > 0
              ? 'border-alloy/50 bg-alloy/10'
              : 'border-line-soft bg-deep hover:border-line'
        }`}
      >
        <Beacon lit={unseen > 0} />
        {unseen > 0 && (
          <>
            {/* A halo outside the button, so the pulse is visible against the
                header's own gradient rather than only inside the border. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-1 rounded-chip bg-threat/20 blur-[6px] motion-safe:animate-pulse"
            />
            <span className="num absolute -right-1 -top-1 min-w-[16px] rounded-full bg-threat px-1 text-center text-micro leading-4 text-bone shadow-[0_0_8px_rgba(224,138,124,0.9)]">
              {unseen > 9 ? '9+' : unseen}
            </span>
          </>
        )}
      </button>

      {open && (
        <Sheet
          eyebrow={
            unseen > 0 ? t('signals.eyebrowUnread', { count: unseen }) : t('signals.eyebrowRead')
          }
          title={t('signals.title')}
          onClose={() => {
            setOpen(false);
            setJustRead(new Set());
          }}
        >
          {status.length > 0 && (
            <div className="mb-6 mt-4">
              <p className="legend mb-2">{t('signals.statusHeading')}</p>
              <div className="plate plate-inset">
                {status.map((item) => (
                  <button
                    key={item.line}
                    type="button"
                    disabled={!item.go}
                    onClick={() => {
                      if (!item.go) return;
                      onOpen(item.go);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-3 border-b border-line-soft p-3 text-left last:border-b-0"
                  >
                    <span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-chip border ${ item.tone === 'threat' ? 'border-threat/45 bg-threat/10 text-threat' : item.tone === 'alloy' ? 'border-alloy/35 bg-alloy/10 text-alloy' : 'border-crystal/35 bg-crystal/10 text-crystal' }`} aria-hidden>
                      <StatusGlyph kind={item.kind} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body text-bone">{item.line}</span>
                      <span className="mt-1 block text-caption text-faint">{item.detail}</span>
                    </span>
                    {item.go && (
                      <span aria-hidden className="shrink-0 text-body text-faint">
                        →
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="legend mb-2">{t('signals.eventsHeading')}</p>
          {events.length === 0 ? (
            <div className="grid justify-items-center gap-3 border border-dashed border-line-soft px-6 py-8 text-center text-dim">
              <BellIcon className="size-10 text-faint" />
              <p className="max-w-[28ch] text-body leading-relaxed">{t('signals.empty')}</p>
            </div>
          ) : (
            <div className="plate plate-inset">
              {groups.map((entry) => (
                <Event
                  key={entry.event.id}
                  event={entry.event}
                  repeats={entry.repeats}
                  unread={!entry.event.seen || justRead.has(entry.event.id)}
                  now={now}
                  onGo={(panel, stop) => {
                    onOpen(panel, stop);
                    setOpen(false);
                  }}
                  onFocusPlanet={(planetId) => {
                    setOpen(false);
                    onFocusPlanet(planetId);
                  }}
                />
              ))}
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

/**
 * WHERE EACH KIND OF NEWS IS ACTUALLY DEALT WITH — AND WHICH SHELF. D121.
 *
 * A panel was not a complete answer. The Intel centre holds two lists, so every
 * one of these landed on the probe list: "you were raided" opened the right room
 * and then showed the reader somebody else's scouting. `stop` is the shelf, and
 * it is only meaningful for `intel` because it is the only panel with two.
 *
 * FIVE KINDS USED TO HAVE NOWHERE TO GO AT ALL. A Death Star resolving, a colony
 * taken, a colony lost, a settlement landing, a settlement lost — the most
 * consequential things that can happen to a commander — rendered as rows with no
 * way in, because the map was written before those kinds existed and nothing
 * failed when they were added. A missing entry is silent by construction, which
 * is why the exhaustiveness of this map is asserted in `notification-routes.test`.
 */
export const DESTINATION: Record<string, { panel: Panel; stop?: PanelStop }> = {
  // Something is coming: spend the stock, build a gun, get the fleet out.
  incoming_fleet: { panel: 'planet' },
  strategic_incoming: { panel: 'planet' },
  fleet_returned: { panel: 'planet' },
  // Everything that is a READING goes where readings live — the battle report
  // behind a raid, the radar log behind a scan, the report behind a probe.
  raided: { panel: 'intel', stop: 'battles' },
  raid_result: { panel: 'intel', stop: 'battles' },
  death_star_result: { panel: 'intel', stop: 'battles' },
  // The radar log is its own section further down the same screen, and the probe
  // list is the shelf it sits under.
  scan_detected: { panel: 'intel', stop: 'probes' },
  probe_report: { panel: 'intel', stop: 'probes' },
  unlock: { panel: 'intel', stop: 'probes' },
  /*
    A WORLD CHANGED HANDS. The planet panel is where a commander's worlds are
    managed and where a newly won or newly lost one is either developed or
    mourned; the disc behind it is already showing the change.
  */
  colony_captured: { panel: 'planet' },
  settlement_success: { panel: 'planet' },
  colony_lost: { panel: 'planet' },
  settlement_lost: { panel: 'planet' },
};

/**
 * IDENTICAL NEWS, COLLAPSED. D45.
 *
 * The overlay this list replaced said "3 scans detected" on one line. Signals said
 * it three times, in the same words, and a run of eleven — which is what a night
 * under a determined neighbour's probes looks like — pushed everything else off
 * the screen. `game-design.md` calls that a wall of logs and forbids it.
 *
 * Only adjacent runs of the same kind fold, and only for kinds whose sentence
 * carries no figures of its own. Anything with a number in it says something
 * different every time and must stay on its own line.
 */
const FOLDABLE = new Set(['scan_detected']);

interface Group {
  event: NotificationView;
  repeats: number;
}

export function group(events: readonly NotificationView[]): Group[] {
  const out: Group[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    if (last && FOLDABLE.has(event.kind) && last.event.kind === event.kind) {
      last.repeats += 1;
      // The newest of a run keeps the row, and its unseen state is the run's:
      // one unread scan in a fold of five must not read as already handled.
      if (!event.seen) last.event = { ...last.event, seen: false };
      continue;
    }
    out.push({ event, repeats: 1 });
  }
  return out;
}

function Event({
  event,
  repeats,
  unread,
  now,
  onGo,
  onFocusPlanet,
}: {
  event: NotificationView;
  repeats: number;
  /** New in THIS reading — see `justRead`. Not simply `!event.seen`. */
  unread: boolean;
  now: number;
  onGo: (panel: Panel, stop?: PanelStop) => void;
  onFocusPlanet: (planetId: string) => void;
}) {
  const line = describeNotification(event, now);
  if (!line) return null;
  const bad = isAlarming(event);
  const destination = DESTINATION[event.kind];
  const subject = notificationIdentity(event);
  const subjectAt = subject === null ? -1 : line.indexOf(subject.label);

  return (
    <div
      data-testid="signal-event"
      className={`relative flex w-full items-start gap-3 border-b border-line-soft p-3 text-left last:border-b-0 ${
        unread ? 'bg-crystal/[0.04]' : ''
      }`}
    >
      {destination && (
        <button
          type="button"
          aria-label={i18n.t('signals.openEvent')}
          onClick={() => { onGo(destination.panel, destination.stop); }}
          className="absolute inset-0"
        />
      )}
      <span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-chip border ${ !unread ? 'border-line-soft bg-deep text-faint' : bad ? 'border-threat/45 bg-threat/10 text-threat' : 'border-crystal/40 bg-crystal/10 text-crystal' }`} aria-hidden>
        <EventGlyph kind={event.kind} />
      </span>
      <span className="pointer-events-none relative min-w-0 flex-1">
        <span className={`relative block text-body ${bad ? 'text-threat-ink' : 'text-bone'}`}>
          {subject && subjectAt >= 0 ? (
            <>
              {line.slice(0, subjectAt)}
              {subject.planetId ? (
                <button
                  type="button"
                  onClick={() => {
                    haptic('tap');
                    onFocusPlanet(subject.planetId!);
                  }}
                  className="pointer-events-auto relative z-10 font-bold text-inherit underline decoration-current/40 underline-offset-2"
                >
                  {subject.label}
                </button>
              ) : (
                <strong className="font-bold">{subject.label}</strong>
              )}
              {line.slice(subjectAt + subject.label.length)}
            </>
          ) : line}
          {repeats > 1 && (
            <span className="num text-faint"> {i18n.t('signals.repeat', { count: repeats })}</span>
          )}
        </span>
        <span className="num mt-1 block text-label text-faint">
          {staleness((now - event.at.getTime()) / 60_000)}
        </span>
      </span>
    </div>
  );
}

/**
 * The states that are true right now.
 *
 * REWRITTEN FOR D16. The old version warned about a full STORE, which was the
 * right warning when production flowed straight into it. It no longer does:
 * production fills the works and stops there, so a full store is now a mild
 * inconvenience — the next collection will not fit — while full WORKS are the real
 * loss, because that is where production actually halts.
 *
 * Both are stated as what they cost per hour rather than as a percentage. A
 * percentage is a fact; a loss is a reason to act.
 */
export function statusOf(planet: PlanetView, held: Projected): Status[] {
  const out: Status[] = [];
  const p = planet.planet;

  if (p.disruptedUntil && p.disruptedUntil.getTime() > serverNow()) {
    out.push({
      kind: 'disrupted',
      tone: 'threat',
      line: i18n.t('signals.status.disruptedLine'),
      detail: i18n.t('signals.status.disruptedDetail', {
        duration: duration((p.disruptedUntil.getTime() - serverNow()) / 60_000),
      }),
    });
  }

  /**
   * JUDGED AGAINST THE PROJECTION, LIKE EVERY OTHER PILE ON THIS SURFACE. D52a.
   *
   * `held` has carried projected buffer figures since D16 and this read `p.bufferAlloy`
   * — the last fetch — so the two halves of the same widget disagreed: the header's
   * Works meter (which uses the projection) hit 100% while Signals, the one surface
   * whose job is to SAY the works have stopped, stayed silent until the next poll.
   * Up to thirty seconds of production thrown away with the interface insisting
   * nothing was wrong.
   */
  const worksFull =
    held.bufferAlloy >= p.bufferAlloyCap - 0.5 || held.bufferCrystal >= p.bufferCrystalCap - 0.5;
  if (worksFull) {
    out.push({
      kind: 'works-full',
      tone: 'alloy',
      line: i18n.t('signals.status.worksStoppedLine'),
      detail: i18n.t('signals.status.worksStoppedDetail', {
        amount: compact(p.alloyPerHour + p.crystalPerHour),
      }),
      go: 'planet',
    });
  }

  // A full store only matters because it blocks the next collection. Said that
  // way round, because "storage full" on its own is not something a player can act
  // on now that nothing flows into it.
  for (const store of stores(planet, held)) {
    if (store.value >= store.cap - 0.5 && store.waiting > 0) {
      out.push({
        kind: store.tone === 'alloy' ? 'alloy-full' : 'crystal-full',
        tone: store.tone,
        line: i18n.t(store.line),
        detail: i18n.t('signals.status.storeDetail', { amount: compact(store.waiting) }),
        go: 'planet',
      });
    }
  }

  return out;
}

function StatusGlyph({ kind }: { kind: Status['kind'] }) {
  if (kind === 'disrupted') return <DisruptedIcon className="size-5" />;
  if (kind === 'works-full') return <RefineryIcon className="size-5" />;
  if (kind === 'alloy-full') return <AlloyIcon className="size-5" />;
  return <CrystalIcon className="size-5" />;
}

function EventGlyph({ kind }: { kind: string }) {
  if (kind === 'incoming_fleet') return <IncomingIcon className="size-5" />;
  if (kind === 'fleet_returned') return <ReturnedIcon className="size-5" />;
  if (kind === 'raided' || kind === 'raid_result') return <RaidedIcon className="size-5" />;
  if (kind === 'scan_detected' || kind === 'probe_report') return <ScanIcon className="size-5" />;
  if (kind === 'unlock') return <UnlockIcon className="size-5" />;
  return <BellIcon className="size-5" />;
}

function stores(planet: PlanetView, held: Projected) {
  return [
    {
      // The whole line, not a noun to splice into one: Turkish declines the
      // resource ("Alaşım deposu dolu"), so there is no stem this could hand over.
      line: 'signals.status.alloyStoreLine' as const,
      tone: 'alloy' as const,
      value: held.alloy,
      cap: planet.planet.alloyCap,
      // Projected too: "the store is full AND something is waiting" is one
      // sentence, and reading its two halves off two different instants is what
      // let it be true and unsaid at the same time.
      waiting: held.bufferAlloy,
    },
    {
      line: 'signals.status.crystalStoreLine' as const,
      tone: 'crystal' as const,
      value: held.crystal,
      cap: planet.planet.crystalCap,
      waiting: held.bufferCrystal,
    },
  ];
}

/** A dish, listening. Lit when there is something unread in it. */
function Beacon({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-5 ${lit ? 'text-threat-ink' : 'text-faint'}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M12 20v-7.5" strokeLinecap="round" />
      <path d="M7 20h10" strokeLinecap="round" />
      <circle cx="12" cy="9.5" r="3" />
      <path
        d="M5.5 6a9 9 0 0 1 13 0"
        strokeLinecap="round"
        strokeOpacity={lit ? '1' : '.4'}
        className={lit ? 'motion-safe:animate-pulse' : ''}
      />
    </svg>
  );
}
