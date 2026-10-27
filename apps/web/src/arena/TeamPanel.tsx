import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TACTICS, type ArenaResources, type Tactic, type TeamView } from '@astera/rules/arena';
import i18n from '../i18n/index.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { Button, SectionHead } from '../v2/kit/Surface.js';
import { Icon } from '../v2/icons.js';
import { arenaCopy } from './copy.js';
import { amount } from './hangarDesk.js';
import { askTeam, type TeamAction } from './teamDesk.js';
import { teamCopy } from './teamCopy.js';

/** No global cache: an account switch cannot inherit another commander's team or claims. */
export function useTeamDesk(credential: () => Promise<string | null>) {
  const [source] = useState(() => credential);
  const [view, setView] = useState<TeamView | null>(null);
  const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [error, setError] = useState(''); const [note, setNote] = useState('');
  const [receipt, setReceipt] = useState<TeamView['receipt']>(); const [reload, setReload] = useState(0);
  const epoch = useRef(0); const mounted = useRef(false);
  useEffect(() => {
    let live = true; let inFlight = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const isLive = (): boolean => live;
    const controller = new AbortController(); mounted.current = true;
    const poll = async (): Promise<void> => {
      if (!live || inFlight) return;
      clearTimeout(timer);
      if (!document.hidden && !busyRef.current) {
        inFlight = true; const version = epoch.current;
        try {
          const token = await source();
          if (!isLive()) return;
          const answer = await askTeam(token, { kind: 'read' }, fetch, controller.signal);
          if (isLive() && epoch.current === version) {
            if (answer.ok) { setView(answer.view); setError(''); }
            else { setError(answer.error); if (answer.error === 'auth' || answer.error === 'denied') setView(null); }
          }
        } catch { if (isLive()) setError('TEAM_UNAVAILABLE'); }
        finally { inFlight = false; }
      }
      if (isLive()) timer = setTimeout(() => { void poll(); }, 2500);
    };
    const visible = (): void => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', visible); void poll();
    return () => { live = false; mounted.current = false; epoch.current++; controller.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [source, reload]);
  const act = async (action: TeamAction): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setNote(''); const version = ++epoch.current;
    try {
      const answer = await askTeam(await source(), action);
      if (mounted.current && version === epoch.current) {
        if (answer.ok) { setView(answer.view); setReceipt(answer.view.receipt); setError(''); return true; }
        else setNote(answer.error);
      }
      return false;
    } catch { if (mounted.current) setNote('TEAM_UNAVAILABLE'); return false; }
    finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  return { view, busy, error, note, receipt, act, refresh: () => { setReload(n => n + 1); } };
}

const KINDS = ['alloy', 'crystal', 'deuterium'] as const;
/** What of a share today's transfer limit would keep out (it is not deposited, owner rule). */
const over = (share: ArenaResources, left: ArenaResources): ArenaResources =>
  ({ alloy: Math.max(0, share.alloy - left.alloy), crystal: Math.max(0, share.crystal - left.crystal), deuterium: Math.max(0, share.deuterium - left.deuterium) });

/** Before the claim: the part that would be lost, and when waiting would land it all. */
function ClaimOverflow({ over: lost, resetsAt }: { over: ArenaResources; resetsAt: string }) {
  if (!KINDS.some(kind => lost[kind] > 0)) return null;
  const t = teamCopy();
  return <div data-claim-overflow="" className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-v2-warn/30 bg-v2-warn/5 px-2 py-1.5 text-micro">
    <span className="text-v2-warn">{t.overToday}</span><Loot value={lost} />
    <span className="basis-full text-v2-ink-3">{t.overWait(resetsAt)}</span>
  </div>;
}

function Loot({ value }: { value: ArenaResources }) {
  const c = arenaCopy();
  return <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-v2-mono text-caption tabular-nums">
    {KINDS.map((kind, i) => value[kind] > 0 && <span key={kind} className="flex items-center gap-1" title={c.kinds[i]}>
      <img alt={c.kinds[i]} src={RESOURCE_ART[kind]} className="size-3.5 object-contain" />+{amount(value[kind])}</span>)}
  </span>;
}

/** A compact clan flight manifest. Ship chores remain in the hangar. */
export default function TeamPanel({ credential, onEnter, claimsOnly = false, prepareOnly = false, onView, onClaim, room }: {
  credential: () => Promise<string | null>; onEnter?: (view: TeamView) => void; claimsOnly?: boolean; prepareOnly?: boolean;
  onView?: (view: TeamView) => void;
  onClaim?: () => void;
  /** What the capital can still take from the Yarık today (the hangar's), so a claim says before it lands what would not. */
  room?: { left: ArenaResources; resetsAt: string };
}) {
  const desk = useTeamDesk(credential); const c = arenaCopy(); const t = teamCopy();
  const errors: Readonly<Record<string, string>> = t.errors; const outcomes: Readonly<Record<string, string>> = t.outcomes;
  const { view, busy } = desk; const team = view?.team; const self = team?.members.find(m => m.playerId === view?.playerId);
  const leader = view?.playerId === team?.leaderId;
  const [choice, setChoice] = useState<Tactic | null>(null); const tactic = choice ?? self?.tactic ?? 'smoke';
  const was = useRef<string | null>(null); const enter = useRef(onEnter); enter.current = onEnter;
  useEffect(() => {
    if (view && !claimsOnly && was.current === 'forming' && team?.state === 'flying' && team.joined && !self?.outcome) enter.current?.(view);
    was.current = team?.state ?? null;
  }, [team?.state, team?.joined, self?.outcome, claimsOnly, view]);
  // Ready means "at the launch desk": leaving it (closing the panel, locking the phone) takes the
  // mark back, so the leader never launches a ship nobody connects within the 30 s window.
  const standing = useRef<{ teamId: string; tactic: Tactic } | null>(null); const token = useRef(credential); token.current = credential;
  standing.current = !claimsOnly && !prepareOnly && team?.state === 'forming' && self?.ready ? { teamId: team.id, tactic: self.tactic } : null;
  useEffect(() => {
    const stand = (): void => {
      const mark = standing.current; if (!mark) return; standing.current = null;
      void token.current().then(auth => askTeam(auth, { kind: 'ready', teamId: mark.teamId, ready: false, tactic: mark.tactic },
        (url, init) => fetch(url, { ...init, keepalive: true })));
    };
    const hide = (): void => { if (document.hidden) stand(); };
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); stand(); };
  }, []);
  // The parent hides its solo tactic picker before the team picker is painted.
  useLayoutEffect(() => { if (view) onView?.(view); }, [view, onView]);
  const disabled = busy || desk.error !== '';
  const run = (action: TeamAction): void => { void desk.act(action).then(ok => { if (ok && action.kind === 'claim') onClaim?.(); }); };
  const date = (at: string): string => new Intl.DateTimeFormat(i18n.resolvedLanguage, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  if (claimsOnly && view?.claims.length === 0 && !desk.receipt) return null;
  return <section data-part="arena-team" className="flex flex-col gap-3 text-v2-ink">
    <SectionHead label={claimsOnly ? t.claims : t.title} icon={<Icon id="i-fleet" className="size-3" />}
      {...(team && !claimsOnly ? { aside: `${team.members.length}/${view.capacity}` } : {})} />
    {(desk.error || desk.note) && <p role="status" className="text-caption text-v2-warn">{errors[desk.note || desk.error] ?? errors.TEAM_UNAVAILABLE}
      {desk.error && <button type="button" className="ml-2 underline" onClick={desk.refresh}>{c.reconnect}</button>}</p>}
    {!view && !desk.error && <p className="text-caption text-v2-ink-3">{t.loading}</p>}
    {!claimsOnly && view && <>
      <p className="text-caption leading-relaxed text-v2-ink-2">{t.rule}</p>
      {!team ? view.canCreate ? <Button full disabled={disabled} onClick={() => { run({ kind: 'create' }); }}>{t.create}</Button>
        : <p className="text-caption text-v2-ink-3">{view.clanId ? t.needLeader : t.needClan}</p> : <>
        <ul className="divide-y divide-v2-line border-y border-v2-line">
          {team.members.map(m => <li key={m.playerId} className="flex items-center gap-2 py-2">
            <span className={`size-1.5 shrink-0 rounded-full ${m.ready ? 'bg-v2-self' : 'bg-v2-ink-3'}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-caption font-semibold">{m.name}{m.playerId === view.playerId && <small className="ml-1.5 font-normal text-v2-ink-3">{t.self}</small>}</p>
              <p className="flex flex-wrap gap-x-2 text-micro text-v2-ink-3">{m.ship && <><span>{c.classes[m.ship.class].name} · {c.level(m.ship.level)}</span>
                {team.state === 'forming' && <span>{c.fuel} {amount(m.ship.fuel)}/{amount(m.ship.fuelMax)}</span>}</>}
                <span className={m.blocked && team.state === 'forming' ? 'text-v2-warn' : m.ready ? 'text-v2-self' : ''}>
                  {team.state === 'flying' ? m.outcome ? outcomes[m.outcome] ?? t.waiting : t.flying : m.blocked ? errors[m.blocked] ?? t.waiting : m.ready ? t.readyState : t.waiting}</span>
                {team.state === 'forming' && m.blocked === 'SHIP_NOT_READY' && m.ship?.readyAt && <time dateTime={m.ship.readyAt}>{date(m.ship.readyAt)}</time>}
              </p>
            </div>
            {leader && team.state === 'forming' && m.playerId !== view.playerId && <button type="button" disabled={disabled} aria-label={t.remove(m.name)}
              className="grid size-8 shrink-0 place-items-center rounded-control text-v2-ink-3 disabled:opacity-35" onClick={() => { run({ kind: 'remove', teamId: team.id, playerId: m.playerId }); }}>×</button>}
          </li>)}
        </ul>
        {team.state === 'forming' ? team.joined ? <>
          {prepareOnly ? <Button full variant="primary" disabled={disabled} onClick={() => { onEnter?.(view); }}>{t.prepare}</Button> : <>
          <div role="radiogroup" aria-label={t.tactic} className="grid grid-cols-4 gap-1">
            {TACTICS.map(value => <button key={value} type="button" role="radio" aria-checked={tactic === value} disabled={disabled}
              className={`min-w-0 rounded-control border px-1 py-2 text-micro ${tactic === value ? 'border-v2-self/50 text-v2-self' : 'border-v2-line text-v2-ink-3'}`}
              onClick={() => { setChoice(value); if (self?.ready) run({ kind: 'ready', teamId: team.id, ready: false, tactic: value }); }}>{c[value]}</button>)}
          </div>
          <Button full disabled={disabled || (!self?.ready && self?.blocked !== null)} onClick={() => { run({ kind: 'ready', teamId: team.id, ready: !self?.ready, tactic }); }}>{self?.ready ? t.unready : t.ready}</Button>
          {self?.ready && <p className="text-center text-micro text-v2-ink-3">{t.stay}</p>}
          {leader && <Button full variant="primary" disabled={disabled || team.members.length === 0 || team.members.some(m => !m.ready)} onClick={() => { run({ kind: 'start', teamId: team.id }); }}>{t.start}</Button>}
          </>}
          <button type="button" disabled={disabled} className="self-center px-3 py-1 text-caption text-v2-ink-3" onClick={() => { run({ kind: 'leave', teamId: team.id }); }}>{leader ? t.cancel : t.leave}</button>
        </> : <Button full disabled={disabled || team.members.length >= view.capacity} onClick={() => { run({ kind: 'join', teamId: team.id }); }}>{t.join}</Button>
          : team.joined && onEnter && <Button full variant="primary" disabled={disabled} onClick={() => { onEnter(view); }}>{self?.outcome ? t.watch : t.enter}</Button>}
      </>}
      <details className="text-caption text-v2-ink-3"><summary className="cursor-pointer">{t.rules}</summary><p className="mt-2 leading-relaxed">{t.remainder} {t.cap} {t.auto}</p></details>
    </>}
    {view && view.claims.length > 0 && <div className="flex flex-col gap-2">
      {!claimsOnly && <SectionHead label={t.claims} />}
      {view.claims.map(claim => <div key={claim.teamId} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-v2-line pt-2">
        <div className="min-w-0 flex-1"><Loot value={claim.share} /><p className="mt-1 text-micro text-v2-ink-3">{t.autoAt(date(claim.autoAt))}</p></div>
        <Button disabled={disabled} onClick={() => { run({ kind: 'claim', teamId: claim.teamId }); }}>{t.claim}</Button>
        {room && <ClaimOverflow over={over(claim.share, room.left)} resetsAt={date(room.resetsAt)} />}
      </div>)}
      <p className="text-micro text-v2-ink-3">{t.cap}</p>
    </div>}
    {desk.receipt && <div role="status" className="flex flex-col gap-1 text-caption">
      <span className="text-v2-self">{t.delivered}</span><Loot value={desk.receipt.deposit} />
      {KINDS.some(k => (desk.receipt?.overflow[k] ?? 0) > 0) && <><span className="text-v2-warn">{t.overflow}</span><Loot value={desk.receipt.overflow} /></>}
    </div>}
  </section>;
}
