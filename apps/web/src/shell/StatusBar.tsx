import { usePlanet, useSeason } from '../api/queries.js';
import { compact, full } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { useProjectedResources } from '../lib/projection.js';
import { Meter } from '../ui/primitives.js';
import { RESOURCE_ART } from '../ui/assets.js';

/**
 * The instrument strip: what you hold, and how long the season has left.
 *
 * Both numbers move on their own — the stock because it is being produced, the
 * season because it is ending. That is the whole game in two lines, and it is why
 * they are always on screen.
 */
export function StatusBar() {
  const { data, dataUpdatedAt } = usePlanet();
  const season = useSeason();
  const held = useProjectedResources(data?.planet, dataUpdatedAt);

  if (!data) return <div className="h-[62px]" />;

  const hoursLeft = season.data
    ? Math.max(0, (season.data.endsAt.getTime() - Date.now()) / 3_600_000)
    : null;

  return (
    <header className="shrink-0 border-b border-line-soft bg-void/90 px-4 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="flex items-end gap-5">
        <Stock
          label="Alloy"
          value={held.alloy}
          cap={data.planet.alloyCap}
          rate={data.planet.alloyPerHour}
          tone="alloy"
        />
        <Stock
          label="Crystal"
          value={held.crystal}
          cap={data.planet.crystalCap}
          rate={data.planet.crystalPerHour}
          tone="crystal"
        />
        <div className="shrink-0 text-right">
          <p className="legend">Season</p>
          <p className="num text-[13px] leading-tight text-dim">
            {hoursLeft === null ? '—' : duration(hoursLeft * 60)}
          </p>
        </div>
      </div>
    </header>
  );
}

function Stock({
  label,
  value,
  cap,
  rate,
  tone,
}: {
  label: string;
  value: number;
  cap: number;
  rate: number;
  tone: 'alloy' | 'crystal';
}) {
  const atCap = value >= cap - 0.5;
  const colour = tone === 'alloy' ? 'text-alloy' : 'text-crystal';

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <img
            src={tone === 'alloy' ? RESOURCE_ART.alloy : RESOURCE_ART.crystal}
            alt=""
            aria-hidden
            className="size-4 shrink-0 object-contain"
          />
          <span className="legend">{label}</span>
        </span>
        {/* Full storage is production being thrown away — say so, once, quietly. */}
        <span className={`num text-[10px] ${atCap ? 'text-alert' : 'text-faint'}`}>
          {atCap ? 'full' : `+${compact(rate)}/h`}
        </span>
      </div>
      <p className={`num text-[17px] leading-tight ${colour}`}>{full(value)}</p>
      <div className="mt-1">
        <Meter value={value} cap={cap} tone={tone} />
      </div>
    </div>
  );
}
