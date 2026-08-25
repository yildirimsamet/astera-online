import { useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HULLS,
  distance,
  fleetCount,
  fleetPower,
  fleetTravelExact,
  resourcesTotal,
  transferCargoCapacity,
  type Fleet,
  type HullId,
} from '@astera/rules';
import { useTransfer } from '../api/queries.js';
import type { GalaxyPlanet, PlanetView } from '../api/schemas.js';
import { hullName } from '../i18n/names.js';
import { compact } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { Button, Sheet } from '../ui/kit/index.js';
import { describe, useToast } from '../ui/Toast.js';

const MOVABLE = (Object.keys(HULLS) as HullId[]).filter((id) => !HULLS[id].ground);
const RESOURCE_ORDER = ['alloy', 'crystal', 'deuterium'] as const;

function fitCargo(
  cargo: Record<(typeof RESOURCE_ORDER)[number], number>,
  capacity: number,
): typeof cargo {
  const total = resourcesTotal(cargo);
  if (total <= capacity) return cargo;
  if (capacity <= 0) return { alloy: 0, crystal: 0, deuterium: 0 };
  const ratio = capacity / total;
  const fitted = {
    alloy: Math.floor(cargo.alloy * ratio),
    crystal: Math.floor(cargo.crystal * ratio),
    deuterium: Math.floor(cargo.deuterium * ratio),
  };
  let spare = capacity - resourcesTotal(fitted);
  for (const resource of RESOURCE_ORDER) {
    const add = Math.min(spare, cargo[resource] - fitted[resource]);
    fitted[resource] += add;
    spare -= add;
  }
  return fitted;
}

export function TransferSheet({
  target,
  planet,
  onClose,
  onLaunched,
}: {
  target: GalaxyPlanet;
  planet: PlanetView;
  onClose: () => void;
  onLaunched: () => void;
}) {
  const { t } = useTranslation();
  const say = useToast();
  const transfer = useTransfer();
  const [fleet, setFleet] = useState<Fleet>({});
  const [cargo, setCargo] = useState({ alloy: 0, crystal: 0, deuterium: 0 });
  const capacity = transferCargoCapacity(fleet);
  const loaded = resourcesTotal(cargo);
  const remainingFleet = useMemo<Fleet>(() => Object.fromEntries(
    (Object.keys(planet.fleet) as HullId[]).map((id) => [
      id,
      Math.max(0, (planet.fleet[id] ?? 0) - (fleet[id] ?? 0)),
    ]),
  ), [fleet, planet.fleet]);
  const homeDefence = fleetPower({ ...remainingFleet, ...planet.ground });
  const eta = useMemo(
    () => fleetCount(fleet) > 0
      ? fleetTravelExact(distance(planet.planet.position, target.position), fleet)
      : 0,
    [fleet, planet.planet.position, target.position],
  );
  const valid = fleetCount(fleet) > 0 && loaded <= capacity
    && cargo.alloy <= planet.planet.alloy
    && cargo.crystal <= planet.planet.crystal
    && cargo.deuterium <= planet.planet.deuterium;

  const setShip = (id: HullId, value: number) => {
    const max = planet.fleet[id] ?? 0;
    const next = { ...fleet, [id]: Math.max(0, Math.min(max, value)) };
    setFleet(next);
    setCargo((current) => fitCargo(current, transferCargoCapacity(next)));
  };

  return (
    <Sheet
      eyebrow={t('transfer.eyebrow')}
      title={target.name}
      onClose={onClose}
      footer={(
        <Button
          variant="commit"
          size="lg"
          full
          disabled={!valid || transfer.isPending}
          onClick={() => { transfer.mutate({ targetPlanetId: target.id, fleet, cargo }, {
            onSuccess: () => {
              say(t('transfer.launched', { duration: duration(eta) }));
              onLaunched();
            },
            onError: (error) => { say(describe(error), 'error'); },
          }); }}
        >
          {transfer.isPending ? t('transfer.sending') : t('transfer.commit')}
        </Button>
      )}
    >
      <div className="grid grid-cols-2 gap-2 pt-4">
        <p className="plate px-3 py-2 text-caption text-dim">
          {t('transfer.eta')} <strong className="text-bone">{eta > 0 ? duration(eta) : '—'}</strong>
        </p>
        <p className="plate px-3 py-2 text-caption text-dim">
          {t('transfer.capacity')} <strong className={loaded > capacity ? 'text-threat-ink' : 'text-bone'}>{compact(loaded)} / {compact(capacity)}</strong>
        </p>
      </div>
      <h3 className="legend mt-4">{t('transfer.fleet')}</h3>
      <p className="mt-1 text-label text-dim">
        {t('transfer.homeDefence', {
          ships: fleetCount(remainingFleet) + fleetCount(planet.ground),
          power: compact(homeDefence),
        })}
      </p>
      <div className="mt-2 space-y-2">
        {MOVABLE.filter((id) => (planet.fleet[id] ?? 0) > 0).map((id) => (
          <div key={id} className="flex min-h-12 items-center gap-3 rounded-chip border border-line-soft px-3">
            <span className="min-w-0 flex-1 text-body text-bone">{hullName(id) ?? id}</span>
            <span className="num text-label text-dim">/{planet.fleet[id] ?? 0}</span>
            <div className="flex items-center overflow-hidden rounded-chip border border-line bg-deep">
              <button
                type="button"
                aria-label={t('launch.fewer', { name: hullName(id) ?? id })}
                disabled={(fleet[id] ?? 0) <= 0}
                onClick={() => { setShip(id, (fleet[id] ?? 0) - 1); }}
                className="grid size-10 place-items-center text-title text-dim enabled:hover:bg-white/5 enabled:hover:text-bone disabled:opacity-25"
              >−</button>
              <output
                aria-live="polite"
                className="num min-w-10 border-x border-line px-2 text-center text-body text-bone"
              >{fleet[id] ?? 0}</output>
              <button
                type="button"
                aria-label={t('launch.more', { name: hullName(id) ?? id })}
                disabled={(fleet[id] ?? 0) >= (planet.fleet[id] ?? 0)}
                onClick={() => { setShip(id, (fleet[id] ?? 0) + 1); }}
                className="grid size-10 place-items-center text-title text-dim enabled:hover:bg-white/5 enabled:hover:text-bone disabled:opacity-25"
              >+</button>
            </div>
          </div>
        ))}
      </div>
      <h3 className="legend mt-4">{t('transfer.cargo')}</h3>
      <div className="mt-2 space-y-3">
        {RESOURCE_ORDER.map((resource) => {
          const stock = Math.floor(planet.planet[resource]);
          const otherCargo = loaded - cargo[resource];
          const max = Math.max(0, Math.floor(Math.min(stock, capacity - otherCargo)));
          const fill = max > 0 ? Math.min(100, (cargo[resource] / max) * 100) : 0;
          return (
          <label key={resource} className="block rounded-chip border border-line-soft bg-deep/55 px-3 py-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className="legend text-dim">
                {t(`transfer.${resource}`)}
              </span>
              <span className="num text-caption text-bone">
                {compact(cargo[resource])} <span className="text-faint">/ {compact(stock)}</span>
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={cargo[resource]}
              onChange={(event) => {
                const value = Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0));
                setCargo((current) => ({ ...current, [resource]: value }));
              }}
              style={{ '--slider-fill': `${String(fill)}%` } as CSSProperties}
              className={`slider slider-${resource} mt-2 w-full`}
            />
          </label>
          );
        })}
      </div>
      <p className="mt-3 text-caption text-dim">{t('transfer.irreversible')}</p>
    </Sheet>
  );
}
