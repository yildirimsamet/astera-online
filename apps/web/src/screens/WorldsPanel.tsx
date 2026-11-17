import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetCount } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact } from '../lib/format.js';
import { GameButton, Glyph, RoundButton, SectionTag, StoreGauge } from '../game-ui/index.js';
import { haptic } from '../lib/haptics.js';
import { OWN_SOUND, playSound } from '../lib/sound.js';
import { Cells, type Cell } from '../ui/ArmCard.js';
import { useOwnPress } from '../ui/kit/useOwnPress.js';
import { Sheet } from '../v2/kit/Sheet.js';

const RESOURCES = ['alloy', 'crystal', 'deuterium'] as const;

/** A store as the Base's gauge reads it: what it holds, of what, the Vault's safe part, the rate. */
const store = (world: PlanetView, resource: (typeof RESOURCES)[number]) => {
  const p = world.planet;
  return resource === 'alloy'
    ? { held: p.alloy, cap: p.alloyCap, safe: p.vaultProtected.alloy, rate: p.alloyPerHour }
    : resource === 'crystal'
      ? { held: p.crystal, cap: p.crystalCap, safe: p.vaultProtected.crystal, rate: p.crystalPerHour }
      : { held: p.deuterium, cap: p.deuteriumCap, safe: p.vaultProtected.deuterium, rate: p.deuteriumPerHour ?? 0 };
};

/**
 * YOUR WORLDS, AND THE ONE SENTENCE THAT MOVES SOMETHING BETWEEN THEM. T3 · D163.
 *
 * The disc is the right way to look at a galaxy and the wrong way to answer "which
 * of mine has the alloy". Both things a commander does across their own holdings —
 * switching to one, and sending something to another — needed a second world found
 * by eye on a rotating 3D scene first, and the second of them needed the player to
 * stand on the source before they could name the destination.
 *
 * THE TRANSFER IS `FROM → TO`, IN ONE LINE. Owner instruction: *"tablı sistem ile
 * değil dropdown ile nereden -> nereye."* It used to ask one question in two
 * unrelated places — a segmented control at the top chose the SOURCE, then one of
 * three identical "send here" buttons further down chose the DESTINATION, with
 * three world rows between the two halves of the same sentence. Nothing on screen
 * said they were one decision, and the sheet's own name for itself ("Kolay
 * Aktarım", the easy transfer) was the thing being contradicted.
 *
 * Two dropdowns and one button: both ends visible at once, the arrow between them
 * doing the explaining, and exactly one control that commits. On the kit (G2-j) each
 * end is a plate that drops a list of the worlds — never the browser's `<select>` — and
 * the arrow between them turns the route around. The press only OPENS the transfer;
 * what it carries is decided, and committed, on the transfer sheet. A destination that
 * cannot be committed is not offered — the target list is every world except the
 * source, because the server refuses `SELF_TRANSFER` and an option that always
 * fails is a rule the interface is teaching wrongly.
 *
 * THE LIST BELOW IS A DIFFERENT VERB and keeps its own tap: pressing a row GOES
 * there — camera and active world together, because they have to move together or
 * the player manages one world while looking at another. Nothing in this sheet
 * moves the camera on its own any more; the planet mark on the disc does that
 * (D163).
 *
 * THE OLD ROUTE IS UNTOUCHED (D118): focus a world, focus it again to manage it,
 * and the focus rail keeps the active world as the source while looking at a target.
 */
export function WorldsPanel({
  worlds,
  activePlanetId,
  capitalPlanetId,
  onSelect,
  onTransfer,
  onClose,
}: {
  worlds: readonly PlanetView[];
  activePlanetId: string | null;
  capitalPlanetId: string | null;
  /** Go to this world: focus it and make it active, in one gesture. */
  onSelect: (planetId: string) => void;
  /** Open a transfer without disturbing the active world. */
  onTransfer: (originPlanetId: string, targetPlanetId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  /**
   * The active world is the source a player means nine times out of ten, and it is
   * the one the old route would have forced on them anyway. It is a starting point
   * rather than a binding: `activePlanetId` is read once, so choosing another
   * source here does not fight a later change of active world.
   */
  const [sourceId, setSourceId] = useState<string | null>(activePlanetId);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [dropped, setDropped] = useState<'from' | 'to' | null>(null);
  const listId = useId();
  const canTransfer = worlds.length > 1;
  const source = worlds.some((world) => world.planet.id === sourceId)
    ? sourceId
    : worlds[0]?.planet.id ?? null;
  /**
   * EVERYWHERE BUT HERE, and the fallback is what keeps the pair legal.
   *
   * `targetId` is deliberately allowed to go stale — the player may pick a target
   * and then change the source to it — so the committed value is derived rather
   * than stored: a target that is no longer offered falls back to the first world
   * that is. Storing a corrected value instead would need an effect, and an effect
   * that rewrites a control the player is looking at is how a dropdown ends up
   * jumping under a thumb.
   */
  const targets = worlds.filter((world) => world.planet.id !== source);
  const target = targets.some((world) => world.planet.id === targetId)
    ? targetId
    : targets[0]?.planet.id ?? null;
  const named = (id: string): PlanetView | undefined => worlds.find((world) => world.planet.id === id);
  const kind = (id: string): string => t(id === capitalPlanetId ? 'worlds.kindCapital' : 'worlds.kindColony');

  return (
    <Sheet kit={{ tone: 'self' }} eyebrow={t('worlds.eyebrow')} title={t('worlds.title')} onClose={onClose}>
      <div className="gk gk-worlds">
        {canTransfer && source !== null && target !== null && (
          <section aria-label={t('worlds.sendTitle')} className="gk-route gk-well">
            <SectionTag>{t('worlds.sendTitle')}</SectionTag>
            {/*
              ONE LINE, TWO ENDS, THE TURN BETWEEN THEM. At 350px two plates and a round
              button fit across the sheet, and the arrow is the whole explanation.
            */}
            <div className="gk-route__line">
              <RouteEnd
                label={t('worlds.sendFrom')}
                name={named(source)?.planet.name ?? ''}
                capital={source === capitalPlanetId}
                open={dropped === 'from'}
                controls={listId}
                onToggle={() => { setDropped(dropped === 'from' ? null : 'from'); }}
              />
              <RoundButton
                small
                face="⇄"
                label={t('worlds.swap')}
                onPress={() => {
                  setSourceId(target);
                  setTargetId(source);
                  setDropped(null);
                }}
              />
              <RouteEnd
                label={t('worlds.sendTo')}
                name={named(target)?.planet.name ?? ''}
                capital={target === capitalPlanetId}
                open={dropped === 'to'}
                controls={listId}
                onToggle={() => { setDropped(dropped === 'to' ? null : 'to'); }}
              />
            </div>
            {dropped !== null && (
              <div id={listId} role="listbox" aria-label={dropped === 'from' ? t('worlds.sendFrom') : t('worlds.sendTo')} className="gk-route__list gk-cut">
                {(dropped === 'from' ? worlds : targets).map((world) => {
                  const id = world.planet.id;
                  return (
                    <RoutePick
                      key={id}
                      id={id}
                      name={world.planet.name}
                      kind={kind(id)}
                      capital={id === capitalPlanetId}
                      chosen={id === (dropped === 'from' ? source : target)}
                      onPick={() => {
                        if (dropped === 'from') setSourceId(id);
                        else setTargetId(id);
                        setDropped(null);
                      }}
                    />
                  );
                })}
              </div>
            )}
            <GameButton tone="action" wide glyph="next" onPress={() => { onTransfer(source, target); }}>
              {t('worlds.send')}
            </GameButton>
          </section>
        )}

        <ul aria-label={t('worlds.list')} className="gk-worlds__list">
          {worlds.map((world) => (
            <WorldCard
              key={world.planet.id}
              world={world}
              kind={kind(world.planet.id)}
              capital={world.planet.id === capitalPlanetId}
              active={world.planet.id === activePlanetId}
              onGo={() => {
                onSelect(world.planet.id);
                onClose();
              }}
            />
          ))}
        </ul>
      </div>
    </Sheet>
  );
}

/** One end of the route: which end, the world on it, and the mark that it drops a list. */
function RouteEnd({ label, name, capital, open, controls, onToggle }: {
  label: string;
  name: string;
  capital: boolean;
  open: boolean;
  controls: string;
  onToggle: () => void;
}) {
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onToggle(); });
  return (
    <button
      type="button"
      {...OWN_SOUND}
      aria-label={`${label}: ${name}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      {...(open ? { 'aria-controls': controls } : {})}
      className="gk-route__end"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-route__label"><span className="gk-label">{label}</span><Glyph id="down" /></span>
      <span className="gk-route__world">
        <span className="gk-route__coin" data-capital={capital ? '' : undefined} aria-hidden="true"><Glyph id={capital ? 'home' : 'colony'} /></span>
        <span className="gk-route__name">{name}</span>
      </span>
    </button>
  );
}

/** A world in a route end's list: its name and kind, the chosen one ticked. */
function RoutePick({ id, name, kind, capital, chosen, onPick }: {
  id: string;
  name: string;
  kind: string;
  capital: boolean;
  chosen: boolean;
  onPick: () => void;
}) {
  const own = useOwnPress(() => { playSound('tab'); haptic('tap'); onPick(); });
  return (
    <button
      type="button"
      role="option"
      aria-selected={chosen}
      data-world={id}
      {...OWN_SOUND}
      className="gk-route__pick"
      onPointerDown={own.onPointerDown}
      onClick={own.onClick}
    >
      <span className="gk-route__coin" data-capital={capital ? '' : undefined} aria-hidden="true"><Glyph id={capital ? 'home' : 'colony'} /></span>
      <span className="gk-route__name">{name}</span>
      <span className="gk-sub">{kind}</span>
      {chosen && <Glyph id="check" />}
    </button>
  );
}

/**
 * A WORLD, AS A CARD THAT GOES THERE. Its name and kind, the three stores as the Base's own
 * gauges — the longest bar is the world with the alloy, a closed one a world losing production
 * — what stands there, and the flight bays as cells: lit are free to launch.
 */
function WorldCard({ world, kind, capital, active, onGo }: {
  world: PlanetView;
  kind: string;
  capital: boolean;
  active: boolean;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const own = useOwnPress(() => { playSound('tap'); haptic('tap'); onGo(); });
  const standing = fleetCount(world.fleet) + fleetCount(world.ground);
  const { used, total } = world.flight;
  const bays: Cell[] = Array.from({ length: total }, (_unused, index): Cell => (index < total - used ? 'ready' : 'flight'));
  return (
    <li>
      <button
        type="button"
        {...OWN_SOUND}
        className="gk-wcard"
        {...(active ? { 'data-active': '' } : {})}
        onPointerDown={own.onPointerDown}
        onClick={own.onClick}
      >
        <span className="gk-wcard__head">
          <span className="gk-wcard__name">{world.planet.name}</span>
          <span className="gk-chip" {...(capital ? { 'data-tone': 'gold' } : {})}>
            <Glyph id={capital ? 'home' : 'colony'} />
            {kind}
          </span>
          {active && <span className="gk-chip" data-on="">{t('worlds.active')}</span>}
          <span className="gk-wcard__go" aria-hidden="true"><Glyph id="next" /></span>
        </span>
        <span className="gk-stores">
          {RESOURCES.map((resource) => {
            const { held, cap, safe, rate } = store(world, resource);
            return (
              <StoreGauge
                key={resource}
                resource={resource}
                held={held}
                cap={cap}
                safe={safe}
                rate={rate}
                label={t('worlds.store', { resource: t(`worlds.${resource}`), amount: compact(held), cap: compact(cap) })}
              />
            );
          })}
        </span>
        <span className="gk-wcard__foot">
          <span className="gk-sub gk-num">{t('worlds.craft', { count: standing })}</span>
          <span className="gk-wcard__bays">
            <span className="gk-label">{t('worlds.bays')}</span>
            <Cells cells={bays} label={t('worlds.baysReading', { used, total })} />
          </span>
        </span>
      </button>
    </li>
  );
}
