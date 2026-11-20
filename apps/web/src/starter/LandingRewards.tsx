import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClaimAllRewards, useRewards, useWelcome } from '../api/queries.js';
import { Dialog, GameButton, Glyph } from '../game-ui/index.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { describe, useToast } from '../ui/Toast.js';
import { WelcomeWeek } from '../screens/WelcomeWeek.js';
import './landingRewards.css';

const DAY_MS = 86_400_000;
const KEY = 'astera:landing-rewards';

const shownBefore = (): boolean => { try { return window.localStorage.getItem(KEY) !== null; } catch { return false; } };
const remember = (): void => { try { window.localStorage.setItem(KEY, '1'); } catch { /* Storage may be disabled. */ } };

/** The seven boxes have not begun: the landing hands the first one over (plan 2026-11-18 S6). */
function useFirstBox(): boolean {
  const welcome = useWelcome().data?.welcome;
  return welcome?.opened === 0 && welcome.box === 1;
}

/** Whether the landing reward moment is owed now: the first week, two or more tiers or the first box waiting, never shown. */
export function useLandingRewardsDue(landedAtMs: number | undefined, nowMs: number): boolean {
  const waiting = useRewards().data?.claimable ?? 0;
  const firstBox = useFirstBox();
  return landedAtMs !== undefined && nowMs - landedAtMs < 7 * DAY_MS && (waiting >= 2 || firstBox) && !shownBefore();
}

interface Purse { alloy: number; crystal: number }

/** What the repairs are worth, in the resources' own art and size: the thing taken, not a line of cost. */
function PurseRow({ purse, testId }: { purse: Purse; testId: string }) {
  const { t } = useTranslation();
  return (
    <span data-testid={testId} className="lr-purse">
      {(['alloy', 'crystal'] as const).filter(resource => purse[resource] > 0).map(resource => (
        <span key={resource} className={`lr-purse__part lr-purse__part--${resource} gk-num`}>
          <img src={RESOURCE_ART[resource]} alt={t(`vocabulary.resource.${resource}`)} draggable={false} />
          {compact(purse[resource])}
        </span>
      ))}
    </span>
  );
}

/**
 * THE LANDING PAYS (plan 2026-11-06 §7, §7.1 R1; plan 2026-11-18 S6). One window after the landing card, and
 * in it two moments one after the other (owner phone playtest 2026-11-18, item 15: "Take all · 7" read as all
 * seven boxes with one ready, and "Upgrade" led away from them): first what the ship's repairs are worth
 * here, taken with one press; then the seven commander boxes, the first ready to open where it stands.
 * Once an account; Later closes it for good.
 */
export function LandingRewards({ onDone }: { onDone: (code: 'act:take' | 'dismiss') => void }) {
  const { t } = useTranslation();
  const say = useToast();
  const { data } = useRewards();
  const boxes = useWelcome().data?.welcome != null;
  const claimAll = useClaimAllRewards();
  const [granted, setGranted] = useState<Purse | null>(null);
  const ready = (data?.chains ?? []).flatMap(chain => chain.tiers).filter(tier => tier.state === 'claimable');
  const sum = ready.reduce((total, tier) => ({ alloy: total.alloy + tier.alloy, crystal: total.crystal + tier.crystal }), { alloy: 0, crystal: 0 });
  // The reward first, while there is one to take; then the board.
  const rewarding = ready.length > 0 && granted === null;
  const outcome = granted ? 'act:take' : 'dismiss';
  const close = () => { playSound('tap'); haptic('tap'); remember(); onDone(outcome); };
  const take = () => {
    haptic('thunk');
    claimAll.mutate(undefined, {
      onSuccess: (result) => { playSound('unseal'); setGranted({ alloy: result.granted.alloy, crystal: result.granted.crystal }); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  const ribbon = rewarding || !boxes ? t('starter.landingRewards.ribbon') : t('rewards.welcome.board');
  return (
    <div data-testid="landing-rewards" className="gk fixed inset-0 z-50">
      <Dialog ribbon={ribbon} tone="info" rays sound="rankup" onBack={() => { remember(); onDone(outcome); }}
        actions={rewarding
          ? <>
              <GameButton tone="self" wide heavy glyph="crate" pending={claimAll.isPending} onPress={take}>{t('starter.landingRewards.take')}</GameButton>
              <GameButton tone="ghost" wide onPress={close}>{t('starter.landingRewards.later')}</GameButton>
            </>
          : <GameButton tone="ghost" wide onPress={close}>{t(granted ? 'starter.landingRewards.continue' : 'starter.landingRewards.later')}</GameButton>}>
        <div className="lr-body">
          {rewarding && (
            <section className="lr-reward">
              <p className="gk-copy">{t('starter.landingRewards.body', { count: ready.length })}</p>
              <PurseRow purse={sum} testId="landing-reward-sum" />
            </section>
          )}
          {granted && (
            <p data-testid="landing-granted" className="lr-granted">
              <span className="lr-granted__mark" aria-hidden="true"><Glyph id="check" /></span>
              <span>{t('starter.landingRewards.spent')}</span>
              <PurseRow purse={granted} testId="landing-granted-purse" />
            </p>
          )}
          {!rewarding && <WelcomeWeek titled={false} />}
        </div>
      </Dialog>
    </div>
  );
}
