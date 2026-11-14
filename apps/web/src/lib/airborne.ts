import { useTranslation } from 'react-i18next';
import { fleetCount, hpRadiationApplies } from '@astera/rules';
import type { FlightRecallInput } from '../api/client.js';
import { useMining, useMonuments, usePending, usePlanet, useTraffic } from '../api/queries.js';
import { threadKey } from '../galaxy/threadKey.js';
import {
  arrivalOf,
  contactFor,
  escortLine,
  flightFocus,
  flightRecallInput,
  flightTitle,
  incomingDetail,
  runArrival,
  runTitle,
  type FlightFocus,
} from './flights.js';
import { monumentPendingThreads } from './monumentFlights.js';
import { useNow } from './time.js';

/*
  Moved out of `shell/PendingStrip.tsx` (G1-d2, 2026-11-14): the live game reads these — the
  Fleet page, the Outline, the shell — and the strip itself is drawn only by the old Academy.
*/

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
  const origin = usePlanet();
  const monuments = useMonuments(hpRadiationApplies(origin.data?.rulesetVersion ?? 0));
  const threads = [...data?.pending ?? [], ...monumentPendingThreads(monuments.data, now)];
  const runs = (mining.data?.runs ?? []).filter((run) => run.status !== 'done');
  const seen = traffic.data?.contacts ?? [];

  const items: AirborneItem[] = [
    ...threads.map((thread, index): AirborneItem => {
      const focus = flightFocus(thread, index, seen);
      const recallMission = flightRecallInput(thread, now);
      return {
        key: `thread:${threadKey(thread, index)}`,
        title: flightTitle(thread),
        detail: [incomingDetail(thread, contactFor(thread, seen)) ?? (thread.fleet
          ? t('pendingStrip.craftCount', { count: fleetCount(thread.fleet) })
          : t('pendingStrip.craftUnknown')), escortLine(thread)].filter(part => part !== null).join(' '),
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
        ...(recallMission ? { recallMission } : {}),
        ...(thread.monumentRecall ? { recallMinutes: thread.monumentRecall.minutes } : {}),
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
  recallMission?: FlightRecallInput;
  /** Native return forecast; radiation and surviving hull speeds can change the way home. */
  recallMinutes?: number;
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
  | 'monument' | 'unknown_signal'
  | 'fleet' | 'probe' | 'incoming' | 'transfer' | 'settlement' | 'death_star' | 'radiation_bomb'
  | 'mining' | 'salvage' | 'pirate' | 'trade' | 'intergalactic_convoy';
