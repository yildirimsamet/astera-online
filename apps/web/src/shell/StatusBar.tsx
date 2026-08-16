import { useEffect, useRef, useState } from 'react';
import { usePlanet, useSeason } from '../api/queries.js';
import { compact, full } from '../lib/format.js';
import { duration } from '../lib/time.js';
import { useProjectedResources } from '../lib/projection.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Meter } from '../ui/Meter.js';
import { Signals } from './Signals.js';
import type { Tab } from './TabBar.js';

/**
 * What you hold, and how long the season has left.
 *
 * Both numbers move on their own — the stock because it is being produced, the
 * season because it is ending — and that is the whole game in one strip, which is
 * why it never leaves the screen.
 */
export function StatusBar({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { data, dataUpdatedAt } = usePlanet();
  const season = useSeason();
  const held = useProjectedResources(data?.planet, dataUpdatedAt);

  if (!data) return <div className="h-[70px]" />;

  const hoursLeft = season.data
    ? Math.max(0, (season.data.endsAt.getTime() - Date.now()) / 3_600_000)
    : null;

  return (
    <header className="relative shrink-0 border-b border-line bg-gradient-to-b from-[#0b1120] to-void px-3 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))]">
      <div className="flex items-end gap-3">
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
        <div className="flex shrink-0 items-end gap-2 pb-0.5">
          <div className="text-right">
            <p className="legend">Season</p>
            <p className="readout mt-1 text-[13px] text-dim">
              {hoursLeft === null ? '—' : duration(hoursLeft * 60)}
            </p>
          </div>
          <Signals onNavigate={onNavigate} />
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
  const near = !atCap && rate > 0 && value > cap * 0.8;
  const colour = tone === 'alloy' ? 'text-alloy' : 'text-crystal';
  const pop = useJump(value);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-center gap-1.5">
        <img
          src={tone === 'alloy' ? RESOURCE_ART.alloy : RESOURCE_ART.crystal}
          alt=""
          aria-hidden
          className="size-5 shrink-0 object-contain drop-shadow-[0_0_5px_rgba(120,160,220,0.35)]"
        />
        <span className={`readout text-[18px] ${colour} ${pop ? 'pop' : ''}`}>{full(value)}</span>
        {/*
          The ceiling, stated as time rather than as a fraction.
          Production stops at the cap, so the number that matters is not "83%" —
          it is how long you have before you start throwing hours away.
        */}
        <span className={`num ml-auto text-[10px] ${atCap ? 'text-threat' : near ? 'text-alloy' : 'text-faint'}`}>
          {atCap ? 'FULL' : near ? `full in ${duration(((cap - value) / rate) * 60)}` : `+${compact(rate)}/h`}
        </span>
      </div>
      <p className="sr-only">{label}</p>
      <div className="mt-1.5">
        <Meter value={value} cap={cap} tone={tone} cells={10} />
      </div>
    </div>
  );
}

/**
 * True for a moment after a value jumps by more than the trickle.
 *
 * Production creeps up a few units a second and must not twitch; a raid landing or
 * a fleet coming home with loot moves thousands, and that deserves to be felt. The
 * threshold is what separates the two.
 */
function useJump(value: number): boolean {
  const previous = useRef(value);
  const [popping, setPopping] = useState(false);

  useEffect(() => {
    const delta = Math.abs(value - previous.current);
    const material = delta > Math.max(50, previous.current * 0.04);
    previous.current = value;
    if (!material) return;

    setPopping(true);
    const id = setTimeout(() => {
      setPopping(false);
    }, 450);
    return () => {
      clearTimeout(id);
    };
  }, [value]);

  return popping;
}
