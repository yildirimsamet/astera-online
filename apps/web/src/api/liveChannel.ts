import { TRAFFIC } from '@astera/rules';

/** A minute: for a read under a dead channel, and for one no event could ever refresh. */
export const NET_MS = 60_000;
/**
 * The net under a live one, for an edge the stream missed. Query plan, 2026-11-03: about
 * one production request in eight was a read repeating itself a minute later. A fixed
 * spread per session, so a fleet of clients does not fall into step; never per call, since
 * a changing interval restarts the query's timer on every render.
 */
export const calmNetMs = (roll: number): number => Math.round(180_000 * (0.9 + roll * 0.2));
export const CALM_NET_MS = calmNetMs(Math.random());

let live = false;

/** The stream opened, or closed. A closed one re-reads everything when it opens again. */
export function setChannelLive(open: boolean): void {
  live = open;
}

export const safetyNetMs = (): number => (live ? CALM_NET_MS : NET_MS);

let trafficWake = false;

/** The server has said it will wake this client for traffic: it works it out on the same clock. */
export function setTrafficWake(on: boolean): void {
  trafficWake = on;
}

export const trafficPollMs = (): number => (trafficWake ? CALM_NET_MS : TRAFFIC.refreshMs);
