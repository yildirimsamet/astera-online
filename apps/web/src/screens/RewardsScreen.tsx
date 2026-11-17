import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { REWARD_CHAIN_IDS, type RewardChainId } from '@astera/rules';
import { useClaimAllRewards, useClaimReward, usePlanet, useRewards } from '../api/queries.js';
import { useWorld } from '../api/world.js';
import type { RewardChainView, RewardTierView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { useAccordion } from '../lib/accordion.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Banner, CostLine, EmptyState, GameButton, Glyph, InfoPeek, ProgressBar, RewardPod, artIconSrc, type GlyphId } from '../game-ui/index.js';
import { describe, useToast } from '../ui/Toast.js';
import { nextRewardGoal, rewardGate, type RewardGate } from '../lib/rewardGates.js';

const CHAIN_GLYPH: Record<RewardChainId, GlyphId> = {
  PROBE: 'eye', RAID: 'attack', CORE: 'home', SHIPYARD: 'rocket',
  REFINERY: 'fuel', EXTRACTOR: 'mine', SHIPS: 'rocket', AEGIS: 'shield',
  VAULT: 'lock', PIRATE: 'pirate', MINE: 'asteroid', SALVAGE: 'debris', SOCIAL: 'crate',
};

/** How long an opened pod keeps what was in it on show before the next one stands in its place. */
const LOOT_MS = 1800;

type KnownChain = RewardChainView & { id: RewardChainId };
const known = (chain: RewardChainView): chain is KnownChain =>
  REWARD_CHAIN_IDS.some((id) => id === chain.id);

/** The server owns progress and credits. This surface makes the next act and payout legible. */
export function RewardsScreen({ commander, onGo }: { commander: string; onGo?: (gate: RewardGate) => void }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useRewards();
  const planet = usePlanet();
  const { capitalPlanetId, worlds } = useWorld();
  const claim = useClaimReward();
  const claimAll = useClaimAllRewards();
  const say = useToast();
  const ladder = useAccordion('rewards', []);

  const chains = useMemo(() => {
    const rows = (data?.chains ?? []).filter(known);
    // The community bonus remains pinned (owner); ready goals retain server order within their group.
    const social = rows.filter((chain) => chain.metric === 'grant');
    const goals = rows.filter((chain) => chain.metric !== 'grant');
    return [...social, ...goals.filter((chain) => chain.tiers.some((tier) => tier.state === 'claimable')),
      ...goals.filter((chain) => !chain.tiers.some((tier) => tier.state === 'claimable'))];
  }, [data]);

  // The pod just opened keeps its loot on show for a moment, whatever the list says meanwhile.
  const [opened, setOpened] = useState<RewardTierView | null>(null);
  useEffect(() => {
    if (opened === null) return;
    const timer = window.setTimeout(() => { setOpened(null); }, LOOT_MS);
    return () => { window.clearTimeout(timer); };
  }, [opened]);

  if (isError) return <div role="alert" className="gk-rewards gk-rewards--state">
    <Banner tone="hostile" title={t('surface.unreachable', { what: t('surface.whatRewards') })}
      action={<GameButton size="sm" glyph="refresh" onPress={() => { void refetch(); }}>{t('surface.retry')}</GameButton>} />
  </div>;
  if (isPending) return <div aria-busy="true" aria-label={t('rewards.title')} className="gk-rewards gk-rewards--state">
    {[0, 1, 2].map((index) => <div key={index} className="gk-well gk-rewards__ghost" />)}
  </div>;
  if (chains.length === 0) return <div data-v2-rewards className="gk-rewards gk-rewards--state">
    <EmptyState art={artIconSrc('gift')} title={t('rewards.empty')} body={t('rewards.emptyHint')}
      action={<GameButton glyph="refresh" onPress={() => { void refetch(); }}>{t('surface.retry')}</GameButton>} />
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
  // Every waiting tier in one move (plan 2026-11-06 §7.1 R4): the pod opens on the sum, with a sound and a knock.
  const onClaimAll = () => {
    haptic('thunk');
    claimAll.mutate(undefined, {
      onSuccess: (result) => {
        playSound('unseal');
        setOpened({ id: 'all', goal: 0, alloy: result.granted.alloy, crystal: result.granted.crystal, state: 'claimed' });
        say(t('rewards.granted', { alloy: compact(result.granted.alloy), crystal: compact(result.granted.crystal) }));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  // R3: with nothing waiting, the panel still says what to do next, and goes there (R6).
  const next = onGo ? nextRewardGoal(chains) : null;
  const nextGate = next ? rewardGate(next.chain.id) : null;
  const pod = opened ?? ready[0];
  // E5: the claim being taken spins; every other claim rests until it lands, rather than spinning too.
  const claiming = claim.isPending ? claim.variables : claimAll.isPending ? 'all' : null;
  const podChain = pod ? chains.find((chain) => chain.tiers.some((tier) => tier.id === pod.id)) : undefined;

  return <div data-v2-rewards className="gk-rewards">
    {pod && <div className="gk-rewards__pod">
      <RewardPod key={pod.id} label={t('rewards.openPod')} opened={opened !== null}
        onOpen={() => { setOpened(pod); onClaim(pod.id); }}>
        <CostLine cost={{ alloy: pod.alloy, crystal: pod.crystal }} />
      </RewardPod>
      {opened === null && ready.length > 1 && <GameButton tone="self" wide heavy glyph="crate" pending={claimAll.isPending}
        disabledReason={claim.isPending ? t('rewards.takeAll', { count: ready.length }) : null}
        onPress={onClaimAll}>{t('rewards.takeAll', { count: ready.length })}</GameButton>}
      {podChain && <div data-pod-reward className="gk-rewards__podname">
        <span className="gk-label">{t(`rewards.chains.${podChain.id}.name`)}{podChain.metric === 'grant' ? '' : ` · ${goalText(t, podChain.metric, pod.goal)}`}</span>
        {/* once the lid is off, the loot itself says what was inside */}
        {opened === null && <CostLine cost={{ alloy: pod.alloy, crystal: pod.crystal }} />}
      </div>}
    </div>}
    <dl className="gk-cmdr__cells gk-well gk-rewards__sum">
      <div className="gk-cmdr__cell" {...(ready.length > 0 ? { 'data-on': '' } : {})}>
        <dt className="gk-label gk-cmdr__label"><Glyph id="crate" />{t('rewards.summaryReady')}</dt>
        <dd className="gk-cmdr__value gk-display gk-num">{full(ready.length)}</dd>
      </div>
      <div className="gk-cmdr__cell">
        <dt className="gk-label gk-cmdr__label"><Glyph id="check" />{t('rewards.summaryClaimed')}</dt>
        <dd className="gk-cmdr__value gk-display gk-num">{full(taken)} / {full(tiers.length)}</dd>
      </div>
    </dl>
    {next && nextGate && onGo && <div data-testid="reward-next">
      <Banner tone="info" variant="strip" glyph={CHAIN_GLYPH[next.chain.id]}
        title={t('rewards.next', { name: t(`rewards.chains.${next.chain.id}.name`), count: next.left })}
        action={<GoButton onGo={() => { onGo(nextGate); }} />} />
    </div>}
    <p className="gk-copy">{t('rewards.intro')}</p>
    {overflowing && <Banner tone="warn" title={t('rewards.overCap')} />}
    <ul className="gk-rewards__list">
        {chains.map((chain) => chain.metric === 'grant'
          ? <SocialCard key={chain.id} chain={chain} commander={commander} claiming={claiming} onClaim={onClaim} />
          : <GoalCard key={chain.id} chain={chain} expanded={ladder.isOpen(chain.id)} onToggle={() => { ladder.toggle(chain.id); }} claiming={claiming} onClaim={onClaim} onGo={onGo} />)}
    </ul>
  </div>;
}

/** To the place a goal is played (R6): the map for an act, its row for a building. */
function GoButton({ onGo }: { onGo: () => void }) {
  const { t } = useTranslation();
  return <GameButton size="sm" tone="steel" glyph="next" onPress={() => { playSound('tap'); haptic('tap'); onGo(); }}>{t('rewards.go')}</GameButton>;
}

function GoalCard({ chain, expanded, onToggle, claiming, onClaim, onGo }: {
  chain: KnownChain; expanded: boolean; onToggle: () => void; claiming: string | null; onClaim: (id: string) => void;
  onGo?: ((gate: RewardGate) => void) | undefined;
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
  const fold = useOwnPress(() => { playSound('tab'); haptic('tap'); onToggle(); });
  const gate = rewardGate(chain.id);

  return <li data-reward-chain={chain.id}>
    <article className={`gk-cut gk-reward${waiting ? ' gk-cut--self' : ''}`} {...(done ? { 'data-done': '' } : {})}>
      <div className="gk-reward__head">
        <span className="gk-reward__mark" {...(waiting ? { 'data-on': '' } : {})}><Glyph id={CHAIN_GLYPH[chain.id]} /></span>
        <div className="gk-reward__words">
          <div className="gk-reward__titleline">
            <h3 className="gk-reward__name gk-display">{name}</h3>
            <span className="gk-reward__standing gk-num" {...(waiting ? { 'data-on': '' } : {})}>{standing}</span>
            {gate && onGo && !done && <GoButton onGo={() => { onGo(gate); }} />}
          </div>
          <p className="gk-reward__tag">{t(`rewards.chains.${chain.id}.tag`)}</p>
          <div className="gk-reward__steps" role="img" aria-label={`${t('rewards.summaryClaimed')}: ${String(taken)} / ${String(chain.tiers.length)}`}>
            {chain.tiers.map((tier) => <span key={tier.id} aria-hidden="true" data-state={tier.state} />)}
          </div>
        </div>
      </div>
      <ul id={panelId} className="gk-well gk-reward__tiers">
        {visible.map((tier) => <TierRow key={tier.id} tier={tier} metric={chain.metric} progress={chain.progress} claiming={claiming} onClaim={onClaim} />)}
      </ul>
      {visible.length < chain.tiers.length || expanded ? <button type="button" {...OWN_SOUND} onPointerDown={fold.onPointerDown} onClick={fold.onClick}
        aria-expanded={expanded} aria-controls={panelId} aria-label={`${t('rewards.allMilestones')} · ${name}`}
        className="gk-reward__fold">
        <span>{t('rewards.allMilestones')}<span className="gk-reward__foldcount gk-num">{taken} / {chain.tiers.length}</span></span>
        <Glyph id={expanded ? 'up' : 'down'} />
      </button> : null}
    </article>
  </li>;
}

function SocialCard({ chain, commander, claiming, onClaim }: {
  chain: KnownChain; commander: string; claiming: string | null; onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const tier = chain.tiers[0];
  if (!tier) return null;
  const ready = tier.state === 'claimable';
  const taken = tier.state === 'claimed';
  const forever = taken && chain.scope === 'account';

  return <li data-reward-chain={chain.id}>
    <article className={`gk-cut gk-reward gk-reward--social${ready ? ' gk-cut--self' : ''}`}>
      <div className="gk-reward__head">
        <span className="gk-reward__mark" {...(ready ? { 'data-on': '' } : {})}><Glyph id="crate" /></span>
        <div className="gk-reward__words">
          <p className="gk-label">{t('rewards.social.eyebrow')}</p>
          <h3 className="gk-reward__name gk-display">{t('rewards.chains.SOCIAL.name')}</h3>
          {!taken && chain.scope === 'account' && <p className="gk-reward__tag">{t('rewards.chains.SOCIAL.tag')}</p>}
        </div>
      </div>
      <div className="gk-well gk-reward__prize"><CostLine cost={{ alloy: tier.alloy, crystal: tier.crystal }} /></div>
      {/* The steps are one tap away; the prize line above says what it is worth. */}
      {!taken && <InfoPeek about={t('rewards.social.how')} fact={<span className="gk-reward__tag">{t('rewards.social.howFact')}</span>}
        rule={<>
          <ol className="gk-reward__how">
            <Step n={1}>{t('rewards.social.step1')}</Step>
            <Step n={2}>{t('rewards.social.step2')}<span className="gk-reward__name-copy gk-num">{commander}</span></Step>
            <Step n={3}>{t('rewards.social.step3')}</Step>
          </ol>
          <a href={t('rewards.social.url')} target="_blank" rel="noreferrer noopener" className="gk-reward__link">
            {t('rewards.social.open')}<Glyph id="share" />
          </a>
        </>} />}
      {ready ? <span data-reward-claim={tier.id}><GameButton tone="action" size="lg" wide heavy glyph="crate" pending={claiming === tier.id}
        disabledReason={resting(claiming, tier.id, t('rewards.social.ready'))} onPress={() => { onClaim(tier.id); }}>{t('rewards.social.ready')}</GameButton></span>
        : <p className="gk-reward__after" {...(taken ? { 'data-on': '' } : {})}>
          <Glyph id={taken ? 'check' : 'clock'} />
          <span>{forever ? t('rewards.social.forever') : taken ? t('rewards.claimed') : t('rewards.social.pending')}</span>
        </p>}
    </article>
  </li>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return <li className="gk-reward__step">
    <span className="gk-reward__stepno gk-num">{n}</span>
    <div className="min-w-0">{children}</div>
  </li>;
}

function TierRow({ tier, metric, progress, claiming, onClaim }: {
  tier: RewardTierView; metric: string; progress: number; claiming: string | null; onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const claimed = tier.state === 'claimed';
  const ready = tier.state === 'claimable';
  const target = goalText(t, metric, tier.goal);
  const reach = tier.goal > 0 ? Math.max(0, Math.min(1, progress / tier.goal)) : 1;

  return <li data-reward-tier={tier.id} data-state={tier.state} className="gk-reward__tier">
    <div className="gk-reward__tierline">
      <span className="gk-reward__target gk-display gk-num">{target}</span>
      <span className="gk-reward__state gk-num" {...(ready ? { 'data-on': '' } : {})}>
        {ready ? t('rewards.waiting', { count: 1 }) : claimed ? t('rewards.claimed') : t('rewards.toGo', { count: Math.max(0, tier.goal - progress) })}
      </span>
    </div>
    <div className="gk-reward__tierline">
      <CostLine cost={{ alloy: tier.alloy, crystal: tier.crystal }} />
      {ready && <span data-reward-claim={tier.id}><GameButton size="sm" tone="action" heavy glyph="crate" pending={claiming === tier.id}
        disabledReason={resting(claiming, tier.id, t('rewards.claim'))} onPress={() => { onClaim(tier.id); }}>{t('rewards.claim')}</GameButton></span>}
    </div>
    {!claimed && !ready && <span data-tier-reach className="gk-reward__reach"><ProgressBar value={reach} max={1} tone="crystal" /></span>}
  </li>;
}

/** A goal in its chain's own unit: a level, or a count. */
function goalText(t: TFunction, metric: string, goal: number): string {
  return metric === 'level' ? t('rewards.goalLevel', { n: goal }) : t('rewards.goalCount', { n: goal });
}

/** While another claim is being taken, this one rests under its own name: pressable again once that lands. */
function resting(claiming: string | null, id: string, label: string): string | null {
  return claiming !== null && claiming !== id ? label : null;
}
