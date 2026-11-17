import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Medallion, ResourceHud, type HudResource } from '../../game-ui/index.js';
import { WORKS_RESOURCES, type CollectState, type WorksResource } from '../../lib/collect.js';
import { compact, full, stock as figure } from '../../lib/format.js';
import { RESOURCE_ART } from '../../ui/assets.js';

type Resource = WorksResource;
export interface CollectionTransfer { id: number; each: Record<Resource, { from: number; to: number }> }

/** The works as the pills read them: what waits in each vessel, and the one press that collects it all. */
export interface WorksPress {
  state: CollectState;
  /** A collect is in flight: the pills hold. */
  pending: boolean;
  onCollect: () => void;
}

export interface TopBarProps {
  /** Each store on the active world, and the part of it the Vault keeps from a raid (`safe`). */
  stock: Record<Resource, { value: number; cap: number; safe?: number }>;
  /** Not in use yet, aboard a colony ship. Its place stays, so the others do not move. */
  hidden?: readonly Resource[];
  /** The works under the stores (owner, 2026-09-25); absent until the world is read. */
  works?: WorksPress;
  transfer?: CollectionTransfer | null;
  /** The commander, for the medallion at the end of the bar: their initials and their name. */
  commander: { initials: string; name: string };
  /** A pill with nothing to collect, or no room to collect it into: the economy, where a store is raised. */
  onResource: (resource: Resource) => void;
  /** The medallion: the menu. */
  onCommander: () => void;
  /** E11 · K10: on a desk the five tabs sit here, between the stores and the medallion. */
  tabs?: ReactNode;
}

const LABEL = {
  alloy: 'statusBar.alloyLabel',
  crystal: 'statusBar.crystalLabel',
  deuterium: 'statusBar.deuteriumLabel',
} as const satisfies Record<Resource, string>;

const TONE = { alloy: 'alloy', crystal: 'crystal', deuterium: 'deut' } as const satisfies Record<Resource, HudResource['tone']>;

const TIP = 'astera:works-tip-v1';

/**
 * THE TOP BAR, ON THE GAME KIT (G1-b, 2026-11-14). Spec B1 (docs/ui-v2/gozlemevi.md).
 *
 * Three resource pills and the commander's medallion. Each pill is its store's figure (whole to 99,999,
 * where a price is still checked digit by digit), a bar of how full the store is with a
 * notch at the share a raid cannot take, and — the works, read at a glance (owner,
 * 2026-09-25) — what waits for it in the works, in the colour of what a press does:
 * green worth collecting, yellow a gap to close (a vessel full and stopped, or no room
 * left in the store), quiet while there is little. A FULL STORE IS A GAP, NEVER RED (H2).
 *
 * THE PILL IS THE ONE PRESS: it collects everything waiting while the stores can take
 * any of it, and otherwise opens the economy, where a store is raised.
 *
 * THE MEDALLION ENDS THE BAR (owner, 2026-11-14): the menu took the bell's place there, and
 * the bell came down to the galaxy beside the chat, where a thumb reaches it.
 */
export function TopBar({ stock, hidden = [], works, transfer = null, commander, onResource, onCommander, tabs }: TopBarProps) {
  const { t } = useTranslation();
  const [tip, setTip] = useState(() => {
    try { return window.localStorage.getItem(TIP) !== 'seen'; }
    catch { return false; }
  });
  const state = works?.state;
  const waiting = state ? WORKS_RESOURCES.filter((resource) => state.each[resource] >= 1) : [];
  // The ship says this itself while it is still opening resources.
  const teach = tip && hidden.length === 0 && waiting.length > 0;
  useEffect(() => {
    if (!teach) return;
    try { window.localStorage.setItem(TIP, 'seen'); } catch { /* Storage is optional. */ }
  }, [teach]);
  const collects = state !== undefined && waiting.length > 0 && !state.blocked;

  const press = (resource: Resource): void => {
    setTip(false);
    if (works?.pending) return;
    if (works && collects) works.onCollect();
    else onResource(resource);
  };

  const items = WORKS_RESOURCES.map((resource): HudResource => {
    const { value, cap, safe = 0 } = stock[resource];
    // Full by the pill's own reading, so the name and the bar never disagree over a fraction.
    const isFull = cap > 0 && value >= cap - 0.5;
    const each = state ? state.each[resource] : 0;
    const stopped = state?.stopped.includes(resource) ?? false;
    const noRoom = state?.noRoom.includes(resource) ?? false;
    const flow = transfer?.each[resource];
    const name = [
      t(isFull ? 'meter.full' : 'meter.reading', { resource: t(LABEL[resource]), value: full(value), cap: full(cap) }),
      ...(state ? [t('statusBar.works.inPool', { amount: full(Math.floor(each)) })] : []),
      ...(stopped ? [t('statusBar.works.fullStopped')] : noRoom ? [t('statusBar.works.storeFull')] : []),
      ...(collects ? [t('statusBar.works.collect')] : []),
    ].join(' · ');
    return {
      id: resource,
      art: RESOURCE_ART[resource],
      amount: figure(value),
      store: isFull ? 1 : cap > 0 ? value / cap : 0,
      ...(cap > 0 && safe > 0 ? { safe: safe / cap } : {}),
      ...(state ? { pool: { text: `+${compact(Math.floor(each))}`, tone: stopped || noRoom ? 'warn' : state.ripe && each >= 1 ? 'good' : 'quiet' } } : {}),
      ...((state?.ripe === true || state?.full === true) && collects && each >= 1 && works?.pending !== true ? { ripe: true } : {}),
      ...(hidden.includes(resource) ? { hidden: true } : {}),
      ...(transfer && flow && flow.to > flow.from ? { flight: transfer.id } : {}),
      tone: TONE[resource],
      label: name,
      onPress: () => { press(resource); },
    };
  });

  return (
    <>
      {/* The bar owns the notch inset now that the brand strip above it is gone (`.gk-hudbar`). */}
      <header className="gk-hudbar">
        {/* On a desk the pills keep a phone's reach; a 600 px bar would read no better than 160. */}
        <div data-works-line="" data-guide="works" className={`min-w-0 flex-1 ${tabs === undefined ? '' : 'max-w-[34rem]'}`}>
          <ResourceHud items={items} />
        </div>
        {tabs !== undefined && <div className="ml-auto flex h-full shrink-0">{tabs}</div>}
        <Medallion initials={commander.initials} label={t('statusBar.menuHint', { name: commander.name })} onPress={onCommander} />
      </header>
      {/* Once, the first time something waits: in the flow, so it covers nothing under it. */}
      {teach && (
        <div role="note" className="gk px-[var(--gk-gutter)] pb-1">
          <Banner variant="strip" tone="info" glyph="up" title={t('statusBar.works.firstTip')} body={t('statusBar.works.gathers')} />
        </div>
      )}
    </>
  );
}
