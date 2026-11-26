import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DAILY_QUESTS, type DailyQuestId } from '@astera/rules';
import { useClaimDailyQuest, useDailyQuests } from '../api/queries.js';
import { CostLine, GameButton, Glyph, InfoPeek, ProgressBar, type GlyphId } from '../game-ui/index.js';
import { dailyQuestGate } from '../lib/dailyQuests.js';
import { compact } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { honorScore } from '../lib/honor.js';
import type { RewardGate } from '../lib/rewardGates.js';
import { playSound } from '../lib/sound.js';
import { roughDuration, useNow } from '../lib/time.js';
import { describe, useToast } from '../ui/Toast.js';
import './daily-quests.css';

/*
  VFX brief (owner 2026-11-18: every effect is its own event).
  - In the world: a row of gate lamps, one segment per act. Each act the commander performs lights its
    segment; the act that completes the row sends one hard bright bar across it and the row's key lifts.
    The claim key sinks under the thumb, the crate unseals, and the row dims to a ticked, spent plate.
  - Assets: none new — the kit's segmented bar, cut plate and resource art; the bar is one hard-edged
    streak (daily-quests.css), no halo.
  - Why: a day's list is four acts you could do; a lamp that lights when you do one, and a bar that
    crosses when the list is whole, is what finishing looks like.
*/
const MARK: Record<DailyQuestId, GlyphId> = { PROBES: 'eye', RIFT: 'worm', PIRATE: 'pirate', ASTEROID: 'asteroid' };
/** How long a row that just became ready keeps its crossing bar. */
const FRESH_MS = 1_400;

const known = (id: string): id is DailyQuestId => DAILY_QUESTS.some((quest) => quest.id === id);

/**
 * GÜNLÜK GÖREVLER (owner, 2026-11-24). Four acts the loop already has, each paying a small purse once a UTC
 * day. The server counts them; this panel says what is done, what is left, where to do it, and takes the
 * purse. It stays out of the way while it loads and wherever the server has no panel for this commander.
 */
export function DailyQuests({ onGo }: { onGo?: ((gate: RewardGate) => void) | undefined }) {
  const { t } = useTranslation();
  const { data } = useDailyQuests();
  const claim = useClaimDailyQuest();
  const say = useToast();
  const now = useNow(30_000);
  const seen = useRef<Map<string, string> | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  // A row that turns ready while the panel is open gets its crossing bar once; the first read gets none.
  useEffect(() => {
    if (!data) return;
    const before = seen.current;
    const after = new Map(data.quests.map((quest) => [quest.id, quest.state]));
    seen.current = after;
    if (before === null) return;
    const turned = data.quests.filter((quest) => quest.state === 'claimable' && before.get(quest.id) === 'locked').map((quest) => quest.id);
    if (turned.length === 0) return;
    setFresh(new Set(turned));
    const timer = window.setTimeout(() => { setFresh(new Set()); }, FRESH_MS);
    return () => { window.clearTimeout(timer); };
  }, [data]);

  if (!data) return null;
  const rows = data.quests.filter((quest) => known(quest.id));
  if (rows.length === 0) return null;
  const left = Math.max(0, (data.resetsAt.getTime() - now) / 60_000);
  const onClaim = (id: string) => {
    claim.mutate(id, {
      onSuccess: (result) => {
        playSound('unseal');
        const { alloy, crystal, honor } = result.granted;
        // A season with no ranked Honor pays none, and the toast does not name a zero.
        say(honor > 0
          ? t('rewards.daily.granted', { alloy: compact(alloy), crystal: compact(crystal), honor: honorScore(honor) })
          : t('rewards.granted', { alloy: compact(alloy), crystal: compact(crystal) }));
      },
      onError: (error) => { say(describe(error), 'error'); },
    });
  };
  const claiming = claim.isPending ? claim.variables : null;

  return <section data-testid="daily-quests" className="gk-cut dq" aria-label={t('rewards.daily.title')}>
    <header className="dq__head">
      <h3 className="dq__title gk-display">{t('rewards.daily.title')}</h3>
      <span className="dq__reset gk-num"><Glyph id="clock" />{t('rewards.daily.resets', { time: roughDuration(left) })}</span>
    </header>
    <ul className="dq__list">
      {rows.map((quest) => {
        const id = quest.id as DailyQuestId;
        const gate = dailyQuestGate(id);
        return <li key={quest.id} data-quest={quest.id} data-state={quest.state} {...(fresh.has(quest.id) ? { 'data-fresh': '' } : {})} className="dq__row">
          <span className="dq__mark" aria-hidden="true"><Glyph id={MARK[id]} /></span>
          <div className="dq__words">
            <div className="dq__line">
              <span className="dq__name gk-display">{t(`rewards.daily.quests.${id}`)}</span>
              <span className="dq__count gk-num">{t('rewards.progressCount', { have: quest.progress, need: quest.goal })}</span>
            </div>
            <ProgressBar value={quest.progress} max={quest.goal} segments={quest.goal} />
          </div>
          <div className="dq__side">
            <CostLine cost={{ alloy: quest.alloy, crystal: quest.crystal }} />
            <div className="dq__act">
              {quest.honor > 0 && <span className="dq__honor gk-num"><Glyph id="star" />{honorScore(quest.honor)} {t('leaderboard.honorTitle')}</span>}
              {quest.state === 'claimable'
                ? <GameButton size="sm" tone="self" heavy className="gk-btn--compact" pending={claiming === quest.id}
                  disabledReason={claim.isPending && claiming !== quest.id ? t('rewards.claim') : null}
                  onPress={() => { haptic('commit'); onClaim(quest.id); }}>{t('rewards.claim')}</GameButton>
                : quest.state === 'claimed'
                  ? <span className="dq__taken"><Glyph id="check" />{t('rewards.claimed')}</span>
                  : gate && onGo
                    ? <GameButton size="sm" tone="steel" glyph="next" className="gk-btn--compact" onPress={() => { onGo(gate); }}>{t('rewards.go')}</GameButton>
                    : null}
            </div>
          </div>
        </li>;
      })}
    </ul>
    <InfoPeek about={t('rewards.daily.about')} fact={<span className="dq__fact">{t('rewards.daily.fact')}</span>} rule={<p className="gk-copy">{t('rewards.daily.rule')}</p>} />
  </section>;
}
