import { fleetEntries } from '@astera/rules';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../api/context.js';
import { hullLabel } from '../i18n/names.js';
import { full } from '../lib/format.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { scenePlayed, startJump, useJump, fromTheLanding } from './jump.js';
import { dismissTip, tipDismissed, tipFor, type LandingTip } from './landingTips.js';
import { arrivalQuery, useMarkArrivalSeen } from './queries.js';

const CARD_LINES = ['battle', 'shield', 'absence', 'core', 'opened', 'alerts'] as const;

/**
 * THE ONE CARD AFTER THE LANDING, and the week of short notes behind it. Reads from the main game's
 * side, since the account no longer has a ship. A scene cut short plays its ending first, once.
 */
export function ArrivalHost() {
  const { t } = useTranslation();
  const api = useApi();
  const jump = useJump();
  const seen = useMarkArrivalSeen();
  const { data } = useQuery(arrivalQuery(api));
  const [now] = useState(() => Date.now());
  const [tip, setTip] = useState<LandingTip | null>(null);
  const arrival = data?.arrival ?? null;
  const hull = arrival?.hull;
  const shardName = arrival?.shardName;

  useEffect(() => {
    if (!hull || shardName === undefined || jump || scenePlayed()) return;
    startJump({ shardName, hull, look: 'RENEWED', sky: [], landing: null, start: fromTheLanding });
  }, [hull, shardName, jump]);

  const landedAt = data?.landedAt?.getTime();
  useEffect(() => {
    if (arrival || landedAt === undefined) { setTip(null); return; }
    const next = tipFor(landedAt, now);
    setTip(next && !tipDismissed(next) ? next : null);
  }, [arrival, landedAt, now]);

  if (jump) return null;
  if (arrival) {
    return (
      <Sheet
        title={t('starter.landing.title', { name: arrival.shardName })}
        onClose={() => { seen.mutate(); }}
        footer={
          <div className="flex items-center gap-2">
            <button type="button" className="min-h-11 shrink-0 rounded-control border border-v2-line-hi px-3 text-caption text-v2-ink-2"
              onClick={() => { startJump({ shardName: arrival.shardName, hull: arrival.hull, look: 'RENEWED', sky: [], landing: null, start: 0, replay: true }); }}>
              {t('starter.jump.replay')}
            </button>
            <button type="button" onClick={() => { seen.mutate(); }}
              className="min-h-11 flex-1 rounded-control border border-v2-self bg-gradient-to-b from-v2-self to-v2-self/55 text-body font-bold uppercase tracking-wide text-v2-void">
              {t('starter.landing.go')}
            </button>
          </div>
        }
      >
        <div data-testid="landing-card" className="flex flex-col gap-2 pt-1 font-v2-ui">
          <p className="text-caption leading-snug text-v2-ink-2">
            {t('starter.landing.cargo', { alloy: full(arrival.cargo.alloy), crystal: full(arrival.cargo.crystal), deuterium: full(arrival.cargo.deuterium) })}
            {fleetEntries(arrival.cargo.fleet).map(([id, count]) => ` · ${String(count)} ${hullLabel(id)}`).join('')}
          </p>
          <ul className="flex flex-col gap-1.5">
            {CARD_LINES.map(line => (
              <li key={line} className="border-l-2 border-v2-self/60 pl-2 text-caption leading-snug text-v2-ink">{t(`starter.landing.line.${line}`)}</li>
            ))}
          </ul>
        </div>
      </Sheet>
    );
  }
  if (!tip) return null;
  return (
    <div data-testid="landing-tip" role="status" className="pointer-events-auto fixed inset-x-3 top-[calc(env(safe-area-inset-top)+64px)] z-[60] mx-auto flex max-w-[440px] items-start gap-2 rounded-control border border-v2-self/40 bg-v2-panel/95 px-2.5 py-2 font-v2-ui shadow-lg">
      <p className="min-w-0 flex-1 text-caption leading-snug text-v2-ink">{t(`starter.landing.tip.${tip}`)}</p>
      <button type="button" aria-label={t('starter.landing.dismiss')} onClick={() => { dismissTip(tip); setTip(null); }}
        className="-m-1 min-h-8 min-w-8 text-v2-ink-2">×</button>
    </div>
  );
}
