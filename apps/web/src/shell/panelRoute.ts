import type { Panel, PanelStop } from '../screens/GalaxyView.jsx';

export interface PanelStopRequest {
  stop: PanelStop;
  request: number;
  reportMissionId?: string;
}

/**
 * Preserve a deep-link only for the navigation that carries it.
 *
 * A battle notification may name both the Intel shelf and one exact report. A
 * later ordinary press on Intel is a fresh visit, so it must clear that identity
 * instead of reopening yesterday's sheet.
 */
export function nextPanelStop(
  current: PanelStopRequest | null,
  stop?: PanelStop,
  reportMissionId?: string,
): PanelStopRequest | null {
  if (!stop) return null;
  return {
    stop,
    request: (current?.request ?? 0) + 1,
    ...(reportMissionId ? { reportMissionId } : {}),
  };
}

/**
 * WHERE A NOTIFICATION WANTS THE PLANET SHEET TO LAND. Koloni arızaları.
 *
 * Owner instruction, and the whole of it: *"Bildirime tikladigimda, ekran -> ilgili
 * koloniye geçmeli -> menü açmalı -> filo tabını acıp tershaneye gelmeli."* Three moves
 * in one press — select the world, open the sheet, scroll to the row — and none of them
 * is the same as the others.
 *
 * ITS OWN TYPE BESIDE `PanelStopRequest` RATHER THAN A FIELD ON IT, for the reason D183
 * records about that one: a deep link belongs to the navigation that carried it and to
 * no other. A later ordinary press on a world must not re-open yesterday's fault.
 */
export interface PanelFocusRequest {
  planetId?: string;
  group?: string;
  itemId?: string;
  request: number;
}

/**
 * Keep a focus only for the navigation that carries one. Same rule as `nextPanelStop`,
 * stated separately because the two are cleared by different presses: a stop belongs to
 * a shelf and a focus belongs to a row.
 */
export function nextPanelFocus(
  current: PanelFocusRequest | null,
  focus?: { planetId?: string; group?: string; itemId?: string },
): PanelFocusRequest | null {
  if (!focus || (!focus.planetId && !focus.group && !focus.itemId)) return null;
  return { ...focus, request: (current?.request ?? 0) + 1 };
}

/**
 * DOES A REQUESTED PLANET TAB STILL BELONG TO THIS PANEL? D183.
 *
 * The planet sheet opens on Production and lets a CALLER name a tab instead — a
 * research requirement pointing at the Command Core, the Intel screen pointing at
 * the orbit (D170). The request used to be cleared only when the panel CLOSED, and
 * a reader rarely closes anything: going from Intel's "install a Telescope" to the
 * Signals shelf and then tapping one of their own worlds never passes through
 * `null`, so the orbit request was still standing and the sheet opened on a tab
 * nobody had asked for that time. The owner's report was that the same tap landed
 * somewhere different each time.
 *
 * A REQUEST BELONGS TO THE PANEL IT WAS MADE FOR AND TO NO OTHER. Written here
 * rather than inline so it is a rule with a test rather than a condition inside an
 * effect — a default that is only sometimes the default is the guessing D170
 * removed, arriving through a different door.
 */
export const keepsPlanetGroup = (panel: Panel): boolean => panel === 'planet';

/** One menu row per rival mark: where to focus, what to call it, and whether it is gone. */
export interface RivalMenuRow {
  planetId: string;
  slot: number;
  owner: string;
  name: string;
  lost: boolean;
}

/**
 * RESOLVE EACH RIVAL MARK AGAINST THE DISC, THE WAY THE DISC ITSELF DOES. D183 · D97.
 *
 * A mark is about a COMMANDER; the world in it is only where the press landed.
 * `rivalSlotOf` draws the reticle on every world that commander controls, and
 * follows them when a marked colony changes hands — so the menu has to ask the same
 * question or the two surfaces name different things. Resolved by ANCHOR it split
 * apart in exactly the case D97 exists for: capture the anchor world and the row
 * announced its new owner, somebody the commander never marked, while the disc went
 * on marking the original commander's remaining worlds.
 *
 * THE ANCHOR STILL WINS WHERE IT IS STILL THEIRS, so a mark that has not moved
 * points where the player put it. Otherwise it falls to any world of theirs the
 * caller can see, which is what focusing a mark is FOR — take me to them.
 *
 * AND "LOST" IS ABOUT THE COMMANDER. A mark is lost when none of that commander's
 * worlds are on this disc, not when one particular world is missing from it: a
 * capital nobody has found yet is not a dead bookmark.
 *
 * Written here rather than inline in `GalaxyView` so it is a rule with a test —
 * the surfaces disagreeing about one mark is the entire failure it prevents.
 */
export function rivalMenuRows(
  rivals: readonly { planetId: string; playerId: string; slot: number }[],
  planets: readonly {
    id: string;
    name: string;
    owner: string;
    controller?: { kind: string; playerId?: string };
  }[],
): RivalMenuRow[] {
  return [...rivals]
    .sort((a, b) => a.slot - b.slot)
    .map((mark) => {
      const theirs = planets.filter(
        (world) => world.controller?.kind === 'PLAYER'
          && world.controller.playerId === mark.playerId,
      );
      const anchor = theirs.find((world) => world.id === mark.planetId) ?? theirs[0];
      return {
        planetId: anchor?.id ?? mark.planetId,
        slot: mark.slot,
        owner: anchor?.owner ?? '',
        name: anchor?.name ?? '',
        lost: anchor === undefined,
      };
    });
}

/**
 * WHICH SURFACES THE MENU OWNS, AND THEREFORE WHICH ONES STEP BACK TO IT.
 *
 * Owner report: *"yanlış bir buton'a tıklayınca geri dönme yok direk kapatılıyor"*.
 * A menu destination REPLACES the menu, so closing it landed the reader on the
 * galaxy — one mis-tap cost the header control and finding your place in the list
 * again, which is where a player stops exploring a menu at all.
 *
 * These six are opened from the menu and from nowhere else, which is what makes a
 * back arrow on them honest: it always points at the surface the reader actually
 * came from. Everything else is deliberately absent —
 *
 *   · the planet sheet, Intel, research, the clan, chat and the chronicle are
 *     opened from the disc, so their way back is the disc;
 *   · the recap and the Silent Space notice OPEN THEMSELVES when a season ends or
 *     a placement lands, so an arrow into the menu would name a room the reader
 *     was never in.
 *
 * Written here rather than inline in `GalaxyView` so it is a rule with a test: the
 * failure it prevents is exactly a seventh sheet quietly growing an arrow that
 * leads somewhere its reader has not been.
 */
const MENU_PANELS = new Set<Panel>([
  'skin-shop',
  'skin-inventory',
  'leaderboard',
  'rewards',
  'announcements',
  'feedback',
  'donate',
  'admin',
]);

export const returnsToMenu = (panel: Panel): boolean => MENU_PANELS.has(panel);
