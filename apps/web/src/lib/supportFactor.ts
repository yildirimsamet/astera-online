import { combatValue, factorValue, garrisonOf, supportFactor } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import { decimal } from './format.js';

/**
 * KLAN SAVUNMA DESTEĞİ — THE DOMINION FACTOR, WHERE A PLAYER READS IT. Owner, 2026-10-02.
 *
 * Only the host's Dominion moves in a supported fight: its own fight multiplied by line
 * power ÷ host power (at most ×5) — a host who loses loses ×D, one who wins gains ÷D — and
 * the supporters' lost ships at face value (`defendedTransfer`). `supportFactor` in the
 * rules is the one statement of D; this file only feeds it what each screen knows and says
 * the answer in one short figure.
 */

/**
 * "×2", "×1.3": one decimal, dropped when the factor is whole — and two when one would
 * round a real effect down to "×1", which would tell a host the support changed nothing.
 */
export function factorLabel(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 1 && value > 1) {
    const finer = Math.round(value * 100) / 100;
    return finer === 1 ? '1' : decimal(finer, 2);
  }
  return Number.isInteger(rounded) ? String(rounded) : decimal(rounded, 1);
}

/**
 * THE STAKES ON THE HOST'S OWN PAGE: its line as it stands — ships and guns — against the
 * waves standing here inside the tier band. A wave out of the band goes home before the
 * first shot, so it sets nothing; one still flying in has not joined the line yet. Guns a
 * Core outage or a running EMP has silenced fire nothing, exactly as the battle reads them.
 */
export function hostFactor(planet: PlanetView, now: number): number {
  const empUntil = planet.planet.empUntil ?? null;
  const gunsOnline = !(planet.faults ?? []).some((fault) => fault.kind === 'CORE_OUTAGE')
    && !(empUntil !== null && empUntil.getTime() > now);
  const hostPower = combatValue(garrisonOf(planet.fleet, gunsOnline ? planet.ground : {}));
  const supportPower = (planet.clanSupport?.waves ?? [])
    .filter((wave) => wave.status === 'STATIONED' && !wave.outOfBand)
    .reduce((sum, wave) => sum + combatValue(wave.fleet), 0);
  return factorValue(supportFactor({ hostPower, supportPower }));
}

/**
 * THE MOST THE RAIDER CAN EXPECT A WIN TO BE MULTIPLIED BY: the most support against the
 * weakest host the probe allows. A ceiling, not a band — the probe reads the host's SHIPS,
 * never its guns, and every gun only lowers the factor, so no floor can be vouched for.
 */
export function raiderFactorCeiling(
  hostShips: { low: number; high: number },
  support: { low: number; high: number },
): number {
  const whole = (value: number) => Math.max(0, Math.round(value));
  return factorValue(supportFactor({ hostPower: whole(hostShips.low), supportPower: whole(support.high) }));
}
