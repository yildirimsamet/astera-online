import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isScenarioActive } from '@astera/rules';
import { useNewcomerScenario, useNewcomerScenarioActions } from '../api/queries.js';
import { triggerFurnaceFlare } from '../galaxy/FurnaceOverloadFx.js';
import { ContextCard, ContextStrip, GameButton, type GlyphId } from '../game-ui/index.js';
import { useAccordion } from '../lib/accordion.js';
import { serverNow } from '../lib/clock.js';
import { haptic } from '../lib/haptics.js';
import { playSound } from '../lib/sound.js';
import { useAttentionLock } from '../shell/attention/store.js';
import { describe, useToast } from '../ui/Toast.js';

const PRE_VICTORY_ALLOW = ['arrival_card'] as const;
const POST_VICTORY_ALLOW = ['arrival_card', 'landing_rewards', 'return_card'] as const;

const STEP_META: Readonly<Record<'MINE' | 'PIRATE' | 'PROBE' | 'WRAP_UP', { num: number; glyph: GlyphId }>> = {
  MINE: { num: 1, glyph: 'mine' },
  PIRATE: { num: 2, glyph: 'attack' },
  PROBE: { num: 3, glyph: 'eye' },
  WRAP_UP: { num: 4, glyph: 'star' },
};
const TOTAL_STEPS = 4;

/**
 * Holds the attention queue lock while the first-game onboarding tasks run (plan 2026-11-20 §5.5), for the
 * founding hour at most (review 2026-11-23): tasks left for later keep their card, not the whole screen.
 * Renders no DOM of its own; the visible card lives inside `ContextSlot` below the chat icon.
 */
export function NewcomerScenarioLock() {
  const scenario = useNewcomerScenario().data?.scenario ?? null;
  const until = scenario?.holdsScreenUntil.getTime() ?? 0;
  const [, setTick] = useState(0);
  const holding = until > serverNow();
  useEffect(() => {
    if (!holding) return undefined;
    const timer = window.setTimeout(() => { setTick(tick => tick + 1); }, until - serverNow() + 50);
    return () => { window.clearTimeout(timer); };
  }, [holding, until]);
  const active = scenario !== null && isScenarioActive(scenario.step) && holding;
  const allow = !active
    ? null
    : scenario.pirateDefeated
      ? POST_VICTORY_ALLOW
      : PRE_VICTORY_ALLOW;
  useAttentionLock(allow);
  return null;
}

/**
 * İNİŞ SONRASI İLK SAAT GÖREV KARTI (plan 2026-11-20 §4; playtest 2026-11-23).
 *
 * Built exclusively on the Direction B Game Kit (`ContextCard` / `ContextStrip` / `GameButton`)
 * and hosted inside `ContextSlot` at the foot of the galaxy below the chat icon, so it never
 * overlaps top HUD icons or bottom FocusPanels.
 *
 * Pure guidance — zero auto-open sheets and zero 1-click auto-launch buttons. The player performs
 * every action (mining, pirate raid, planet probe) directly through the real game UI.
 */
export function NewcomerScenarioCard() {
  const { t } = useTranslation();
  const say = useToast();
  const scenario = useNewcomerScenario().data?.scenario ?? null;
  const actions = useNewcomerScenarioActions();
  const guide = useAccordion('guide', ['onboarding']);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  if (!scenario || !isScenarioActive(scenario.step)) return null;

  const onError = (error: unknown) => { say(describe(error), 'error'); };
  const dismiss = () => {
    playSound('tap');
    haptic('tap');
    setConfirmDismiss(false);
    actions.dismiss.mutate(undefined, { onError });
  };

  let eyebrow = t('starter.scenario.hourTitle');
  let title = '';
  let body = '';
  let glyph: GlyphId = 'up';
  let actionNode: ReactNode = undefined;

  switch (scenario.step) {
    case 'LANDING':
      eyebrow = t('starter.scenario.hourTitle');
      title = t('starter.scenario.hourHeadline');
      body = t('starter.scenario.hourPrivilege');
      glyph = 'up';
      actionNode = (
        <GameButton
          tone="self"
          size="sm"
          glyph="up"
          pending={actions.start.isPending}
          onPress={() => {
            playSound('unseal');
            haptic('thunk');
            triggerFurnaceFlare();
            actions.start.mutate(undefined, { onError });
          }}
        >
          {t('starter.scenario.hourStart')}
        </GameButton>
      );
      break;
    case 'MINE':
      eyebrow = t('starter.scenario.stepProgress', { current: STEP_META.MINE.num, total: TOTAL_STEPS });
      title = t('starter.scenario.mineTitle');
      body = t('starter.scenario.mineBody');
      glyph = STEP_META.MINE.glyph;
      break;
    case 'PIRATE':
      eyebrow = t('starter.scenario.stepProgress', { current: STEP_META.PIRATE.num, total: TOTAL_STEPS });
      title = t('starter.scenario.pirateTitle');
      body = t('starter.scenario.pirateBody');
      glyph = STEP_META.PIRATE.glyph;
      break;
    case 'PROBE':
      eyebrow = t('starter.scenario.stepProgress', { current: STEP_META.PROBE.num, total: TOTAL_STEPS });
      title = t('starter.scenario.probeTitle');
      body = t('starter.scenario.probeBody');
      glyph = STEP_META.PROBE.glyph;
      break;
    case 'WRAP_UP':
      eyebrow = t('starter.scenario.stepProgress', { current: STEP_META.WRAP_UP.num, total: TOTAL_STEPS });
      title = t('starter.scenario.wrapTitle');
      body = t('starter.scenario.wrapBody');
      glyph = STEP_META.WRAP_UP.glyph;
      actionNode = (
        <GameButton
          tone="self"
          size="sm"
          glyph="check"
          pending={actions.complete.isPending}
          onPress={() => {
            playSound('confirm');
            haptic('tap');
            actions.complete.mutate(undefined, { onError });
          }}
        >
          {t('starter.scenario.wrapDone')}
        </GameButton>
      );
      break;
  }

  if (confirmDismiss) {
    return (
      <div data-testid="newcomer-scenario" data-step={scenario.step}>
        <ContextCard
          tone="warn"
          glyph="warn"
          eyebrow={eyebrow}
          title={t('starter.scenario.dismissConfirm')}
          dismissLabel={t('starter.scenario.dismissNo')}
          onDismiss={() => { setConfirmDismiss(false); }}
          actions={(
            <div data-testid="scenario-dismiss-confirm" className="flex items-center gap-2">
              <GameButton
                tone="ghost"
                size="sm"
                onPress={() => { setConfirmDismiss(false); }}
              >
                {t('starter.scenario.dismissNo')}
              </GameButton>
              <GameButton
                tone="danger"
                size="sm"
                pending={actions.dismiss.isPending}
                onPress={dismiss}
              >
                {t('starter.scenario.dismissYes')}
              </GameButton>
            </div>
          )}
        />
      </div>
    );
  }

  if (!guide.isOpen('onboarding')) {
    return (
      <div data-testid="newcomer-scenario" data-step={scenario.step}>
        <ContextStrip
          tone="self"
          glyph={glyph}
          eyebrow={eyebrow}
          title={title}
          label={t('directives.show')}
          onPress={() => { guide.toggle('onboarding'); }}
        />
      </div>
    );
  }

  return (
    <div data-testid="newcomer-scenario" data-step={scenario.step}>
      <ContextCard
        tone="self"
        glyph={glyph}
        eyebrow={eyebrow}
        title={title}
        actions={actionNode}
        foldLabel={t('directives.hide')}
        onFold={() => { guide.toggle('onboarding'); }}
        dismissLabel={t('starter.scenario.dismiss')}
        onDismiss={() => { setConfirmDismiss(true); }}
      >
        {body}
      </ContextCard>
    </div>
  );
}
