import { REPAIR_LADDER, type VesselProgress } from '@astera/rules';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vesselSchema } from '../src/api/starterSchemas.js';
import type { TutorialAnswer } from '../src/starter/tutorial/script.js';
import { StarterGoal, StarterLesson, type StarterGoalValue } from '../src/starter/tutorial/visualGoal.js';
import { ObjectiveLine } from '../src/starter/ObjectiveLine.js';
import { wireVessel } from './starterVesselFixture.js';

const observe = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/playerAnalytics/runtime.js', () => ({ observe }));
const sound = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/sound.js', () => ({ playSound: sound }));

afterEach(() => { cleanup(); localStorage.clear(); observe.mockClear(); sound.mockClear(); });

const first = REPAIR_LADDER.find(s => s.module === 'REFINERY' && s.stage === 2);

describe('the next-step line over the galaxy', () => {
  it('names the first repair, and a tap opens the ship', () => {
    const open = vi.fn();
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000 }))} fetchedAt={Date.now()} onOpenShip={open} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('repair');
    expect(line.textContent).toContain('Next');
    fireEvent.click(line);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('says what the repair opens, in a word', () => {
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000, modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, progress: { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, facts: ['FIRST_MINING_RETURN'], parts: 0, fuel: 0 } }))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').textContent).toMatch(/opens probes/i);
  });

  it('says "that is all for now" and the time to come back, when the next step is a long way off', () => {
    const vessel = vesselSchema.parse(wireVessel({ alloy: 0, crystal: 10_000, bufferAlloy: 0 }));
    render(<ObjectiveLine vessel={vessel} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-rest')).toBe('');
    expect(line.textContent).toMatch(/that is all for now/i);
  });

  // Nobody to probe: the line must not send the player after a ship that is not there.
  it('asks for the first probe only when there is another ship to probe', () => {
    const probeReady = { alloy: 0, crystal: 0, bufferAlloy: 0, modules: { REFINERY: 2, EXTRACTOR: 1, SURVEY: 1 }, features: ['production', 'intel'] };
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel(probeReady))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-kind')).toBe('probe');
    cleanup();
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel(probeReady))} fetchedAt={Date.now()} onOpenShip={vi.fn()} alone />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-kind')).not.toBe('probe');
  });

  it('is a mark the tutorial can point at', () => {
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ alloy: 10_000, crystal: 10_000 }))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    expect(screen.getByTestId('ship-objective').getAttribute('data-guide')).toBe('objective');
  });

  it('points at the top bar when only the works can pay, and opens nothing', () => {
    expect(first).toBeDefined();
    const vessel = vesselSchema.parse(wireVessel({ alloy: (first?.alloy ?? 0) - 5, crystal: 10_000, bufferAlloy: 60 }));
    render(<ObjectiveLine vessel={vessel} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('collect');
    expect(line.tagName).not.toBe('BUTTON');
    expect(line.textContent).toContain('top bar');
  });
});

it('uses the officer road for both its short label and its destination, even when mining is already available', () => {
  const open = vi.fn(), rock = vi.fn();
  const goal: StarterGoalValue = { step: { kind: 'step', id: 'orderRefinery', step: 'press', chapter: 2, strict: true, nav: 'openShip', marks: ['[data-guide="dock-base"]'] }, choice: { kind: 'mine' }, picked: false, guided: true, view: 'galaxy' };
  render(<StarterGoal.Provider value={goal}>
    <ObjectiveLine vessel={vesselSchema.parse(wireVessel({modules:{REFINERY:1,EXTRACTOR:1,SHIPYARD:1},features:['production','intel','fleet']}))} fetchedAt={Date.now()} onOpenShip={open} onFocusRock={rock}/>
  </StarterGoal.Provider>);
  const line=screen.getByTestId('ship-objective');
  expect(line.textContent).toContain('Refinery');expect(line.textContent).not.toContain('Send a Prospector');
  fireEvent.click(line);expect(open).toHaveBeenCalledOnce();expect(rock).not.toHaveBeenCalled();
});

/**
 * THE ADVISOR (plan F3, N1). After the core the NPC offers at most three real things to do, one of
 * them recommended, each with its price, its time and what it opens. The player picks; the line then
 * names the pick. It speaks up by itself when the guide hands over, and again after each pick is done.
 */
describe('the advisor behind the next-step line', () => {
  const rich = { alloy: 10_000, crystal: 10_000, bufferAlloy: 50, progress: { modules: { REFINERY: 2, EXTRACTOR: 1, TELESCOPE: 1, RADAR: 1 }, facts: ['FIRST_MINING_RETURN' as const], parts: 0, fuel: 0 } };
  // After the road: the ship the yard opened up, where several repairs stand side by side.
  const yard = { progress: { ...rich.progress, modules: { ...rich.progress.modules, SURVEY: 1, SHIPYARD: 1 } } };
  const survey = REPAIR_LADDER.find(s => s.module === 'SURVEY' && s.stage === 1)!;
  const refinery = REPAIR_LADDER.find(s => s.module === 'REFINERY' && s.stage === 3)!;
  const advise: TutorialAnswer = { kind: 'advise' };
  const line = (over: Record<string, unknown> = {}, lesson: TutorialAnswer | null = null) => {
    const wrap = (child: ReactNode) => lesson ? <StarterLesson.Provider value={lesson}>{child}</StarterLesson.Provider> : child;
    return wrap(<ObjectiveLine vessel={vesselSchema.parse(wireVessel({ ...rich, ...over }))} fetchedAt={Date.now()} onOpenShip={vi.fn()} />);
  };
  const ordered = (step: typeof refinery) => [{ id: 'o1', queue: 'CONSTRUCTION', subject: step.module, stage: step.stage, count: 1, startedAt: new Date().toISOString(), readyAt: new Date(Date.now() + 60_000).toISOString(), cost: { alloy: step.alloy, crystal: step.crystal, deuterium: 0 } }];

  const offered = () => within(screen.getByTestId('starter-advice')).getAllByRole('button', { name: /.+/ }).filter(row => row.hasAttribute('data-advice'));

  it('offers no more than three of the many things open after the yard', () => {
    render(line(yard));
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    const rows = offered();
    expect(rows).toHaveLength(3);
    expect(rows.filter(row => /recommended/i.test(row.textContent))).toEqual([rows[0]]);
  });

  it('recommends the first choice, with its price, its time and what it opens', () => {
    render(line());
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    const rows = offered();
    expect(rows[0]?.getAttribute('data-advice')).toBe('repair:SURVEY:1');
    expect(rows[0]?.textContent).toMatch(/recommended/i);
    expect(rows[1]?.textContent).not.toMatch(/recommended/i);
    expect(rows[0]?.textContent).toContain(String(survey.alloy));
    expect(rows[0]?.textContent).toContain(String(survey.crystal));
    expect(rows[0]?.textContent).toContain('30s');
    expect(rows[0]?.textContent).toMatch(/opens probes/i);
    expect(sound).toHaveBeenCalled();
  });

  it('makes a pick the line, remembers it for the ship, and folds away with a sound', () => {
    render(line(yard));
    expect(screen.getByTestId('ship-objective').textContent).toContain('Extractor');
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    sound.mockClear();
    fireEvent.click(screen.getByTestId('starter-advice').querySelector('[data-advice="repair:REFINERY:3"]')!);
    expect(screen.queryByTestId('starter-advice')).toBeNull();
    expect(screen.getByTestId('ship-objective').textContent).toContain('Refinery');
    expect(localStorage.getItem('astera.starter.advice.ship-1')).toContain('repair:REFINERY:3');
    expect(sound).toHaveBeenCalledWith('confirm');
    expect(observe).toHaveBeenCalledWith('interaction', { surface: 'starter_advisor', subject: 'repair:REFINERY:3', code: 'picked' });
  });

  it('opens by itself once when the guide hands over, and not again until a pick is done', () => {
    const view = render(line(yard, advise));
    expect(screen.getByTestId('starter-advice')).toBeTruthy();
    expect(observe).toHaveBeenCalledWith('surface_visible', { surface: 'starter_advisor' });
    fireEvent.click(within(screen.getByTestId('starter-advice')).getByRole('button', { name: /close/i }));
    view.rerender(line({ ...yard, bufferAlloy: 51 }, advise));
    expect(screen.queryByTestId('starter-advice')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    fireEvent.click(screen.getByTestId('starter-advice').querySelector('[data-advice="repair:REFINERY:3"]')!);
    view.rerender(line({ ...yard, queue: ordered(refinery) }, advise));
    expect(screen.getByTestId('starter-advice')).toBeTruthy();
    expect(screen.getByTestId('ship-objective').textContent).not.toContain('Refinery');
  });

  it('never opens by itself with the guide off, yet the choices are a tap away', () => {
    render(line());
    expect(screen.queryByTestId('starter-advice')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    expect(screen.getByTestId('starter-advice')).toBeTruthy();
  });

  it('keeps the choices away while the core holds the player', () => {
    render(line({}, { kind: 'step', id: 'collect', step: 'press', chapter: 1, strict: true, marks: ['[data-guide="works"]'] }));
    expect(screen.queryByRole('button', { name: /other choices/i })).toBeNull();
    expect(screen.queryByTestId('starter-advice')).toBeNull();
  });

  it('has nothing to open when there is only one thing to do', () => {
    render(line({ alloy: 0, crystal: 0, bufferAlloy: 0 }));
    expect(screen.queryByRole('button', { name: /other choices/i })).toBeNull();
  });
});

/**
 * THE FIRST HUNT ON THE LINE (plan §5.1, F4e). While the Prospector flies, the line tells the story of
 * the two outposts, and a tap goes where the next move is made: the outpost to probe, the reports to
 * weigh. A flight under way only names itself.
 */
describe('the first hunt on the next-step line', () => {
  const modules = { REFINERY: 3, EXTRACTOR: 2, SURVEY: 1, VAULT: 1, SHIPYARD: 1 };
  const progress: VesselProgress = { modules, facts: ['FIRST_PROBE_REPORT'], parts: 0, fuel: 0 };
  const shipyard = { alloy: 0, crystal: 0, bufferAlloy: 0, modules, features: ['production', 'intel', 'fleet'], progress };
  const hunt = (props: Partial<Parameters<typeof ObjectiveLine>[0]>) =>
    render(<ObjectiveLine vessel={vesselSchema.parse(wireVessel(shipyard))} fetchedAt={Date.now()} onOpenShip={vi.fn()} mining {...props} />);

  it('says the Prospector is out and the guards are unknown, and a tap goes to the outpost to probe', () => {
    const outpost = vi.fn();
    hunt({ hunt: { stage: 'probe', target: 'tevis' }, onFocusOutpost: outpost });
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('hunt');
    expect(line.textContent).toMatch(/Prospector is on its way/);
    expect(line.textContent).toMatch(/two pirate outposts/);
    fireEvent.click(line);
    expect(outpost).toHaveBeenCalledWith('tevis');
  });

  it('leaves the Prospector out of it once it is home', () => {
    hunt({ hunt: { stage: 'probe', target: 'tevis' }, mining: false, vessel: vesselSchema.parse(wireVessel({ ...shipyard, progress: { ...progress, facts: ['FIRST_PROBE_REPORT', 'FIRST_MINING_RETURN'] } })) });
    const line = screen.getByTestId('ship-objective');
    expect(line.getAttribute('data-kind')).toBe('hunt');
    expect(line.textContent).not.toMatch(/Prospector/);
  });

  it('opens the reports once both guards are read', () => {
    const reports = vi.fn();
    hunt({ hunt: { stage: 'decide' }, onOpenReports: reports });
    fireEvent.click(screen.getByTestId('ship-objective'));
    expect(reports).toHaveBeenCalledOnce();
  });

  it('after a lost fight names the other outpost, and a tap goes there', () => {
    const focus = vi.fn();
    hunt({ hunt: { stage: 'retry', target: 'eldeth', name: 'Ravara' }, onFocusOutpost: focus });
    const line = screen.getByTestId('ship-objective');
    expect(line.textContent).toMatch(/Ravara/);
    expect(line.textContent).toMatch(/could not win/i);
    fireEvent.click(line);
    expect(focus).toHaveBeenCalledWith('eldeth');
  });

  it('only names the probes and the fleet while they fly', () => {
    hunt({ hunt: { stage: 'probing' } });
    expect(screen.getByTestId('ship-objective').tagName).not.toBe('BUTTON');
    expect(screen.getByTestId('ship-objective').textContent).toMatch(/probes are on their way/i);
    cleanup();
    hunt({ hunt: { stage: 'raid' } });
    expect(screen.getByTestId('ship-objective').textContent).toMatch(/battle comes on arrival/i);
  });

  it('is a short choice in the advisor', () => {
    hunt({ hunt: { stage: 'probe', target: 'tevis' }, mining: false, vessel: vesselSchema.parse(wireVessel({ ...shipyard, alloy: 10_000, crystal: 10_000 })) });
    fireEvent.click(screen.getByRole('button', { name: /other choices/i }));
    expect(screen.getByTestId('starter-advice').querySelector('[data-advice="hunt:probe"]')?.textContent).toMatch(/Probe the outposts/);
  });
});
