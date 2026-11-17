import { openUnknownSignal } from '../lib/unknownSignal.js';
import { clanAlarmOf } from '../lib/clanAlarm.js';
import { openClanAlarm } from '../lib/clanAlarmDoor.js';
import { z } from 'zod';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarkSeen, useNotifications, usePlanet } from '../api/queries.js';
import { observeOutcomes } from '../session/outcomeVisible.js';
import type { NotificationView, PlanetView } from '../api/schemas.js';
import i18n from '../i18n/index.js';
import { EmptyState, NewsList, NewsRow, RoundButton, artIconSrc, type GlyphId, type NewsTone } from '../game-ui/index.js';
import { compact } from '../lib/format.js';
import { EVENT_GLYPH } from '../lib/nowLine.js';
import { haptic } from '../lib/haptics.js';
import {
  describeNotification,
  notificationIdentity,
  notificationMonumentTarget,
  signalFamily,
  signalGlyph,
  signalOutcome,
  type SignalFamily,
  type SignalGlyph,
} from '../lib/notifications.js';
import { useProjected, type Projected } from '../lib/projection.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { Sheet } from '../ui/kit/index.js';
import type { Panel, PanelStop } from '../screens/GalaxyView.jsx';
import { serverNow } from '../lib/clock.js';

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

/** Where a signal's press lands: the panel, its shelf, the report, the row. */
export type SignalGo = (
  panel: Panel,
  stop?: PanelStop,
  reportMissionId?: string,
  focus?: { planetId?: string; group?: string; itemId?: string },
) => void;

/**
 * THE FEED, READ ONCE FOR EVERY SURFACE THAT SHOWS IT: the old beacon and the v2
 * bell sheet (K1) count and list exactly the same rows.
 */
function useSignalFeed() {
  const { data } = useNotifications();
  const planet = usePlanet();
  const now = useNow(30_000);
  // Stock is projected forward between fetches, so "almost full" is judged
  // against what the player is actually holding rather than what we last read.
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 5000);

  const events = useMemo(
    () => (data?.notifications ?? []).filter((n) => describeNotification(n, now) !== null),
    [data, now],
  );
  const groups = useMemo(() => group(events), [events]);
  const unseen = events.filter((n) => !n.seen).length;
  const status = planet.data ? statusOf(planet.data, held) : [];
  return { events, groups, unseen, status, now };
}

/**
 * OPENING THE FEED IS WHAT MARKS IT READ. Loading the app is not: a player who
 * starts the game and immediately closes it has not been told anything.
 *
 * Every unseen id in the payload, not only the ones this build can describe — a
 * row nobody can be shown must not hold the badge open. Returns the ids it just
 * marked, so the rows stay lit for the reader who opened them.
 */
export function useOpenSignals(): () => ReadonlySet<string> {
  const { data } = useNotifications();
  const markSeen = useMarkSeen();
  return () => {
    const unseen = (data?.notifications ?? []).filter((n) => !n.seen);
    const fresh = unseen.map((n) => n.id);
    if (fresh.length > 0) markSeen.mutate(fresh);
    observeOutcomes(unseen, 'signals');
    return new Set(fresh);
  };
}

export function Signals({
  onOpen,
  onFocusPlanet,
  onFocusMonument,
}: {
  onOpen: SignalGo;
  onFocusPlanet: (planetId: string) => void;
  onFocusMonument?: (monumentId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [justRead, setJustRead] = useState<ReadonlySet<string>>(new Set());
  const { unseen, status } = useSignalFeed();
  const openSignals = useOpenSignals();

  return (
    <>
      <button
        type="button"
        aria-label={unseen > 0 ? t('signals.beaconUnread', { count: unseen }) : t('signals.beacon')}
        onClick={() => {
          haptic('tap');
          setOpen(true);
          setJustRead(openSignals());
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
        className={`relative flex size-9 items-center justify-center rounded-chip border transition-colors ${unseen > 0
          ? 'border-threat/70 bg-threat/15 animate-pulse'
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
              className="pointer-events-none absolute -inset-1 rounded-chip bg-threat/20 blur-[6px] animate-pulse"
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
          <SignalsFeed
            onFocusMonument={onFocusMonument ? (id) => { setOpen(false); onFocusMonument(id); } : undefined}
            justRead={justRead}
            onGo={(panel, stop, reportMissionId, focus) => {
              onOpen(panel, stop, reportMissionId, focus);
              setOpen(false);
            }}
            onFocusPlanet={(planetId) => {
              setOpen(false);
              onFocusPlanet(planetId);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

/**
 * THE FEED ITSELF: what is true right now (status), then what happened (events).
 * The v2 bell sheet's Signals tab draws this same body.
 */
export function SignalsFeed({
  justRead,
  onGo,
  onFocusPlanet,
  onFocusMonument,
}: {
  /** Ids marked read by this opening; they stay lit until the feed closes. */
  justRead: ReadonlySet<string>;
  onGo: SignalGo;
  onFocusPlanet: (planetId: string) => void;
  onFocusMonument?: (monumentId: string) => void;
}) {
  const { t } = useTranslation();
  const { events, groups: all, status, now } = useSignalFeed();
  // A clan alarm is true right now while its raid is in the air (owner 2026-11-11); landed, it is history.
  const live = all.filter((entry) => (clanAlarmOf(entry.event)?.arriveAt.getTime() ?? 0) > now);
  const groups = all.filter((entry) => !live.includes(entry));
  const row = (entry: (typeof all)[number]) => (
    <Event
      onFocusMonument={onFocusMonument}
      key={entry.event.id}
      event={entry.event}
      repeats={entry.repeats}
      unread={!entry.event.seen || justRead.has(entry.event.id)}
      now={now}
      onGo={onGo}
      onFocusPlanet={onFocusPlanet}
    />
  );
  const rightNow = status.length > 0 || live.length > 0;

  /*
    THE FEED ON THE KIT (G1-e, 2026-11-14): what is true right now on a plate of its own, then
    what happened. A head only where "Right now" stands above it to be told apart from; the
    list is still named for a reader. Nothing yet is said with the bell's picture.
  */
  return (
    <>
      {rightNow && (
        <NewsList title={t('signals.statusHeading')}>
          {live.map(row)}
          {status.map((item) => (
            <li key={item.line}>
              <NewsRow
                glyph={STATUS_MARK[item.kind]}
                tone={STATUS_TONE[item.tone]}
                fresh
                {...(item.go === undefined ? {} : { open: { label: item.line, onPress: () => { if (item.go !== undefined) onGo(item.go); } } })}
              >
                <strong>{item.line}</strong> · {item.detail}
              </NewsRow>
            </li>
          ))}
        </NewsList>
      )}
      {groups.length === 0 && live.length > 0 ? null : events.length === 0 ? (
        <EmptyState art={artIconSrc('hud-bell')} title={t('signals.emptyTitle')} body={t('signals.emptyBody')} />
      ) : rightNow ? (
        <NewsList title={t('signals.eventsHeading')}>{groups.map(row)}</NewsList>
      ) : (
        <NewsList label={t('signals.eventsHeading')}>{groups.map(row)}</NewsList>
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
  arena_ship_ready: { panel: 'ship' },
  arena_team_share: { panel: 'ship' },
  arena_sortie_end: { panel: 'ship' },
  unknown_signal_result: { panel: null },
  monument_inbound: { panel: null },
  monument_probe_lost: { panel: null },
  monument_returning: { panel: null },
  convoy_result: { panel: 'planet' },
  // Something is coming: spend the stock, build a gun, get the fleet out.
  incoming_fleet: { panel: 'planet' },
  strategic_incoming: { panel: 'planet' },
  fleet_returned: { panel: 'planet' },
  // Ships a cloud finished: the flight board is where what is left of the fleet is.
  radiation_lost: { panel: 'planet' },
  radiation_bomb_result: { panel: 'report', stop: 'battles' },
  // The trip is spent and the craft are on their way back; the flight board is
  // where the commander sees them and decides what the next launch is aimed at.
  target_gone: { panel: 'planet' },
  /*
    A FIGHT OPENS ITS OWN REPORT. Owner instruction, correcting D121.

    D121 read this complaint as a ROOM problem — "you were raided" opened the
    Intel centre and landed on the probe list — and fixed the shelf. The altitude
    was still wrong: the reader tapped one battle and got a list with that battle
    somewhere in it. `report` is the door onto the report itself, and the shelf
    named beside it is where `BattleReportDoor` falls back when that exact fight
    cannot be found.
  */
  raided: { panel: 'report', stop: 'battles' },
  raid_result: { panel: 'report', stop: 'battles' },
  // The same doors aboard a colony ship, whose notifications use the ship's own kinds. A
  // reading opens where the main game's readings do; the ship's own news opens the ship.
  BATTLE_REPORT: { panel: 'report', stop: 'battles' },
  PROBE_REPORT: { panel: 'intel', stop: 'probes' },
  PROBE_DETECTED: { panel: 'intel', stop: 'probes' },
  FLEET_HOME: { panel: 'planet' },
  FLEET_TURNED_BACK: { panel: 'planet' },
  RADAR_WARNING: { panel: 'planet' },
  SHIELD_WARNING: { panel: 'planet' },
  REPAIR_DONE: { panel: 'planet' },
  CRATE_OPENED: { panel: 'planet' },
  YARD_DONE: { panel: 'planet' },
  RESEARCH_DONE: { panel: 'planet' },
  DOCK_DONE: { panel: 'planet' },
  SEASON_OPEN: { panel: 'planet' },
  // Klan Savunma Desteği: the fight a supporter's ships stood in is a report like any
  // other; who is coming, who left and the posture reset are all on the world's sheet.
  clan_support_result: { panel: 'report', stop: 'battles' },
  // F2 Klan Alarmı: the row opens the support sheet aimed at the clanmate's world.
  clan_alarm: { panel: null },
  clan_support_inbound: { panel: 'planet' },
  clan_support_departed: { panel: 'planet' },
  clan_support_lifted: { panel: 'planet' },
  defence_posture_reset: { panel: 'planet' },
  death_star_result: { panel: 'report', stop: 'battles' },
  strategic_intercepted: { panel: 'report', stop: 'battles' },
  // Everything else that is a READING goes where readings live — the radar log
  // behind a scan, the report behind a probe.
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
  /*
    SOMETHING BROKE ON ONE OF YOUR WORLDS, and the press has to land on the row that is
    broken rather than on the planet sheet's front door. The payload names the world, the
    tab and the item; `PanelFocusRequest` carries them the rest of the way.
  */
  colony_fault: { panel: 'planet' },
  colony_loyalty_warning: { panel: 'planet' },
  settlement_lost: { panel: 'planet' },
  // The active-event chip lives on the galaxy itself; closing Signals is the route.
  galaxy_event_started: { panel: null },
  galaxy_event_ended: { panel: null },
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
/*
  WHAT A RUN HAS TO SHARE TO FOLD, per kind. Every scan says the same sentence. A probe report
  names its world and whether the probe was caught, and opens the probe shelf rather than a
  report of its own (G1-e, 2026-11-14): two home from the same world, both unseen or both caught,
  are one line; another world or another fate is different news.
*/
const probeFold = z.object({
  targetPlanetId: z.string().optional(),
  targetPlanetName: z.string().optional(),
  detected: z.boolean().optional(),
});
const FOLD_KEY: Partial<Record<string, (event: NotificationView) => string>> = {
  scan_detected: () => '',
  probe_report: (event) => {
    const parsed = probeFold.safeParse(event.payload);
    const probe = parsed.success ? parsed.data : {};
    return `${probe.targetPlanetId ?? probe.targetPlanetName ?? ''}|${String(probe.detected === true)}`;
  },
};

interface Group {
  event: NotificationView;
  repeats: number;
}

export function group(events: readonly NotificationView[]): Group[] {
  const out: Group[] = [];
  for (const event of events) {
    const last = out[out.length - 1];
    const key = FOLD_KEY[event.kind];
    if (last && key && last.event.kind === event.kind && key(last.event) === key(event)) {
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

/**
 * HOW EACH FAMILY OF NEWS IS PAINTED. D142, on the kit since G1-e (2026-11-14).
 *
 * `docs/visual-design.md`: **icons carry shape, the interface carries colour.**
 * So the family decides the coin's hue and `signalGlyph` decides its mark, and a
 * row is never separated from its neighbour by only one of the two. A read row
 * keeps its colour at a lower light (`NewsRow`): still legible as "that was a loss",
 * clearly no longer new.
 *
 * PIRATE AND THREAT SHARE THE RED, DELIBERATELY. An identified pirate wears a red
 * skull on the disc (`PIRATE_MARK`, `galaxy/Fleets.tsx`) and the mark, not the hue,
 * is what says "a target rather than a commander".
 */
const FAMILY_TONE: Record<SignalFamily, NewsTone> = {
  threat: 'hostile',
  pirate: 'hostile',
  gain: 'good',
  watch: 'warn',
  world: 'info',
  // A kind this build has never heard of. Furniture, on purpose — see `signalFamily`.
  note: 'steel',
};

/** The kit's mark for each kind of news, the same marks the Now line and the galaxy wear. */
const SIGNAL_MARK: Record<SignalGlyph, GlyphId> = {
  incoming: 'siren',
  strategic: 'radiation',
  raided: 'attack',
  returned: 'recall',
  skull: 'pirate',
  // Your instrument looking out; the magnifier is somebody looking at you.
  probe: 'eye',
  scan: 'zoom',
  unlock: 'unlock',
  conquest: 'banner',
  'world-lost': 'colony',
  galaxy: 'star',
  bell: 'bell',
};

/** A galaxy event wears the mark its chip wears on the galaxy and on the Now line. */
const eventKindOf = z.object({ eventKind: z.enum(['ASTEROID_SHOWER', 'TRADE_SHIP', 'INTERGALACTIC_CONVOY']) });
function newsMark(event: NotificationView): GlyphId {
  const galaxy = eventKindOf.safeParse(event.payload);
  if (signalFamily(event) === 'world' && galaxy.success) return EVENT_GLYPH[galaxy.data.eventKind];
  return SIGNAL_MARK[signalGlyph(event)];
}

const STATUS_MARK: Record<Status['kind'], GlyphId> = {
  disrupted: 'damaged',
  'works-full': 'timed',
  'alloy-full': 'crate',
  'crystal-full': 'crate',
};
const STATUS_TONE: Record<Status['tone'], NewsTone> = { threat: 'hostile', alloy: 'alloy', crystal: 'crystal' };

function Event({
  event,
  repeats,
  unread,
  now,
  onGo,
  onFocusPlanet,
  onFocusMonument,
}: {
  event: NotificationView;
  repeats: number;
  /** New in THIS reading — see `justRead`. Not simply `!event.seen`. */
  unread: boolean;
  now: number;
  onGo: (
    panel: Panel,
    stop?: PanelStop,
    reportMissionId?: string,
    focus?: { planetId?: string; group?: string; itemId?: string },
  ) => void;
  onFocusPlanet: (planetId: string) => void;
  onFocusMonument?: (monumentId: string) => void;
}) {
  const line = describeNotification(event, now);
  if (!line) return null;
  const family = signalFamily(event);
  const destination = DESTINATION[event.kind];
  const age = staleness((now - event.at.getTime()) / 60_000);
  const subject = notificationIdentity(event);

  const openIt = (): void => {
      if (!destination) return;
      if (event.kind === 'unknown_signal_result' && event.refId) {
        onGo(null);
        openUnknownSignal(event.refId);
        return;
      }
      const alarm = clanAlarmOf(event);
      if (alarm) {
        onGo(null);
        openClanAlarm(alarm);
        return;
      }
      const monument = notificationMonumentTarget(event);
      if (monument?.monumentId && destination.stop !== 'battles' && onFocusMonument) {
        onFocusMonument(monument.monumentId);
        return;
      }
      /*
        THE SHELF DECIDES WHETHER THE ROW NAMES A FIGHT. Owner report.

        A battle notification is about ONE report, and `refId` is that fight on
        every kind that routes to the battle shelf — the mission for a raid, a
        Death Star and an interception, the raid itself for a pirate (D150),
        and `BattleReports` matches both binders. This used to be a list of two
        kinds, so a Death Star resolving and a rocket being shot down opened
        the list and left the reader to find their own report in it.

        Read off the destination, the rule is stated once: a fifth battle kind
        gets it by routing there, which is the only place it can be forgotten.
      */
      const bomb = event.kind === 'radiation_bomb_result' || (event.kind === 'strategic_intercepted'
        && z.object({ weaponKind: z.literal('RADIATION_BOMB') }).safeParse(event.payload).success);
      const reportMissionId = destination.stop === 'battles' && event.refId
        ? bomb ? `bomb:${event.refId}` : event.refId : undefined;
      /*
        A FAULT NAMES A WORLD, A TAB AND A ROW, and all three come off the payload
        rather than being worked out here. The server's copy has to travel with the
        notification anyway — it is what makes the press work on a build that has
        never heard of the fault it is announcing — so deriving a second answer on
        this side would be a table to keep in step for no gain.
      */
      const payload = event.payload as
        { planetId?: unknown; group?: unknown; itemId?: unknown } | undefined;
      const focus = {
        ...(typeof payload?.planetId === 'string' ? { planetId: payload.planetId } : {}),
        ...(typeof payload?.group === 'string' ? { group: payload.group } : {}),
        ...(typeof payload?.itemId === 'string' ? { itemId: payload.itemId } : {}),
      };
      /*
        NOTHING TO POINT AT MEANS NOTHING IS SENT. Most news has no row in it, and
        handing every one of them an empty object would make the argument meaningless
        and every existing caller's signature a lie about what it receives.
      */
      onGo(
        destination.panel,
        destination.stop,
        reportMissionId,
        Object.keys(focus).length > 0 ? focus : undefined,
      );
  };

  /*
    THE WAY TO WHOEVER IT NAMES IS A ROUND PRESS OF ITS OWN (G1-e, 2026-11-14). It was the
    underlined name in the sentence: a line of text the thumb had to hit, lying over the row's
    own press. The name stays bold; the target at the row's end flies there.
  */
  const fly = subject?.monumentId !== undefined && onFocusMonument
    ? () => { if (subject.monumentId !== undefined) onFocusMonument(subject.monumentId); }
    : subject?.planetId !== undefined
      ? () => { if (subject.planetId !== undefined) onFocusPlanet(subject.planetId); }
      : null;

  return (
    <li data-testid="signal-event" data-signal-id={event.id} data-family={family}>
      <NewsRow
        glyph={newsMark(event)}
        tone={FAMILY_TONE[family]}
        outcome={signalOutcome(event)}
        fresh={unread}
        age={age}
        /*
          A GALAXY EVENT IS NOT PERSONAL MAIL, AND IS NOT DRAWN LIKE IT. An asteroid shower
          happened to the whole shard; it says so above its sentence, in the blue the event's
          own chip on the galaxy wears, with a rail down its edge.
        */
        {...(family === 'world' ? { banner: i18n.t('signals.worldEvent') } : {})}
        {...(destination ? { open: { label: i18n.t('signals.openEvent'), onPress: openIt } } : {})}
        {...(fly === null || subject === null ? {} : {
          tool: <RoundButton small glyph="target" label={i18n.t('signals.showOnMap', { name: subject.label })} onPress={fly} />,
        })}
      >
        <Sentence line={line} event={event} repeats={repeats} />
      </NewsRow>
    </li>
  );
}

/** The sentence, with the one identity in it made bold. */
function Sentence({ line, event, repeats }: { line: string; event: NotificationView; repeats: number }) {
  const subject = notificationIdentity(event);
  const subjectAt = subject === null ? -1 : line.indexOf(subject.label);
  return (
    <>
      {subject && subjectAt >= 0 ? (
        <>
          {line.slice(0, subjectAt)}
          <strong>{subject.label}</strong>
          {line.slice(subjectAt + subject.label.length)}
        </>
      ) : line}
      {repeats > 1 && <span className="gk-num"> {i18n.t('signals.repeat', { count: repeats })}</span>}
    </>
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
  // Works of size zero (a ship whose Extractor is still broken) make nothing, so they cannot stop.
  const full = (pile: number, cap: number) => cap > 0 && pile >= cap - 0.5;
  const worksFull = full(held.bufferAlloy, p.bufferAlloyCap) || full(held.bufferCrystal, p.bufferCrystalCap);
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
        className={lit ? 'animate-pulse' : ''}
      />
    </svg>
  );
}
