import { useTranslation } from 'react-i18next';
import {
  ESCAPE,
  combatValue,
  escapeCombatShipCount,
  escapeFuel,
  escapingShips,
  fleetEscapeMinimumApplies,
  fleetCount,
  garrisonOf,
  type DefencePosture,
  type Fleet,
} from '@astera/rules';
import { compact } from '../lib/format.js';

/**
 * TAKTİK GERİ ÇEKİLME, FROM THE DEFENDER'S SIDE — BEFORE ANY RAID. Owner decision, 2026-09-23.
 *
 * The rule is a plan only if the player can read it off their own world: at what
 * firepower their ships stop fighting and run, and whether the tank can pay for the
 * lift. Both are this commander's own figures — their line, their tank — so the
 * number is stated exactly; nothing here is anyone else's secret.
 *
 * ONE LINE, IN THE DEFEND TAB. It answers the four questions in order: what it is
 * (the firepower a raid needs to make the ships run), whether big is good (a higher
 * line means the ships stay and fight more often), what it is related to (the ships
 * and guns standing here, and the tank), and what to do with it (keep the lift in the
 * tank, or keep the line strong enough to fight). The rule's wording lives in the
 * launch sheet one tap deep; here it is the figure.
 *
 * NOTHING TO SAY WITHOUT SHIPS. Guns never run, and a Prospector never stands in the
 * line, so a world with neither armed nor unarmed ships at home gets no line at all.
 * In ruleset 13 the row first shows progress to five combat ships; below that
 * floor it must not promise any escape threshold.
 *
 * A DRY TANK IS A GAP YOU CAN CLOSE (E5 · K2): yellow, never the red of a threat.
 *
 * A POSTURE THAT FORBIDS THE RETREAT REPLACES THE FIGURE (Klan Savunma Desteği, K4). Under
 * SUPPORT or HOLD no firepower makes these ships run, so a threshold would be a promise the
 * battle never keeps; the line says what the posture does and where it is changed.
 *
 * THE GUNS ARE COUNTED AS IF ONLINE. An outage or an EMP takes them out of the line
 * and lowers the real threshold; the readout states the ordinary rule rather than
 * tracking a fault clock the Defend tab already shows beside it.
 */
export function EscapeReadout({
  fleet,
  ground,
  deuterium,
  rulesetVersion = 0,
  posture,
}: {
  /** The home fleet — `PlanetView.fleet`. Prospectors are dropped by `garrisonOf`. */
  fleet: Fleet;
  ground: Fleet;
  /** This world's tank: the lift is paid from here, vault share included. */
  deuterium: number;
  rulesetVersion?: number;
  /** The world's defence posture from ruleset 15; absent before it. */
  posture?: DefencePosture | undefined;
}) {
  const { t } = useTranslation();
  const line = garrisonOf(fleet, ground);
  const ships = escapingShips(line);
  if (fleetCount(ships) === 0) return null;
  if (posture === 'SUPPORT' || posture === 'HOLD') {
    return (
      <p data-testid="escape-readout" data-held="" className="px-3 py-2 text-caption leading-snug text-v2-ink-2">
        {t(`clanSupport.defendOff.${posture}`)}
      </p>
    );
  }

  const combatShips = escapeCombatShipCount(line);
  if (fleetEscapeMinimumApplies(rulesetVersion) && combatShips < ESCAPE.minimumCombatShips) {
    return (
      <p data-testid="escape-readout" className="px-3 py-2 text-caption leading-snug text-v2-ink-2">
        {t('planet.defend.escapeMinimum', { count: combatShips, minimum: ESCAPE.minimumCombatShips })}
      </p>
    );
  }

  const at = compact(ESCAPE.ratio * combatValue(line));
  const fuel = escapeFuel(ships);
  const stock = Math.floor(Math.max(0, deuterium));
  const short = stock < fuel;

  return (
    <p
      data-testid="escape-readout"
      {...(short ? { 'data-short': '' } : {})}
      className={`px-3 py-2 text-caption leading-snug ${short ? 'text-v2-warn' : 'text-v2-ink-2'}`}
    >
      {short
        ? t('planet.defend.escapeShort', { at, fuel, stock })
        : t('planet.defend.escapeReady', { at, fuel })}
    </p>
  );
}
