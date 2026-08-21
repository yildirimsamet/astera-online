import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useClaimReward, useRewards } from '../api/queries.js';
import type { RewardChainView, RewardTierView } from '../api/schemas.js';
import { compact, full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { Button, EmptyState, Plate, SkeletonText, Unreachable } from '../ui/kit/index.js';
import {
  AegisIcon,
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
    const waiting = rows.filter((c) => c.tiers.some((x) => x.state === 'claimable'));
    return [...waiting, ...rows.filter((c) => !waiting.includes(c))];
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

  return (
    <div className="flex flex-col gap-4 pb-6 pt-3">
      <p className="text-[13px] leading-relaxed text-dim">{t('rewards.intro')}</p>

      {/*
        NO SECOND HEADING HERE. The sheet's own eyebrow already says STANDING
        OFFERS directly above this, and printing it twice made the panel look like
        it had two sections when it has one. What was worth keeping is the count,
        so that is all this line is: a rule, and what is waiting on the end of it.
      */}
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

function ChainCard({
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
  const Icon = CHAIN_ICON[chain.id] ?? RewardIcon;
  const waiting = chain.tiers.some((x) => x.state === 'claimable');
  const done = chain.tiers.every((x) => x.state === 'claimed');
  const social = chain.id === 'SOCIAL';

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
            {!social && (
              <span className={`num shrink-0 text-micro ${waiting ? 'text-opportunity' : 'text-faint'}`}>
                {standing}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-faint">
            {t(`rewards.chains.${chain.id}.tag` as 'rewards.chains.PROBE.tag')}
          </p>
        </div>
      </div>

      {social && <SocialSteps commander={commander} />}

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
 * The one reward the game cannot see, so its card is an INSTRUCTION.
 *
 * There is no Twitter API in this project and there is not going to be one: a
 * marketing integration is not a game system, and the honest implementation of "a
 * human checked" is a human checking. The commander name is interpolated rather
 * than left as "your commander name", because the whole failure mode of this flow
 * is somebody sending a message that does not say who they are.
 *
 * IT IS THE COMMANDER NAME AND NOT THE PLANET NAME, and getting that wrong would
 * have broken the entire feature silently. `grantReward` resolves what the
 * operator types against `players.name`, which is the account's display name — so
 * a card that printed "Rook-14" would have had every player DM a string the
 * command can never find, and the operator would be told no such commander exists
 * while looking at the message.
 */
function SocialSteps({ commander }: { commander: string }) {
  const { t } = useTranslation();
  return (
    <ol className="mt-2.5 flex flex-col gap-1 pl-1 text-[11px] leading-relaxed text-dim">
      <li>
        <a
          href={t('rewards.social.url')}
          target="_blank"
          rel="noreferrer noopener"
          className="text-crystal underline-offset-2 hover:underline"
        >
          {t('rewards.social.step1')}
        </a>
      </li>
      <li>{t('rewards.social.step2', { name: commander })}</li>
      <li>{t('rewards.social.step3')}</li>
    </ol>
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
