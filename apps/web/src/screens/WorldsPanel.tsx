import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetCount } from '@astera/rules';
import type { PlanetView } from '../api/schemas.js';
import { compact } from '../lib/format.js';
import { Tally } from '../ui/Tally.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Chip, Meter, Sheet } from '../ui/kit/index.js';

/**
 * THE THREE STORES, IN ONE ORDER, READ OFF THE VIEW RATHER THAN RETYPED.
 *
 * Declared once so a row's three meters cannot drift apart and a fourth resource
 * cannot be added to the header without this list refusing to compile.
 */
const RESOURCES = [
  {
    tone: 'alloy',
    held: (world: PlanetView) => world.planet.alloy,
    cap: (world: PlanetView) => world.planet.alloyCap,
  },
  {
    tone: 'crystal',
    held: (world: PlanetView) => world.planet.crystal,
    cap: (world: PlanetView) => world.planet.crystalCap,
  },
  {
    tone: 'deuterium',
    held: (world: PlanetView) => world.planet.deuterium,
    cap: (world: PlanetView) => world.planet.deuteriumCap,
  },
] as const satisfies readonly {
  tone: 'alloy' | 'crystal' | 'deuterium';
  held: (world: PlanetView) => number;
  cap: (world: PlanetView) => number;
}[];

/**
 * Written out rather than interpolated. Tailwind scans source text for class
 * names, so `text-${tone}` produces a class that is never generated and a figure
 * that renders with no colour at all.
 */
const INK: Record<'alloy' | 'crystal' | 'deuterium', string> = {
  alloy: 'text-alloy',
  crystal: 'text-crystal',
  deuterium: 'text-deuterium',
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
 * doing the explaining, and exactly one control that commits. A destination that
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
 * and the focus rail still offers the transfer with the previously active world as
 * its source.
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

  return (
    <Sheet eyebrow={t('worlds.eyebrow')} title={t('worlds.title')} onClose={onClose}>
      {canTransfer && source !== null && target !== null && (
        <section className="plate mb-3 px-3 py-3">
          <h2 className="legend mb-2">{t('worlds.sendTitle')}</h2>
          {/*
            ONE LINE, TWO ENDS, AN ARROW BETWEEN THEM. At 375px two selects and a
            glyph fit across the sheet with room to spare, and the arrow is the
            whole explanation — a labelled pair stacked in a column would spend
            four rows saying what one row draws.
          */}
          <div className="flex items-center gap-2">
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t('worlds.sendFrom')}</span>
              <select
                aria-label={t('worlds.sendFrom')}
                value={source}
                onChange={(event) => { setSourceId(event.currentTarget.value); }}
                className="field min-h-9 w-full py-1"
              >
                {worlds.map((world) => (
                  <option key={world.planet.id} value={world.planet.id}>
                    {world.planet.name}
                  </option>
                ))}
              </select>
            </label>
            <span aria-hidden className="shrink-0 text-dim">→</span>
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t('worlds.sendTo')}</span>
              <select
                aria-label={t('worlds.sendTo')}
                value={target}
                onChange={(event) => { setTargetId(event.currentTarget.value); }}
                className="field min-h-9 w-full py-1"
              >
                {targets.map((world) => (
                  <option key={world.planet.id} value={world.planet.id}>
                    {world.planet.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            className="slab slab-primary mt-2 w-full max-h-10 min-h-10"
            onClick={() => { onTransfer(source, target); }}
          >
            {t('worlds.send')}
          </button>
        </section>
      )}

      <ul aria-label={t('worlds.list')} className="mt-2 flex flex-col gap-2">
        {worlds.map((world) => {
          const id = world.planet.id;
          const standing = fleetCount(world.fleet) + fleetCount(world.ground);
          return (
            <li key={id} className="plate flex items-center gap-2 px-3 py-3">
              <button
                type="button"
                onClick={() => {
                  onSelect(id);
                  onClose();
                }}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex flex-wrap items-center gap-2">
                  {/* `.name` already sets the size and the ink — see the token block in styles.css. */}
                  <span className="name">{world.planet.name}</span>
                  <Chip tone={id === capitalPlanetId ? 'alloy' : 'neutral'}>
                    {t(id === capitalPlanetId ? 'worlds.kindCapital' : 'worlds.kindColony')}
                  </Chip>
                  {id === activePlanetId && (
                    <Chip tone="crystal">{t('worlds.active')}</Chip>
                  )}
                </span>
                {/*
                  "WHICH OF MINE HAS THE ALLOY" — ANSWERED BY EYE. Owner
                  instruction, and this panel's own stated reason for existing.

                  It answered it with three bare figures per row, so a commander
                  with three worlds had nine numbers to compare across rows to
                  find one thing. A store is a quantity against a CEILING, which
                  is the meter the header has drawn since the first session, and
                  three meters stacked in a column compare down the list without
                  a digit being read: the longest bar is the world with the alloy,
                  and a bar that has closed is a world losing production.

                  The figures stay beside their own meter, small, for the moment a
                  player wants to check rather than scan.
                */}
                <span className="mt-2 flex flex-col gap-1.5">
                  {RESOURCES.map(({ tone, held, cap }) => (
                    <span key={tone} className="flex items-center gap-2">
                      <img
                        src={RESOURCE_ART[tone]}
                        alt=""
                        aria-hidden
                        className="size-3.5 shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1">
                        <Meter
                          value={held(world)}
                          cap={cap(world)}
                          tone={tone}
                          cells={10}
                          label={t('worlds.store', {
                            resource: t(`worlds.${tone}`),
                            amount: compact(held(world)),
                            cap: compact(cap(world)),
                          })}
                        />
                      </span>
                      <span className={`num w-12 shrink-0 text-right text-micro ${INK[tone]}`}>
                        {compact(held(world))}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption">
                  <span className="text-dim">{t('worlds.craft', { count: standing })}</span>
                  {/*
                    THE BAYS ARE A RACK, and the same rack the header draws. "1 / 3"
                    was the one figure on this row a player reads to decide whether
                    they can launch at all, and three marks answer it without being
                    parsed.
                  */}
                  <span className="ml-auto flex items-center gap-2">
                    <span className="legend">{t('worlds.bays')}</span>
                    <Tally
                      used={world.flight.used}
                      total={world.flight.total}
                      size="sm"
                      label={t('worlds.baysReading', {
                        used: world.flight.used,
                        total: world.flight.total,
                      })}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
