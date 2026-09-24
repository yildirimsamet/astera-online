import i18n from '../../i18n/index.js';
import { compact } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';

type Resource = 'alloy' | 'crystal' | 'deuterium';
interface Amounts { alloy: number; crystal: number; deuterium?: number }

/**
 * A PRICE IN RESOURCE MARKS, quiet: a ladder's column and a footer's line. Each
 * resource wears its icon (K2: a resource colour never appears without it), and a part
 * the purse cannot meet turns warn — a gap you close by waiting, not a threat. A zero
 * part is left out: "0 crystal" is a figure that says nothing.
 */
export function Cost({ cost, held }: { cost: Amounts; held?: Amounts }) {
  const part = (resource: Resource) => {
    const amount = cost[resource] ?? 0;
    if (amount <= 0 && resource !== 'alloy') return null;
    const short = held !== undefined && amount > (held[resource] ?? 0);
    return (
      <span key={resource} className={`flex items-center gap-1 ${short ? 'text-v2-warn' : 'text-v2-ink'}`}>
        <img
          src={RESOURCE_ART[resource]}
          alt={i18n.t(`vocabulary.resource.${resource}`)}
          className="size-3.5 shrink-0 object-contain"
        />
        {compact(amount)}
      </span>
    );
  };
  return (
    <span className="flex shrink-0 items-center gap-2 font-v2-mono text-caption tabular-nums">
      {part('alloy')}
      {part('crystal')}
      {part('deuterium')}
    </span>
  );
}
