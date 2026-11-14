import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ALERT_TIMINGS, PAID_ALERTS, type AlertTiming, type PaidAlertKind } from '@astera/rules';
import {
  useBuildNotificationCenter, useFundNotificationCenter, useNotificationCenter, useNotificationCenterSettings,
} from '../api/notificationCenter.js';
import { PAID_ALERT_KINDS, type NotificationCenter } from '../api/notificationCenterSchemas.js';
import { useApi } from '../api/context.js';
import { usePlanet } from '../api/queries.js';
import { Banner, CostLine, GameButton, GameHold, Glyph, SectionTag, Toggle, type GlyphId } from '../game-ui/index.js';
import { LANGUAGES, type Language } from '../i18n/languages.js';
import { full } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import { useProjected } from '../lib/projection.js';
import { LOCAL_ALERT_CATEGORIES } from '../lib/localAlerts.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import {
  allowExactLocalAlerts, disableLocalAlerts, enableLocalAlerts, setLocalAlertPrefs, useLocalAlertSettings, usePhonePermission,
} from '../platform/localNotifications.js';
import { connectPush } from '../platform/push.js';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { describe } from '../ui/Toast.js';
import { Sheet } from '../v2/kit/Sheet.js';

const KIND_GLYPH: Record<PaidAlertKind, GlyphId> = { incoming_attack: 'attack', incoming_strategic: 'radiation', probe_detected: 'eye' };
const RECENT_SHOWN = 5;
const HARDWARE = '/assets/images/general/notification_center_1.webp';

/** What one alert of this kind costs today, at the commander's timing where it has one. */
function priceOf(view: NotificationCenter, kind: PaidAlertKind): number {
  return kind === 'probe_detected' ? view.prices.probe_detected : view.prices[kind][view.timing];
}

function Deuterium({ amount, className = '' }: { amount: number; className?: string }) {
  const { t } = useTranslation();
  return <span className={`gk-deut gk-num ${className}`}>
    <img src={RESOURCE_ART.deuterium} alt={t('vocabulary.resource.deuterium')} draggable={false} />
    {full(amount)}
  </span>;
}

/** A setback said on the kit: what the server answered, in the hostile tone. */
function Failure({ error }: { error: unknown }) {
  return <Banner tone="hostile" glyph="warn" role="alert" title={describe(error)} />;
}

/**
 * BİLDİRİM MERKEZİ. Owner 2026-10-30, docs/bildirim-merkezi-plani-2026-10-30.md.
 * Android only: the web has no way in and no trace of it.
 *
 * ON THE GAME KIT (C6, 2026-11-14). The player's question is "will I know before they land,
 * and what does it cost me?": the wallet answers it first, in alerts it pays for; the timing
 * is a dial of four lit rows with their price each; the kinds are the kit's switches. Building
 * and every transfer spend, so both are the kit's one-second hold, the transfer's "it cannot
 * come back" said above it rather than in a dialog after.
 */
export function NotificationCenterSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const query = useNotificationCenter(true);
  const view = query.data;
  return createPortal(<div>
    <Sheet placement="dialog" title={t('notificationCenter.title')} eyebrow={t('notificationCenter.eyebrow')}
      headerArt={ATMOSPHERE.notificationCenter} kit={{ art: HARDWARE, tone: 'self' }} onClose={onClose} detents={['full']}>
      <div data-notification-center className="gk-center">
        <p className="gk-copy">{t('notificationCenter.lead')}</p>
        {!view ? <div className="grid gap-2">
            <p role="status" className="gk-note">{query.isError ? t('notificationCenter.loadError') : t('notificationCenter.loading')}</p>
            {query.isError && <GameButton size="sm" glyph="refresh" onPress={() => { void query.refetch(); }}>{t('notificationCenter.retry')}</GameButton>}
          </div>
          : view.built ? <Built view={view} /> : <Unbuilt view={view} />}
        <PhoneAlerts />
      </div>
    </Sheet>
  </div>, document.body);
}

/** One line of a kit ledger: a mark, what it is, and what it costs or came to. */
function LedgerRow({ glyph, tone, title, sub, side }: { glyph: GlyphId; tone?: 'hostile'; title: ReactNode; sub: ReactNode; side: ReactNode }) {
  return <li className="gk-ledger__row">
    <span className="gk-ledger__mark" {...(tone ? { 'data-tone': tone } : {})}><Glyph id={glyph} /></span>
    <span className="gk-ledger__words">
      <span className="gk-ledger__title">{title}</span>
      <span className="gk-ledger__sub">{sub}</span>
    </span>
    <span className="gk-ledger__side">{side}</span>
  </li>;
}

/** The three paid kinds, at their floor: what the centre is for before it is built. */
function KindsPreview() {
  const { t } = useTranslation();
  return <div className="grid gap-2">
    <SectionTag>{t('notificationCenter.kindsTitle')}</SectionTag>
    <ul aria-label={t('notificationCenter.kindsTitle')} className="gk-ledger">
      {PAID_ALERT_KINDS.map(kind => {
        const row: { timed?: Record<AlertTiming, { floor: number }>; now?: { floor: number } } = PAID_ALERTS[kind];
        const floor = row.now?.floor ?? row.timed?.T3.floor ?? 0;
        return <LedgerRow key={kind} glyph={KIND_GLYPH[kind]} tone="hostile" title={t(`notificationCenter.kind.${kind}`)}
          sub={t(`notificationCenter.kindRule.${kind}`)}
          side={<><span className="gk-note">{t('notificationCenter.from')}</span><Deuterium amount={floor} /></>} />;
      })}
    </ul>
  </div>;
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
    <section aria-label={t('notificationCenter.buildCost')} className="gk-well gk-center__build">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="gk-label">{t('notificationCenter.buildCost')}</span>
        <CostLine cost={cost} {...(world ? { held: world.held } : {})} />
      </div>
      <p className="gk-note">{t('notificationCenter.buildFrom', { world: world?.name ?? '—' })}</p>
      {short && world && <p className="gk-center__warn">{t('notificationCenter.buildShort')}</p>}
      <GameHold weight="spends" glyph="bell" label={t('notificationCenter.build')}
        disabledReason={short ? t('notificationCenter.buildShortReason') : null}
        onCommit={() => { if (world && !build.isPending) build.mutate(world.id, { onSuccess: () => { void askPush(); } }); }} />
    </section>
    {build.error && <Failure error={build.error} />}
  </>;
}

function Built({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  const settings = useNotificationCenterSettings();
  const attack = view.prices.incoming_attack[view.timing];
  const covers = Math.floor(view.wallet / attack);
  // One setting at a time: the next is worked out from the view the last one answers with.
  const setMuted = (kind: PaidAlertKind, on: boolean) => {
    if (settings.isPending) return;
    settings.mutate({ muted: on ? view.muted.filter(k => k !== kind) : [...view.muted, kind] });
  };
  return <>
    <PushOff />
    <section aria-label={t('notificationCenter.wallet')} className="gk-wallet" {...(covers > 0 ? {} : { 'data-short': '' })}>
      <div className="gk-wallet__head">
        <span className="gk-label">{t('notificationCenter.wallet')}</span>
        <Deuterium amount={view.wallet} className="gk-wallet__sum" />
      </div>
      <p className="gk-wallet__covers">
        {covers > 0 ? t('notificationCenter.covers', { count: covers, timing: t(`notificationCenter.timingOption.${view.timing}`) }) : t('notificationCenter.empty')}</p>
      {view.unfunded > 0 && <p className="gk-center__warn">{t('notificationCenter.unfunded', { count: view.unfunded })}</p>}
      <p className="gk-note">{t('notificationCenter.walletRule')}</p>
      <Transfer view={view} />
    </section>

    <Timing view={view} pending={settings.isPending} onChoose={timing => { settings.mutate({ timing }); }} />

    <div className="grid gap-2">
      <SectionTag>{t('notificationCenter.kindsTitle')}</SectionTag>
      <div className="gk-switches">
        {PAID_ALERT_KINDS.map(kind => {
          const on = !view.muted.includes(kind);
          return <Toggle key={kind} checked={on} onChange={value => { setMuted(kind, value); }} sub={t(`notificationCenter.kindRule.${kind}`)}
            label={<span className="gk-kindline">
              <span className="gk-kindline__mark" {...(on ? { 'data-on': '' } : {})}><Glyph id={KIND_GLYPH[kind]} /></span>
              <span className="gk-kindline__name">{t(`notificationCenter.kind.${kind}`)}</span>
              <Deuterium amount={priceOf(view, kind)} />
            </span>} />;
        })}
      </div>
    </div>

    {view.recent.length > 0 && <Recent view={view} />}

    <Rules view={view} />
    {settings.error && <Failure error={settings.error} />}
  </>;
}

/** A setting, not a price list: the moment is the choice, the price per alert its consequence. */
function Timing({ view, pending, onChoose }: { view: NotificationCenter; pending: boolean; onChoose: (timing: AlertTiming) => void }) {
  const { t } = useTranslation();
  const question = useId();
  const choose = (timing: AlertTiming): void => {
    if (pending || timing === view.timing) return;
    playSound('tab');
    haptic('tap');
    onChoose(timing);
  };
  const walk = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const at = ALERT_TIMINGS.indexOf(view.timing) + step;
    const next = ALERT_TIMINGS[at];
    if (next === undefined) return;
    choose(next);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[at]?.focus();
  };
  return <div className="grid gap-2">
    <p id={question} className="gk-center__ask">{t('notificationCenter.timingTitle')}</p>
    <div role="radiogroup" aria-labelledby={question} className="gk-rate" {...OWN_SOUND}>
      {ALERT_TIMINGS.map(timing => <RateRow key={timing} on={timing === view.timing} label={t(`notificationCenter.timingOption.${timing}`)}
        price={<><Deuterium amount={view.prices.incoming_attack[timing]} />{t('notificationCenter.perAlert')}</>}
        onChoose={() => { choose(timing); }} onKeyDown={walk} />)}
    </div>
    <p className="gk-note">{t('notificationCenter.timingRule')}</p>
  </div>;
}

function RateRow({ on, label, price, onChoose, onKeyDown }: {
  on: boolean;
  label: string;
  price: ReactNode;
  onChoose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const own = useOwnPress(onChoose);
  return <button type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className="gk-rate__row"
    onPointerDown={own.onPointerDown} onClick={own.onClick} onKeyDown={onKeyDown}>
    <span className="gk-rate__lamp" aria-hidden="true" />
    <span className="gk-rate__words">{label}</span>
    <span className="gk-rate__price">{price}</span>
  </button>;
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
  return <div data-push-off className="grid gap-2">
    <Banner tone="warn" glyph="bell" role="status" title={t('notificationCenter.pushOffTitle')} body={t('notificationCenter.pushOff')} />
    <GameButton wide tone="action" glyph="bell" pending={asking} onPress={() => {
      if (asking) return;
      setAsking(true);
      void askPush().then(result => { setRefused(result === 'denied'); }).finally(() => { setAsking(false); });
    }}>{t('notificationCenter.pushAllow')}</GameButton>
    {refused && <p className="gk-center__warn">{t('notificationCenter.pushDenied')}</p>}
  </div>;
}

/** Topping up the one wallet: an amount, never a bundle of alerts. */
function Transfer({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  const world = useSelectedWorld();
  const fund = useFundNotificationCenter();
  const [text, setText] = useState('');
  const store = Math.floor(world?.held.deuterium ?? 0);
  const amount = Number(text);
  const whole = text !== '' && Number.isInteger(amount) && amount >= 1;
  const valid = whole && amount <= store;
  const after = view.wallet + amount;
  const reason = !whole ? t('notificationCenter.amountFirst') : !valid ? t('notificationCenter.amountOver') : null;
  return <div className="gk-wallet__transfer">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="gk-center__ask">{t('notificationCenter.transferTitle')}</span>
      <span className="gk-note">{t('notificationCenter.transferFrom', { world: world?.name ?? '—' })} <Deuterium amount={store} /></span>
    </div>
    <div className="flex gap-2">
      <input type="number" inputMode="numeric" min={1} max={store} step={1} value={text}
        aria-label={t('notificationCenter.amount')} placeholder={t('notificationCenter.amount')}
        onChange={event => { setText(event.target.value); }}
        className="gk-field__input gk-num gk-amount" />
      {store >= 1 && <GameButton size="sm" onPress={() => { setText(String(store)); }}>{t('notificationCenter.all')}</GameButton>}
    </div>
    {valid && <>
      <p className="gk-note">{t('notificationCenter.transferPreview', { wallet: full(after), count: Math.floor(after / view.prices.incoming_attack[view.timing]) })}</p>
      <p className="gk-center__final"><Glyph id="lock" />{t('notificationCenter.confirmBody')}</p>
    </>}
    {/* owner 2026-11-14: the shortest hold, though the transfer cannot be taken back */}
    <GameHold weight="reversible" glyph="fuel" label={t('notificationCenter.transfer')} detail={valid ? <Deuterium amount={amount} /> : undefined}
      disabledReason={reason} onCommit={() => {
        if (!world || fund.isPending) return;
        fund.mutate({ planetId: world.id, amount }, { onSuccess: () => { setText(''); } });
      }} />
    {fund.error && <Failure error={fund.error} />}
  </div>;
}

function Recent({ view }: { view: NotificationCenter }) {
  const { t, i18n } = useTranslation();
  const time = (date: Date) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(date);
  return <div className="grid gap-2">
    <SectionTag>{t('notificationCenter.recentTitle')}</SectionTag>
    <ul aria-label={t('notificationCenter.recentTitle')} className="gk-ledger">
      {view.recent.slice(0, RECENT_SHOWN).map((row, index) => {
        const target = row.payload.targetPlanetName;
        const charged = row.status === 'SENT' && row.price !== null;
        const tone = row.status === 'SENT' ? 'sent' : row.status === 'UNFUNDED' ? 'short' : 'none';
        return <LedgerRow key={index} glyph={KIND_GLYPH[row.kind]}
          title={`${t(`notificationCenter.kind.${row.kind}`)}${target ? ` · ${target}` : ''}`}
          sub={<span className="gk-num">{time(row.sendAt)}</span>}
          side={<span className="gk-ledger__status" data-tone={tone}>
            <span>{t(`notificationCenter.status.${row.status}`)}</span>
            {charged && <span className="gk-num">−{full(row.price ?? 0)}</span>}
          </span>} />;
      })}
    </ul>
  </div>;
}

/** The whole rule, one press away: what is never charged, and what an alert costs. */
function Rules({ view }: { view: NotificationCenter }) {
  const { t } = useTranslation();
  return <details className="gk-rules">
    <summary className="gk-rules__head" {...OWN_SOUND} onClick={() => { playSound('tap'); haptic('tap'); }}>
      <Glyph id="help" />
      <span className="flex-1">{t('notificationCenter.rulesTitle')}</span>
      <span className="gk-rules__chev"><Glyph id="down" /></span>
    </summary>
    <div className="gk-rules__body">
      <ul>
        {(['ruleRadar', 'ruleRecall', 'ruleShort', 'ruleUndelivered', 'ruleInGame'] as const).map(key => <li key={key}>{t(`notificationCenter.${key}`)}</li>)}
      </ul>
      <p>{t('notificationCenter.priceRule', { rate: full(view.deuteriumPerHour) })}</p>
      <table className="gk-num">
        <tbody>
          {ALERT_TIMINGS.map(timing => {
            const price = PAID_ALERTS.incoming_attack.timed[timing];
            return <tr key={timing}>
              <td>{t(`notificationCenter.timing.${timing}`)}</td>
              <td>{t('notificationCenter.hours', { count: price.hours })}</td>
              <td>{t('notificationCenter.floor', { amount: price.floor })}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </details>;
}

/**
 * Android 12+ without the on-time alarm: in a game of minutes, the one thing on this section
 * worth a tap. Exported for the v2 gallery.
 */
export function LateAlerts() {
  const { t } = useTranslation();
  return <div data-local-late className="grid gap-2">
    <Banner tone="warn" glyph="clock" role="status" title={t('notificationCenter.local.lateTitle')} body={t('notificationCenter.local.late')} />
    <GameButton wide tone="action" glyph="clock" onPress={() => { void allowExactLocalAlerts(); }}>{t('notificationCenter.local.allowExact')}</GameButton>
  </div>;
}

/**
 * Free queue alerts scheduled on this phone (decision 3): no building, no wallet. The switch
 * is the player's choice; the phone's permission is read live, and a block set in the phone
 * settings is said here rather than failing in silence.
 */
function PhoneAlerts() {
  const { t } = useTranslation();
  const settings = useLocalAlertSettings();
  const permission = usePhonePermission();
  const [tried, setTried] = useState(false);
  const [asking, setAsking] = useState(false);
  const blocked = permission.display === 'denied';
  return <div className="grid gap-2">
    <SectionTag>{t('notificationCenter.local.section')}</SectionTag>
    <p className="gk-copy">{t('notificationCenter.local.sectionBody')}</p>
    <div className="gk-switches">
      <Toggle checked={settings.enabled} label={t('notificationCenter.local.switch')} onChange={on => {
        if (asking) return;
        if (!on) { disableLocalAlerts(); return; }
        setAsking(true);
        void enableLocalAlerts().finally(() => { setTried(true); setAsking(false); });
      }} />
      {settings.enabled && <div className="gk-switches__grid" {...(blocked ? { 'data-blocked': '' } : {})}>
        {LOCAL_ALERT_CATEGORIES.map(category => <Toggle key={category} checked={settings.prefs[category]}
          label={t(`notificationCenter.local.category.${category}`)}
          onChange={on => { setLocalAlertPrefs({ ...settings.prefs, [category]: on }); }} />)}
      </div>}
    </div>
    {blocked && settings.enabled && <p className="gk-center__warn">{t('notificationCenter.local.blocked')}</p>}
    {blocked && !settings.enabled && tried && <p className="gk-center__warn">{t('notificationCenter.local.denied')}</p>}
    {settings.enabled && permission.display === 'granted' && permission.exact === 'denied' && <LateAlerts />}
  </div>;
}
