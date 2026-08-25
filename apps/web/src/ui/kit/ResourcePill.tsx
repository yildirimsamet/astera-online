import { Meter } from './Meter.js';
import { useJump } from './useCountUp.js';
import { RESOURCE_ART } from '../assets.js';
import { full } from '../../lib/format.js';
import { duration } from '../../lib/time.js';

/**
 * What you hold, and how long you have before you start wasting it.
 *
 * The HUD's one job. Both numbers move on their own — the stock because it is being
 * produced, the season because it is ending — which is why this never leaves the
 * screen.
 *
 * The ceiling is stated as TIME rather than as a fraction, and that is a product
 * decision, not a formatting one. Production stops at the cap, so "83%" is not the
 * number that matters; how long until you are throwing hours away is. `interface.md`
 * finding 5: the honest version of a storage cap shows the waste on screen, in-app
 * and factual, instead of pushing a notification about it.
 *
 * This is also the one place the 450px resource renders earn their size — at 30px in
 * a lit socket they read as objects you own, which is the whole ownership pillar in
 * the smallest possible space.
 */
export function ResourcePill({
  kind,
  value,
  cap,
  rate,
}: {
  kind: 'alloy' | 'crystal';
  value: number;
  cap: number;
  rate: number;
}) {
  const atCap = value >= cap - 0.5;
  const near = !atCap && rate > 0 && value > cap * 0.8;
  const popping = useJump(value);

  const tone = kind === 'alloy' ? 'text-alloy' : 'text-crystal';
  const status = atCap
    ? 'FULL'
    : near
      ? `full in ${duration(((cap - value) / rate) * 60)}`
      : `+${full(rate)}/h`;

  return (
    <div className="plate min-w-0 flex-1 px-2 pb-2 pt-2">
      <div className="flex items-center gap-2">
        <span className="socket grid size-[30px] shrink-0 place-items-center rounded-control">
          <img
            src={kind === 'alloy' ? RESOURCE_ART.alloy : RESOURCE_ART.crystal}
            alt=""
            aria-hidden
            className="socket-art size-[23px] object-contain"
          />
        </span>

        <span className={`readout text-figure ${tone} ${popping ? 'pop' : ''} truncate`}>
          {full(value)}
        </span>

        <span
          className={`legend num ml-auto shrink-0 pl-1 ${ atCap ? 'text-threat lit' : near ? 'text-alloy' : 'text-faint' }`}
        >
          {status}
        </span>
      </div>

      <p className="sr-only">{kind}</p>

      <div className="mt-2">
        <Meter value={value} cap={cap} tone={kind} cells={10} label={kind} />
      </div>
    </div>
  );
}
