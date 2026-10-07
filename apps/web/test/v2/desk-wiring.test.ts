import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * E11 · K10: THE DESK'S WIRING THROUGH THE GALAXY. `GalaxyView` is too large to render
 * in a unit test, so — as `context-slot-host.test.ts` does for the home request — the
 * wiring is read from the source; the rules behind it are tested on their own
 * (`shortcuts.test.ts`, `game-shell.test.tsx`).
 */

const galaxy = readFileSync('src/screens/GalaxyView.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const canvas = readFileSync('src/galaxy/GalaxyCanvas.tsx', 'utf8');

/**
 * Owner report, 2026-10-06: picking a world from the desk outline focused it on the galaxy but
 * left the old world selected. The request carries `select` from the shell through the app to
 * the galaxy, which selects with the same intent the Worlds sheet uses.
 */
describe('selecting a world from the outline', () => {
  it('carries the select intent from the app to the galaxy', () => {
    expect(app).toMatch(/options\?\.select \? \{ select: true \} : \{\}/);
    expect(galaxy).toMatch(/focusPlanet\(focusRequest\.planetId, focusRequest\.select === true \? 'select' : 'focus'\)/);
  });
});

/** Owner, 2026-09-24: Home ("Fly to your world") above the View chip in the right-hand stack. */
describe('the galaxy’s right-hand stack', () => {
  it('puts Home above the View chip', () => {
    const stack = galaxy.slice(galaxy.indexOf('<GalaxyReadout'));
    expect(stack.indexOf('<HomeChip')).toBeGreaterThan(0);
    expect(stack.indexOf('<HomeChip')).toBeLessThan(stack.indexOf('<ViewChip'));
  });
});

/** E9: "Clan chat" in the war room opens the clan channel; the room knows its crew. */
describe('the war room wiring', () => {
  const clanScreen = readFileSync('src/screens/ClanScreen.tsx', 'utf8');

  it('opens clan chat from the war room through the galaxy and the app', () => {
    const screen = galaxy.slice(galaxy.indexOf('<ClanScreen'));
    expect(screen.slice(0, 300)).toMatch(/onOpenClanChat: \(\) => \{ onOpenChat\('clan'\); \}/);
    expect(app).toMatch(/onOpenChat=\{onOpenChat\}/);
  });

  it('seats the clan’s members in the war room, with the commander known', () => {
    const panel = clanScreen.slice(clanScreen.indexOf('<ClanWarPanel'));
    expect(panel.slice(0, 400)).toMatch(/members=\{/);
    expect(panel.slice(0, 400)).toMatch(/selfPlayerId=\{/);
    expect(panel.slice(0, 500)).toMatch(/\{ onOpenClanChat \}/);
  });
});

/**
 * M4: a report's doors reach it from both ways in — the notification's sheet and Intel's
 * list: raid again (the dossier), tell the clan (clan chat with the line as a draft, only
 * in a clan), and the other side's mark.
 */
describe('the report doors', () => {
  const intel = readFileSync('src/screens/IntelScreen.tsx', 'utf8');

  it('opens the selected world dossier when a report planet is followed', () => {
    const doors = galaxy.slice(galaxy.indexOf('const reportDoors: ReportDoors'), galaxy.indexOf('const activeWorldPosition'));
    expect(doors).toMatch(/onFocusPlanet: \(planetId: string\) => \{\s*onPanel\(null\);\s*focusPlanet\(planetId\);\s*setDetail\(true\);/);
  });

  it('hands the report sheet from a notification the clan door and the rival mark', () => {
    const door = galaxy.slice(galaxy.indexOf('<BattleReportDoor'), galaxy.indexOf('<BattleReportDoor') + 1400);
    expect(door).toMatch(/\{\.\.\.reportDoors\}/);
    expect(galaxy).toMatch(/onShare: \(line: string\) => \{ onOpenChat\('clan', line\); \}/);
    expect(galaxy).toMatch(/membership/);
  });

  it('hands Intel’s list the same doors', () => {
    const screen = galaxy.slice(galaxy.indexOf('<IntelScreen'), galaxy.indexOf('<IntelScreen') + 1200);
    expect(screen).toMatch(/\{\.\.\.reportDoors\}/);
    const list = intel.slice(intel.indexOf('<BattleReports'), intel.indexOf('<BattleReports') + 600);
    expect(list).toMatch(/onAttackAgain: onOpenDossier/);
    expect(list).toMatch(/\{\.\.\.doors\}/);
  });
});

/** M4: a Telescope sighting's "Open the dossier" frames the world with its dossier open. */
describe('a focus that asks for the dossier', () => {
  it('carries the ask from the app to the galaxy, which opens the dossier', () => {
    expect(app).toMatch(/options\?\.dossier \? \{ dossier: true \} : \{\}/);
    expect(galaxy).toMatch(/focusPlanet\(focusRequest\.planetId, [^)]*\);\s*if \(focusRequest\.dossier\) setDetail\(true\);/);
  });
});

describe('Space and Esc on the galaxy', () => {
  it('brings the selection back into frame on Space, or flies home with nothing selected', () => {
    const center = galaxy.slice(galaxy.indexOf('useRequest(centerRequest'), galaxy.indexOf('useRequest(clearRequest'));
    expect(center).toMatch(/if \(focus === null\) flyHome\(\);\s*else setCenterSignal/);
    expect(galaxy).toMatch(/centerSignal=\{centerSignal\}/);
  });

  it('lets go of the selection on Esc, the way the card’s own close does', () => {
    expect(galaxy).toMatch(/useRequest\(clearRequest, \(\) => \{ if \(focus !== null\) close\(\); \}\)/);
  });

  it('is handed both requests by the app', () => {
    expect(app).toMatch(/centerRequest=\{centerRequest\}/);
    expect(app).toMatch(/clearRequest=\{clearRequest\}/);
  });

  it('docks Intel and Clan as pages on a wide screen, though they fit their content on a phone', () => {
    for (const panel of ['intel', 'clan']) {
      const opened = galaxy.slice(galaxy.indexOf(`{panel === '${panel}' && (`));
      expect(opened.slice(0, opened.indexOf('onClose')), panel).toMatch(/detents=\{\['fit'\]\}\s*placement="page"/);
    }
  });

  it('re-takes the subject in the camera on the signal alone, so a refetch never re-frames', () => {
    const effect = canvas.slice(canvas.indexOf('BRING THE SELECTION BACK'));
    expect(effect).toMatch(/if \(centerSignal === 0\) return;/);
    expect(effect).toMatch(/\}, \[centerSignal\]\);/);
  });
});
