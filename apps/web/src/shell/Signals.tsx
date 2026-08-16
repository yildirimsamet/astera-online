import { useState } from 'react';
import { useApi } from '../api/context.js';
import { useNotifications, usePlanet } from '../api/queries.js';
import type { NotificationView, PlanetView } from '../api/schemas.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { describeNotification } from '../lib/notifications.js';
import { useProjectedResources } from '../lib/projection.js';
import { duration, staleness, useNow } from '../lib/time.js';
import { Sheet } from '../ui/Sheet.js';
import type { Tab } from './TabBar.js';

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
  tone: 'threat' | 'alloy' | 'crystal';
  line: string;
  detail: string;
  go?: Tab;
}

export function Signals({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const planet = usePlanet();
  const api = useApi();
  const now = useNow(30_000);
  // Stock is projected forward between fetches, so "almost full" is judged
  // against what the player is actually holding rather than what we last read.
  const held = useProjectedResources(planet.data?.planet, planet.dataUpdatedAt, 5000);

  const events = data?.notifications ?? [];
  const unseen = events.filter((n) => !n.seen).length;
  const status = planet.data ? statusOf(planet.data, held) : [];

  return (
    <>
      <button
        type="button"
        aria-label={unseen > 0 ? `Signals — ${String(unseen)} unread` : 'Signals'}
        onClick={() => {
          haptic('tap');
          setOpen(true);
          // Opening is what marks them read. Loading the app is not: a player who
          // starts the game and immediately closes it has not been told anything.
          const fresh = events.filter((n) => !n.seen).map((n) => n.id);
          if (fresh.length > 0) void api.markSeen(fresh);
        }}
        className={`relative flex size-9 items-center justify-center rounded-sm border transition-colors ${
          status.length > 0
            ? 'border-alloy/50 bg-alloy/10'
            : 'border-line-soft bg-deep hover:border-line'
        }`}
      >
        <Beacon lit={unseen > 0} />
        {unseen > 0 && (
          <span className="num absolute -right-1 -top-1 min-w-[16px] rounded-full bg-threat px-1 text-center text-[10px] leading-4 text-bone">
            {unseen > 9 ? '9+' : unseen}
          </span>
        )}
      </button>

      {open && (
        <Sheet
          eyebrow={unseen > 0 ? `${String(unseen)} new` : 'Everything you have been told'}
          title="Signals"
          onClose={() => {
            setOpen(false);
          }}
        >
          {status.length > 0 && (
            <div className="mb-5">
              <p className="legend mb-2">Right now</p>
              <div className="frame">
                {status.map((item) => (
                  <button
                    key={item.line}
                    type="button"
                    disabled={!item.go}
                    onClick={() => {
                      if (!item.go) return;
                      onNavigate(item.go);
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-3 border-b border-line-soft p-3 text-left last:border-b-0"
                  >
                    <span
                      className={`mt-1 size-2 shrink-0 rounded-full ${
                        item.tone === 'threat'
                          ? 'bg-threat'
                          : item.tone === 'alloy'
                            ? 'bg-alloy'
                            : 'bg-crystal'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-bone">{item.line}</span>
                      <span className="mt-0.5 block text-[12px] text-faint">{item.detail}</span>
                    </span>
                    {item.go && (
                      <span aria-hidden className="shrink-0 text-[13px] text-faint">
                        →
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="legend mb-2">What happened</p>
          {events.length === 0 ? (
            <p className="border border-dashed border-line-soft px-3.5 py-6 text-center text-[13px] text-dim">
              Nothing yet. The galaxy tells you when a fleet moves against you, when a probe is
              caught, and when your own ships come home.
            </p>
          ) : (
            <div className="frame">
              {events.map((event) => (
                <Event
                  key={event.id}
                  event={event}
                  now={now}
                  onGo={(tab) => {
                    onNavigate(tab);
                    setOpen(false);
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

/** Where each kind of news is actually dealt with. */
const DESTINATION: Record<string, Tab> = {
  incoming_fleet: 'planet',
  fleet_returned: 'planet',
  raided: 'intel',
  scan_detected: 'intel',
};

function Event({
  event,
  now,
  onGo,
}: {
  event: NotificationView;
  now: number;
  onGo: (tab: Tab) => void;
}) {
  const line = describeNotification(event);
  if (!line) return null;
  const bad = event.kind === 'incoming_fleet' || event.kind === 'raided';
  const destination = DESTINATION[event.kind];

  return (
    <button
      type="button"
      disabled={!destination}
      onClick={() => {
        if (destination) onGo(destination);
      }}
      className={`flex w-full items-start gap-3 border-b border-line-soft p-3 text-left last:border-b-0 ${
        event.seen ? '' : 'bg-crystal/[0.04]'
      }`}
    >
      <span
        className={`mt-1 size-2 shrink-0 rounded-full ${
          event.seen ? 'bg-line' : bad ? 'bg-threat' : 'bg-crystal'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-[13px] ${bad ? 'text-[#ff9d8f]' : 'text-bone'}`}>{line}</span>
        <span className="num mt-0.5 block text-[11px] text-faint">
          {staleness((now - event.at.getTime()) / 60_000)}
        </span>
      </span>
    </button>
  );
}

/**
 * The states that are true right now.
 *
 * A full store is the one the player asked for and the one the design already
 * paid for: production stops at twelve hours (ECON.capHours), so an overnight
 * absence costs real output. Stated as hours thrown away rather than as "storage
 * full", because a percentage is a fact and a loss is a reason to act.
 */
export function statusOf(planet: PlanetView, held: { alloy: number; crystal: number }): Status[] {
  const out: Status[] = [];

  if (planet.planet.disruptedUntil && planet.planet.disruptedUntil.getTime() > Date.now()) {
    out.push({
      tone: 'threat',
      line: 'Your works are offline',
      detail: `Raided. Production resumes in ${duration(
        (planet.planet.disruptedUntil.getTime() - Date.now()) / 60_000,
      )}.`,
    });
  }

  for (const store of stores(planet, held)) {
    if (store.value >= store.cap - 0.5) {
      out.push({
        tone: store.tone,
        line: `${store.name} store is full`,
        detail: `${compact(store.rate)} an hour is being thrown away. Spend it.`,
        go: 'planet',
      });
    } else if (store.value > store.cap * 0.85 && store.rate > 0) {
      out.push({
        tone: store.tone,
        line: `${store.name} store almost full`,
        detail: `${compact(store.cap - store.value)} of room — ${duration(
          ((store.cap - store.value) / store.rate) * 60,
        )} before it starts wasting.`,
        go: 'planet',
      });
    }
  }

  return out;
}

function stores(planet: PlanetView, held: { alloy: number; crystal: number }) {
  return [
    {
      name: 'Alloy',
      tone: 'alloy' as const,
      value: held.alloy,
      cap: planet.planet.alloyCap,
      rate: planet.planet.alloyPerHour,
    },
    {
      name: 'Crystal',
      tone: 'crystal' as const,
      value: held.crystal,
      cap: planet.planet.crystalCap,
      rate: planet.planet.crystalPerHour,
    },
  ];
}

/** A dish, listening. Lit when there is something unread in it. */
function Beacon({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-5 ${lit ? 'text-crystal' : 'text-faint'}`}
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
