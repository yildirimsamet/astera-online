import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { COMMUNITY_POLICY_VERSION } from '@astera/rules';
import { useWorld } from '../src/api/world.js';
import { createSchool, schoolAction, schoolScene, tickSchool } from '../src/onboarding/flightSchool/world.js';
import { saveSchool, type SchoolRecord } from '../src/onboarding/flightSchool/storage.js';
import { serverNow } from '../src/lib/clock.js';
import type { Focus } from '../src/galaxy/FocusPanel.js';
import type { GameShellProps } from '../src/v2/shell/GameShell.js';
import { FlightSchool } from '../src/onboarding/flightSchool/FlightSchool.js';
import { useSchoolPresentation } from '../src/onboarding/flightSchool/presentation.js';
import { useSensorReach } from '../src/lib/useSensorReach.js';
import * as schoolWorld from '../src/onboarding/flightSchool/world.js';
const consent = { version: COMMUNITY_POLICY_VERSION, locale: 'en' };
vi.mock('../src/v2/shell/GameShell.js', () => ({ GameShell: ({ galaxy, onPanel }: GameShellProps) => <div data-real-game-shell>{galaxy({ homeRequest: 0, centerRequest: 0, worldsRequest: 0, clearRequest: 0, onPanel, onOpenChat: vi.fn(), onOpenBell: vi.fn() })}</div> }));
vi.mock('../src/screens/GalaxyView.jsx', () => ({ GalaxyView: ({ onFocused, coachFocus, coachTap, onSceneReady }: { onFocused: (f: { kind: string; id: string } | null) => void; coachFocus?: { focus: Focus } | null; coachTap?: { onTap: () => void } | null; onSceneReady?: () => void }) =>
  <><output data-testid="overview-sight">{String(useSensorReach('telescope')[0])}</output><canvas data-testid="overview-pick" onClick={event=>{event.currentTarget.dataset.picked='yes';onFocused({kind:'planet',id:'school-2'});}} /><button data-beat-card data-frame-at={useSchoolPresentation()?.overview?.at} onClick={onSceneReady}>Scene visible</button><button data-academy-tap-target onClick={coachTap?.onTap}>Teaching target</button><button data-focus-rail onClick={() => { onFocused(null); }}>Close focus</button><button data-academy-home data-focus-kind={coachFocus?.focus.kind} data-active-world={useWorld().activePlanetId} onClick={() => { onFocused({ kind: 'planet', id: 'academy-home' }); }}>Own planet</button></> }));
vi.mock('../src/shell/StatusBar.js', () => ({ StatusBar: () => null }));
vi.mock('../src/shell/PendingStrip.js', () => ({ PendingStrip: () => null }));
vi.mock('../src/onboarding/ClaimDialog.jsx', () => ({ ClaimDialog: ({ onClaim, introduction }: { introduction: string; onClaim: (a: string, b: string, c: string, d: typeof consent) => void }) =>
  <div>{introduction}<button onClick={() => { onClaim('pilot', 'test-password', 'TR', consent); }}>Create commander</button></div> }));
beforeEach(() => { localStorage.clear(); });
it('finishes a replay without promising another first-season package or opening a claim', () => {
  const world = { ...createSchool(serverNow()), scene: 'departure' as const };
  vi.spyOn(schoolWorld, 'createSchool').mockReturnValue(world);
  const onClaim = vi.fn(), onLeave = vi.fn();
  render(<FlightSchool replay onClaim={onClaim} onSignIn={vi.fn()} onLeave={onLeave} />);
  fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
  const message = document.querySelector('[data-school-line]')?.getAttribute('data-school-line');
  expect(message).toMatch(/No rewards/i);
  expect(message).not.toContain('will receive your first season');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(onLeave).toHaveBeenCalledOnce();
  expect(onClaim).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Create commander' })).not.toBeInTheDocument();
});
describe('new training entry', () => {
  it('has its active world on the first frame so restoring a target cannot lose camera focus', () => {
    render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Own planet' })).toHaveAttribute('data-active-world', 'academy-home');
  });
  it('waits for the explanation before inviting an action', () => {
    render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Own planet' }));
    expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene', 'welcome');
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Own planet' }));
    expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene', 'resources');
  });
  it('only opens the resources lesson after selecting the owned planet', () => {
    render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene', 'welcome');
    expect(document.querySelector('[data-real-game-shell]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Own planet' }));
    expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene', 'resources');
  });
  it('claims a normal opening with no training checkpoint or economic state', () => {
    const claim = vi.fn().mockResolvedValue(undefined);
    render(<FlightSchool onClaim={claim} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Finish academy' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create commander' }));
    expect(claim).toHaveBeenCalledWith('pilot', 'test-password', [], 'TR', consent);
  });
  it('leaves the top resource collection control clear during the collection lesson', () => {
    render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Own planet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show full message' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene', 'collect');
    expect(document.querySelector('[data-school-coach]')).toHaveAttribute('data-dock', 'bottom');
  });
});

it('follows the dispatched fleet instead of leaving the player looking at a distant target', () => {
  const end = serverNow(), startedAt = end - 300_000;
  let at = startedAt, w = createSchool(startedAt);
  const events: SchoolRecord['events'] = [];
  while (w.scene !== 'raid') {
    const scene = schoolScene(w), kind = scene.kind;
    const action = kind === 'order' ? { kind, subject: scene.subject!, count: scene.count ?? 1 }
      : kind === 'read' || kind === 'report' || kind === 'range' ? { kind: 'continue' as const } : { kind };
    w = schoolAction(w, action, at); events.push({ action, at });
    at = w.pending?.finishesAt.getTime() ?? w.flight?.homeAt ?? at + 1;
    w = tickSchool(w, at);
  }
  events.push({ action: { kind: 'raid' }, at: end });
  saveSchool({ version: 1, startedAt, events });
  render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Own planet' })).toHaveAttribute('data-focus-kind', 'thread');
});

it('allows choosing Lyra again after its focus sheet is closed', () => {
 const end=serverNow(),startedAt=end-300_000;
 let w=createSchool(startedAt),at=startedAt;const events:SchoolRecord['events']=[];
 while(w.scene!=='watch'){
  const scene=schoolScene(w),kind=scene.kind;
  const action=kind==='order'?{kind,subject:scene.subject!,count:scene.count??1}:kind==='read'||kind==='range'||kind==='report'?{kind:'continue' as const}:{kind};
  events.push({action,at});w=schoolAction(w,action,at);at=w.pending?.finishesAt.getTime()??at+1;w=tickSchool(w,at);
 }
 saveSchool({version:1,startedAt,events});
 render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
 fireEvent.click(screen.getByRole('button',{name:'Show full message'}));
 fireEvent.click(screen.getByRole('button',{name:'Teaching target'}));
 expect(screen.getByRole('button',{name:'Own planet'})).not.toHaveAttribute('data-focus-kind');
 fireEvent.click(screen.getByRole('button',{name:'Close focus'}));
 expect(screen.getByRole('button',{name:'Own planet'})).toHaveAttribute('data-focus-kind','planet');
});

it('starts a resumed Telescope reveal after the loading cover has gone', () => {
 const end=serverNow(),startedAt=end-300_000;
 let w=createSchool(startedAt),at=startedAt;const events:SchoolRecord['events']=[];
 while(w.scene!=='sight'){
  const scene=schoolScene(w),kind=scene.kind;
  const action=kind==='order'?{kind,subject:scene.subject!,count:scene.count??1}:kind==='read'||kind==='range'||kind==='report'?{kind:'continue' as const}:{kind};
  events.push({action,at});w=schoolAction(w,action,at);at=w.pending?.finishesAt.getTime()??at+1;w=tickSchool(w,at);
 }
 saveSchool({version:1,startedAt,events});
 render(<FlightSchool onClaim={vi.fn()} onSignIn={vi.fn()} onLeave={vi.fn()} />);
 expect(screen.getByTestId('overview-sight')).toHaveTextContent('true');
 fireEvent.click(screen.getByTestId('overview-pick'));
 expect(screen.getByTestId('overview-pick')).toHaveAttribute('data-picked','yes');
 expect(document.querySelector('[data-school-scene]')).toHaveAttribute('data-school-scene','sight');
 const clock=vi.spyOn(Date,'now').mockReturnValue(end+20_000);
 fireEvent.click(screen.getByRole('button',{name:'Scene visible'}));
 expect(Number(screen.getByRole('button',{name:'Scene visible'}).getAttribute('data-frame-at'))).toBeGreaterThanOrEqual(end+22_000);
 clock.mockRestore();
});

it('needs exactly two Telescope expansions before continuing the demonstration', () => {
 const end=serverNow(),startedAt=end-300_000;
 let w=createSchool(startedAt),at=startedAt;const events:SchoolRecord['events']=[];
 while(w.scene!=='range'){
  const scene=schoolScene(w),kind=scene.kind;
  const action=kind==='order'?{kind,subject:scene.subject!,count:scene.count??1}:kind==='read'||kind==='range'||kind==='report'?{kind:'continue' as const}:{kind};
  events.push({action,at});w=schoolAction(w,action,at);at=w.pending?.finishesAt.getTime()??at+1;w=tickSchool(w,at);
 }
 saveSchool({version:1,startedAt,events});
 const props={onClaim:vi.fn(),onSignIn:vi.fn(),onLeave:vi.fn()};
 const first=render(<FlightSchool {...props} />);
 fireEvent.click(screen.getByRole('button',{name:'Show full message'}));
 fireEvent.click(screen.getByRole('button',{name:'Expand the Telescope'}));first.unmount();
 const clock=vi.spyOn(Date,'now').mockReturnValue(end+6000);
 const second=render(<FlightSchool {...props} />);
 fireEvent.click(screen.getByRole('button',{name:'Show full message'}));
 fireEvent.click(screen.getByRole('button',{name:'Expand the Telescope'}));second.unmount();
 const saved=z.object({events:z.array(z.object({at:z.number(),action:z.unknown()}))}).parse(JSON.parse(localStorage.getItem('astera.flight-school.v1')!));
 expect(saved.events).toHaveLength(events.length+2);
 expect(saved.events.slice(-2).map(event=>event.action)).toEqual([{kind:'range',level:3},{kind:'range',level:5}]);
 clock.mockReturnValue(end+12000);
 render(<FlightSchool {...props} />);fireEvent.click(screen.getByRole('button',{name:'Show full message'}));
 expect(screen.queryByRole('button',{name:'Expand the Telescope'})).not.toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Continue'})).toBeEnabled();clock.mockRestore();
});
