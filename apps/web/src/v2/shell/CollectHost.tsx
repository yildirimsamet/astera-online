import { useTranslation } from 'react-i18next';
import { useCollect, usePlanet } from '../../api/queries.js';
import { collectState } from '../../lib/collect.js';
import { compact } from '../../lib/format.js';
import { haptic } from '../../lib/haptics.js';
import { useProjected } from '../../lib/projection.js';
import { describe, useToast } from '../../ui/Toast.js';
import { CollectBubble } from '../hud/CollectBubble.js';

/**
 * THE COLLECT BUBBLE, WIRED. Spec B13 (docs/ui-v2/gozlemevi.md).
 *
 * Drawn over the active world by the galaxy (`GalaxyCanvas`'s `homeOverlay`). It
 * reads the works projected second by second — the planet query has no poll, so
 * a bubble fed only by fetches would never rise — and collects with the request
 * and the toast the header's Works control used, which it replaced: the amount
 * that came in, or the part that would not fit.
 */
export function CollectHost({ onOpenBase }: { onOpenBase: () => void }) {
  const { t } = useTranslation();
  const planet = usePlanet();
  const held = useProjected(planet.data?.planet, planet.dataUpdatedAt, 1_000);
  const collect = useCollect();
  const say = useToast();
  const world = planet.data?.planet;
  if (!world) return null;

  const state = collectState({
    caps: { alloy: world.bufferAlloyCap, crystal: world.bufferCrystalCap, deuterium: world.bufferDeuteriumCap },
    works: { alloy: held.bufferAlloy, crystal: held.bufferCrystal, deuterium: held.bufferDeuterium },
    store: { alloy: held.alloy, crystal: held.crystal, deuterium: held.deuterium },
    storeCaps: { alloy: world.alloyCap, crystal: world.crystalCap, deuterium: world.deuteriumCap },
  });

  return (
    <CollectBubble
      state={state}
      pending={collect.isPending}
      onOpenBase={onOpenBase}
      onCollect={() => {
        haptic('commit');
        collect.mutate(undefined, {
          onSuccess: (result) => {
            const moved = Math.round(result.moved.alloy + result.moved.crystal + result.moved.deuterium);
            const kept = Math.round(result.blocked.alloy + result.blocked.crystal + result.blocked.deuterium);
            say(
              kept > 0
                ? t('statusBar.works.collectedPartly', { moved: compact(moved), held: compact(kept) })
                : t('statusBar.works.collected', { amount: compact(moved) }),
              kept > 0 ? 'error' : undefined,
            );
          },
          onError: (error) => { say(describe(error), 'error'); },
        });
      }}
    />
  );
}
