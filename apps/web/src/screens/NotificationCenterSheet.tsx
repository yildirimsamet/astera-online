import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ALERT_TIMINGS, PAID_ALERTS, type AlertTiming, type PaidAlertKind } from '@astera/rules';
import {
  useBuildNotificationCenter, useFundNotificationCenter, useNotificationCenter, useNotificationCenterSettings,
} from '../api/notificationCenter.js';
import { PAID_ALERT_KINDS, type NotificationCenter } from '../api/notificationCenterSchemas.js';
import { useApi } from '../api/context.js';
import { usePlanet } from '../api/queries.js';
import { LANGUAGES, type Language } from '../i18n/languages.js';
import { full } from '../lib/format.js';
import { useProjected } from '../lib/projection.js';
import { LOCAL_ALERT_CATEGORIES } from '../lib/localAlerts.js';
import {
  allowExactLocalAlerts, disableLocalAlerts, enableLocalAlerts, setLocalAlertPrefs, useLocalAlertSettings, usePhonePermission,
} from '../platform/localNotifications.js';
import { connectPush } from '../platform/push.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { BroadcastIcon, ClockIcon, DeathStarIcon, IncomingIcon, ScanIcon } from '../ui/icons/index.js';
import { Confirm, ConfirmLine } from '../ui/kit/Confirm.js';
import { describe } from '../ui/Toast.js';
import { Cost } from '../v2/kit/Cost.js';
import { Sheet } from '../v2/kit/Sheet.js';
import { Button, Note, Section } from '../v2/kit/Surface.js';
import { Toggle } from '../v2/kit/Toggle.js';

const KIND_ICON = { incoming_attack: IncomingIcon, incoming_strategic: DeathStarIcon, probe_detected: ScanIcon } as const;
const RECENT_SHOWN = 5;
const HARDWARE = '/assets/images/general/notification_center_1.webp';

/** The transmitter itself, in the 74px socket the base's hardware uses. */
function Hardware() {
  return <img src={HARDWARE} alt="" aria-hidden="true" draggable={false} decoding="async"
    className="size-[74px] shrink-0 object-contain drop-shadow-[0_6px_14px_rgb(0_0_0/0.55)]" />;
}

/** What one alert of this kind costs today, at the commander's timing where it has one. */
function priceOf(view: NotificationCenter, kind: PaidAlertKind): number {
  return kind === 'probe_detected' ? view.prices.probe_detected : view.prices[kind][view.timing];
}

function Deuterium({ amount, className = '' }: { amount: number; className?: string }) {
  const { t } = useTranslation();
  return <span className={`inline-flex items-center gap-1 font-v2-mono tabular-nums ${className}`}>
    <img src={RESOURCE_ART.deuterium} alt={t('vocabulary.resource.deuterium')} className="size-3.5 shrink-0 object-contain" />
    {full(amount)}
  </span>;
}

/**
 * BİLDİRİM MERKEZİ. Owner 2026-10-30, docs/bildirim-merkezi-plani-2026-10-30.md.
 * Android only: the web has no way in and no trace of it.
 */
export function NotificationCenterSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const query = useNotificationCenter(true);
  const view = query.data;
  return createPortal(<div>
    <Sheet placement="dialog" title={t('notificationCenter.title')} eyebrow={t('notificationCenter.eyebrow')}
      headerArt={ATMOSPHERE.notificationCenter} onClose={onClose} detents={['full']}>
      <div data-notification-center className="flex flex-col gap-4 pb-3">
        <p className="text-caption leading-relaxed text-v2-ink-2">{t('notificationCenter.lead')}</p>
        {!view ? <>
            <Note>{query.isError ? t('notificationCenter.loadError') : t('notificationCenter.loading')}</Note>
            {query.isError && <Button onClick={() => { void query.refetch(); }}>{t('notificationCenter.retry')}</Button>}
          </>
          : view.built ? <Built view={view} /> : <Unbuilt view={view} />}
        <PhoneAlerts />
      </div>
    </Sheet>
  </div>, document.body);
}

/** The three paid kinds, at their floor: what the centre is for before it is built. */
function KindsPreview() {
  const { t } = useTranslation();
  return <ul className="divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel px-3">
    {PAID_ALERT_KINDS.map(kind => {
      const Icon = KIND_ICON[kind];
      const row: { timed?: Record<AlertTiming, { floor: number }>; now?: { floor: number } } = PAID_ALERTS[kind];
      const floor = row.now?.floor ?? row.timed?.T3.floor ?? 0;
      return <li key={kind} className="flex items-center gap-3 py-2.5">
        <Icon className="size-5 shrink-0 text-v2-hostile" />
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-v2-ink">{t(`notificationCenter.kind.${kind}`)}</p>
          <p className="text-micro leading-snug text-v2-ink-3">{t(`notificationCenter.kindRule.${kind}`)}</p>
        </div>
        <span className="shrink-0 text-micro text-v2-ink-3">{t('notificationCenter.from')} <Deuterium amount={floor} className="text-v2-ink-2" /></span>
      </li>;
    })}
  </ul>;
}

/** Asks the phone for notifications and hands its FCM address to the server (`platform/push.ts`). */
function useAskPush() {
  const api = useApi();
  const { t, i18n } = useTranslation();
  const resolved = i18n.resolvedLanguage;
  const locale: Language = LANGUAGES.find(language => language === resolved) ?? 'en';
  return () => connectPush(api, { locale, channelName: t('notificationCenter.pushChannel'), ask: true });
}

function useSelectedWorld() {
  const { data, dataUpdatedAt } = usePlanet();
  const held = useProjected(data?.planet, dataUpdatedAt, 5000);
  return data ? { id: data.planet.id, name: data.planet.name, held } : null;
}

function Unbuilt({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  const world = useSelectedWorld();
  const build = useBuildNotificationCenter();
  const askPush = useAskPush();
  const cost = view.buildCost;
  const short = !world || world.held.alloy < cost.alloy || world.held.crystal < cost.crystal || world.held.deuterium < cost.deuterium;
  return <>
    <KindsPreview />
    <div className="flex flex-col gap-3 rounded-control border border-v2-line-hi bg-v2-panel p-3">
      <div className="flex items-center gap-3">
        <Hardware />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="text-body font-semibold text-v2-ink">{t('notificationCenter.buildCost')}</span>
            <Cost cost={cost} {...(world ? { held: world.held } : {})} />
          </div>
          <p className="text-caption leading-relaxed text-v2-ink-2">{t('notificationCenter.buildFrom', { world: world?.name ?? '—' })}</p>
        </div>
      </div>
      <Button size="lg" full variant="primary" disabled={short || build.isPending}
        onClick={() => { if (world) build.mutate(world.id, { onSuccess: () => { void askPush(); } }); }}>{t('notificationCenter.build')}</Button>
      {short && world && <p className="text-micro text-v2-warn">{t('notificationCenter.buildShort')}</p>}
    </div>
    {build.error && <Note>{describe(build.error)}</Note>}
  </>;
}

function Built({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  const settings = useNotificationCenterSettings();
  const attack = view.prices.incoming_attack[view.timing];
  const covers = Math.floor(view.wallet / attack);
  const setMuted = (kind: PaidAlertKind, on: boolean) => {
    settings.mutate({ muted: on ? view.muted.filter(k => k !== kind) : [...view.muted, kind] });
  };
  return <>
    <PushOff />
    <section aria-label={t('notificationCenter.wallet')}
      className={`flex flex-col gap-3 rounded-control border p-3 ${covers > 0 ? 'border-v2-self/30 bg-v2-self/5' : 'border-v2-warn/40 bg-v2-warn/5'}`}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-micro uppercase tracking-wide text-v2-ink-3">{t('notificationCenter.wallet')}</span>
          <Deuterium amount={view.wallet} className={`text-title ${covers > 0 ? 'text-v2-self' : 'text-v2-warn'}`} />
        </div>
        <p className={`text-caption leading-snug ${covers > 0 ? 'text-v2-ink-2' : 'text-v2-warn'}`}>
          {covers > 0 ? t('notificationCenter.covers', { count: covers, timing: t(`notificationCenter.timingOption.${view.timing}`) }) : t('notificationCenter.empty')}</p>
        {view.unfunded > 0 && <p className="text-caption leading-snug text-v2-warn">{t('notificationCenter.unfunded', { count: view.unfunded })}</p>}
        <p className="text-micro leading-snug text-v2-ink-3">{t('notificationCenter.walletRule')}</p>
      </div>
      <Transfer view={view} />
    </section>

    <Section label={t('notificationCenter.timingTitle')}>
      {/* A setting, not a price list: the moment is the choice, the price per alert its consequence. */}
      <div role="radiogroup" aria-label={t('notificationCenter.timingTitle')}
        className="flex flex-col divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel">
        {ALERT_TIMINGS.map(timing => {
          const on = timing === view.timing;
          return <button key={timing} type="button" role="radio" aria-checked={on} disabled={settings.isPending}
            onClick={() => { if (!on) settings.mutate({ timing }); }}
            className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-left transition-colors first:rounded-t-control last:rounded-b-control hover:bg-v2-raise focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-v2-self">
            <span aria-hidden="true" className={`grid size-4 shrink-0 place-items-center rounded-full border ${on ? 'border-v2-self' : 'border-v2-line-hi'}`}>
              {on && <span className="size-2 rounded-full bg-v2-self" />}
            </span>
            <span className={`min-w-0 flex-1 text-caption ${on ? 'font-semibold text-v2-ink' : 'text-v2-ink-2'}`}>{t(`notificationCenter.timingOption.${timing}`)}</span>
            <span className="flex shrink-0 items-center gap-1 text-micro text-v2-ink-3">
              <Deuterium amount={view.prices.incoming_attack[timing]} className={on ? 'text-v2-self' : 'text-v2-ink-2'} />
              {t('notificationCenter.perAlert')}
            </span>
          </button>;
        })}
      </div>
      <p className="text-micro leading-relaxed text-v2-ink-3">{t('notificationCenter.timingRule')}</p>
    </Section>

    <Section label={t('notificationCenter.kindsTitle')}>
      <div className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
        {PAID_ALERT_KINDS.map(kind => {
          const Icon = KIND_ICON[kind];
          const on = !view.muted.includes(kind);
          return <Toggle key={kind} tone="self" checked={on} disabled={settings.isPending} onChange={value => { setMuted(kind, value); }}>
            <span className="flex items-center gap-2">
              <Icon className={`size-4 shrink-0 ${on ? 'text-v2-hostile' : 'text-v2-ink-3'}`} />
              <span className="min-w-0 flex-1 font-semibold">{t(`notificationCenter.kind.${kind}`)}</span>
              <Deuterium amount={priceOf(view, kind)} className="shrink-0 text-micro text-v2-ink-2" />
            </span>
            <span className="mt-0.5 block text-micro text-v2-ink-3">{t(`notificationCenter.kindRule.${kind}`)}</span>
          </Toggle>;
        })}
      </div>
    </Section>

    {view.recent.length > 0 && <Recent view={view} />}

    <details className="rounded-control border border-v2-line p-3 text-caption text-v2-ink-2">
      <summary className="cursor-pointer font-semibold text-v2-ink">{t('notificationCenter.rulesTitle')}</summary>
      <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 leading-relaxed">
        {(['ruleRadar', 'ruleRecall', 'ruleShort', 'ruleInGame'] as const).map(key => <li key={key}>{t(`notificationCenter.${key}`)}</li>)}
      </ul>
      <p className="mt-3 leading-relaxed">{t('notificationCenter.priceRule', { rate: full(view.deuteriumPerHour) })}</p>
      <table className="mt-2 w-full font-v2-mono text-micro">
        <tbody>
          {ALERT_TIMINGS.map(timing => {
            const price = PAID_ALERTS.incoming_attack.timed[timing];
            return <tr key={timing} className="border-t border-v2-line">
              <td className="py-1 font-v2-ui">{t(`notificationCenter.timing.${timing}`)}</td>
              <td className="py-1 text-right">{t('notificationCenter.hours', { count: price.hours })}</td>
              <td className="py-1 text-right">{t('notificationCenter.floor', { amount: price.floor })}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </details>
    {settings.error && <Note>{describe(settings.error)}</Note>}
  </>;
}

/**
 * The centre exists to reach the phone: without notifications it cannot, so this leads the
 * built centre in the same amber as a late alert. Android stops asking after a second refusal,
 * and then only the phone settings can turn it back on.
 */
function PushOff() {
  const { t } = useTranslation();
  const { display } = usePhonePermission();
  const askPush = useAskPush();
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState(false);
  if (display === 'granted' || display === 'unknown') return null;
  return <div data-push-off role="status" className="flex flex-col gap-2.5 rounded-control border border-v2-warn/50 bg-v2-warn/10 p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-v2-warn/60 bg-v2-warn/15 text-v2-warn">
        <BroadcastIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-caption font-semibold text-v2-warn">{t('notificationCenter.pushOffTitle')}</p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('notificationCenter.pushOff')}</p>
      </div>
    </div>
    <button type="button" disabled={asking} onClick={() => {
      setAsking(true);
      void askPush().then(result => { setRefused(result === 'denied'); }).finally(() => { setAsking(false); });
    }}
      className="flex min-h-10 items-center justify-center rounded-control bg-v2-warn px-3 text-caption font-semibold text-v2-deep shadow-[0_0_18px_rgb(255_204_77/0.22)] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-warn disabled:opacity-60">
      {t('notificationCenter.pushAllow')}</button>
    {refused && <p className="text-micro leading-snug text-v2-warn">{t('notificationCenter.pushDenied')}</p>}
  </div>;
}

/** Topping up the one wallet: an amount, never a bundle of alerts. */
function Transfer({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  const world = useSelectedWorld();
  const fund = useFundNotificationCenter();
  const [text, setText] = useState('');
  const [confirming, setConfirming] = useState(false);
  const store = Math.floor(world?.held.deuterium ?? 0);
  const amount = Number(text);
  const valid = text !== '' && Number.isInteger(amount) && amount >= 1 && amount <= store;
  const after = view.wallet + amount;
  return <div className="flex flex-col gap-2 border-t border-v2-line pt-3">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="text-caption font-semibold text-v2-ink">{t('notificationCenter.transferTitle')}</span>
      <span className="text-micro text-v2-ink-3">{t('notificationCenter.transferFrom', { world: world?.name ?? '—' })} <Deuterium amount={store} className="text-v2-ink-2" /></span>
    </div>
    <div className="flex gap-2">
      <div className="relative min-w-0 flex-1">
        <input type="number" inputMode="numeric" min={1} max={store} step={1} value={text}
          aria-label={t('notificationCenter.amount')} placeholder={t('notificationCenter.amount')}
          onChange={event => { setText(event.target.value); }}
          className="min-h-11 w-full rounded-control border border-v2-line bg-v2-deep pl-3 pr-16 font-v2-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none text-body text-v2-ink placeholder:font-v2-ui placeholder:text-caption placeholder:text-v2-ink-3 focus-visible:outline-2 focus-visible:outline-v2-self" />
        <button type="button" disabled={store < 1} onClick={() => { setText(String(store)); }}
          className="absolute right-1.5 top-1/2 min-h-8 -translate-y-1/2 rounded-chip px-2 text-micro font-semibold text-v2-self transition-colors hover:bg-v2-self/10 disabled:opacity-40">
          {t('notificationCenter.all')}</button>
      </div>
      <Button variant="primary" disabled={!valid || fund.isPending} onClick={() => { setConfirming(true); }}>{t('notificationCenter.transfer')}</Button>
    </div>
    {valid && <p className="text-micro leading-snug text-v2-ink-2">
      {t('notificationCenter.transferPreview', { wallet: full(after), count: Math.floor(after / view.prices.incoming_attack[view.timing]) })}</p>}
    {fund.error && <Note>{describe(fund.error)}</Note>}
    {confirming && world && <Confirm eyebrow={t('notificationCenter.title')} title={t('notificationCenter.confirmTitle', { amount: full(amount) })}
      confirmLabel={t('notificationCenter.confirm', { amount: full(amount) })} backLabel={t('notificationCenter.back')} pending={fund.isPending}
      onClose={() => { setConfirming(false); }} onConfirm={() => {
        fund.mutate({ planetId: world.id, amount }, { onSuccess: () => { setConfirming(false); setText(''); } });
      }}>
      <ConfirmLine label={world.name} value={`−${full(amount)}`} />
      <ConfirmLine label={t('notificationCenter.walletAfter')} value={full(after)} tone="kept" />
      <p className="mt-2 text-body leading-relaxed text-v2-ink-2">{t('notificationCenter.confirmBody')}</p>
    </Confirm>}
  </div>;
}

function Recent({ view }: { view: NotificationCenter }) {
  const { t, i18n } = useTranslation();
  const time = (date: Date) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  return <Section label={t('notificationCenter.recentTitle')}>
    <ul aria-label={t('notificationCenter.recentTitle')} className="divide-y divide-v2-line rounded-control border border-v2-line bg-v2-panel px-3">
      {view.recent.slice(0, RECENT_SHOWN).map((row, index) => {
        const Icon = KIND_ICON[row.kind];
        const target = row.payload.targetPlanetName;
        const charged = row.status === 'SENT' && row.price !== null;
        return <li key={index} className="flex items-center gap-2.5 py-2">
          <Icon className="size-4 shrink-0 text-v2-ink-3" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-caption text-v2-ink">{t(`notificationCenter.kind.${row.kind}`)}{target ? ` · ${target}` : ''}</p>
            <p className="font-v2-mono text-micro text-v2-ink-3">{time(row.sendAt)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className={`text-micro font-semibold ${row.status === 'SENT' ? 'text-v2-self' : row.status === 'UNFUNDED' ? 'text-v2-warn' : 'text-v2-ink-3'}`}>
              {t(`notificationCenter.status.${row.status}`)}</span>
            {charged && <span className="font-v2-mono text-micro text-v2-ink-2">−{full(row.price ?? 0)}</span>}
          </div>
        </li>;
      })}
    </ul>
  </Section>;
}

/**
 * Free queue alerts scheduled on this phone (decision 3): no building, no wallet. The switch
 * is the player's choice; the phone's permission is read live, and a block set in the phone
 * settings is said here rather than failing in silence.
 */
/** Android 12+ without the on-time alarm: in a game of minutes, the one thing on this section worth a tap. Exported for the v2 gallery. */
export function LateAlerts() {
  const { t } = useTranslation();
  return <div data-local-late role="status" className="flex flex-col gap-2.5 rounded-control border border-v2-warn/50 bg-v2-warn/10 p-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
    <div className="flex items-start gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-v2-warn/60 bg-v2-warn/15 text-v2-warn">
        <ClockIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-caption font-semibold text-v2-warn">{t('notificationCenter.local.lateTitle')}</p>
        <p className="text-micro leading-snug text-v2-ink-2">{t('notificationCenter.local.late')}</p>
      </div>
    </div>
    <button type="button" onClick={() => { void allowExactLocalAlerts(); }}
      className="flex min-h-10 items-center justify-center rounded-control bg-v2-warn px-3 text-caption font-semibold text-v2-deep shadow-[0_0_18px_rgb(255_204_77/0.22)] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-v2-warn">
      {t('notificationCenter.local.allowExact')}</button>
  </div>;
}

function PhoneAlerts() {
  const { t } = useTranslation();
  const settings = useLocalAlertSettings();
  const permission = usePhonePermission();
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState(false);
  const blocked = permission.display === 'denied';
  return <Section label={t('notificationCenter.local.section')}>
    <p className="text-caption leading-relaxed text-v2-ink-2">{t('notificationCenter.local.sectionBody')}</p>
    <div className="flex flex-col gap-1 rounded-control border border-v2-line bg-v2-panel px-2 py-1.5">
      <Toggle tone="self" checked={settings.enabled} disabled={asking} onChange={on => {
        if (!on) { disableLocalAlerts(); return; }
        setAsking(true);
        void enableLocalAlerts().finally(() => { setTried(true); setAsking(false); });
      }}><span className="font-semibold">{t('notificationCenter.local.switch')}</span></Toggle>
      {settings.enabled && <div className={`ml-6 grid grid-cols-2 gap-x-2 border-t border-v2-line pt-1 ${blocked ? 'opacity-50' : ''}`}>
        {LOCAL_ALERT_CATEGORIES.map(category => <Toggle key={category} tone="self" checked={settings.prefs[category]}
          onChange={on => { setLocalAlertPrefs({ ...settings.prefs, [category]: on }); }}>
          {t(`notificationCenter.local.category.${category}`)}</Toggle>)}
      </div>}
    </div>
    {blocked && settings.enabled && <p className="text-micro leading-snug text-v2-warn">{t('notificationCenter.local.blocked')}</p>}
    {blocked && !settings.enabled && tried && <p className="text-micro leading-snug text-v2-warn">{t('notificationCenter.local.denied')}</p>}
    {settings.enabled && permission.display === 'granted' && permission.exact === 'denied' && <LateAlerts />}
  </Section>;
}
