import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ToastProvider } from '../src/ui/Toast.js';
import { PlanetFocus } from '../src/galaxy/FocusPanel.js';
import type { GalaxyPlanet, IntelView, PlanetView } from '../src/api/schemas.js';
import i18n from '../src/i18n/index.js';
import { planetView } from './fixtures.js';

/**
 * THREE OWNER CORRECTIONS TO THE WORLD FOCUS SHEET, ALL OF THEM ABOUT THE SAME
 * THING: the sheet was spending the screen on the wrong sentences.
 *
 * 1 · A GAP IS THE READER'S OWN IGNORANCE, NEVER THE GALAXY'S. "Nothing has ever
 *     looked closely" and "Nobody has ever looked here" are claims about what
 *     EVERY commander in the galaxy has done, and no commander can know that —
 *     it is the exact inversion of the fog rule the dossier exists to serve. The
 *     player is being told they have no reading; the sentence must say so.
 *
 * 2 · THE STRIKE ESSAY DOES NOT BELONG ON A WORLD YOU ARE LOOKING AT. Six lines
 *     of what a Death Star does, drawn under a target, for a weapon almost no
 *     commander holds. `focus-density.test.ts` already refuses to draw the
 *     CONTROL to somebody who owns none; the explanation of the control outlived
 *     it. It belongs beside the thing that fires it, which is where the forge
 *     card already states the same five facts (D55).
 *
 * 3 · THE SHEET IS TOO SHORT. 52dvh on an 812pt phone is about 420pt of body
 *     with a rail and a commit row inside it, so nearly every world put the
 *     player into a scroll before they had read anything. `interface.md`'s
 *     fourth question is interaction cost, and a scroll is the cost being
 *     measured.
 */

const NOW = new Date('2026-04-01T12:00:00.000Z').getTime();

const harness = () => {
  const api = new Api({ fetch: vi.fn() as unknown as typeof globalThis.fetch });
  const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queries}>
      <ApiProvider api={api}>
        <ToastProvider>{children}</ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
};

const target = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p2',
  name: 'Grimhold',
  owner: 'Sable',
  position: { x: 200, y: 0, z: 0 },
  coreTier: 2,
  coreLevel: 6,
  intel: 'RESOLVED' as const,
  state: { kind: 'NORMAL' as const },
  satellites: [],
  shielded: false,
  isSelf: false,
  ...over,
});

const commander = (over: Partial<Omit<PlanetView, 'planet'>> = {}): PlanetView =>
  planetView(
    {
      buildings: { CORE: 4, REFINERY: 2, EXTRACTOR: 2, VAULT: 1, SHIPYARD: 1 },
      instruments: { TELESCOPE: 1, RADAR: 0, AEGIS: 0, VEIL: 0 },
      orbit: ['UPLINK'],
      fleet: { DART: 6, COURIER: 2 },
      ...over,
    },
    { alloy: 4000, crystal: 2000, alloyCap: 9000, crystalCap: 4000 },
  );

const intel: IntelView = {
  watching: [],
  probeReports: [],
  probeCooldowns: [],
  radarLog: [],
  probeCost: { alloy: 25, crystal: 25, deuterium: 0 },
};

const show = (world: GalaxyPlanet = target(), planet: PlanetView = commander()) => {
  const Wrapper = harness();
  return render(
    <Wrapper>
      <PlanetFocus
        target={world}
        planet={planet}
        intel={intel}
        reports={[]}
        now={NOW}
        onClose={vi.fn()}
        onAttack={vi.fn()}
        onDeathStar={vi.fn()}
        onInstallTelescope={vi.fn()}
        onLaunched={vi.fn()}
        open
        onToggle={vi.fn()}
      />
    </Wrapper>,
  );
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('a gap states the READER’S ignorance, never the galaxy’s', () => {
  /**
   * Both trees, because the fault is in the sentence rather than in one language,
   * and a second-person gap in Turkish beside a third-person one in English would
   * mean the two audiences are being told different things about the same fog.
   */
  const gapKeys = [
    'dossier.surfaceGapMissing',
    'dossier.probeGapMissing',
    /**
     * The panel's own TITLE for a world outside every reach, which said the same
     * thing about the same fog one line above the gaps that say it. It is not in
     * the dossier tree, which is exactly why it survived every earlier pass.
     */
    'focus.planet.unsurveyedTitle',
  ] as const;

  it.each(['tr', 'en'])('never claims to know what other commanders have done (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const key of gapKeys) {
      const text = i18n.t(key);
      // A commander cannot see another's telescope. Any sentence with an
      // all-quantifier over people is a fact the game has no way to hold.
      expect(text, `${lang}/${key}`).not.toMatch(/\b(kimse|nobody|no one|nothing|anyone|anybody)\b/i);
    }
  });

  it.each(['tr', 'en'])('addresses the commander directly (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const key of gapKeys) {
      const text = i18n.t(key);
      expect(text, `${lang}/${key}`).toMatch(lang === 'tr' ? /n$|din$|dın$|sin$|sın$/i : /\byou\b/i);
    }
  });

  /**
   * AND THE THREE SAY THREE DIFFERENT THINGS. They can appear on one screen at
   * once — the title above two gaps — so making them all second person is only
   * half the job: three identical sentences stacked is the "if a fact is drawn,
   * do not also write it" rule broken three ways. Each names the reading it is
   * missing: the world unlooked-at, the world unseen, the world unprobed.
   */
  it.each(['tr', 'en'])('never says the same sentence twice on one screen (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    const said = gapKeys.map((key) => i18n.t(key));
    expect(new Set(said).size).toBe(said.length);
    await i18n.changeLanguage('en');
  });

  it('renders the second-person sentence on an unprobed world', async () => {
    await i18n.changeLanguage('tr');
    show(target({ intel: 'RESOLVED' }));
    expect(screen.getByText(i18n.t('dossier.probeGapMissing'))).toBeVisible();
    await i18n.changeLanguage('en');
  });
});

describe('the strike essay is not part of looking at a world', () => {
  const source = readFileSync('src/galaxy/FocusPanel.tsx', 'utf8');

  it('draws no list of what a Death Star does', () => {
    /*
      COMMENTS COME OUT FIRST. The docblock left where the component was names
      it and explains why it went, which is what the next author needs; what may
      not exist is a component or a call, which is the panel drawing it again.
    */
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    expect(code).not.toContain('StrikeEffects');
  });

  /** The strings go with it — a key nothing renders is the next author's trap. */
  it.each(['tr', 'en'])('leaves no orphaned strike copy behind (%s)', async (lang) => {
    await i18n.changeLanguage(lang);
    for (const key of ['strikeTitle', 'strikeFleet', 'strikeStock', 'strikeCore', 'strikeAegis', 'strikeDark', 'strikeNoCapture']) {
      const full = `focus.planet.${key}`;
      expect(i18n.exists(full), `${lang}: ${full} still exists`).toBe(false);
    }
    await i18n.changeLanguage('en');
  });

  /**
   * WHAT MUST SURVIVE. The strike itself is still a route the panel names and
   * still a control it offers; only the essay under it goes.
   */
  it('still names the strike route on a colony', async () => {
    await i18n.changeLanguage('en');
    const view = show(target({ kind: 'COLONY' }), {
      ...commander(),
      strategic: { id: 's1', status: 'READY', readyAt: new Date(NOW), remainingSeconds: null },
    });
    expect(view.container.querySelector('[data-death-star]')).not.toBeNull();
  });
});

describe('the sheet is given the height it was already using', () => {
  const source = readFileSync('src/galaxy/FocusPanel.tsx', 'utf8');

  it('opens taller than half the screen', () => {
    const found = /max-h-\[(\d+)dvh\]/.exec(source);
    expect(found, 'the focus body no longer states a height').not.toBeNull();
    // 65 is the owner's deliberate height (2026-09-13): still well over half the screen.
    expect(Number(found?.[1])).toBeGreaterThanOrEqual(65);
  });

  /**
   * AND STILL LEAVES THE WORLD VISIBLE. The galaxy never closes (I5): the whole
   * argument for a rail over a page is that the disc stays above what you are
   * deciding. A full-height rail is a page with extra steps.
   */
  it('never takes the whole screen', () => {
    const found = /max-h-\[(\d+)dvh\]/.exec(source);
    expect(Number(found?.[1])).toBeLessThanOrEqual(78);
  });
});
