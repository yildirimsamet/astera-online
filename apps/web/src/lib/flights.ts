import { fleetCount } from '@astera/rules';
import type { Contact, MiningRun, PendingThread } from '../api/schemas.js';
import i18n from '../i18n/index.js';

/**
 * WHAT A CRAFT IN THE AIR IS CALLED, AND WHEN IT LANDS.
 *
 * Moved out of `shell/PendingStrip.tsx` so the strip, the v2 Now line (B2) and the
 * v2 Fleet page word a flight the same way.
 */

/**
 * WHOSE FLIGHT THIS IS, SAID OUT LOUD.
 *
 * The strip is a permanent bar at the foot of the screen and the focus rail opens
 * directly above it, so the two stack into what reads as one panel — and this row's
 * countdown then reads as belonging to whatever the player has just tapped. Focus
 * anything that is NOT yours, which is most of the disc, and the strip was quietly
 * attributing your own fleet's clock to somebody else's craft.
 *
 * Every owned line therefore names the owner; the anonymous inbound warning is
 * the deliberate exception.
 */
/**
 * WHAT A DEFENDER'S RADAR HAS ACTUALLY BOUGHT THEM. D123.
 *
 * Three rungs, in the order the ladder sells them, and each one replaces the line
 * below it rather than adding to it: the roster at L5, the size band at L4, and
 * the bare warning available from L1. Returns null for anything that is not an inbound thread,
 * so an owned craft falls through to its own manifest — which is free, because you
 * packed it.
 */
export const incomingDetail = (thread: PendingThread, seen: Contact | undefined): string | null => {
  if (thread.kind !== 'incoming') return null;
  const fleet = thread.fleet ?? seen?.fleet;
  if (fleet) return i18n.t('pendingStrip.craftCount', { count: fleetCount(fleet) });
  const mass = thread.mass ?? seen?.mass;
  if (mass === 'HEAVY') return i18n.t('pendingStrip.massHeavy');
  if (mass === 'MEDIUM') return i18n.t('pendingStrip.massMedium');
  if (mass === 'LIGHT') return i18n.t('pendingStrip.massLight');
  /*
    "ORIGIN HIDDEN BY FOG" IS ONLY TRUE OF A CRAFT NOBODY CAN SEE. D162.

    Owner report: the line kept saying the source was fogged while the fleet was
    plainly drawn on the disc — because the row only ever read the RADAR ladder's
    own fields and never the sight the commander already had. Where a circle is
    covering the craft, the honest line is that it is on the disc and can be looked
    at; the origin genuinely stays unsold, and the row no longer implies that the
    craft itself is unseen.
  */
  return i18n.t(seen ? 'pendingStrip.incomingVisible' : 'pendingStrip.incomingHint');
};

/**
 * THE CONTACT THIS WARNING IS ABOUT, IF ANY CIRCLE IS COVERING IT. D162.
 *
 * Matched on the mission uuid the two payloads share. It is the client's only
 * statement of "can I look at this", and it is a LOOKUP rather than a sight
 * calculation on purpose: the server decided what is visible, and a second opinion
 * about sight on this side is exactly what `sight.ts` exists to prevent.
 */
export const contactFor = (
  thread: PendingThread,
  contacts: readonly Contact[],
): Contact | undefined => (thread.contactId === undefined
  ? undefined
  : contacts.find((c) => c.id === thread.contactId));

export const flightTitle = (thread: PendingThread): string => {
  if (thread.kind === 'incoming') {
    /**
     * WHICH OF YOUR WORLDS, AND — AT RADAR L5 — WHERE FROM.
     *
     * The two are different products and they were collapsed into one. The origin
     * is the top of the radar ladder and stays there; the TARGET is your own world
     * and was simply missing, so a commander with four worlds was told a fleet was
     * six minutes out and could not tell which world to defend.
     *
     * `targetPlanetId` gates the pair rather than `targetName`, because the server
     * used to send the literal string "inbound fleet" in that field and a client
     * running against an older build must not print it.
     */
    const world = thread.targetPlanetId === undefined ? undefined : thread.targetName;
    if (world === undefined) {
      return thread.originName === undefined
        ? i18n.t('pendingStrip.incoming')
        : i18n.t('pendingStrip.incomingFrom', { origin: thread.originName });
    }
    return thread.originName === undefined
      ? i18n.t('pendingStrip.incomingAt', { world })
      : i18n.t('pendingStrip.incomingFromAt', { world, origin: thread.originName });
  }
  if (thread.kind === 'probe') return i18n.t('pendingStrip.probe', { target: thread.targetName });
  if (thread.kind === 'death_star') return i18n.t('pendingStrip.deathStar', { target: thread.targetName });
  if (thread.kind === 'settlement') return i18n.t('pendingStrip.settlement', { target: thread.targetName });
  if (thread.kind === 'transfer') return i18n.t('pendingStrip.transfer', { target: thread.targetName });
  /*
    THE MERCHANT IS NAMED FROM THE LOCALE FILES, never from `targetName`. D156.

    That field carries the stable event-kind identifier `TRADE_SHIP` — there is no
    world on the far end to borrow a name from — and printing a wire identifier at
    a player is the failure this branch exists to prevent.
  */
  if (thread.kind === 'trade') {
    return i18n.t(thread.leg === 'return' ? 'pendingStrip.tradeHome' : 'pendingStrip.tradeOut');
  }
  if (thread.kind === 'intergalactic_convoy') {
    return i18n.t(
      thread.leg === 'return'
        ? 'pendingStrip.intergalacticConvoyHome'
        : 'pendingStrip.intergalacticConvoyOut',
    );
  }
  if (thread.kind === 'pirate') {
    /*
      NAMED FROM THE LEVEL AND THE CALLSIGN, never from a server sentence. There is
      no world on the far end to borrow a name from, and the copy that names a
      pirate belongs in the locale files like every other user-facing string.
    */
    const name = thread.pirate
      ? i18n.t('pirate.name', { level: thread.pirate.level, callsign: thread.pirate.callsign })
      : i18n.t('pirate.title');
    return i18n.t(
      thread.leg === 'return' ? 'pendingStrip.pirateHome' : 'pendingStrip.pirateOut',
      { target: name },
    );
  }
  return i18n.t(thread.leg === 'return' ? 'pendingStrip.fleetHome' : 'pendingStrip.fleetOut', {
    target: thread.targetName,
  });
};

export const runTitle = (run: MiningRun): string => {
  if (run.status === 'returning') return i18n.t('pendingStrip.drillHome');
  if (run.targetKind === 'debris') return i18n.t('pendingStrip.salvageOut');
  return i18n.t('pendingStrip.drillOut');
};

export const runArrival = (run: MiningRun): number =>
  (run.status === 'returning' ? run.homeAt ?? run.arriveAt : run.arriveAt).getTime();

/**
 * THE INSTANT ITSELF, not a figure rebuilt from a rounded one.
 *
 * This used to be `answeredAt + minutesRemaining * 60_000`, which is accurate to
 * within half a minute and no better. The attacker's own strip read the exact
 * `arriveAt` off the thread's path, and a defender — whose inbound thread has no
 * path, deliberately — got the reconstruction. So the two players watching the
 * same fleet counted down to instants up to thirty seconds apart, which reads as
 * the game being unable to agree with itself about when it will land.
 *
 * `answeredAt` is no longer needed at all: an absolute timestamp does not have to
 * be anchored to anything.
 */
export const arrivalOf = (thread: PendingThread): number => thread.arriveAt.getTime();
