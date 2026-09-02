import { useTranslation } from 'react-i18next';
import { MULTI_WORLD, distance, fleetTravelExact, missionFuel } from '@astera/rules';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { full } from '../lib/format.js';
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
  const travelMinutes = fleetTravelExact(span, fleet);
  const fuel = missionFuel(fleet, span, 1);
  const closesIn = Math.max(0, (target.neutral?.claimUntil?.getTime() ?? now) - now);

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
      <div className="plate plate-crystal px-4 py-4">
        <p className="text-title text-figure">
          {t('focus.planet.settlementConfirm.race')}
        </p>
        <p className="mt-2 text-body text-muted">
          {t('focus.planet.settlementConfirm.noRecall')}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-line/50">
        <SettlementFact
          label={t('focus.planet.settlementConfirm.transports')}
          value={String(MULTI_WORLD.settlement.transports)}
        />
        <SettlementFact
          label={t('focus.planet.settlementConfirm.foundingCargo')}
          value={t('focus.planet.settlementConfirm.cargoValue', {
            alloy: full(MULTI_WORLD.settlement.cost.alloy),
            crystal: full(MULTI_WORLD.settlement.cost.crystal),
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
      </dl>
    </Sheet>
  );
}

function SettlementFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-deep/90 px-3 py-3">
      <dt className="legend">{label}</dt>
      <dd className="mt-1 text-body text-figure">{value}</dd>
    </div>
  );
}
