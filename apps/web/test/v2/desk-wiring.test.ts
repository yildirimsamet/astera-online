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
