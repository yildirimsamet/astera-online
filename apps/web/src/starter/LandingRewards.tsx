import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClaimAllRewards, useRewards } from '../api/queries.js';
import { CostLine, Dialog, GameButton } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { describe, useToast } from '../ui/Toast.js';
import type { ShellRoute } from '../v2/shell/GameShell.js';

const DAY_MS = 86_400_000;
const KEY = 'astera:landing-rewards';

const shownBefore = (): boolean => { try { return window.localStorage.getItem(KEY) !== null; } catch { return false; } };
const remember = (): void => { try { window.localStorage.setItem(KEY, '1'); } catch { /* Storage may be disabled. */ } };

/** Whether the landing reward moment is owed now: the first week, two or more tiers waiting, never shown. */
export function useLandingRewardsDue(landedAtMs: number | undefined, nowMs: number): boolean {
  const waiting = useRewards().data?.claimable ?? 0;
  return landedAtMs !== undefined && nowMs - landedAtMs < 7 * DAY_MS && waiting >= 2 && !shownBefore();
}

/**
 * THE LANDING PAYS (plan 2026-11-06 §7, §7.1 R1). The first-season start earns several tiers at once and a
 * gift icon was all that said so. One moment after the landing card: what the ship's work is worth here,
 * all of it in one move, and where to spend it. Once an account; Later closes it for good.
 */
export function LandingRewards({ onPanel, onDone }: { onPanel: ShellRoute; onDone: () => void }) {
  const { t } = useTranslation();
  const say = useToast();
  const { data } = useRewards();
  const claimAll = useClaimAllRewards();
  const [granted, setGranted] = useState<{ alloy: number; crystal: number } | null>(null);
  const ready = (data?.chains ?? []).flatMap(chain => chain.tiers).filter(tier => tier.state === 'claimable');
  const sum = ready.reduce((total, tier) => ({ alloy: total.alloy + tier.alloy, crystal: total.crystal + tier.crystal }), { alloy: 0, crystal: 0 });
  const close = () => { remember(); onDone(); };
  const take = () => {
    haptic('thunk');
    claimAll.mutate(undefined, {
      onSuccess: (result) => { playSound('unseal'); setGranted({ alloy: result.granted.alloy, crystal: result.granted.crystal }); },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  return (
    <div data-testid="landing-rewards" className="gk">
      <Dialog ribbon={t('starter.landingRewards.ribbon')} tone="good" rays sound="rankup" onBack={close}
        actions={granted
          ? <GameButton tone="self" wide heavy glyph="up" onPress={() => { playSound('tap'); haptic('tap'); close(); onPanel('planet', undefined, undefined, { group: 'grow' }); }}>
              {t('starter.landingRewards.spend')}
            </GameButton>
          : <>
              <GameButton tone="self" wide heavy glyph="crate" pending={claimAll.isPending} onPress={take}>
                {t('starter.landingRewards.take', { count: ready.length })}
              </GameButton>
              <GameButton tone="ghost" wide onPress={() => { playSound('tap'); haptic('tap'); close(); }}>{t('starter.landingRewards.later')}</GameButton>
            </>}>
        <p className="gk-copy">{granted ? t('starter.landingRewards.spent') : t('starter.landingRewards.body', { count: ready.length })}</p>
        <CostLine cost={granted ?? sum} />
      </Dialog>
    </div>
  );
}
