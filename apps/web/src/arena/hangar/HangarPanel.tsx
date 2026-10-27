import { Component, Suspense, lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { launchLoad, pointsLeft, remainingFlightSeconds, shipTuning, type LoadoutPlan, type ShipClass } from '@astera/rules/arena';
import { HoldButton } from '../../v2/kit/HoldButton.js';
import { Segmented } from '../../v2/kit/Segmented.js';
import { openReferenceSession } from '../access.js';
import { arenaCopy, type ArenaCopy } from '../copy.js';
import { blockLine, launchText, levelGains } from '../Hangar.js';
import { capLeft, fetchHangar, launchBlock, pickShip, repairShip, setLoadout, spendAbility, stillFlying, upgradeShip, type Hangar, type HangarAnswer } from '../hangarDesk.js';
import { AbilitiesBlock, CapBlock, ClassBlock, DeskNote, GrowthBlock, LevelBlock, LoadoutBlock, RepairBlock, RulesBlock, ShipStatus, shipTone } from './ShipDesk.js';
import { SIGNATURE_ICONS } from '../Controls.js';
import { roomyRenderer } from '../assets/memory.js';
import './hangar.css';

/** The 3D bay is its own chunk: the panel and its numbers are up before the models arrive. */
const HangarStage = lazy(() => import('./HangarStage.js'));
const TeamClaims = lazy(() => import('../TeamPanel.js'));

/** The bay is decoration: if it throws, the desk stays and the ship stands flat (S22 B2/B3, F6). */
class BayBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  override render(): ReactNode { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * The ship without the live bay: a still of it standing in the bay (rendered from the bay itself),
 * or, if even that cannot load, its class mark in its own colour on the pad's light.
 */
function FlatShip({ ship }: { ship: ShipClass }) {
  const [still, setStill] = useState(true);
  return <div data-part="stage-fallback" data-ship={ship} className="hp-flat" aria-hidden>
    {still ? <img key={ship} className="hp-still" src={`/assets/arena/hangar/${ship}.webp`} alt="" decoding="async" onError={() => { setStill(false); }} />
      : <><i className="hp-flat-pad" /><i className="hp-flat-mark hp-glyph">{SIGNATURE_ICONS[ship]}</i></>}
  </div>;
}

const left = (ms: number, c: ArenaCopy): string => ms >= 3_600_000 ? `${String(Math.floor(ms / 3_600_000))} ${c.hours}` : `${String(Math.max(1, Math.ceil(ms / 60_000)))} ${c.minutes}`;

/**
 * The way into the Yarık from the hangar. A ship that may fly shows the flight's price; one that
 * cannot still opens the Yarık for practice, and says why the real flight waits.
 */
export function hangarCta(h: Hangar | null, now: number, c: ArenaCopy): { line: string; note: string | null; ready: boolean } {
  if (!h) return { line: c.enter(0), note: c.practiceOnly, ready: false };
  if (stillFlying(h)) return { line: c.resumeFlight, note: c.resumeNote, ready: true };
  const block = launchBlock(h, now);
  if (!block) return { ...launchText(h, now, c), ready: true };
  return { line: c.enter(0), note: `${blockLine(block, now, c)} · ${c.practiceOnly}`, ready: false };
}

/**
 * What the way in is worth (plan 14 §13): who flies the Yarık now, and how long the tank the
 * launch puts aboard lasts at full throttle — the shortest flight, so the estimate never overpromises.
 */
export function entryFacts(h: Hangar | null, c: ArenaCopy): string | null {
  if (!h?.ship) return null;
  const tuning = shipTuning(h.ship.class, h.ship.level);
  // The tank the launch puts aboard (owner 2026-10-27: a plan may be half a tank), not a full one.
  const fuel = launchLoad(h.ship.class, h.ship.level, h.ship.fuel, h.ship.ammo, h.ship.plan).fuel;
  const tank = c.fullThrottle(Math.floor(remainingFlightSeconds(fuel, 1, false, tuning) / 60));
  return h.live ? `${c.livePilots(h.live.pilots)} · ${tank}` : tank;
}

type Section = 'grow' | 'skills' | 'launch';

/**
 * THE HANGAR (owner 2026-10-23): the Komutan gemisi tab. Every ship chore is done here, around the
 * ship itself. Owner 2026-10-27 ("everything spread before the player"): the desk is three
 * sections, one at a time — the level as a goal and what it grows, the abilities, what the launch
 * puts aboard — with a repair band above them when it can be shortened. Comparing or changing the
 * class takes the desk over until the pilot goes back. Every spend is a hold (ui-v2 rule 4).
 *
 * `onSpent`: the capital's stock changed here (a level, a repair, a team share), so the page reads
 * it again at once rather than on its next poll (F17).
 */
export function HangarPanel({ credential, onEnter, onSpent }: { credential: () => Promise<string | null>; onEnter: () => void; onSpent?: () => void }) {
  const c = arenaCopy();
  // The parent hands a fresh closure each render; the hangar is read once per opening.
  const [ask] = useState(() => credential);
  const [desk, setDesk] = useState<HangarAnswer | null>(null);
  const [preview, setPreview] = useState<ShipClass>('kilavuz');
  const [pending, setPending] = useState<ShipClass | null>(null);
  const [classes, setClasses] = useState(false);
  const [section, setSection] = useState<Section>('grow');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [pulse, setPulse] = useState(0);
  // The level just bought, shown with what it gave for a moment (F17).
  const [risen, setRisen] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  // The class ships live in the Yarık's pack; outside development a seated pilot opens it first.
  const [refs, setRefs] = useState<boolean>(import.meta.env.DEV);
  // A 32-bit renderer never builds the bay (S22: the galaxy beside it left no room); a GPU that
  // took the bay's context back stands the ship flat for the rest of this visit.
  const [flat, setFlat] = useState(() => !roomyRenderer());
  const lost = useCallback(() => { setFlat(true); }, []);

  useEffect(() => {
    const run = { live: true };
    const live = (): boolean => run.live;
    void ask().then(async token => {
      const answer = await fetchHangar(token);
      if (!run.live) return;
      setDesk(answer); setNow(Date.now());
      if (!import.meta.env.DEV && await openReferenceSession(token) && live()) setRefs(true);
    });
    return () => { run.live = false; };
  }, [ask]);
  useEffect(() => {
    const id = setInterval(() => { setNow(Date.now()); }, 1000);
    return () => { clearInterval(id); };
  }, []);
  // CR8: the day's transfer cap resets at UTC midnight; an open hangar reads the new day then.
  const resetsAt = desk?.ok ? desk.hangar.resetsAt : null;
  useEffect(() => {
    const wait = resetsAt === null ? -1 : Date.parse(resetsAt) - Date.now();
    if (wait < 0) return;
    const run = { live: true };
    const id = setTimeout(() => { void ask().then(fetchHangar).then(answer => { if (run.live && answer.ok) setDesk(answer); }); }, wait + 1000);
    return () => { run.live = false; clearTimeout(id); };
  }, [resetsAt, ask]);
  useEffect(() => {
    if (risen === null) return;
    const id = setTimeout(() => { setRisen(null); }, 3200);
    return () => { clearTimeout(id); };
  }, [risen]);

  const hangar = desk?.ok ? desk.hangar : null;
  const owned = hangar?.ship ?? null;
  const changeUntil = owned?.changeUntil ? Date.parse(owned.changeUntil) : 0;
  // The free change lasts its window; after it the classes can still be compared, never taken.
  const open = owned !== null && changeUntil > now;
  const looking = owned !== null && classes;
  const shown = owned ? (looking ? pending ?? owned.class : owned.class) : preview;
  // F7: a class tried on is not the ship that flies; a change is on offer only while the window lasts.
  const change = looking && open && pending !== null ? pending : null;
  const trying = owned !== null && shown !== owned.class;
  const pick = (next: ShipClass): void => {
    if (!owned) setPreview(next); else setPending(next === owned.class ? null : next);
  };
  const back = (): void => { setPending(null); setClasses(false); };
  const act = (call: (token: string | null) => Promise<HangarAnswer>, done?: () => void, spends = true): void => {
    if (busy) return;
    setBusy(true); setNote('');
    void ask().then(call).then(answer => {
      if (answer.ok) { setDesk(answer); back(); done?.(); if (spends) onSpent?.(); } else setNote(c.kicks[answer.error] ?? c.hangarError);
      setBusy(false);
    });
  };
  const cta = hangarCta(hangar, now, c);
  const facts = entryFacts(hangar, c);
  const choosing = hangar !== null && owned === null && hangar.core >= hangar.minCore;
  const points = owned ? pointsLeft(owned.level, owned.abilities) : 0;
  const classBlock = <ClassBlock c={c} value={shown} level={owned?.level ?? 1} points={owned?.class === shown ? owned.abilities : {}} onPick={pick}
    {...(open ? { aside: c.changeLeft(left(changeUntil - now, c)) } : {})}>
    {change && <p className="text-caption leading-relaxed text-v2-ink-2">{c.changeNote}</p>}
  </ClassBlock>;
  const holding = busy ? c.hangarBusy : null;
  return <div className="hangar-root" data-ship={shown} style={shipTone(shown)}>
    <div className="hp-stage">
      {flat ? <FlatShip ship={shown} /> : <BayBoundary fallback={<FlatShip ship={shown} />}>
        <Suspense fallback={<p className="hp-wait">{c.hangarLoading}</p>}>
          <HangarStage ship={shown} pulse={pulse} refs={refs} onLost={lost} />
        </Suspense>
      </BayBoundary>}
      <div className="hp-plate">
        <small>{c.classes[shown].role}</small>
        <p><b>{c.classes[shown].name}</b>{trying ? <em className="is-preview">{c.preview}</em> : owned && <em key={owned.level}>{c.level(owned.level)}</em>}</p>
      </div>
      {hangar && owned && !trying && <div className="hp-state"><ShipStatus c={c} hangar={hangar} now={now} /></div>}
      <p className="hp-drag" aria-hidden>{c.hangarDrag}</p>
      {risen !== null && <div key={risen} data-part="level-up" className="hp-levelup" role="status">
        <b>{c.levelUp(risen)}</b>
        <span>{levelGains(shown, risen - 1, c).map(gain => <i key={gain.key}>{gain.name} <em>{gain.text}</em></i>)}</span>
      </div>}
    </div>
    <div className="hp-desk">
      {!desk ? <p className="hp-loading" aria-busy>{c.hangarTitle} …</p>
        : !desk.ok ? <DeskNote>{c.kicks[desk.error] ?? c.hangarError}</DeskNote>
        : desk.hangar.core < desk.hangar.minCore ? <div className="hp-lead"><b className="is-gap">{c.coreLine(desk.hangar.core, desk.hangar.minCore)}</b><span>{c.coreHint}</span></div>
        : !owned && <div className="hp-lead"><b>{c.chooseTitle}</b><span>{c.chooseNote}</span></div>}
      {note && <DeskNote>{note}</DeskNote>}
      {desk && <Suspense fallback={null}><TeamClaims credential={ask} claimsOnly onClaim={() => { act(token => fetchHangar(token)); }}
        {...(hangar ? { room: { left: capLeft(hangar), resetsAt: hangar.resetsAt } } : {})} /></Suspense>}
      {hangar && owned && !looking ? <>
        <RepairBlock c={c} hangar={hangar} now={now} busy={busy} onRepair={() => { act(token => repairShip(token)); }} />
        <Segmented label={c.deskTabs} value={section} onChange={setSection} options={[
          { id: 'grow', label: c.tabGrow },
          { id: 'skills', label: c.tabSkills, dot: points > 0, dotLabel: c.pointsReady(points) },
          { id: 'launch', label: c.tabLaunch },
        ]} />
        {section === 'grow' && <>
          <LevelBlock c={c} hangar={hangar} busy={busy} onUpgrade={() => { act(token => upgradeShip(token), () => { setPulse(n => n + 1); setRisen(owned.level + 1); }); }} />
          <GrowthBlock c={c} ship={owned.class} level={owned.level} />
          <button type="button" data-part="class-row" onClick={() => { setClasses(true); }}
            className="hp-card flex items-center gap-3 text-left">
            <i aria-hidden className="hp-sig-icon hp-glyph grid size-8 shrink-0 place-items-center rounded-control">{SIGNATURE_ICONS[owned.class]}</i>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-caption font-semibold text-v2-ink">{open ? c.changeClass : c.compareClasses}</b>
              {open && <small className="font-v2-mono text-micro text-v2-ink-3">{c.changeLeft(left(changeUntil - now, c))}</small>}
            </span>
            <svg viewBox="0 0 20 20" aria-hidden className="size-4 shrink-0 fill-none stroke-v2-ink-3 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.8]"><path d="M8 5l5 5-5 5" /></svg>
          </button>
        </>}
        {section === 'skills' && <AbilitiesBlock c={c} hangar={hangar} busy={busy} onSpend={ability => { act(token => spendAbility(token, ability)); }} />}
        {section === 'launch' && <>
          <LoadoutBlock c={c} hangar={hangar} busy={busy} onPlan={(plan: LoadoutPlan) => { act(token => setLoadout(token, plan), undefined, false); }} />
          <CapBlock c={c} hangar={hangar} />
          <RulesBlock c={c} />
        </>}
      </> : classBlock}
    </div>
    <div className="hp-dock">
      {/* Before the first choice, choosing is the one thing to do; while classes are open, going back or the change. A season's class is held, never tapped (B4). */}
      {choosing ? <HoldButton marker="hp-choose" label={c.choose(c.classes[shown].name)} disabledReason={holding} onCommit={() => { act(token => pickShip(token, shown)); }} />
        : change ? <div className="grid gap-1.5">
          <HoldButton marker="hp-change" label={c.changeTo(c.classes[change].name)} disabledReason={holding} onCommit={() => { act(token => pickShip(token, change)); }} />
          <button type="button" className="min-h-8 text-caption text-v2-ink-2" onClick={back}>{c.cancelPreview}</button>
        </div>
        : looking ? <button type="button" className="hp-go is-back" onClick={back}><span className="text-body font-semibold">{c.backToShip}</span></button>
        : <>{facts && <p data-part="entry-facts" className="hp-facts">
          <i aria-hidden className={hangar?.live?.pilots ? 'is-live' : ''} />{facts}</p>}
        <button type="button" data-testid="hangar-enter" onClick={onEnter} className={`hp-go ${cta.ready ? 'is-ready' : 'is-blocked'}`}>
          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left leading-tight">
            <span className="text-body font-semibold">{cta.line}</span>
            {cta.note && <small className="max-w-full truncate font-v2-mono text-micro tabular-nums">{cta.note}</small>}
          </span>
          <svg viewBox="0 0 20 20" aria-hidden className="size-5 shrink-0 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"><path d="M5 10h10M11 6l4 4-4 4" /></svg>
        </button></>}
    </div>
  </div>;
}
