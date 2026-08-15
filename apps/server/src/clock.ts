/**
 * The single conversion between wall time and game time.
 *
 * The database stores `timestamptz` everywhere. The rules package works in
 * minutes since season start. This file is the only place those two meet — if
 * a minute-valued number appears anywhere else, it came through here.
 */

export const minutesSince = (seasonStart: Date, at: Date): number =>
  (at.getTime() - seasonStart.getTime()) / 60_000;

export const atMinute = (seasonStart: Date, minutes: number): Date =>
  new Date(seasonStart.getTime() + minutes * 60_000);

export const addMinutes = (at: Date, minutes: number): Date =>
  new Date(at.getTime() + minutes * 60_000);

/** Wall-clock source, injectable so tests can control time without faking timers. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export class FixedClock implements Clock {
  constructor(private current: Date) {}
  now(): Date {
    return this.current;
  }
  set(at: Date): void {
    this.current = at;
  }
  advance(minutes: number): void {
    this.current = addMinutes(this.current, minutes);
  }
}
