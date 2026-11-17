import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type ArenaResources, type Tactic, type TeamView } from '@astera/rules/arena';
import i18n from '../i18n/index.js';
import { GameButton, Glyph, SectionTag } from '../game-ui/index.js';
import { RESOURCE_ART } from '../ui/assets.js';
import { RulesRow } from '../ui/RulesRow.js';
import { TacticPicker } from './ClassPicker.js';
import { arenaCopy } from './copy.js';
import { amount } from './hangarDesk.js';
import { askTeam, type TeamAction } from './teamDesk.js';
import { teamCopy } from './teamCopy.js';

type TeamMember = NonNullable<TeamView['team']>['members'][number];

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
  return <div data-claim-overflow="" className="gk-inote gk-squad__over" data-tone="warn">
    <Glyph id="warn" /><span>{t.overToday} <Loot value={lost} /></span>
    <span className="gk-squad__wait">{t.overWait(resetsAt)}</span>
  </div>;
}

function Loot({ value }: { value: ArenaResources }) {
  const c = arenaCopy();
  return <span className="gk-squad__loot gk-num">
    {KINDS.map((kind, i) => value[kind] > 0 && <span key={kind} title={c.kinds[i]}>
      <img alt={c.kinds[i]} src={RESOURCE_ART[kind]} />+{amount(value[kind])}</span>)}
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
  const [choice2, setChoice2] = useState<Tactic | null>(null);
  const tactic2 = choice2 ?? self?.tactic2 ?? (tactic === 'cloak' ? 'smoke' : 'cloak');
  const was = useRef<string | null>(null); const enter = useRef(onEnter); enter.current = onEnter;
  useEffect(() => {
    if (view && !claimsOnly && was.current === 'forming' && team?.state === 'flying' && team.joined && !self?.outcome) enter.current?.(view);
    was.current = team?.state ?? null;
  }, [team?.state, team?.joined, self?.outcome, claimsOnly, view]);
  // Ready means "at the launch desk": leaving it (closing the panel, locking the phone) takes the
  // mark back, so the leader never launches a ship nobody connects within the 30 s window.
  const standing = useRef<{ teamId: string; tactic: Tactic; tactic2: Tactic | null } | null>(null); const token = useRef(credential); token.current = credential;
  standing.current = !claimsOnly && !prepareOnly && team?.state === 'forming' && self?.ready ? { teamId: team.id, tactic: self.tactic, tactic2: self.tactic2 ?? null } : null;
  useEffect(() => {
    const stand = (): void => {
      const mark = standing.current; if (!mark) return; standing.current = null;
      void token.current().then(auth => askTeam(auth, { kind: 'ready', teamId: mark.teamId, ready: false, tactic: mark.tactic, tactic2: mark.tactic2 },
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
  const stateOf = (m: TeamMember): { text: string; tone?: 'self' | 'warn' } => team?.state === 'flying'
    ? { text: m.outcome ? outcomes[m.outcome] ?? t.waiting : t.flying }
    : m.blocked ? { text: errors[m.blocked] ?? t.waiting, tone: 'warn' } : m.ready ? { text: t.readyState, tone: 'self' } : { text: t.waiting };
  return <section data-part="arena-team" className="gk gk-squad">
    <SectionTag as="h3" {...(team && !claimsOnly ? { aside: `${String(team.members.length)}/${String(view.capacity)}` } : {})}>{claimsOnly ? t.claims : t.title}</SectionTag>
    {(desk.error || desk.note) && <p role="status" className="gk-inote" data-tone="warn"><Glyph id="warn" /><span>{errors[desk.note || desk.error] ?? errors.TEAM_UNAVAILABLE}</span>
      {desk.error && <GameButton size="sm" glyph="refresh" onPress={desk.refresh}>{c.reconnect}</GameButton>}</p>}
    {!view && !desk.error && <p className="gk-sub" aria-busy>{t.loading}</p>}
    {!claimsOnly && view && <>
      <p className="gk-sub">{t.rule}</p>
      {!team ? view.canCreate ? <GameButton tone="action" wide glyph="support" pending={busy} disabledReason={desk.error ? errors.TEAM_UNAVAILABLE : null}
        onPress={() => { run({ kind: 'create' }); }}>{t.create}</GameButton>
        : <p className="gk-inote"><Glyph id="support" /><span>{view.clanId ? t.needLeader : t.needClan}</span></p> : <>
        <ol className="gk-well gk-crewlist gk-squad__crew">
          {team.members.map(m => {
            const state = stateOf(m);
            return <li key={m.playerId} className="gk-crewlist__row">
              <span className="gk-crewlist__lamp" data-on={m.ready ? 'true' : 'false'} aria-hidden />
              <span className="gk-crewlist__who">
                <span className="gk-crewlist__name"><strong>{m.name}</strong>
                  {m.playerId === view.playerId && <span className="gk-chip gk-crewlist__chip" data-tone="self">{t.self}</span>}
                  <span className="gk-chip gk-crewlist__chip" data-state="" {...(state.tone ? { 'data-tone': state.tone } : {})}>{state.text}</span>
                </span>
                <span className="gk-sub gk-num">{m.ship && <>{c.classes[m.ship.class].name} · {c.level(m.ship.level)}
                  {team.state === 'forming' && <> · <span className="gk-squad__fuel">{c.fuel} {amount(m.ship.fuel)}/{amount(m.ship.fuelMax)}</span></>}</>}
                  {team.state === 'forming' && m.blocked === 'SHIP_NOT_READY' && m.ship?.readyAt && <> · <time dateTime={m.ship.readyAt}>{date(m.ship.readyAt)}</time></>}
                </span>
              </span>
              {leader && team.state === 'forming' && m.playerId !== view.playerId && <span className="gk-crewlist__acts">
                <GameButton size="sm" glyph="close" spoken={t.remove(m.name)} pending={busy} onPress={() => { run({ kind: 'remove', teamId: team.id, playerId: m.playerId }); }}>{t.removeShort}</GameButton>
              </span>}
            </li>;
          })}
        </ol>
        {team.state === 'forming' ? team.joined ? <>
          {prepareOnly ? <GameButton tone="action" wide glyph="rocket" pending={busy} onPress={() => { onEnter?.(view); }}>{t.prepare}</GameButton> : <>
          <fieldset disabled={disabled} className="gk-squad__tactics">
            <TacticPicker c={c} value={tactic} value2={tactic2} ship={self?.ship?.class} points={self?.ship?.abilities} onPick={(first, second) => {
              setChoice(first); setChoice2(second);
              if (self?.ready) run({ kind: 'ready', teamId: team.id, ready: false, tactic: first, tactic2: second });
            }} />
          </fieldset>
          <GameButton wide glyph={self?.ready ? 'close' : 'check'} pending={busy}
            disabledReason={!self?.ready && self?.blocked ? errors[self.blocked] ?? t.waiting : null}
            onPress={() => { run({ kind: 'ready', teamId: team.id, ready: !self?.ready, tactic, tactic2 }); }}>{self?.ready ? t.unready : t.ready}</GameButton>
          {self?.ready && <p className="gk-inote" data-tone="self"><Glyph id="clock" /><span>{t.stay}</span></p>}
          {leader && <GameButton tone="action" wide glyph="rocket" heavy pending={busy}
            disabledReason={team.members.some(m => !m.ready) ? t.startWait : null}
            onPress={() => { run({ kind: 'start', teamId: team.id }); }}>{t.start}</GameButton>}
          </>}
          <GameButton size="sm" className="gk-squad__leave" pending={busy} onPress={() => { run({ kind: 'leave', teamId: team.id }); }}>{leader ? t.cancel : t.leave}</GameButton>
        </> : <GameButton wide glyph="support" pending={busy} disabledReason={team.members.length >= view.capacity ? errors.TEAM_FULL ?? null : null}
          onPress={() => { run({ kind: 'join', teamId: team.id }); }}>{t.join}</GameButton>
          : team.joined && onEnter && <GameButton tone="action" wide glyph={self?.outcome ? 'eye' : 'rocket'} pending={busy} onPress={() => { onEnter(view); }}>{self?.outcome ? t.watch : t.enter}</GameButton>}
      </>}
      <RulesRow glyph="help" title={t.rules}><p className="gk-note">{t.remainder} {t.cap} {t.auto}</p></RulesRow>
    </>}
    {view && view.claims.length > 0 && <div className="gk-squad__claims">
      {!claimsOnly && <SectionTag as="h3">{t.claims}</SectionTag>}
      {view.claims.map(claim => <div key={claim.teamId} className="gk-well gk-squad__claim">
        <span className="gk-squad__share"><Loot value={claim.share} /><span className="gk-sub">{t.autoAt(date(claim.autoAt))}</span></span>
        <GameButton size="sm" tone="action" glyph="crate" pending={busy} onPress={() => { run({ kind: 'claim', teamId: claim.teamId }); }}>{t.claim}</GameButton>
        {room && <ClaimOverflow over={over(claim.share, room.left)} resetsAt={date(room.resetsAt)} />}
      </div>)}
      <p className="gk-note">{t.cap}</p>
    </div>}
    {desk.receipt && <div role="status" className="gk-inote gk-squad__receipt" data-tone="self">
      <Glyph id="check" /><span>{t.delivered} <Loot value={desk.receipt.deposit} /></span>
      {KINDS.some(k => (desk.receipt?.overflow[k] ?? 0) > 0) && <span className="gk-squad__wait" data-tone="warn">{t.overflow} <Loot value={desk.receipt.overflow} /></span>}
    </div>}
  </section>;
}
