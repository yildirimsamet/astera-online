import { STARTER } from '@astera/rules';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCK_TABS } from '../src/lib/dock.js';

/**
 * THE GUIDE POINTS AT HOOKS OTHER SCREENS DRAW. A renamed or dropped hook breaks no type and no
 * component test: the guide only waits for a mark that never comes (prod `mark_missing`, plan Faz 1).
 * Each hook the guide names is listed with the file that draws it, as that file writes it.
 */
const SRC = join(import.meta.dirname, '../src');
const read = (file: string): string => readFileSync(join(SRC, file), 'utf8');

const DRAWN: readonly (readonly [hook: string, file: string, drawn: string])[] = [
  ['data-guide="unlock-try"', 'starter/UnlockMoment.tsx', 'data-guide="unlock-try"'],
  ['data-guide="unlock-dismiss"', 'starter/UnlockMoment.tsx', 'data-guide="unlock-dismiss"'],
  ['data-guide="works"', 'v2/hud/TopBar.tsx', 'data-guide="works"'],
  // The collect is pressed on the alloy pill inside the works line (isolated player tests 2026-11-18).
  ['data-pill="alloy"', 'game-ui/readouts.tsx', 'data-pill={item.id}'],
  ['data-guide="crate"', 'starter/CrateBay.tsx', 'data-guide="crate"'],
  ['data-guide="objective"', 'starter/ObjectiveLine.tsx', "'data-guide': 'objective'"],
  ['data-guide="repair-order"', 'starter/RepairCard.tsx', 'data-guide="repair-order"'],
  ['data-guide="repair-show"', 'starter/RepairCard.tsx', 'data-guide="repair-show"'],
  ['data-step="', 'starter/RepairCard.tsx', 'data-step={`${step.module}:${String(step.stage)}`}'],
  ['data-guide="system-', 'starter/SystemTabs.tsx', 'data-guide={`system-${system}`}'],
  ['data-guide="sight-rock"', 'galaxy/StarterSightMarks.tsx', "'data-guide':'sight-rock'"],
  ['data-guide="sight-craft"', 'galaxy/StarterSightMarks.tsx', "'sight-craft'"],
  ['data-guide="sight-unknown"', 'galaxy/StarterSightMarks.tsx', "'sight-unknown'"],
  ['data-scene-mark', 'galaxy/StarterSightMarks.tsx', 'data-scene-mark=""'],
  ['data-guide="mine"', 'galaxy/FocusPanel.tsx', "'data-guide': 'mine'"],
  ['data-guide="probe"', 'galaxy/FocusPanel.tsx', "'data-guide': 'probe'"],
  ['data-focus-close', 'galaxy/FocusPanel.tsx', 'data-focus-close=""'],
  ['data-outpost-guide="', 'galaxy/OutpostGuide.tsx', 'data-outpost-guide={node.id}'],
  // The dock is the kit's bottom bar (G1-a): it names each tab's hook, the bar draws it.
  ['data-guide="dock-base"', 'v2/hud/Dock.tsx', 'guide: `dock-${tab}`'],
  ['data-guide="dock-intel"', 'v2/hud/Dock.tsx', 'guide: `dock-${tab}`'],
  ['data-guide="dock-*"', 'game-ui/controls.tsx', "'data-guide': item.guide"],
  ['data-known="probe"', 'screens/IntelScreen.tsx', 'data-known="probe"'],
  ['data-report-open', 'screens/IntelScreen.tsx', 'data-report-open=""'],
  ['data-dossier-loot', 'v2/hud/TargetDossier.tsx', '<section data-dossier-loot'],
  ['data-commit', 'screens/PlanetScreen.tsx', 'data-act data-commit'],
  ['data-testid="yard-hull"', 'starter/YardDeck.tsx', 'data-testid="yard-hull" data-hull={id}'],
  ['data-hull="DART"', 'starter/YardDeck.tsx', 'data-testid="yard-hull" data-hull={id}'],
  ['#ship-deck-yard', 'starter/VesselScreen.tsx', 'tabId={deck => `ship-deck-${deck}`}'],
  ['data-testid="ship-repair"', 'starter/VesselScreen.tsx', 'data-testid="ship-repair"'],
  ['data-sheet-close', 'v2/kit/Sheet.tsx', 'data-sheet-close=""'],
  ['data-universe-chip', 'starter/UniverseChip.tsx', 'data-universe-chip=""'],
  ['data-loading-screen', 'shell/LoadingScreen.tsx', '<main data-loading-screen'],
  ['data-school-coach', 'onboarding/flightSchool/SchoolCoach.tsx', 'data-school-coach'],
];

/** Every hook the guide's files name: `data-x`, `data-x="value"`, or the fixed part before a `${…}`. */
function named(source: string): string[] {
  const hooks = [...source.matchAll(/\[(data-[a-z-]+)(?:="([^"$]*)(")?)?/gu)]
    .map(([, name, value, closed]) => (value === undefined ? name! : `${name!}="${value}${closed ?? ''}`));
  return [...hooks, ...[...source.matchAll(/#ship-deck-[a-z]+/gu)].map(([id]) => id)];
}

describe('the hooks the starter guide points at', () => {
  it.each(DRAWN)('%s is drawn by %s', (_hook, file, drawn) => {
    expect(read(file)).toContain(drawn);
  });

  it('lists every hook the guide names', () => {
    const listed = new Set(DRAWN.map(([hook]) => hook));
    const guide = ['starter/tutorial/script.ts', 'starter/tutorial/StarterTutorialCoach.tsx', 'starter/tutorial/visualGoal.tsx'].map(read).join('\n');
    expect([...new Set(named(guide))].filter(hook => !listed.has(hook))).toEqual([]);
  });

  it('has the dock tabs, ship deck and hull its templated hooks need', () => {
    expect(DOCK_TABS).toEqual(expect.arrayContaining(['base', 'intel']));
    expect(read('starter/VesselScreen.tsx')).toContain("id: 'yard'");
    expect(STARTER.hulls).toContain('DART');
  });
});
