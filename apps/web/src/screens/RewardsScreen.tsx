import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useClaimReward, usePlanet, useRewards } from '../api/queries.js';
import type { RewardChainView, RewardTierView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { Button, EmptyState, Plate, SkeletonText, Unreachable } from '../ui/kit/index.js';
import {
  AegisIcon,
  ExternalIcon,
  AttackIcon,
  CargoIcon,
  CoreIcon,
  DrillIcon,
  ExtractorIcon,
  HullIcon,
  RefineryIcon,
  RewardIcon,
  ScanIcon,
  ShipyardIcon,
  type IconProps,
} from '../ui/icons/index.js';
import { describe, useToast } from '../ui/Toast.js';

/**
 * WHAT THE GALAXY OWES YOU FOR PLAYING IT.
 *
 * The panel exists because of a specific report: *"onboardingden sonra user'a
 * yapıcak bişey kalmıyor. Boş boş bekliyor."* A commander finishes the rehearsal,
 * spends the opening grant, and is left holding a world with nothing pressable on
 * it. `OPENING_BONUS` (D58) bought one more decision; this is a standing list of
 * them.
 *
 * IT IS A LIST OF THINGS TO DO, NOT A LIST OF PRIZES, and every design choice
 * below follows from that:
 *
 *   · THE CHAINS ARE NAMED AFTER THE ACT. "Probes sent", never "Scout Bonus I".
 *     Half the value of this screen is that a new commander reads it and learns
 *     that probing, raiding, drilling and salvaging exist at all — the recorded
 *     risk against this game is that nobody scouts and it degrades into a worse
 *     OGame.
 *   · ANYTHING CLAIMABLE FLOATS TO THE TOP, and nothing else is reordered. A list
 *     that re-sorted itself on every read would move the row under the thumb.
 *   · NOTHING COUNTS DOWN, nothing expires, and nothing says "don't miss out".
 *     `game-design.md` bans streaks and login bonuses by name; a timer here would
 *     be one wearing a different hat.
 *
 * The claim is not predicted. See `useClaimReward` — the server re-counts progress
 * under the planet lock and can legitimately refuse a tier this client thinks is
 * ready, and a reward that visibly un-happens is worse than a round trip nobody
 * was going to notice.
 */

const CHAIN_ICON: Record<string, (props: IconProps) => React.ReactElement> = {
  PROBE: ScanIcon,
  RAID: AttackIcon,
  CORE: CoreIcon,
  SHIPYARD: ShipyardIcon,
  REFINERY: RefineryIcon,
  EXTRACTOR: ExtractorIcon,
  SHIPS: HullIcon,
  AEGIS: AegisIcon,
  MINE: DrillIcon,
  SALVAGE: CargoIcon,
  SOCIAL: RewardIcon,
};

/**
 * Chain ids the server may send that this build has never heard of.
 *
 * The schema parses `id` as a plain string on purpose (see `schemas.ts`), so a
 * newer server costs this client one unrenderable card rather than an empty
 * panel. This is where that promise is kept: no icon and no name means the card
 * is skipped, and every other one still draws.
 */
const known = (chain: RewardChainView): boolean => chain.id in CHAIN_ICON;

export function RewardsScreen({ commander }: { commander: string }) {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useRewards();
  const planet = usePlanet();
  const claim = useClaimReward();
  const say = useToast();

  /**
   * CLAIMABLE FIRST, then the original order.
   *
   * `REWARD_CHAINS` is authored in the order a commander meets these systems, and
   * that order is worth keeping — so this is a stable partition rather than a
   * sort. Two chains that are both waiting stay in the order the server sent
   * them.
   */
  const chains = useMemo(() => {
    const rows = (data?.chains ?? []).filter(known);
    /**
     * THE HAND-GRANTED CARD IS PINNED, ABOVE EVEN A CLAIMABLE ONE. Owner
     * instruction.
     *
     * It is the only reward that asks the player to do something OUTSIDE the
     * game, so it is the only one that cannot be discovered by playing — every
     * other chain is met by pressing the things it pays for. A card nobody scrolls
     * to is a card nobody follows.
     */
    const pinned = rows.filter((c) => c.metric === 'grant');
    const rest = rows.filter((c) => c.metric !== 'grant');
    const waiting = rest.filter((c) => c.tiers.some((x) => x.state === 'claimable'));
    return [...pinned, ...waiting, ...rest.filter((c) => !waiting.includes(c))];
  }, [data]);

  /**
   * A FAILED READ IS NEVER DRAWN AS A SLOW ONE. D53a.
   *
   * `isPending` goes false on error while `data` stays undefined, so
   * `isPending || !data` would shimmer for ever at a request that has already
   * given up — and this panel would claim the ledger was empty.
   */
  if (isError) {
    return (
      <Unreachable
        what={t('surface.whatRewards')}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }
  // `isError` above is what keeps this honest: React Query drops `isPending` on
  // failure, so a lone pending check would shimmer forever at a dead request (D53a).
  if (isPending) return <SkeletonText lines={8} className="mt-4" />;

  /**
   * Would taking what is on offer put either store over its ceiling? Measured
   * against the LARGEST single claimable tier rather than the sum: they are
   * claimed one at a time, and warning about a total nobody will press in one go
   * would overstate it.
   */
  const held = planet.data?.planet;
  const claimableTiers = data.chains.flatMap((c) => c.tiers.filter((x) => x.state === 'claimable'));
  const overflowing =
    held !== undefined &&
    claimableTiers.some(
      (x) => held.alloy + x.alloy > held.alloyCap || held.crystal + x.crystal > held.crystalCap,
    );

  return (
    <div className="flex flex-col gap-4 pb-6 pt-3">
      <p className="text-[13px] leading-relaxed text-dim">{t('rewards.intro')}</p>

      {/*
        NO SECOND HEADING HERE. The sheet's own eyebrow already says STANDING
        OFFERS directly above this, and printing it twice made the panel look like
        it had two sections when it has one. What was worth keeping is the count,
        so that is all this line is: a rule, and what is waiting on the end of it.
      */}
      {/*
        WHAT HAPPENS IF THE STORE IS FULL, ANSWERED ON THE SCREEN.

        It is the first question a player asks before pressing a button that adds
        resources, and the honest answer is the surprising one: NOTHING IS LOST.
        A grant is written straight to storage with no clamp — the same thing
        `OPENING_BONUS` does, for the reason in its docblock — so the whole amount
        lands and the store is simply allowed to sit above its ceiling for a while.
        What that costs is the WORKS: they cannot be emptied into a store that is
        already over, so the pressure is to spend rather than to hoard.

        Shown only when it is actually true of something claimable right now.
        A standing warning about a state nobody is in is noise.
      */}
      {overflowing && (
        <p className="rounded border border-alloy/40 bg-alloy/10 px-3 py-2 text-[12px] leading-relaxed text-alloy">
          {t('rewards.overCap')}
        </p>
      )}

      {data.claimable > 0 && (
        <p className="flex items-center gap-2.5">
          <span className="rail-soft flex-1" />
          <span className="num shrink-0 text-micro text-opportunity">
            {t('rewards.waiting', { count: data.claimable })}
          </span>
        </p>
      )}

      {chains.length === 0 ? (
        <EmptyState icon={<RewardIcon className="size-7" />} title={t('rewards.allTaken')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {chains.map((chain) => (
            <ChainCard
              key={chain.id}
              chain={chain}
              commander={commander}
              busy={claim.isPending}
              onClaim={(id) => {
                haptic('commit');
                claim.mutate(id, {
                  onSuccess: (r) => {
                    say(
                      t('rewards.granted', {
                        alloy: compact(r.granted.alloy),
                        crystal: compact(r.granted.crystal),
                      }),
                    );
                  },
                  onError: (err) => {
                    say(describe(err), 'error');
                  },
                });
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChainCard(props: {
  chain: RewardChainView;
  commander: string;
  busy: boolean;
  onClaim: (id: string) => void;
}) {
  // A hand-granted reward is not a progress chain wearing a different hat: it has
  // no counter, its instructions live off-platform, and it is the one card that has
  // to be READ rather than recognised. It gets its own surface.
  if (props.chain.metric === 'grant') return <SocialCard {...props} />;
  return <GoalCard {...props} />;
}

function GoalCard({
  chain,
  busy,
  onClaim,
}: {
  chain: RewardChainView;
  commander: string;
  busy: boolean;
  onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = CHAIN_ICON[chain.id] ?? RewardIcon;
  const waiting = chain.tiers.some((x) => x.state === 'claimable');
  const done = chain.tiers.every((x) => x.state === 'claimed');

  /**
   * THE STANDING, IN THE UNITS THE CHAIN IS ACTUALLY MEASURED IN.
   *
   * "3 / 5" and "L4" are different kinds of number and one phrasing could not
   * carry both — a Command Core that read "4 / 5" would be claiming there are
   * five of something. `metric` comes off the payload rather than being inferred
   * from the id, so a chain added server-side says how to read itself.
   */
  const standing = done
    ? t('rewards.progressDone')
    : chain.metric === 'level'
      ? t('rewards.progressLevel', { have: chain.progress })
      : t('rewards.progressCount', {
          have: chain.progress,
          need: chain.tiers.find((x) => x.state !== 'claimed')?.goal ?? chain.progress,
        });

  return (
    <Plate as="li" tone={waiting ? 'opportunity' : 'neutral'} className="px-3 py-3">
      <div className="flex items-start gap-2.5">
        <span
          className={`socket grid size-9 shrink-0 place-items-center rounded-md ${
            waiting ? 'text-opportunity' : done ? 'text-faint' : 'text-dim'
          }`}
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate font-display text-[13px] font-semibold uppercase tracking-[0.04em] text-bone">
              {t(`rewards.chains.${chain.id}.name` as 'rewards.chains.PROBE.name')}
            </p>
            <span
              className={`num shrink-0 text-micro ${waiting ? 'text-opportunity' : 'text-faint'}`}
            >
              {standing}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-faint">
            {t(`rewards.chains.${chain.id}.tag` as 'rewards.chains.PROBE.tag')}
          </p>
        </div>
      </div>

      <ul className="mt-2.5 flex flex-col gap-1.5">
        {chain.tiers.map((tier) => (
          <TierRow
            key={tier.id}
            tier={tier}
            metric={chain.metric}
            progress={chain.progress}
            busy={busy}
            onClaim={onClaim}
          />
        ))}
      </ul>
    </Plate>
  );
}

/**
 * THE COMMUNITY BONUS. Owner instruction: put it at the top and make it premium.
 *
 * IT IS THE ONLY CARD IN THIS PANEL THAT ASKS FOR SOMETHING OUTSIDE THE GAME, and
 * every difference from the goal cards follows from that one fact:
 *
 *   · IT IS PINNED ABOVE EVERYTHING, claimable goals included. Every other chain
 *     is discovered by playing — you meet the probe reward by sending a probe.
 *     Nobody discovers this one by pressing anything, so a card at the bottom of a
 *     scroll is a card that does not exist.
 *   · IT HAS NO PROGRESS AND CANNOT HAVE ONE. There is nothing in the galaxy to
 *     count; the act happens on Twitter and a human confirms it. So the body is an
 *     INSTRUCTION, numbered, in the order it has to be done.
 *   · THE WAY OUT IS A REAL BUTTON, not a word in a sentence. It leaves the game
 *     for another site, which is exactly the kind of thing a control should be
 *     honest about — hence the glyph, the new tab, and `rel="noreferrer noopener"`
 *     so the page it opens gets no handle on this one.
 *   · THE COMMANDER NAME IS PRINTED, and getting this wrong would break the whole
 *     feature in silence. The operator's command resolves what is typed against
 *     `players.name`, the account's display name — so a card that printed the
 *     PLANET's name would have every player send a string the grant can never
 *     find, and the operator would be told no such commander exists while looking
 *     at their message.
 */
function SocialCard({
  chain,
  commander,
  busy,
  onClaim,
}: {
  chain: RewardChainView;
  commander: string;
  busy: boolean;
  onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const tier = chain.tiers[0];
  if (!tier) return null;

  const ready = tier.state === 'claimable';
  const taken = tier.state === 'claimed';

  return (
    <Plate
      as="li"
      cut
      tone={ready ? 'opportunity' : 'neutral'}
      className="relative overflow-hidden px-3.5 pb-3.5 pt-3"
    >
      {/* A single wash behind the card, warm at one corner. The only decorative
          gradient in the panel, and it is what separates "an offer from us" from
          the eleven goals below it without shouting. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgb(89_200_255/0.14)_0%,transparent_62%)]"
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <span
            className={`socket grid size-11 shrink-0 place-items-center rounded-lg ${
              ready ? 'text-opportunity' : 'text-crystal'
            }`}
          >
            <RewardIcon className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="legend text-crystal/80">{t('rewards.social.eyebrow')}</p>
            <p className="mt-1 font-display text-[15px] font-semibold uppercase leading-tight tracking-[0.03em] text-bone">
              {t('rewards.chains.SOCIAL.name')}
            </p>
          </div>
        </div>

        {/* The prize, stated once and large. `full()` and not `compact()`: this is
            a figure a player checks against a price. */}
        <p className="mt-3 flex items-baseline gap-2">
          <span className="readout text-[22px] text-alloy">{full(tier.alloy)}</span>
          <span className="text-[11px] text-faint">{t('rewards.social.alloy')}</span>
          <span className="readout text-[22px] text-crystal">{full(tier.crystal)}</span>
          <span className="text-[11px] text-faint">{t('rewards.social.crystal')}</span>
        </p>

        <ol className="mt-3 flex flex-col gap-1.5">
          <Step n={1}>{t('rewards.social.step1')}</Step>
          <Step n={2}>
            <span>{t('rewards.social.step2')}</span>{' '}
            <span className="num rounded bg-raised px-1.5 py-0.5 text-[11px] text-bone">
              {commander}
            </span>
          </Step>
          <Step n={3}>{t('rewards.social.step3')}</Step>
        </ol>

        <a
          href={t('rewards.social.url')}
          target="_blank"
          rel="noreferrer noopener"
          className="slab slab-primary mt-3.5 w-full"
        >
          <ExternalIcon className="size-[18px] shrink-0" />
          {t('rewards.social.open')}
        </a>

        <div className="mt-2.5">
          {ready ? (
            <Button
              size="md"
              variant="primary"
              full
              disabled={busy}
              onClick={() => {
                onClaim(tier.id);
              }}
            >
              {t('rewards.social.ready')}
            </Button>
          ) : (
            <p
              className={`rounded border px-3 py-2 text-center text-[11px] ${
                taken
                  ? 'border-line-soft bg-deep text-faint'
                  : 'border-line-soft bg-deep text-dim'
              }`}
            >
              {taken ? t('rewards.claimed') : t('rewards.social.pending')}
            </p>
          )}
        </div>
      </div>
    </Plate>
  );
}

/** One numbered instruction. The numeral is drawn, because a bare `<ol>` marker
 *  is stripped by the CSS reset and these three have to be done in order. */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 text-[12px] leading-relaxed text-dim">
      <span className="num mt-[1px] grid size-[18px] shrink-0 place-items-center rounded-full bg-raised text-[10px] text-crystal">
        {n}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </li>
  );
}

function TierRow({
  tier,
  metric,
  progress,
  busy,
  onClaim,
}: {
  tier: RewardTierView;
  metric: string;
  progress: number;
  busy: boolean;
  onClaim: (id: string) => void;
}) {
  const { t } = useTranslation();
  const target =
    metric === 'level'
      ? t('rewards.goalLevel', { n: tier.goal })
      : t('rewards.goalCount', { n: tier.goal });

  return (
    <li className="plate-sunk flex items-center gap-2 rounded-[4px] px-2 py-1.5">
      <span
        className={`num w-8 shrink-0 text-[11px] ${
          tier.state === 'claimed' ? 'text-faint line-through' : 'text-dim'
        }`}
      >
        {metric === 'grant' ? '' : target}
      </span>

      {/*
        The prize, in the two colours the resources wear everywhere else. `full()`
        rather than `compact()`: these are figures a player checks against a price,
        and "1.2k" cannot be compared to 950.
      */}
      <span className="min-w-0 flex-1 truncate text-[11px]">
        <span className="num text-alloy">{full(tier.alloy)}</span>
        <span className="px-1 text-faint">·</span>
        <span className="num text-crystal">{full(tier.crystal)}</span>
      </span>

      {tier.state === 'claimable' ? (
        <Button
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={() => {
            onClaim(tier.id);
          }}
        >
          {t('rewards.claim')}
        </Button>
      ) : tier.state === 'claimed' ? (
        <span className="num shrink-0 text-micro text-faint">{t('rewards.claimed')}</span>
      ) : (
        <span className="num shrink-0 text-micro text-faint">
          {metric === 'grant'
            ? t('rewards.social.pending')
            : t('rewards.toGo', { count: Math.max(0, tier.goal - progress) })}
        </span>
      )}
    </li>
  );
}
