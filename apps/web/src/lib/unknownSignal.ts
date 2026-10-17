import { HULLS, UNKNOWN_SIGNAL, distance, fleetTravelExact, missionFuel, resourceValue, type UnknownSignalWarshipHull } from '@astera/rules';
import type { PlanetView, UnknownSignalView } from '../api/schemas.js';
import { flightModifiers } from './navigation.js';
import { launchFault } from './faults.js';
import { z } from 'zod';

const SIGNAL_DOOR = 'astera:unknown-signal';
export function openUnknownSignal(id: string): void { window.dispatchEvent(new CustomEvent(SIGNAL_DOOR, { detail: id })); }
export function subscribeUnknownSignal(onOpen: (id: string) => void): () => void {
  const listener = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const parsed = z.string().uuid().safeParse(event.detail);
    if (parsed.success) onOpen(parsed.data);
  };
  window.addEventListener(SIGNAL_DOOR, listener);
  return () => { window.removeEventListener(SIGNAL_DOOR, listener); };
}

type SignalBlocker = 'expired' | 'vacation' | 'locked' | 'noWarship' | 'noCourier' | 'noBay' | 'noFuel';

export function unknownSignalMarkerState(signal: UnknownSignalView, now: number): {
  phase: 'open' | 'targeted' | 'flash' | 'pirates' | 'hidden'; opacity: number;
} {
  if (signal.status === 'open' && signal.expiresAt.getTime() > now) {
    return { phase: 'open', opacity: Math.min(1, (signal.expiresAt.getTime() - now) / 1200) };
  }
  if (signal.status === 'outbound') return { phase: 'targeted', opacity: 1 };
  const elapsed = signal.arriveAt ? now - signal.arriveAt.getTime() : Infinity;
  if (signal.outcome && elapsed >= 0 && elapsed < 3000) {
    return { phase: signal.outcome.kind === 'PIRATES' ? 'pirates' : 'flash', opacity: 1 - elapsed / 3000 };
  }
  return { phase: 'hidden', opacity: 0 };
}

export function defaultUnknownSignalWarship(planet: PlanetView): UnknownSignalWarshipHull {
  return [...UNKNOWN_SIGNAL.warshipHulls].filter(hull => (planet.fleet[hull] ?? 0) > 0)
    .sort((a, b) => resourceValue(HULLS[a]) - resourceValue(HULLS[b]))[0] ?? 'DART';
}

export function unknownSignalQuote(planet: PlanetView, signal: UnknownSignalView, hull: UnknownSignalWarshipHull, now: number) {
  const fleet = { [hull]: 1, COURIER: 1 };
  const reach = distance(planet.planet.position, signal.at);
  const minutes = fleetTravelExact(reach, fleet, flightModifiers(planet));
  const fuel = missionFuel(fleet, reach, 2);
  const warship = HULLS[hull];
  const courier = HULLS.COURIER;
  const blocked: SignalBlocker | null = signal.status !== 'open' || signal.expiresAt.getTime() <= now ? 'expired'
    : planet.vacationUntil && planet.vacationUntil.getTime() > now ? 'vacation'
    : launchFault(planet.faults, 'fleet', planet.silentSpace) || (planet.planet.recoveryUntil?.getTime() ?? 0) > now
      || (planet.loyalty && planet.loyalty.value <= 0) ? 'locked'
    : (planet.fleet[hull] ?? 0) < 1 ? 'noWarship'
    : (planet.fleet.COURIER ?? 0) < 1 ? 'noCourier'
    : planet.flight.used >= planet.flight.total ? 'noBay'
    : planet.planet.deuterium < fuel ? 'noFuel' : null;
  return { fleet, distance: reach, minutes, roundTripMinutes: minutes * 2, fuel, blocked,
    risk: { alloy: warship.alloy + courier.alloy, crystal: warship.crystal + courier.crystal, deuterium: warship.deuterium + courier.deuterium } };
}
