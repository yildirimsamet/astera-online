import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { REWARD_CHAIN_IDS, type RewardChainId } from '@astera/rules';
import { useClaimReward, usePlanet, useRewards } from '../api/queries.js';
import { useWorld } from '../api/world.js';
import type { RewardChainView, RewardTierView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { useAccordion } from '../lib/accordion.js';
import { haptic } from '../lib/haptics.js';
import { Icon, type IconId } from '../v2/icons.js';
import { Button, EmptyState, Plate, PriceTag } from '../v2/kit/Surface.js';
import { describe, useToast } from '../ui/Toast.js';

const CHAIN_ICON: Record<RewardChainId, IconId> = {
  PROBE: 'i-probe', RAID: 'i-attack', CORE: 'i-base', SHIPYARD: 'i-fleet',
  REFINERY: 'i-collect', EXTRACTOR: 'i-mine', SHIPS: 'i-fleet', AEGIS: 'i-shield',
  VAULT: 'i-lock', PIRATE: 'm-pirate', MINE: 'm-rock', SALVAGE: 'm-debris', SOCIAL: 'i-gift',
};

type KnownChain = RewardChainView & { id: RewardChainId };
const known = (chain: RewardChainView): chain is KnownChain =>
  REWARD_CHAIN_IDS.some((id) => id === chain.id);

/** The server owns progress and credits. This surface makes the next act and payout legible. */
export function RewardsScreen({ commander }: { commander: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useRewards();
  const planet = usePlanet();
  const { capitalPlanetId, worlds } = useWorld();
  const claim = useClaimReward();
  const say = useToast();
  const ladder = useAccordion('rewards', []);

  const chains = useMemo(() => {
    const rows = (data?.chains ?? []).filter(known);
    // The community bonus remains pinned; ready goals retain server order within their group.
    const social = rows.filter((chain) => chain.metric === 'grant');
    const goals = rows.filter((chain) => chain.metric !== 'grant');
    return [...social, ...goals.filter((chain) => chain.tiers.some((tier) => tier.state === 'claimable')),
      ...goals.filter((chain) => !chain.tiers.some((tier) => tier.state === 'claimable'))];
  }, [data]);

  if (isError) return <div role="alert" className="py-5 font-v2-ui">
    <Plate className="p-4">
      <Icon id="i-warn" className="mb-3 size-6 text-v2-warn" />
      <p className="text-caption leading-relaxed text-v2-ink-2">{t('surface.unreachable', { what: t('surface.whatRewards') })}</p>
      <Button className="mt-3" onClick={() => { void refetch(); }}>{t('surface.retry')}</Button>
    </Plate>
  </div>;
  if (isPending) return <div aria-busy="true" aria-label={t('rewards.title')} className="grid gap-3 py-3">
    {[0, 1, 2].map((index) => <Plate key={index} className="grid gap-3 p-4">
      <span className="h-3 w-1/3 animate-pulse rounded-chip bg-v2-raise" />
      <span className="h-10 animate-pulse rounded-control bg-v2-raise/60" />
    </Plate>)}
  </div>;
  if (chains.length === 0) return <div data-v2-rewards className="py-3 font-v2-ui">
    <EmptyState icon={<Icon id="i-gift" className="size-6" />} title={t('rewards.empty')}
      action={<Button className="mt-2" onClick={() => { void refetch(); }}>{t('surface.retry')}</Button>}>
      {t('rewards.emptyHint')}
    </EmptyState>
  </div>;

  // Credits go to the capital even while a colony is selected. Overflow is per single claim.
  const held = capitalPlanetId
    ? worlds.find((world) => world.planet.id === capitalPlanetId)?.planet
    : planet.data?.planet;
  const tiers = chains.flatMap((chain) => chain.tiers);
  const taken = tiers.filter((tier) => tier.state === 'claimed').length;
  const ready = tiers.filter((tier) => tier.state === 'claimable');
  const overflowing = held !== undefined && ready.some((tier) =>
    held.alloy + tier.alloy > held.alloyCap || held.crystal + tier.crystal > held.crystalCap);
  const onClaim = (id: string) => {
    haptic('commit');
    claim.mutate(id, {
      onSuccess: (result) => { say(t('rewards.granted', { alloy: compact(result.granted.alloy), crystal: compact(result.granted.crystal) })); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };

  return <div data-v2-rewards className="flex flex-col gap-3 pb-5 pt-2 font-v2-ui text-v2-ink">
    <div className="grid grid-cols-2 divide-x divide-v2-line rounded-control border border-v2-line bg-v2-deep">
      <div className="p-3">
        <p className="text-micro text-v2-ink-3">{t('rewards.summaryReady')}</p>
        <p className={`mt-1 text-readout font-semibold leading-none tabular-nums ${ready.length > 0 ? 'text-v2-self' : 'text-v2-ink-2'}`}>{full(ready.length)}</p>
      </div>
      <div className="p-3">
        <p className="text-micro text-v2-ink-3">{t('rewards.summaryClaimed')}</p>
        <p className="mt-1 text-readout font-semibold leading-none tabular-nums">{full(taken)}<span className="ml-1 text-body font-normal text-v2-ink-3">/ {full(tiers.length)}</span></p>
      </div>
    </div>
    <p className="text-caption leading-relaxed text-v2-ink-2">{t('rewards.intro')}</p>
    {overflowing && <div className="flex items-start gap-2 rounded-control border border-v2-warn/30 bg-v2-warn/5 p-3">
      <Icon id="i-warn" className="mt-0.5 size-4 shrink-0 text-v2-warn" />
      <p className="text-caption leading-relaxed text-v2-ink-2">{t('rewards.overCap')}</p>
    </div>}
    <ul className="grid gap-3">
        {chains.map((chain) => chain.metric === 'grant'
          ? <SocialCard key={chain.id} chain={chain} commander={commander} busy={claim.isPending} onClaim={onClaim} />
          : <GoalCard key={chain.id} chain={chain} expanded={ladder.isOpen(chain.id)} onToggle={() => { ladder.toggle(chain.id); }} busy={claim.isPending} onClaim={onClaim} />)}
    </ul>
  </div>;
}

function GoalCard({ chain, expanded, onToggle, busy, onClaim }: {
  chain: KnownChain; expanded: boolean; onToggle: () => void; busy: boolean; onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const waiting = chain.tiers.some((tier) => tier.state === 'claimable');
  const done = chain.tiers.every((tier) => tier.state === 'claimed');
  const taken = chain.tiers.filter((tier) => tier.state === 'claimed').length;
  const next = chain.tiers.find((tier) => tier.state === 'locked');
  const standing = done ? t('rewards.progressDone') : chain.metric === 'level'
    ? t('rewards.progressLevel', { have: chain.progress })
    : next ? t('rewards.progressCount', { have: chain.progress, need: next.goal }) : full(chain.progress);
  const name = t(`rewards.chains.${chain.id}.name`);
  // Every earned payout stays pressable; only history and later locked tiers fold away.
  const visible = expanded ? chain.tiers : chain.tiers.filter((tier) => tier.state === 'claimable' || tier === next);
  const panelId = `reward-tiers-${chain.id}`;

  return <li data-reward-chain={chain.id}>
    <Plate className="overflow-hidden">
      <div className={`flex items-start gap-3 p-3 ${waiting ? 'border-t-2 border-v2-self' : 'border-t-2 border-transparent'}`}>
        <span className={`grid size-10 shrink-0 place-items-center rounded-control border bg-v2-deep ${waiting ? 'border-v2-self/25 text-v2-self' : 'border-v2-line text-v2-ink-3'}`}>
          <Icon id={CHAIN_ICON[chain.id]} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
            <h3 className="text-body font-semibold leading-snug">{name}</h3>
            <span className={`text-caption font-semibold tabular-nums ${waiting ? 'text-v2-self' : 'text-v2-ink-2'}`}>{standing}</span>
          </div>
          <p className="mt-1 text-caption leading-snug text-v2-ink-3">{t(`rewards.chains.${chain.id}.tag`)}</p>
          <div className="mt-3 flex gap-1" role="img" aria-label={`${t('rewards.summaryClaimed')}: ${taken} / ${chain.tiers.length}`}>
            {chain.tiers.map((tier) => <span key={tier.id} aria-hidden="true" className={`h-1 flex-1 rounded-full ${tier.state === 'claimed' ? 'bg-v2-self' : tier.state === 'claimable' ? 'bg-v2-self/40 ring-1 ring-v2-self/50' : 'bg-v2-line'}`} />)}
          </div>
        </div>
      </div>
      <ul id={panelId} className="divide-y divide-v2-line border-t border-v2-line bg-v2-deep/60">
        {visible.map((tier) => <TierRow key={tier.id} tier={tier} metric={chain.metric} progress={chain.progress} busy={busy} onClaim={onClaim} />)}
      </ul>
      {visible.length < chain.tiers.length || expanded ? <button type="button" onClick={onToggle}
        aria-expanded={expanded} aria-controls={panelId} aria-label={`${t('rewards.allMilestones')} · ${name}`}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-v2-line px-3 text-caption text-v2-ink-2 transition-colors hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self">
        <span>{t('rewards.allMilestones')}<span className="ml-2 text-micro tabular-nums text-v2-ink-3">{taken} / {chain.tiers.length}</span></span>
        <Icon id="i-chev" className={`size-4 transition-transform duration-200 ${expanded ? '-rotate-90' : 'rotate-90'}`} />
      </button> : null}
    </Plate>
  </li>;
}

function SocialCard({ chain, commander, busy, onClaim }: {
  chain: KnownChain; commander: string; busy: boolean; onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const tier = chain.tiers[0];
  if (!tier) return null;
  const ready = tier.state === 'claimable';
  const taken = tier.state === 'claimed';
  const forever = taken && chain.scope === 'account';

  return <li data-reward-chain={chain.id}>
    <Plate className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-v2-line p-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-control border bg-v2-deep ${ready ? 'border-v2-self/30 text-v2-self' : 'border-v2-line-hi text-v2-ink-2'}`}><Icon id="i-gift" className="size-6" /></span>
        <div className="min-w-0">
          <p className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3">{t('rewards.social.eyebrow')}</p>
          <h3 className="mt-1 text-body font-semibold leading-snug">{t('rewards.chains.SOCIAL.name')}</h3>
          {!taken && chain.scope === 'account' && <p className="mt-1 text-micro text-v2-ink-3">{t('rewards.chains.SOCIAL.tag')}</p>}
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          {(['alloy', 'crystal'] as const).map((resource) => <div key={resource} className="rounded-control border border-v2-line bg-v2-deep p-2.5">
            <p className="text-micro text-v2-ink-3">{t(`vocabulary.resource.${resource}`)}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1"><PriceTag exact {...(resource === 'alloy' ? { alloy: tier.alloy } : { crystal: tier.crystal })} className="[&_img]:size-5 [&_span]:text-title" /></div>
          </div>)}
        </div>
        {!taken && <ol className="grid gap-2.5">
          <Step n={1}>{t('rewards.social.step1')}</Step>
          <Step n={2}>{t('rewards.social.step2')}<span className="mt-1.5 block break-all rounded-control border border-v2-line-hi bg-v2-deep px-2 py-1.5 font-v2-mono text-caption text-v2-ink">{commander}</span></Step>
          <Step n={3}>{t('rewards.social.step3')}</Step>
        </ol>}
        {!taken && <a href={t('rewards.social.url')} target="_blank" rel="noreferrer noopener"
          className="flex min-h-11 items-center justify-center gap-2 rounded-control border border-v2-line-hi bg-v2-raise/60 px-3 py-2 text-caption text-v2-ink transition-colors hover:bg-v2-raise focus-visible:outline-2 focus-visible:outline-v2-self">
          {t('rewards.social.open')}<Icon id="i-share" className="size-4 shrink-0" />
        </a>}
        {ready ? <span data-reward-claim={tier.id}><Button full variant="primary" size="lg" disabled={busy} onClick={() => { onClaim(tier.id); }}>{t('rewards.social.ready')}</Button></span>
          : <div className="flex items-start gap-2 border-t border-v2-line pt-3 text-caption leading-relaxed text-v2-ink-3">
            <Icon id={taken ? 'i-check' : 'i-clock'} className={`mt-0.5 size-4 shrink-0 ${taken ? 'text-v2-self' : ''}`} />
            <p>{forever ? t('rewards.social.forever') : taken ? t('rewards.claimed') : t('rewards.social.pending')}</p>
          </div>}
      </div>
    </Plate>
  </li>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return <li className="flex items-start gap-2.5">
    <span className="grid size-5 shrink-0 place-items-center rounded-full border border-v2-line-hi font-v2-mono text-micro text-v2-ink-3">{n}</span>
    <div className="min-w-0 text-caption leading-relaxed text-v2-ink-2">{children}</div>
  </li>;
}

function TierRow({ tier, metric, progress, busy, onClaim }: {
  tier: RewardTierView; metric: string; progress: number; busy: boolean; onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const claimed = tier.state === 'claimed';
  const ready = tier.state === 'claimable';
  const target = metric === 'level' ? t('rewards.goalLevel', { n: tier.goal }) : t('rewards.goalCount', { n: tier.goal });
  const reach = tier.goal > 0 ? Math.max(0, Math.min(1, progress / tier.goal)) : 1;

  return <li data-reward-tier={tier.id} className={`relative grid gap-1.5 px-3 py-2.5 ${claimed ? 'text-v2-ink-3' : ''}`}>
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <span className="text-caption font-semibold tabular-nums">{target}</span>
      <span className={`text-micro tabular-nums ${ready ? 'text-v2-self' : 'text-v2-ink-3'}`}>
        {ready ? t('rewards.waiting', { count: 1 }) : claimed ? t('rewards.claimed') : t('rewards.toGo', { count: Math.max(0, tier.goal - progress) })}
      </span>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <PriceTag alloy={tier.alloy} crystal={tier.crystal} exact className={`flex-wrap ${claimed ? 'opacity-50' : ''}`} />
      {ready && <span data-reward-claim={tier.id}><Button size="md" variant="primary" disabled={busy} onClick={() => { onClaim(tier.id); }}>{t('rewards.claim')}</Button></span>}
    </div>
    {!claimed && !ready && <div aria-hidden="true" className="mt-1 h-0.5 overflow-hidden rounded-full bg-v2-line"><span data-tier-reach className="block h-full origin-left bg-v2-ink-3/60" style={{ transform: `scaleX(${String(reach)})` }} /></div>}
  </li>;
}
