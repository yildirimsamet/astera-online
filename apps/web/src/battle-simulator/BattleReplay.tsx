import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HULLS, fleetCount, fleetEntries, type BattleReplayData, type BattleSide } from '@astera/rules';
import { useNativeBack } from '../platform/nativeBack.js';
import { monumentControlKey } from '../lib/battleOutcome.js';
import { combatClassLabel, hullLabel } from '../i18n/names.js';
import { HULL_ART } from '../ui/assets.js';
import { useSoundEffects, playSound } from '../lib/sound.js';
import { BattleStage, type CameraRequest } from './BattleStage.js';
import { buildReplayTimeline, sampleReplay, type ReplayEvent } from './timeline.js';
import { UnitInspector } from './UnitInspector.js';
import { RetreatRoster } from './RetreatRoster.js';
import { combatNumber } from './presentation.js';

export interface PlaybackClock { time: number; playing: boolean; speed: number }
type ShotEvent = Extract<ReplayEvent, { kind: 'SHOT' }>;

export function BattleReplay({ simulation, environment, suspended = false, initialViewer = 'ATTACK', ownPlayerIds }: { simulation: BattleReplayData; environment: 'PLANET' | 'MONUMENT'; suspended?: boolean; initialViewer?: BattleSide; ownPlayerIds?: readonly string[] }) {
  const { t, i18n } = useTranslation();
  const number = (value: number) => combatNumber(value, i18n.language);
  useSoundEffects();
  const timeline = useMemo(() => buildReplayTimeline(simulation.recording), [simulation]);
  const clock = useRef<PlaybackClock>({ time: 0, playing: true, speed: 1 });
  const ready = useRef(false);
  const [stageState, setStageState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const onReady = useCallback(() => { ready.current = true; setStageState('ready'); }, []);
  const onUnavailable = useCallback(() => { ready.current = false; setStageState('unavailable'); clock.current.playing = false; setPlaying(false); }, []);
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(true), [speed, setSpeed] = useState(1);
  const [viewer, setViewer] = useState<BattleSide>(initialViewer);
  const [selected, setSelected] = useState<string | null>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest | null>(null);
  const camera = (kind: CameraRequest['kind'], unitId?: string) => { setCameraRequest(current => ({ id: (current?.id ?? 0) + 1, kind, unitId })); };
  const [logSide, setLogSide] = useState<BattleSide>(initialViewer);
  const [logOpen, setLogOpen] = useState(false);
  const logPanel = useRef<HTMLElement>(null);
  const logOpener = useRef<HTMLButtonElement>(null);
  const logCloser = useRef<HTMLButtonElement>(null);
  const frame = useMemo(() => sampleReplay(timeline, time), [timeline, time]);
  const ships = useMemo(() => new Map(simulation.recording.ships.map(ship => [ship.id, ship])), [simulation]);
  const openingStrikes = useMemo(() => timeline.events.filter(event => event.kind === 'AEGIS_STRIKE'), [timeline]);
  const allShots = useMemo(() => timeline.events.filter((event): event is ShotEvent => event.kind === 'SHOT'), [timeline]);
  const hitTimes = useMemo(() => new Map(timeline.events.flatMap(event => event.kind === 'HIT' ? [[event.hit, event.at] as const] : [])), [timeline]);
  const selectedShip = selected ? ships.get(selected) : null;
  const shownShot = frame.activeShot;
  const firingShip = frame.activeShot ? ships.get(frame.activeShot.shot.sourceId) : frame.activeAegisStrike ? ships.get(frame.activeAegisStrike.strike.sourceId) : undefined;
  const suspend = useCallback(() => { clock.current.playing = false; setPlaying(false); setTime(clock.current.time); }, []);
  useEffect(() => { if (suspended) { clock.current.playing = false; setPlaying(false); } }, [suspended]);
  const closeLog = useCallback(() => { setLogOpen(false); logOpener.current?.focus(); }, []);
  useNativeBack(logPanel, closeLog, logOpen);
  useEffect(() => {
    if (!logOpen) return;
    logCloser.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); closeLog(); } };
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('keydown', close); };
  }, [logOpen, closeLog]);
  useEffect(() => { if (frame.activeShot) setLogSide(frame.activeShot.side); else if (frame.activeAegisStrike) setLogSide('ATTACK'); }, [frame.activeShot, frame.activeAegisStrike]);
  useEffect(() => {
    let raf = 0, last = performance.now(), shown = last;
    const stop = () => { if (document.hidden) { clock.current.playing = false; setPlaying(false); } };
    const tick = (now: number) => {
      const dt = Math.min(.1, Math.max(0, (now - last) / 1000)); last = now;
      if (ready.current && clock.current.playing && !document.hidden) {
        const before = clock.current.time;
        clock.current.time = Math.min(timeline.duration, before + dt * clock.current.speed);
        if (clock.current.speed <= 1) {
          const cue = allShots.find(shot => shot.at > before && shot.at <= clock.current.time);
          if (!cue && openingStrikes.some(event => event.launchAt > before && event.launchAt <= clock.current.time)) playSound('weapon', { gain: .45, pan: -.25 });
          if (cue) playSound('weapon', { gain: .4, pan: cue.side === 'ATTACK' ? -.25 : .25 });
        }
        if (clock.current.time === timeline.duration) { clock.current.playing = false; setPlaying(false); }
      }
      if (now - shown >= 100) { setTime(clock.current.time); shown = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', stop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', stop); };
  }, [timeline, allShots, openingStrikes]);
  const seek = (value: number) => {
    clock.current.time = value >= timeline.duration - .011 ? timeline.duration : Math.max(0, value); clock.current.playing = false;
    setPlaying(false); setTime(clock.current.time);
  };
  const step = (direction: 1 | -1) => {
    const moments = [...openingStrikes.map(event => event.at), ...allShots.map(shot => shot.impactEnd)].sort((a, b) => a - b);
    const next = direction === 1 ? moments.find(at => at > clock.current.time + .0001) : moments.findLast(at => at < clock.current.time - .0001);
    seek(next ?? (direction === 1 ? timeline.duration : 0));
  };
  const stats = (side: BattleSide) => {
    const values = simulation.recording.ships.filter(ship => ship.side === side).map(ship => frame.ships.get(ship.id)!);
    return { active: values.filter(ship => ship.status === 'ACTIVE').length,
      dead: values.filter(ship => ship.status === 'DESTROYED').length, fled: values.filter(ship => ship.status === 'RETREATED').length };
  };
  const ownership = (ship: { side: BattleSide; playerId: string }) => !ownPlayerIds?.length ? undefined
    : ownPlayerIds.includes(ship.playerId) ? 'YOU' : ship.side === initialViewer ? 'ALLY' : 'ENEMY';
  const inspect = (id: string | null, focus = true) => {
    setSelected(id);
    if (id) { suspend(); if (focus) camera('FOCUS', id); }
  };
  const sideHeader = (side: BattleSide) => {
    const value = stats(side);
    return <div className={`sim-force ${side === viewer ? 'is-self' : 'is-enemy'}`}>
      <strong>{t(side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')}</strong>
      <span>{t('simulator.active')} <b>{value.active}</b></span><span>{t('simulator.destroyed')} <b>{value.dead}</b></span><span>{t('simulator.retreated')} <b>{value.fled}</b></span>
    </div>;
  };
  const logShots = allShots.filter(event => event.round === Math.max(1, frame.round) && event.side === logSide);
  const phaseShots = allShots.filter(event => event.round === frame.round && event.side === frame.phase);
  const phaseShotNumber = phaseShots.filter(event => event.at <= time).length;
  const currentRound = simulation.recording.rounds.find(round => round.round === frame.round);
  const preEscaped = simulation.escape?.kind === 'ESCAPED' ? fleetCount(simulation.escape.ships) : 0;
  const noSurvivors = (side: BattleSide) => stats(side).active + stats(side).fled + (side === 'DEFENCE' ? preEscaped : 0) === 0;
  const mutualDestruction = noSurvivors('ATTACK') && noSurvivors('DEFENCE') && stats('ATTACK').dead > 0 && stats('DEFENCE').dead > 0;
  const readerSide = ownPlayerIds === undefined ? viewer : initialViewer;
  const ownFleetDestroyed = noSurvivors(readerSide) && stats(readerSide).dead > 0;
  const personalShips = ownPlayerIds?.length ? simulation.recording.ships.filter(ship => ownPlayerIds.includes(ship.playerId)) : [];
  const personalFleetDestroyed = personalShips.length > 0 && personalShips.every(ship => frame.ships.get(ship.id)?.status === 'DESTROYED')
    && !(readerSide === 'DEFENCE' && preEscaped > 0);
  return <div className="sim-replay">
    <div className="sim-stage-panel">
      <BattleStage timeline={timeline} clock={clock} viewer={viewer} selected={selected} onSelect={inspect} environment={environment}
        onReady={onReady} onUnavailable={onUnavailable} time={time} playing={playing} onSuspend={suspend} cameraRequest={cameraRequest} />
      {stageState === 'loading' && <div className="sim-model-loading" role="status">{t('simulator.stageLoading')}</div>}
      <div className="sim-stage-top">{sideHeader('ATTACK')}{sideHeader('DEFENCE')}</div>
      <span className="sim-round">{frame.finished ? t('simulator.finished') : frame.round > 0 ? t('simulator.round', { number: frame.round, total: simulation.recording.roundLimit }) : t('simulator.initial')}</span>
      <div className={`sim-action-banner ${(frame.phase === 'ATTACK' || frame.phase === 'DEFENCE') && frame.phase !== viewer ? 'is-enemy' : ''}`} data-combat-phase={frame.phase}>
        <span>{t(frame.phase === 'AEGIS_OPENING' ? 'simulator.aegisOpening' : frame.phase === 'ATTACK' ? 'simulator.attackerTurn' : frame.phase === 'DEFENCE' ? 'simulator.defenderTurn' : frame.phase === 'RETREAT' ? 'simulator.retreatPhase' : frame.phase === 'ROUND_END' ? 'simulator.roundEnd' : frame.phase === 'AFTERMATH' ? 'simulator.aftermath' : frame.phase === 'FINISHED' ? 'simulator.finished' : 'simulator.initial')}</span>
        {firingShip && <strong>{t('simulator.firingUnit', { name: `${hullLabel(firingShip.hull)} #${firingShip.id}` })}</strong>}
        {frame.phase === 'AEGIS_OPENING' && <small>{t('simulator.shieldOnly')}</small>}
        {phaseShots.length > 0 && <small>{t('simulator.phaseProgress', { current: phaseShotNumber, total: phaseShots.length })}</small>}
        {frame.pendingFire.size > 0 && <small>{t('simulator.pendingFire')}</small>}
        {frame.phase === 'RETREAT' && <small>{t('simulator.retreatSummary', { attack: frame.retreats.filter(event => event.round === frame.round && ships.get(event.shipId)?.side === 'ATTACK').length,
          defence: frame.retreats.filter(event => event.round === frame.round && ships.get(event.shipId)?.side === 'DEFENCE').length })}</small>}
      </div>
      {simulation.aegisCapacity > 0 && <div className={`sim-aegis ${viewer === 'DEFENCE' ? 'is-bottom' : ''}`}>
        <span>Aegis <b>{number(frame.aegis)}</b><small> / {number(simulation.aegisCapacity)}</small></span>
        <meter min={0} max={simulation.aegisCapacity} value={frame.aegis} />
        {frame.aegisDamage > 0 && <b className="sim-aegis-damage">−{number(frame.aegisDamage)}</b>}
        {frame.aegisBonusDamage > 0 && <small className="sim-aegis-bonus">{hullLabel('NULLIFIER')} · {t('simulator.bonus')} −{number(frame.aegisBonusDamage)}</small>}
        {simulation.recording.initialAegis > 0 && frame.aegis === 0 && <strong>{t('simulator.aegisBroken')}</strong>}
      </div>}
      {simulation.defenceOffline && <p className="sim-offline">{t('simulator.offlineDetail')}</p>}
      <div className="sim-camera-tools"><select aria-label={t('simulator.selected')} value={selected ?? ''} onChange={event => { inspect(event.currentTarget.value || null, true); }}><option value="">{t('simulator.chooseUnit')}</option>
        {simulation.recording.ships.map(ship => <option key={ship.id} value={ship.id}>{hullLabel(ship.hull)} #{ship.id} · {t(ownership(ship) === 'YOU' ? 'simulator.yourFleet' : ownership(ship) === 'ALLY' ? 'simulator.alliedFleet' : ship.side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')}</option>)}</select>
        <button type="button" onClick={() => { camera('FIT'); }}>{t('simulator.overview')}</button>
        <button type="button" aria-label={t('simulator.zoomIn')} onClick={() => { camera('IN'); }}>+</button>
        <button type="button" aria-label={t('simulator.zoomOut')} onClick={() => { camera('OUT'); }}>−</button></div>
      <div className="sim-stage-bottom"><small>{t('simulator.stageHelp')}</small><span className="sim-side-legend"><i className="is-self">◆</i> {t('simulator.viewing', { side: t(viewer === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender') })}</span></div>
      {(frame.phase === 'AFTERMATH' || frame.finished && (simulation.recording.aftermath?.length ?? 0) > 0) && <p className="sim-aftermath-note">{t(simulation.recording.aftermath?.[0]?.kind === 'PIRATE_OVERRUN' ? 'simulator.pirateOverrun' : 'simulator.cargoWithdrawal')}</p>}
      <RetreatRoster frame={frame} ships={ships} viewer={viewer} ownership={ownership} wingNumber={ship => simulation.owners.find(owner => owner.side === ship.side && owner.stackId === ship.stackId)?.wing ?? 1}
        onInspect={id => { inspect(id, true); }} />
      {selectedShip && <UnitInspector ship={selectedShip} frame={frame} simulation={simulation} ownership={ownership(selectedShip)} onClose={() => { setSelected(null); }}
        onFocus={() => { camera('FOCUS', selectedShip.id); }} onReplayRetreat={at => { seek(at); camera('FOCUS', selectedShip.id); }} />}
    </div>
    <div className="sim-playback">
      <div className="sim-time-row"><span><small>{t('simulator.playbackTime')}</small>{time.toFixed(1)}s</span><input aria-label={t('simulator.timeline')} type="range" min={0} max={timeline.duration} step={.01} value={time} onChange={event => { seek(Number(event.currentTarget.value)); }} /><span>{timeline.duration.toFixed(1)}s</span></div>
      <div className="sim-transport">
        <button type="button" aria-label={t('simulator.restart')} onClick={() => { seek(0); }}>↺</button>
        <button type="button" aria-label={t('simulator.previous')} onClick={() => { step(-1); }}>‹</button>
        <button type="button" className="sim-play" disabled={stageState !== 'ready' || suspended} aria-label={t(playing ? 'simulator.pause' : 'simulator.play')} onClick={() => {
          if (clock.current.time >= timeline.duration) clock.current.time = 0;
          clock.current.playing = !clock.current.playing; setPlaying(clock.current.playing); setTime(clock.current.time);
        }}>{playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" aria-label={t('simulator.next')} onClick={() => { step(1); }}>›</button>
        <select aria-label={t('simulator.speed')} value={speed} onChange={event => { const value = Number(event.currentTarget.value); clock.current.speed = value; setSpeed(value); }}>{[.25, .5, 1, 2, 4, 8, 16].map(value => <option key={value} value={value}>{value}×</option>)}</select>
        <button type="button" aria-label={t('simulator.swapView')} title={t('simulator.swapView')} onClick={() => { setViewer(value => value === 'ATTACK' ? 'DEFENCE' : 'ATTACK'); }}>⇅</button>
        <button ref={logOpener} type="button" className="sim-log-toggle" aria-label={t('simulator.shotLog')} aria-expanded={logOpen} aria-controls="sim-shot-log" onClick={() => { if (!logOpen) suspend(); setLogOpen(value => !value); }}>{t('simulator.logToggle')}</button>
      </div>
      <div className="sim-playback-note"><details onToggle={event => { if (event.currentTarget.open) suspend(); }}><summary>{t('simulator.simultaneous')}</summary><div className="sim-guide-copy"><p>{t('simulator.playbackHelp')}</p><p>{t('simulator.aegisRole')}</p><p>{t('simulator.cameraHelp')}</p></div></details>
        <button type="button" onClick={() => { seek(timeline.rounds.find(round => round.round === frame.round)?.retreatAt ?? timeline.duration); }}>{t('simulator.endRound')}</button></div>
      <div className="sim-round-tabs">{simulation.recording.rounds.map(round => <button type="button" key={round.round} aria-pressed={frame.round === round.round}
        onClick={() => { seek(timeline.rounds[round.round - 1]!.start); }}>{t('simulator.round', { number: round.round, total: simulation.recording.roundLimit })}</button>)}</div>
      {simulation.escape && <p className="sim-result">{simulation.escape.kind === 'ESCAPED' ? t('simulator.escapedBefore', { number: fleetCount(simulation.escape.ships) }) : t('simulator.stranded')}</p>}
      {frame.finished && <p className="sim-result">{mutualDestruction
        ? t('simulator.mutualDestruction') : ownFleetDestroyed
        ? t('simulator.fleetDestroyed') : simulation.control
        ? t(monumentControlKey({ attacking: readerSide === 'ATTACK', control: simulation.control }))
        : t(`reports.verdict.title.${readerSide === 'ATTACK' ? 'attacking' : 'defending'}.${simulation.result.grade}`)}</p>}
      {frame.finished && personalFleetDestroyed && !ownFleetDestroyed && !mutualDestruction && <p className="sim-result sim-personal-loss">{t('simulator.fleetDestroyed')}</p>}
      {frame.finished && simulation.control && (mutualDestruction || ownFleetDestroyed) && <p className="sim-result">{t(monumentControlKey({ attacking: readerSide === 'ATTACK', control: simulation.control }))}</p>}
      {frame.finished && fleetCount(simulation.result.defenceSalvage) > 0 && <p className="sim-caption">{t('simulator.salvage')}: {fleetEntries(simulation.result.defenceSalvage).map(([hull, count]) => `${count} ${hullLabel(hull)}`).join(', ')}</p>}
    </div>
    <aside ref={logPanel} role={logOpen ? 'dialog' : undefined} aria-modal={logOpen ? true : undefined} data-sheet-panel={logOpen ? '' : undefined} id="sim-shot-log" aria-label={t('simulator.shotLog')} className={`sim-log ${logOpen ? 'is-open' : ''}`}>
      <div className="sim-log-heading"><h2>{t('simulator.shotLog')}</h2><small>{t('simulator.hullDamage')}</small><button ref={logCloser} className="sim-log-toggle" type="button" aria-label={t('simulator.closeLog')} onClick={closeLog}>×</button></div>
      <div className="sim-log-scroll">
      <div className="sim-log-sides">{(['ATTACK', 'DEFENCE'] as const).map(side => <button type="button" key={side} aria-pressed={side === logSide} onClick={() => { setLogSide(side); }}>{t(side === 'ATTACK' ? 'simulator.attacker' : 'simulator.defender')}</button>)}</div>
      {logSide === 'ATTACK' && openingStrikes.filter(event => event.round === Math.max(1, frame.round)).map(event => <button type="button" className="sim-opening-shot" key={`opening:${event.strike.sourceId}`} aria-label={t('simulator.showOpening', { name: event.strike.sourceId })} onClick={() => { seek(event.at); }}>
        <span>{hullLabel('NULLIFIER')} #{event.strike.sourceId}<small>{t('simulator.aegisOpening')}</small></span><b>{time >= event.at ? number(event.strike.damage) : '—'}</b>
      </button>)}
      <div className="sim-shot-list">{logShots.length === 0 ? <p className="sim-caption">{t('simulator.empty')}</p> : logShots.map(event => {
        const source = ships.get(event.shot.sourceId)!;
        const completed = time >= event.impactEnd, upcoming = time < event.at;
        return <button type="button" key={event.shot.sourceId} data-shot-state={completed ? 'completed' : upcoming ? 'upcoming' : 'firing'} aria-label={t('simulator.showShot', { number: event.shot.order })} className={shownShot === event ? 'is-selected' : ''} onClick={() => {
          seek(event.impactEnd);
        }}><img src={HULL_ART[source.hull] ?? undefined} alt="" /><span><strong>{hullLabel(source.hull)} <small>#{source.id}</small></strong><small>{t('simulator.shot', { number: event.shot.order, name: t(upcoming ? 'simulator.upcoming' : completed ? 'simulator.completed' : 'simulator.firing') })}</small></span><b title={t('simulator.hullDamage')}>{completed ? number(event.shot.hits.reduce((sum, hit) => sum + hit.hullDamage, 0)) : '—'}</b></button>;
      })}</div>
      {frame.activeAegisStrike && <div className="sim-shot-detail"><h3>{t('simulator.aegisOpening')}</h3>
        <p>{t('simulator.shieldOnly')}</p><p>{t('simulator.baseAttack')}: <b>{number(ships.get(frame.activeAegisStrike.strike.sourceId)!.attack)}</b> × {t('simulator.roundRoll')} {number(currentRound?.attackerRoll ?? 1)} = {number(frame.activeAegisStrike.strike.baseDamage)}</p>
        <p>{t('simulator.openingClassWeight')}: <b>{number(frame.activeAegisStrike.strike.classMultiplier)}</b></p>
        <p>{t('simulator.bonus')}: {number(frame.activeAegisStrike.strike.baseDamage)} × {number(frame.activeAegisStrike.strike.classMultiplier)} × {number(frame.activeAegisStrike.strike.bonusMultiplier)}</p>
        <details><summary>{t('simulator.openingCalculation')}</summary><p>{t('simulator.openingRule')}</p></details>
        <p>Aegis: {number(frame.activeAegisStrike.strike.aegisBefore)} → {time >= frame.activeAegisStrike.at ? number(frame.activeAegisStrike.strike.aegisAfter) : '—'}</p>
      </div>}
      {shownShot && <div className="sim-shot-detail"><h3>{hullLabel(ships.get(shownShot.shot.sourceId)!.hull)} <small>#{shownShot.shot.sourceId}</small></h3>
        <p>{t('simulator.baseAttack')}: <b>{number(ships.get(shownShot.shot.sourceId)!.attack)}</b> × {t('simulator.roundRoll')} <b>{number(shownShot.side === 'ATTACK' ? currentRound?.attackerRoll ?? 1 : currentRound?.defenderRoll ?? 1)}</b></p>
        <p>{t('simulator.rolledAttack')}: <b>{number(shownShot.shot.baseDamage)}</b></p>
        <p>{t('simulator.targetPriority')}</p>
        <table aria-label={t('simulator.damageDistribution')}><thead><tr><th>{t('simulator.target')}</th><th title={t('simulator.aegis')}>Aegis</th><th title={t('simulator.shieldDamage')}>{t('simulator.shield')}</th><th title={t('simulator.hullDamage')}>{t('simulator.hull')}</th></tr></thead>
          <tbody>{shownShot.shot.hits.map((hit, i) => {
            const happened = time >= (hitTimes.get(hit) ?? Infinity);
            return <tr key={i} data-hit-state={happened ? 'completed' : 'upcoming'}><td title={happened ? `${t('simulator.damageBeforeAfter', { before: number(hit.hpBefore), after: number(hit.hpAfter) })}; ${t('simulator.shieldBeforeAfter', { before: number(hit.shieldBefore), after: number(hit.shieldAfter) })}` : t('simulator.upcoming')}><button type="button" onClick={() => { closeLog(); inspect(hit.targetId, true); }}>{hullLabel(ships.get(hit.targetId)!.hull)} <small>#{hit.targetId} · {combatClassLabel(ships.get(hit.targetId)!.cls ?? HULLS[ships.get(hit.targetId)!.hull].cls)} ×{hit.counter}</small></button></td>
              <td>{happened ? number(hit.normalAegisDamage + hit.bonusAegisDamage) : '—'}</td><td>{happened ? number(hit.shieldDamage) : '—'}</td><td>{happened ? number(hit.hullDamage) : '—'}</td></tr>;
          })}</tbody></table>
        <p>{t('simulator.normalAegis')}: <b>{time >= shownShot.impactEnd ? number(shownShot.shot.hits.reduce((sum, hit) => sum + hit.normalAegisDamage, 0)) : '—'}</b></p>
        <p>{t('simulator.bonus')}: <b>{time >= shownShot.impactEnd ? number(shownShot.shot.hits.reduce((sum, hit) => sum + hit.bonusAegisDamage, 0)) : '—'}</b></p>
        <p>{t('simulator.unused')}: <b>{time >= shownShot.impactEnd ? number(shownShot.shot.unusedBaseDamage) : '—'}</b></p>
      </div>}
      </div>
    </aside>
  </div>;
}
