import { useTranslation } from 'react-i18next';
import { MULTI_WORLD, distance, fleetTravelExact, missionFuel } from '@astera/rules';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { full } from '../lib/format.js';
import { flightModifiers } from '../lib/navigation.js';
import { countdown, duration } from '../lib/time.js';
import { Button, Sheet } from '../ui/kit/index.js';

/**
 * Settlement is an irreversible launch into a public race. The focus rail
 * explains how to get here; this sheet says exactly what leaves, what it costs,
 * when it arrives and what happens if somebody else wins first.
 */
export function SettlementSheet({
  target,
  planet,
  now,
  pending,
  onClose,
  onConfirm,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  now: number;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const fleet = { COURIER: MULTI_WORLD.settlement.transports } as const;
  const span = distance(planet.planet.position, target.position);
  /*
    THE COMMANDER'S LADDER, AND DELIBERATELY NOT THEIR BEACON. D180.

    `launchSettlement` on the server passes `{ boost: 1, tech }` — real research,
    no Beacon — so this quotes the same. The asymmetry with every other lane
    (a transfer and a raid both take the Beacon) is the SERVER's, and it is
    mirrored here rather than corrected here: a preview that disagreed with the
    launch would be the bug this whole change exists to remove. If that boost is
    wrong it is wrong in `movement.ts`, and this line moves when that one does.
  */
  const travelMinutes = fleetTravelExact(
    span, fleet, { boost: 1, tech: flightModifiers(planet).tech },
  );
  const fuel = missionFuel(fleet, span, 1);
  const closesIn = Math.max(0, (target.neutral?.claimUntil?.getTime() ?? now) - now);
  const tier = target.neutral?.tier;
  const opening = tier === undefined ? null : MULTI_WORLD.neutral[tier].captureStock;

  return (
    <Sheet
      eyebrow={t('focus.planet.settlementConfirm.eyebrow')}
      title={target.intel === 'UNKNOWN'
        ? t('focus.planet.settlementConfirm.unsurveyedTitle')
        : t('focus.planet.settlementConfirm.title', { world: target.name })}
      onClose={onClose}
      footer={
        <Button
          variant="commit"
          size="lg"
          full
          disabled={pending}
          onClick={onConfirm}
        >
          {pending
            ? t('focus.planet.settlementConfirm.confirming')
            : t('focus.planet.settlementConfirm.confirm')}
        </Button>
      }
    >
      {/*
        FOUR CLASSES IN THIS FILE RESOLVED TO NOTHING, and the sheet had been
        shipping without any of them: `plate-crystal` (the lit tone is `plate-lit`),
        `rounded-panel` (no such radius), `text-muted` (the ink is `text-dim`) and
        a `text-title text-figure` pair where the second silently overrode the
        first. A commitment surface that renders as a flat unlit box is exactly
        the "every screen looks like a different designer made it" the owner
        reported; `surface-vocabulary.test.ts` now refuses a class that means
        nothing.
      */}
      <div className="plate plate-lit px-3 py-3">
        <p className="headline">
          {t('focus.planet.settlementConfirm.race')}
        </p>
        <p className="mt-2 text-body text-dim">
          {t('focus.planet.settlementConfirm.noRecall')}
        </p>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-plate bg-line/50">
        <SettlementFact
          label={t('focus.planet.settlementConfirm.transports')}
          value={String(MULTI_WORLD.settlement.transports)}
        />
        {/*
          ONE COST AND ONE OPENING. D209, owner instruction.
          The cargo and the fee used to be two rows because the cargo landed as the
          colony's stock. Nothing lands now: the whole charge is spent on success and
          the world opens on its tier's `captureStock`, which is only stated for a
          tier this commander can actually read.
        */}
        <SettlementFact
          label={t('focus.planet.settlementConfirm.foundingCost')}
          value={t('focus.planet.settlementConfirm.cargoValue', {
            alloy: full(MULTI_WORLD.settlement.charge.alloy),
            crystal: full(MULTI_WORLD.settlement.charge.crystal),
          })}
        />
        <SettlementFact
          label={t('focus.planet.settlementConfirm.fuel')}
          value={full(fuel)}
        />
        <SettlementFact
          label={t('focus.planet.settlementConfirm.arrives')}
          value={duration(travelMinutes)}
        />
        <SettlementFact
          label={t('focus.planet.settlementConfirm.closes')}
          value={countdown(closesIn)}
        />
        {opening && (
          <SettlementFact
            wide
            label={t('focus.planet.settlementConfirm.opensWith')}
            value={t('focus.planet.settlementConfirm.stockValue', {
              alloy: full(opening.alloy),
              crystal: full(opening.crystal),
              deuterium: full(opening.deuterium),
            })}
          />
        )}
      </dl>
    </Sheet>
  );
}

function SettlementFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    /*
      A CELL IN A HAIRLINE GRID, so the ground is opaque on purpose — the `gap-px`
      above is what draws the rules between them, and a translucent cell would
      show the sheet through its own table. It is not a card and takes no plate.
    */
    <div className={`bg-plate px-3 py-3${wide ? ' col-span-2' : ''}`}>
      <dt className="legend">{label}</dt>
      <dd className="num mt-1 text-body text-bone">{value}</dd>
    </div>
  );
}
