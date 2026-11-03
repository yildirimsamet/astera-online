import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CountryCode } from '@astera/rules';
import type { ClaimIntent } from '../../api/schemas.js';
import type { CommunityPolicyConsent } from '../../api/communityPolicySchemas.js';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { refreshQueries } from '../../api/refreshQueries.js';
import { GalaxyView, type Panel } from '../../screens/GalaxyView.jsx';
import type { Focus } from '../../galaxy/FocusPanel.jsx';
import { WorldProvider } from '../../api/world.js';
import { GameShell } from '../../v2/shell/GameShell.js';
import { serverNow } from '../../lib/clock.js';
import { SensorReachContext } from '../../lib/useSensorReach.js';
import { describeError } from '../../i18n/errors.js';
import { ClaimDialog } from '../ClaimDialog.jsx';
import { useGate } from '../Gate.jsx';
import { schoolFetch, schoolPending, schoolTraffic } from './api.js';
import { createSchool, schoolAction, schoolGalaxy, schoolPlanet, schoolScene, schoolExampleLeg, tickSchool, SCHOOL_HOME, SCHOOL_ROCK, SCHOOL_TARGET, type SchoolAction, type SchoolWorld } from './world.js';
import { clearSchool, restoreSchool, saveSchool, type SchoolRecord } from './storage.js';
import { schoolCopy } from './copy.js';
import { SchoolCoach } from './SchoolCoach.js';
import { SchoolPresentationContext } from './presentation.js';
import { SCHOOL_RAID } from './world.js';
import { useSilenceToasts } from '../../ui/Toast.js';
import { SchoolPointer } from './SchoolPointer.js';
import { SchoolLookHint } from './SchoolLookHint.js';
import { schoolFocusRequest } from './scenes.js';
import { useNow } from '../../lib/time.js';
import { SCHOOL_REVEAL_MS, schoolTelescopeFrame, type SchoolFrame } from './visualStory.js';
import { useSchoolTelemetry } from './useSchoolTelemetry.js';
import type { SchoolTelemetry } from './telemetry.js';
import { isAppActive } from '../../platform/activity.js';

interface Props {
  onClaim: (username: string, password: string, progress: readonly ClaimIntent[], country?: CountryCode, policy?: CommunityPolicyConsent) => Promise<void>;
  onSignIn: () => void; onLeave: () => void; replay?: boolean;
}

export function FlightSchool({ replay = false, ...props }: Props) {
  const [initial] = useState(() => replay ? { world: createSchool(serverNow()), record: { version: 1 as const, startedAt: serverNow(), events: [] } satisfies SchoolRecord } : restoreSchool(serverNow()));
  const [world, setWorld] = useState(initial.world);
  const [prepared, setPrepared] = useState(false);
  const observer = useSchoolTelemetry(world, replay, initial.record.events.length > 0, prepared);
  const live = useRef(world), history = useRef(initial.record);
  const [cache] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } });
    const planet = schoolPlanet(initial.world);
    client.setQueryData(keys.planet, planet);
    client.setQueryData(keys.planetById(SCHOOL_HOME), planet);
    client.setQueryData(keys.planets, { playerId: 'academy-commander', seasonId: 'flight-school', capitalPlanetId: SCHOOL_HOME, planets: [planet] });
    client.setQueryData(keys.galaxy, schoolGalaxy(initial.world, serverNow()));
    return client;
  });
  const write = useCallback((next: SchoolWorld) => {
    live.current = next; setWorld(next);
    cache.setQueryData(keys.planet, schoolPlanet(next));
    void refreshQueries(cache);
  }, [cache]);
  const dispatch = useCallback((action: SchoolAction, at: number) => {
    const next = schoolAction(tickSchool(live.current, at), action, at);
    observer.accepted(live.current.scene, action.kind);
    history.current = { ...history.current, events: [...history.current.events, { action, at }] };
    if (!replay) saveSchool(history.current);
    write(next);
  }, [replay, write, observer]);
  const ready = useRef(false);
  const onSceneReady = useCallback(() => {
    if (ready.current) return;
    ready.current = true;
    setPrepared(true);
    const current = live.current;
    if (!['sight', 'warning', 'traffic'].includes(current.scene)) return;
    const at = serverNow(), reveal = initial.world.reach;
    write({ ...current, sceneAt: at, ...(reveal ? { reach: { ...reveal, at: at + 2000 } } : {}) });
  }, [initial, write]);
  const [api] = useState(() => new Api({ fetch: schoolFetch(() => live.current, dispatch, serverNow), authTransport: null, baseUrl: '' }));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const before = live.current, after = tickSchool(before, serverNow());
      if (before.scene === 'traffic') cache.setQueryData(keys.traffic, { contacts: schoolTraffic(before, serverNow()) });
      if (after !== before) write(after);
      else if (before.flight) void refreshQueries(cache);
    }, 500);
    return () => { window.clearInterval(timer); cache.clear(); };
  }, [cache, write]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (live.current.reach) cache.setQueryData(keys.galaxy, schoolGalaxy(live.current, serverNow()));
    }, 50);
    return () => { window.clearInterval(timer); };
  }, [cache]);
  return <QueryClientProvider client={cache}><ApiProvider api={api}>
    <WorldProvider><SchoolScreen {...props} replay={replay} world={world} dispatch={dispatch} onSceneReady={onSceneReady} observer={observer} /></WorldProvider>
  </ApiProvider></QueryClientProvider>;
}

function SchoolScreen({ world, dispatch, replay, onSceneReady, observer, ...props }: Props & { world: SchoolWorld; dispatch: (a: SchoolAction, at: number) => void; onSceneReady: () => void; observer: SchoolTelemetry }) {
  useSilenceToasts(true);
  const { i18n, t } = useTranslation();
  const copy = schoolCopy(i18n.resolvedLanguage ?? 'en');
  const scene = schoolScene(world);
  const now = useNow(500);
  const flight = world.flight;
  const phase = !flight || now < flight.arriveAt ? 'outbound' : now < flight.turnAt ? 'battle' : 'return';
  const [panel, setPanel] = useState<Panel>(null);
  const [claiming, setClaiming] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [selected, setSelected] = useState(false);
  const [telescope, setTelescope] = useState(world.instruments.TELESCOPE > 0);
  const [radar, setRadar] = useState(world.instruments.RADAR > 0);
  const busy = !!world.pending || !!world.flight;
  const trafficDone = scene.id === 'traffic' && now >= world.sceneAt + 8000;
  const message = flight ? copy.flight[flight.kind][phase] ?? copy.busy : busy ? copy.busy
    : scene.id === 'departure' && replay ? t('academy.replayComplete')
    : scene.id === 'traffic' && trafficDone ? copy.trafficArrived
    : scene.id === 'sight' && world.reach ? copy.sightOpening
    : scene.id === 'warning' && schoolPending(world, now).length === 0 ? copy.radarOpening : copy.scenes[scene.id];
  const [readMessage, setReadMessage] = useState<string | null>(null);
  const narrated = readMessage === message;
  const latest = useRef({ scene, busy, claiming, selected, narrated, pending: world.pending, trafficHint: trafficDone && now >= world.sceneAt + 10_000 });
  latest.current = { scene, busy, claiming, selected, narrated, pending: world.pending, trafficHint: trafficDone && now >= world.sceneAt + 10_000 };
  const send = useCallback((action: SchoolAction) => {
    try { dispatch(action, serverNow()); setProblem(undefined); } catch (e) { setProblem(describeError(e)); }
  }, [dispatch]);

  useEffect(() => {
    setSelected(false);
    setPanel(scene.id === 'probeReport' ? 'intel' : scene.group && scene.kind !== 'collect' && scene.id !== 'resources' ? 'planet' : null);
    if (world.instruments.TELESCOPE > 0) setTelescope(true);
    if (world.instruments.RADAR > 0) setRadar(true);
  }, [scene.id]);
  const telescopeVisible = scene.id === 'sight' || scene.id === 'range' || telescope;
  const radarVisible = radar && !(world.reach?.radar && now < world.reach.at);
  const reach = useMemo(() => ({ telescope: [telescopeVisible, setTelescope] as [boolean, typeof setTelescope], radar: [radarVisible, setRadar] as [boolean, typeof setRadar] }), [telescopeVisible, radarVisible]);
  const overview = useMemo<SchoolFrame | undefined>(() => {
    const telescopeFrame = schoolTelescopeFrame(world);
    if (telescopeFrame) return telescopeFrame;
    const center = { x: 180, y: 0, z: -650 };
    if (scene.id === 'warning' || scene.id === 'incoming') return { center,
      at: world.sceneAt + 2000, from: 110, to: scene.id === 'incoming' ? 110 : 130, duration: SCHOOL_REVEAL_MS };
    return undefined;
  }, [scene.id, world.sceneAt, world.reach, world.previewLevel]);
  const presentation = useMemo(() => ({ orderSeconds: 3, legSeconds: 6.5,
    overview,
    ...(scene.id === 'traffic' ? { transit: { ...schoolExampleLeg(), at: world.sceneAt, duration: 8000 } } : {}),
    pausedIncoming: !world.flight && ['warning', 'aegis', 'shield', 'guns', 'defend'].includes(scene.id),
    ...(scene.kind === 'order' && scene.subject ? { order: { subject: scene.subject, count: scene.count ?? 1 } } : {}),
    ...(scene.kind === 'raid' ? { fleet: SCHOOL_RAID } : {}),
  }), [scene.id, world.flight, world.sceneAt, overview]);
  const selectors = useCallback((): string[] => {
    const { scene: s, busy: b, selected: chosen, narrated: ready } = latest.current;
    if (b) return ['canvas'];
    if (s.id === 'sight' || s.id === 'range') return ['canvas', '[data-school-fog]', '[data-focus-rail]'];
    if (!ready) return [];
    if (s.kind === 'home') return ['canvas', '[data-academy-home]'];
    if (s.kind === 'order') return [`#row-${s.subject ?? ''}`, '[data-item-sheet]', '[data-build-sheet]', '[data-sheet-panel] [data-commit]', '[data-tab]'];
    if (s.kind === 'collect') return ['[data-works-line]', '[data-collect]', '[data-tab]'];
    if (['mine', 'probe', 'raid', 'watch'].includes(s.kind)) return chosen ? ['[data-focus-rail]', '[data-sheet-panel]', '[data-count-max]', '[data-launch-commit]'] : ['[data-academy-tap-target]'];
    if (s.kind === 'report') return ['[data-sheet-panel]'];
    return [];
  }, []);
  const allowed = useCallback(() => selectors().flatMap(s => Array.from(document.querySelectorAll(s))), [selectors]);
  const hand = useCallback((): Element[] => {
    const s = latest.current;
    if (s.scene.id === 'traffic' && s.trafficHint && s.narrated) {
      const next = document.querySelector('[data-school-next]'); return next ? [next] : [];
    }
    if (!s.narrated || s.busy || s.claiming || s.scene.kind === 'read' || s.scene.kind === 'range' || s.scene.kind === 'report') return [];
    if (s.selected && s.scene.kind === 'watch') {
      const buttons = Array.from(document.querySelectorAll('[data-focus-rail] button'));
      const slot = buttons.find(button => button.textContent.trim() === i18n.t('focus.planet.watchSlot', { slot: 1 }));
      const header = document.querySelector('[data-focus-rail] button[aria-expanded="false"]');
      return slot ? [slot] : header ? [header] : [];
    }
    if (s.selected && s.scene.kind === 'probe') {
      const probe = Array.from(document.querySelectorAll('[data-focus-rail] button')).find(button => button.textContent.trim().startsWith(i18n.t('focus.planet.probeShort')));
      return probe ? [probe] : [];
    }
    const priorities = s.scene.kind === 'order'
      ? ['[data-build-sheet] [data-count-max] button:not(:disabled)', '[data-build-sheet] [data-commit] button:not(:disabled)', '[data-item-sheet] [data-act] button:not(:disabled)', `#row-${s.scene.subject ?? ''} [data-open-item]`]
      : s.scene.kind === 'collect' ? ['[data-works-line]', '[data-collect]']
      : s.scene.kind === 'home' ? ['[data-academy-home]']
      : ['[data-academy-tap-target]', '[data-count-max] button:not(:disabled)', '[data-launch-commit] button:not(:disabled)', '[data-focus-rail] [data-attack]', '[data-focus-rail] [data-primary]', '[data-focus-rail] button[aria-expanded="false"]'];
    const orderSheet = document.querySelector('[data-item-sheet], [data-build-sheet]');
    for (const selector of priorities) {
      if (orderSheet && selector.startsWith('#row-')) return [];
      const nodes = Array.from(document.querySelectorAll(selector));
      const node = nodes.find(n => n.getBoundingClientRect().width > 0);
      if (node) return [node];
    }
    return [];
  }, []);
  const refuse = useCallback(() => undefined, []);
  const highlight = useCallback((): Element[] => {
    if (latest.current.pending) {
      if (document.querySelector('[data-item-sheet], [data-build-sheet]')) return [];
      const lane = document.querySelector('[data-queue-lane] [data-progress]')?.closest('[data-queue-lane]');
      return lane ? [lane] : [];
    }
    if (latest.current.scene.id === 'resources') {
      const header = document.querySelector('[data-works-line]')?.closest('header');
      return header ? [header] : [];
    }
    return hand();
  }, [hand]);
  useGate(allowed, !claiming, refuse);
  useEffect(() => {
    if (!narrated || busy || claiming || !isAppActive()) return;
    observer.revealed(scene.id, 'text');
    const frame = requestAnimationFrame(() => {
      const next = document.querySelector('[data-school-next]:not(:disabled)');
      if ([...hand(), ...(next ? [next] : [])].some(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
      })) observer.ready(scene.id);
    });
    return () => { cancelAnimationFrame(frame); };
  }, [scene.id, narrated, busy, claiming, selected, hand, observer, now]);

  const focus: Focus | null = flight ? flight.kind === 'mine' ? { kind: 'run', id: 'school-mine' }
    : phase === 'battle' ? { kind: 'planet', id: flight.kind === 'defend' ? SCHOOL_HOME : SCHOOL_TARGET }
    : flight.kind === 'defend' ? { kind: 'contact', id: 'school-incoming' } : { kind: 'thread', key: `school-${flight.kind}` }
    : scene.kind === 'mine' ? { kind: 'asteroid', id: SCHOOL_ROCK }
    : scene.id === 'sightWorlds' ? { kind: 'planet', id: 'school-3' }
    : scene.id === 'sightCompare' ? { kind: 'planet', id: SCHOOL_TARGET }
    : scene.id === 'traffic' ? { kind: 'contact', id: 'school-neighbour-fleet' }
    : ['shield', 'defend', 'defenseReport'].includes(scene.id) ? { kind: 'planet', id: SCHOOL_HOME }
    : ['probe', 'raid', 'watch'].includes(scene.kind) ? { kind: 'planet', id: SCHOOL_TARGET } : null;
  const request = schoolFocusRequest(world.startedAt, scene.id) * 10 + (flight ? phase === 'outbound' ? 1 : phase === 'battle' ? 2 : 3 : 0);
  const coachFocus = useMemo(() => focus && scene.id !== 'range' && (flight || (!selected && !busy)) ? { focus, request,
    inspect: phase === 'battle' || ['sightWorlds', 'sightCompare', 'shield', 'defend', 'defenseReport'].includes(scene.id) } : null, [scene.id, selected, busy, request]);
  const coachTap = useMemo(() => !busy && coachFocus && ['mine', 'probe', 'raid', 'watch'].includes(scene.kind)
    ? { label: copy.target, onTap: () => { setSelected(true); } } : null, [coachFocus, copy.target]);
  const finishRead = () => {
    if (scene.id === 'departure') { observer.exit(scene.id); if (replay) props.onLeave(); else setClaiming(true); }
    else send({ kind: 'continue' });
  };
  const isRange = scene.kind === 'range';
  const nextRange = () => {
    if (world.previewLevel === 5) send({ kind: 'continue' });
    else send({ kind: 'range', level: (world.previewLevel ?? 1) < 3 ? 3 : 5 });
  };
  const latestReport = world.reports.at(-1);
  const openReport = () => { setPanel('report'); };
  const visibleRows = ['CORE', 'REFINERY', 'EXTRACTOR', 'DEUTERIUM_PLANT', ...(world.uplink ? ['UPLINK'] : []),
    ...(world.instruments.TELESCOPE > 0 ? ['TELESCOPE'] : []), ...(world.buildings.SHIPYARD > 0 ? ['SHIPYARD'] : []),
    ...(world.fleet.PROSPECTOR ? ['PROSPECTOR'] : []), ...(world.fleet.DART ? ['DART'] : []), ...(world.fleet.COURIER ? ['COURIER'] : []),
    ...(world.instruments.RADAR > 0 ? ['RADAR'] : []), ...(world.instruments.AEGIS > 0 ? ['AEGIS'] : []), 'HANGAR', scene.subject ?? ''];
  const hideRows = visibleRows.map(id => `:not(#row-${id})`).join('');

  return <SchoolPresentationContext.Provider value={presentation}><SensorReachContext.Provider value={reach}><div className="school-root relative z-10 flex h-dvh flex-col overflow-hidden" data-school-scene={scene.id}>
    <style>{`[data-school-scene] [id^="row-"]${hideRows}{display:none} [data-school-scene] [data-hull-family-group]{content-visibility:visible!important} [data-school-scene] [data-hull-family-group]:not(:has([id^="row-"])){display:none}`}</style>
    <GameShell commander="Aurora" panel={panel} onPanel={(next) => {
      if (scene.kind === 'report' && panel === 'report' && next === null) send({ kind: 'continue' });
      setPanel(next);
    }} onFocusPlanet={() => { setPanel(null); }} onFocusCraft={() => undefined}
      galaxy={({ homeRequest, centerRequest, clearRequest, onPanel }) => <GalaxyView panel={panel} onPanel={onPanel}
      homeRequest={homeRequest} centerRequest={centerRequest} clearRequest={focus ? undefined : clearRequest + request}
      commander="Aurora" planetGroup={scene.group} showChat={false} showGuidance={false} onSignOut={props.onLeave}
      openingHome={scene.kind === 'home'}
      onSceneReady={onSceneReady}
      coachFocus={coachFocus} coachTap={coachTap}
      panelStop={scene.id === 'probeReport' ? { stop: 'probes', request } : scene.kind === 'report' && latestReport ? { stop: 'battles', request, reportMissionId: latestReport.missionId ?? undefined } : undefined}
      onFocused={(value) => {
        if (value === null) setSelected(false);
        if (scene.id === 'sight' || scene.id === 'range') setPanel(null);
        if (scene.kind === 'home' && value?.kind === 'planet' && value.id === SCHOOL_HOME) send({ kind: 'home' });
      }} />} />
    {!claiming && <>
      {['incoming', 'warning', 'shield', 'defend'].includes(scene.id) && !world.flight && <p data-school-note>{copy.paused}</p>}
      <SchoolPointer targets={highlight} showHand={!busy && (!['read', 'range', 'report'].includes(scene.kind) || scene.id === 'traffic')} />
      {flight && (flight.kind === 'mine' || flight.kind === 'probe') && <SchoolLookHint key={flight.kind} label={copy.rotate} />}
      <SchoolCoach title={`${copy.chapters[scene.chapter - 1] ?? ''}${isRange ? ` · ${copy.level} ${String(world.previewLevel ?? 1)}` : ''}`} progress={scene.chapter}
        text={message} revealLabel={copy.reveal} onRevealed={() => { observer.revealed(scene.id, busy ? phase : 'text'); setReadMessage(message); }}
        dock={scene.kind === 'home' || scene.kind === 'collect' || scene.id === 'resources' || !!world.flight ? 'bottom' : 'top'} busy={busy}
        exitLabel={replay ? t('academy.leave') : copy.exit} onExit={() => { observer.exit(scene.id); if (replay) props.onLeave(); else setClaiming(true); }}
        actionLabel={!busy && !world.reach && !(scene.id === 'traffic' && !trafficDone) ? isRange ? world.previewLevel === 5 ? copy.next : copy.range : scene.kind === 'read' ? copy.next
          : scene.kind === 'report' ? panel === 'report' ? undefined : copy.report : scene.kind === 'defend' ? copy.defend : undefined : undefined}
        onAction={isRange ? nextRange : scene.kind === 'report' ? openReport : scene.kind === 'defend' ? () => { send({ kind: 'defend' }); } : finishRead} />
      {problem && <div data-beat-card role="alert" className="fixed inset-x-3 top-1/2 z-[65] rounded-control border border-v2-warn/50 bg-v2-panel p-4 text-body text-v2-warn" onClick={() => { setProblem(undefined); }}>{problem}</div>}
    </>}
    {claiming && <ClaimDialog planetName="Aurora" introduction={copy.claim} onSignIn={props.onSignIn} error={problem}
      onClaim={async (username, password, country, policy) => {
        try { await props.onClaim(username, password, [], country, policy); if (!replay) clearSchool(); }
        catch (e) { setProblem(describeError(e)); throw e; }
      }} />}
  </div></SensorReachContext.Provider></SchoolPresentationContext.Provider>;
}
