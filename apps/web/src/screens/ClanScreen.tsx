import { useCommunityPolicy } from '../api/communityPolicy.js';
import { CommunityPolicyGate } from './CommunityPolicy.js';
import { ClanTag } from '../ui/ClanTag.js';
import {
  CLAN,
  CLAN_TRANSFERABLE_HULLS,
  clanNameIsValid,
  clanTagIsValid,
  clanTagTier,
  clanTransferCargoCapacity,
  distance,
  fleetCount,
  missionFuel,
  type Fleet,
  type HullId,
  type Resources,
} from '@astera/rules';
import {
  useEffect,
  useRef,
  useState,
  lazy,
  Suspense,
  type SyntheticEvent,
} from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ATMOSPHERE } from '../ui/atmosphere.js';
import { AtmosphereImage } from '../ui/AtmosphereArt.js';
import {
  useClanActions,
  useClanAid,
  useClanDepot,
  useClanDirectory,
  useClanEvents,
  useClanHome,
  useClanLeaderboard,
  useClanProfile,
  useClanStrength,
  useClanWar,
  useGalaxy,
  useLeaderboard,
} from '../api/queries.js';
import type {
  ClanAid,
  ClanEvent,
  ClanHome,
  ClanMemberHome,
  ClanOutsideHome,
  ClanStrength,
  GalaxyView,
  Leaderboard,
} from '../api/schemas.js';
import type { ClanAidInput } from '../api/client.js';
import { describeError } from '../i18n/errors.js';
import { hullName } from '../i18n/names.js';
import { chatRelativeTime } from '../lib/chatTime.js';
import { serverNow } from '../lib/clock.js';
import { techOf } from '../lib/navigation.js';
import { launchFault } from '../lib/faults.js';
import { full, signed } from '../lib/format.js';
import { duration, minutesUntil, useNow } from '../lib/time.js';
import { useWorld } from '../api/world.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { SpendBar } from '../ui/SpendBar.js';
import { HULL_ART, RESOURCE_ART } from '../ui/assets.js';
import { HullMark } from '../ui/icons/hulls.js';
import { Cells, type Cell } from '../ui/ArmCard.js';
import { CostLine, GameButton, GameHold, GameTabs, Glyph, Picker, SectionTag, Slider, Toggle, type GlyphId } from '../game-ui/index.js';
import { RulesRow } from '../ui/RulesRow.js';
import { ClanIcon, CoreIcon } from '../ui/icons/index.js';
import { Unreachable, Waiting } from '../ui/kit/index.js';
import { Sheet } from '../v2/kit/Sheet.js';
import {
  Button,
  Chip,
  EmptyState,
  Note,
  Plate,
  PriceTag,
  Section,
} from '../v2/kit/Surface.js';
import { ClanWarPanel } from './ClanWarPanel.js';

type ClanTab = 'overview' | 'strength' | 'members' | 'aid' | 'war';
type Actions = ReturnType<typeof useClanActions>;
type Member = ClanMemberHome['members'][number];

const ZERO: Resources = { alloy: 0, crystal: 0, deuterium: 0 };

/**
 * Server booleans are snapshots; the timestamp is the authority. Re-render at
 * each pending boundary so a clan screen left open unlocks without a refetch.
 */
function useLiveClanHome(home: ClanHome | undefined): ClanHome | undefined {
  const [boundary, setBoundary] = useState(0);
  useEffect(() => {
    if (home?.state !== 'MEMBER') return;
    const now = serverNow();
    const nextAt = [home.clan.matureAt, ...home.members.map((member) => member.matureAt)]
      .map((at) => at.getTime())
      .filter((at) => at > now)
      .sort((left, right) => left - right)[0];
    if (nextAt === undefined) return;
    const timer = setTimeout(() => {
      setBoundary((current) => current + 1);
    }, Math.min(2_147_483_647, Math.max(0, nextAt - now + 25)));
    return () => { clearTimeout(timer); };
  }, [boundary, home]);

  if (home?.state !== 'MEMBER') return home;
  const now = serverNow();
  return {
    ...home,
    clan: { ...home.clan, mature: home.clan.matureAt.getTime() <= now },
    members: home.members.map((member) => ({
      ...member,
      mature: member.matureAt.getTime() <= now,
    })),
  };
}

/** One mobile-first surface: discovery outside, command console inside. */
const ArenaTeamPanel = lazy(() => import('../arena/TeamPanel.js'));

export function ClanScreen({ initialTab = 'overview', onOpenClanChat, arena }: {
  initialTab?: ClanTab;
  /** The war room's "Clan chat" (E9): chat, as its own page, on the clan channel. */
  onOpenClanChat?: () => void;
  arena?: { credential: () => Promise<string | null>; onEnter: () => void };
}) {
  const { t } = useTranslation();
  const home = useClanHome();
  const actions = useClanActions();
  const galaxy = useGalaxy();
  const [tab, setTab] = useState<ClanTab>(initialTab);
  const marked = useRef(false);
  const liveHome = useLiveClanHome(home.data);
  const member: ClanMemberHome | null = liveHome?.state === 'MEMBER' ? liveHome : null;

  const depot = useClanDepot(home.data !== undefined);
  const events = useClanEvents(member?.clan.mature === true && tab === 'overview');
  const standings = useClanLeaderboard(member !== null && tab === 'overview');
  const aid = useClanAid(member !== null && tab === 'aid');
  const strength = useClanStrength(member !== null && tab === 'strength');
  const war = useClanWar(member !== null && tab === 'war');
  const { worlds } = useWorld();
  const commanders = useLeaderboard(member !== null && tab === 'members');

  useEffect(() => {
    if (!home.data || marked.current) return;
    marked.current = true;
    actions.seen.mutate();
  }, [actions.seen, home.data]);

  if (home.isError) {
    return <Unreachable what={t('clan.surfaceName')} onRetry={() => { void home.refetch(); }} />;
  }
  if (!liveHome) return <Waiting>{t('clan.waiting')}</Waiting>;

  if (liveHome.state === 'OUTSIDE') {
    return (
      <ClanOutside
        home={liveHome}
        actions={actions}
        depot={depot.data?.resources ?? liveHome.depot}
      />
    );
  }

  /**
   * The same value as `member`, and the only one the console below may use.
   *
   * `member` is computed above the hooks because the `enabled` flags need it there,
   * and it is annotated nullable — so every surface under it was handed a
   * `ClanMemberHome | null` against a prop that takes `ClanMemberHome`, four type
   * errors that shipped in this branch. The discriminant is only settled once the
   * OUTSIDE branch has returned, so it is settled HERE rather than asserted.
   */
  const inside = liveHome;

  // The Base's two-storey bar: the mark over the short name; a reader hears the whole name.
  const tabs = [
    { id: 'overview' as const, label: t('clan.tabs.compact.overview'), spoken: t('clan.tabs.overview'), glyph: { id: 'home' as const } },
    { id: 'strength' as const, label: t('clan.tabs.compact.strength'), spoken: t('clan.tabs.strength'), glyph: { id: 'ranking' as const } },
    { id: 'members' as const, label: t('clan.tabs.compact.members'), spoken: t('clan.tabs.members'), glyph: { id: 'support' as const } },
    { id: 'aid' as const, label: t('clan.tabs.compact.aid'), spoken: t('clan.tabs.aid'), glyph: { id: 'share' as const } },
    { id: 'war' as const, label: t('clanWar.tab'), glyph: { id: 'attack' as const, tone: 'hostile' as const } },
  ];

  return (
    <div className="gk gk-clan">
      <ClanHeader home={inside} />
      {arena && tab === 'overview' && <div className="gk-clan__arena">
        <Suspense fallback={null}><ArenaTeamPanel credential={arena.credential} onEnter={arena.onEnter} prepareOnly /></Suspense>
      </div>}
      <div className="gk-clan__tabs">
        <GameTabs
          label={t('clan.tabs.label')}
          tabs={tabs}
          value={tab}
          onChange={setTab}
          ids={{ tab: (id) => `clan-tab-${id}`, panel: (id) => `clan-panel-${id}` }}
          stacked
        />
      </div>

      <div
        id={`clan-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`clan-tab-${tab}`}
        className="gk-clan__panel"
      >
        {tab === 'overview' ? (
          <ClanOverview
            home={inside}
            depot={depot}
            events={events}
            standings={standings}
            actions={actions}
          />
        ) : tab === 'strength' ? (
          <ClanStrengthPanel strength={strength} />
        ) : tab === 'members' ? (
          <ClanMembers
            home={inside}
            commanders={commanders.data?.ladder ?? []}
            selfPlayerId={commanders.data?.you?.playerId ?? galaxy.data?.you.playerId}
            actions={actions}
          />
        ) : tab === 'war' ? (
          war.isError ? <Unreachable what={t('clanWar.tab')} onRetry={() => { void war.refetch(); }} />
            : war.data ? <ClanWarPanel war={war.data} role={inside.clan.role}
              mature={inside.clan.mature} worlds={worlds}
              members={[...inside.members].sort((a, b) => a.slot - b.slot)
                .map((seat) => ({ playerId: seat.playerId, username: seat.username }))}
              selfPlayerId={galaxy.data?.you.playerId}
              {...(onOpenClanChat ? { onOpenClanChat } : {})} />
              : <Waiting>{t('clan.waiting')}</Waiting>
        ) : (
          <ClanAidPanel
            home={inside}
            presence={galaxy.data?.clanPresence}
            selfPlayerId={galaxy.data?.you.playerId}
            transfers={aid.data?.transfers ?? []}
            loading={aid.isPending}
            actions={actions}
          />
        )}
      </div>
    </div>
  );
}

function ClanHeader({ home }: { home: ClanMemberHome }) {
  const { t } = useTranslation();
  /*
    THE CLAN'S IDENTITY IN ONE CARD. D5: the tag as its badge in the allies' colour, the
    name, the role, the motto, and the two figures a member reads it for — how full the
    crew is and what the clan has won together.
  */
  return (
    <header data-testid="clan-head" className="gk-clan__head">
      <AtmosphereImage art={ATMOSPHERE.clan} />
      <span className="gk-clan__tag gk-num">{home.clan.tag}</span>
      <div className="gk-clan__who">
        <div className="gk-clan__name">
          <h3>{home.clan.name}</h3>
          {home.clan.role === 'LEADER' ? <span className="gk-chip gk-clan__role">{t('clan.leader')}</span> : null}
        </div>
        <p className="gk-sub">{home.clan.description || t('clan.noDescription')}</p>
        <dl className="gk-clan__facts">
          <div><dt>{t('clan.membersCountLabel')}</dt><dd className="gk-num">{`${String(home.members.length)} / ${String(CLAN.maxMembers)}`}</dd></div>
          <div><dt>{t('clan.scoreLabel')}</dt>
            <dd className="gk-num" data-tone={home.clan.score > 0 ? 'self' : home.clan.score < 0 ? 'hostile' : 'plain'}>
              {home.clan.score === 0 ? full(0) : signed(home.clan.score)}
            </dd></div>
        </dl>
      </div>
    </header>
  );
}

/**
 * Leaving, being kicked and disbanding all close recruitment for a day, and every
 * way back in is closed — not just founding. The server refuses an apply and an
 * accept with CLAN_MEMBERSHIP_LOCKED too, so a control that stays live is a tap
 * whose only possible answer is a refusal.
 */
const recruitmentLocked = (home: ClanOutsideHome, now: number): boolean =>
  home.creation.unlockedAt !== null && home.creation.unlockedAt.getTime() > now;

function ClanOutside({
  home,
  actions,
  depot,
}: {
  home: ClanOutsideHome;
  actions: Actions;
  depot: Resources;
}) {
  const { t } = useTranslation();
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  /** Which clan's public profile is open. D183 — null is the directory itself. */
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [hostileRequest, setHostileRequest] = useState<string | null>(null);
  const now = useNow(30_000);
  const locked = recruitmentLocked(home, now);
  const lockedFor = duration(minutesUntil(home.creation.unlockedAt ?? new Date(now), now));
  const directory = useClanDirectory(search);
  const listedClans = directory.data?.pages.flatMap((page) => page.clans) ?? [];
  const directoryTotal = directory.data?.pages[0]?.total ?? 0;
  const pendingApplications = new Set(home.requests
    .filter((request) => request.kind === 'APPLICATION' && request.status === 'PENDING')
    .map((request) => request.clanId));
  const hasDepot = resourceTotal(depot) > 0;

  const accept = (requestId: string, acknowledgeHostile: boolean): void => {
    actions.accept.mutate({ requestId, acknowledgeHostile }, {
      onSuccess: () => {
        setNotice(t('clan.requests.joined'));
        setHostileRequest(null);
      },
      onError: (error) => {
        if (isHostileAck(error)) setHostileRequest(requestId);
      },
    });
  };

  return (
    <div className="flex flex-col gap-4 px-3 py-2">
      <header className="clan-command-head rounded-control border border-v2-ally/40 bg-v2-panel px-3 py-3">
        <AtmosphereImage art={ATMOSPHERE.clan} />
        <p className="mb-2 flex items-center gap-1.5 text-micro font-semibold uppercase tracking-widest text-v2-ally">
          <ClanIcon className="size-4" />{t('clan.outside.eyebrow')}
        </p>
        <h3 className="max-w-72 text-title font-semibold leading-tight text-v2-ink">{t('clan.outside.title')}</h3>
        <p className="mt-2 text-caption leading-snug text-v2-ink-2">{t('clan.outside.body')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control border border-v2-ally/25 bg-v2-deep/70 px-2 py-1.5">
          <span className="text-micro text-v2-ink-2">{t('clan.found.cost')}</span>
          <PriceTag alloy={home.creation.cost.alloy} crystal={home.creation.cost.crystal} exact />
        </div>
        <p className="mt-1.5 text-micro leading-snug text-v2-ink-2">
          {t('clan.outside.requirements', { level: home.creation.requiredCoreLevel })}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href="#clan-directory-search" className="grid min-h-11 place-items-center rounded-control bg-v2-self px-2 py-2 text-center text-caption font-semibold text-v2-self-ink outline-none focus-visible:ring-2 focus-visible:ring-v2-ink">{t('clan.outside.joinAction')}</a>
          <a href="#clan-found-name" className="grid min-h-11 place-items-center rounded-control border border-v2-line-hi bg-v2-deep/80 px-2 py-2 text-center text-caption font-semibold text-v2-ink outline-none focus-visible:ring-2 focus-visible:ring-v2-self">{t('clan.outside.foundAction')}</a>
        </div>
      </header>

      <ClanBenefits />

      {hasDepot ? (
        <Section label={t('clan.depot.formerHeading')}>
          <Plate tone="opportunity" className="px-2 py-2">
            <p className="text-body text-v2-ink">{t('clan.depot.formerBody')}</p>
            <ResourceFigures resources={depot} className="mt-3" />
            <Button
              className="mt-2"
              variant="primary"
              disabled={actions.claimDepot.isPending}
              onClick={() => { actions.claimDepot.mutate(); }}
            >
              {t('clan.depot.claim')}
            </Button>
            <MutationError mutation={actions.claimDepot} />
          </Plate>
        </Section>
      ) : null}

      {home.requests.length > 0 ? (
        <Section label={t('clan.requests.heading')}>
          <div className="flex flex-col gap-2">
            {home.requests.map((request) => {
              const pending = request.status === 'PENDING';
              return (
                <Plate key={request.id} className="px-2 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate text-v2-ink">[{request.clanTag}] {request.clanName}</p>
                      <p className="mt-1 text-caption text-v2-ink-3">
                        {request.kind === 'INVITATION'
                          ? t('clan.requests.invitation')
                          : t(`clan.requests.status.${request.status}`)}
                      </p>
                    </div>
                    {pending ? <Chip tone="opportunity">{duration(minutesUntil(request.expiresAt, now))}</Chip> : null}
                  </div>
                  {pending && request.kind === 'INVITATION' ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={locked || actions.accept.isPending}
                        onClick={() => { accept(request.id, false); }}
                      >
                        {locked ? t('clan.requests.locked', { duration: lockedFor }) : t('clan.requests.accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actions.reject.isPending}
                        onClick={() => { actions.reject.mutate(request.id); }}
                      >
                        {t('clan.requests.decline')}
                      </Button>
                    </div>
                  ) : pending ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="ghost"
                      disabled={actions.withdraw.isPending}
                      onClick={() => { actions.withdraw.mutate(request.id); }}
                    >
                      {t('clan.requests.withdraw')}
                    </Button>
                  ) : null}
                  {hostileRequest === request.id ? (
                    <Confirmation
                      title={t('clan.requests.hostileTitle')}
                      body={t('clan.requests.hostileBody')}
                      confirm={t('clan.requests.hostileConfirm')}
                      onCancel={() => { setHostileRequest(null); }}
                      onConfirm={() => { accept(request.id, true); }}
                      busy={actions.accept.isPending}
                    />
                  ) : null}
                  <MutationError mutation={actions.accept} />
                </Plate>
              );
            })}
          </div>
          <MutationError mutation={actions.reject} />
          <MutationError mutation={actions.withdraw} />
        </Section>
      ) : null}

      <Section label={t('clan.directory.heading')} aside={directory.data ? t('clan.directory.count', { count: directoryTotal }) : undefined}>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('clan.directory.search')}</span>
            <input
              id="clan-directory-search"
              value={searchDraft}
              maxLength={40}
              onChange={(event) => { setSearchDraft(event.currentTarget.value); }}
              placeholder={t('clan.directory.search')}
              className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self h-10"
            />
          </label>
          <Button type="submit">{t('clan.directory.find')}</Button>
        </form>
        {directory.isError ? (
          <Unreachable what={t('clan.directory.heading')} onRetry={() => { void directory.refetch(); }} />
        ) : !directory.data ? (
          <Waiting>{t('clan.directory.waiting')}</Waiting>
        ) : listedClans.length === 0 ? (
          <EmptyState title={t('clan.directory.empty')} />
        ) : (
          <ol className="flex flex-col gap-2">
            {listedClans.map((clan) => {
              const applied = pendingApplications.has(clan.id);
              const fullClan = clan.memberCount >= CLAN.maxMembers;
              const canApply = clan.recruiting && !fullClan && !applied && !locked;
              return (
                <li key={clan.id}>
                  <Plate className="px-2 py-2">
                    {/*
                      THE ROW IS THE DOOR. D183, owner report: *"Bir klan'a tıklayıp
                      incelenmiyor. Sıradan bir kullanıcı bir klanda kimler var onu
                      bile göremiyor."*

                      The row used to be a card with one control on it — Apply —
                      which asks a commander to join five strangers on the strength
                      of a member count. Pressing the row itself opens the profile,
                      the same grammar every other list in the game uses (D118: a
                      thing is focused before it is committed to), and Apply lives
                      in both places because the decision can be made from either.
                    */}
                    <button
                      type="button"
                      className="w-full text-left"
                      aria-label={t('clan.directory.inspect', { clan: clan.name })}
                      onClick={() => { setInspecting(clan.id); }}
                    >
                      <div className="flex items-start gap-2">
                        <span className="rounded-control bg-v2-deep grid size-8 shrink-0 place-items-center rounded-control text-v2-self">
                          <ClanIcon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone="crystal"><ClanTag tag={clan.tag} tier={clanTagTier(clan.level)} /></Chip>
                            <strong className="font-semibold truncate text-v2-ink">{clan.name}</strong>
                            {clan.level !== null && (
                              <Chip tone="opportunity">{t('clanWar.level', { level: clan.level })}</Chip>
                            )}
                          </div>
                          <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">
                            {clan.description || t('clan.noDescription')}
                          </p>
                          <p className="mt-2 text-label text-v2-ink-3">
                            {t('clan.directory.meta', {
                              leader: clan.leaderName,
                              members: clan.memberCount,
                              score: clan.score === 0 ? full(0) : signed(clan.score),
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                    <Button
                      full
                      className="mt-2"
                      size="sm"
                      variant={canApply ? 'primary' : 'ghost'}
                      ariaLabel={t('clan.directory.applyTo', { clan: clan.name })}
                      disabled={!canApply || actions.apply.isPending}
                      onClick={() => {
                        actions.apply.mutate(clan.id, {
                          onSuccess: () => { setNotice(t('clan.directory.applied')); },
                        });
                      }}
                    >
                      {applied
                        ? t('clan.directory.pending')
                        : locked
                          ? t('clan.directory.locked', { duration: lockedFor })
                          : fullClan
                            ? t('clan.directory.full')
                            : clan.recruiting
                              ? t('clan.directory.apply')
                              : t('clan.directory.closed')}
                    </Button>
                  </Plate>
                </li>
              );
            })}
          </ol>
        )}
        {directory.hasNextPage ? (
          <Button
            full
            variant="ghost"
            disabled={directory.isFetchingNextPage}
            onClick={() => { void directory.fetchNextPage(); }}
          >
            {directory.isFetchingNextPage ? t('clan.directory.loadingMore') : t('clan.directory.more')}
          </Button>
        ) : null}
        {notice ? <p role="status" className="text-caption text-v2-self">{notice}</p> : null}
        <MutationError mutation={actions.apply} />
      </Section>

      <FoundClan home={home} actions={actions} />

      {inspecting !== null && (
        <ClanProfile
          clanId={inspecting}
          applying={actions.apply.isPending}
          canApply={!locked}
          applied={pendingApplications.has(inspecting)}
          onApply={() => {
            actions.apply.mutate(inspecting, {
              onSuccess: () => {
                setNotice(t('clan.directory.applied'));
                setInspecting(null);
              },
            });
          }}
          onClose={() => { setInspecting(null); }}
        />
      )}
    </div>
  );
}

/**
 * ONE CLAN, AND WHO IS IN IT. D183.
 *
 * The directory answers "which clans exist"; this answers the question a commander
 * about to apply is actually asking — who are these people, and how are they
 * doing. Both facts are already galaxy-wide on the ladder (D76); collecting them
 * under the clan is what makes them a decision rather than trivia.
 *
 * NO WORLDS, ANYWHERE ON IT. Where a member lives is a probe's product (D127), and
 * the payload does not carry one — this is stated here as well because a roster is
 * exactly the surface somebody would later "helpfully" add a position to.
 */
function ClanProfile({
  clanId,
  canApply,
  applied,
  applying,
  onApply,
  onClose,
}: {
  clanId: string;
  canApply: boolean;
  applied: boolean;
  applying: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const profile = useClanProfile(clanId);
  const clan = profile.data;
  const atCapacity = clan !== undefined && clan.memberCount >= CLAN.maxMembers;

  return (
    <Sheet
      eyebrow={t('clan.profile.eyebrow')}
      title={clan ? `[${clan.tag}] ${clan.name}` : t('clan.profile.loading')}
      onClose={onClose}
      footer={clan && (
        <Button
          full
          variant={canApply && clan.recruiting && !atCapacity && !applied ? 'primary' : 'ghost'}
          ariaLabel={t('clan.directory.applyTo', { clan: clan.name })}
          disabled={!canApply || !clan.recruiting || atCapacity || applied || applying}
          onClick={onApply}
        >
          {applied
            ? t('clan.directory.pending')
            : atCapacity
              ? t('clan.directory.full')
              : clan.recruiting
                ? t('clan.directory.apply')
                : t('clan.directory.closed')}
        </Button>
      )}
    >
      {profile.isError ? (
        <Unreachable
          what={t('clan.profile.eyebrow')}
          onRetry={() => { void profile.refetch(); }}
        />
      ) : !clan ? (
        <Waiting>{t('clan.profile.loading')}</Waiting>
      ) : (
        <>
          <p className="text-caption leading-relaxed text-v2-ink-2">
            {clan.description || t('clan.noDescription')}
          </p>
          {clan.level !== null && (
            <p className="mt-2 text-label text-v2-self">
              {t('clanWar.level', { level: clan.level })}
            </p>
          )}
          <p className="mt-2 text-label text-v2-ink-3">
            {t('clan.directory.meta', {
              leader: clan.leaderName,
              members: clan.memberCount,
              score: clan.score === 0 ? full(0) : signed(clan.score),
            })}
          </p>
          <h3 className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3 mt-4 mb-2">
            {t('clan.profile.roster', { count: clan.members.length })}
          </h3>
          {/*
            ONE LINE PER COMMANDER: who they are, what seat they hold, and their
            Dominion. Three facts, one row — the compact directive, and the same
            shape the clan's own Strength tab already lists its crew in.
          */}
          <ol className="flex flex-col gap-1">
            {clan.members.map((mate) => (
              <li
                key={mate.playerId}
                data-clan-member={mate.playerId}
                className="flex items-baseline justify-between gap-2 border-b border-v2-line pb-1 last:border-0"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <strong className="font-semibold truncate text-v2-ink">{mate.username}</strong>
                  {mate.role === 'LEADER' && (
                    <span className="text-micro font-semibold uppercase tracking-wide text-v2-self">{t('clan.profile.leader')}</span>
                  )}
                </span>
                <span className="font-v2-mono tabular-nums shrink-0 text-caption text-v2-ink-2">
                  {mate.dominion === 0 ? full(0) : signed(mate.dominion)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  );
}

function ClanBenefits({ member = false }: { member?: boolean }) {
  const { t } = useTranslation();
  const list = (
    <div className="gk-benefits">
      <Benefit featured glyph="support" title={t('clan.benefits.supportTitle')} body={t('clan.benefits.supportBody')} />
      <Benefit featured glyph="attack" title={t('clan.benefits.warTitle')} body={t('clan.benefits.warBody')} />
      <Benefit featured glyph="banner" title={t('clan.benefits.monumentTitle')} body={t('clan.benefits.monumentBody')} />
      <div className="gk-benefits__small">
        <Benefit glyph="speed" title={t('clan.benefits.aidTitle')} body={t('clan.benefits.aidBody')} />
        <Benefit glyph="crate" title={t('clan.benefits.lootTitle')} body={t('clan.benefits.lootBody')} />
        <Benefit glyph="chat" title={t('clan.benefits.chatTitle')} body={t('clan.benefits.chatBody')} />
        <Benefit glyph="shield" title={t('clan.benefits.safeTitle')} body={t('clan.benefits.safeBody')} />
        <Benefit glyph="history" title={t('clan.benefits.recordTitle')} body={t('clan.benefits.recordBody')} />
      </div>
      <p className="gk-sub">{t('clan.benefits.waitingNote', { hours: CLAN.adaptationMinutes / 60 })}</p>
    </div>
  );
  // A member already has these; they wait one press away. Outside, they are the pitch, so they stand open.
  return member
    ? <RulesRow glyph="help" title={t('clan.benefits.activeHeading')}>{list}</RulesRow>
    : <section className="gk-clan__part"><SectionTag as="h3">{t('clan.benefits.heading')}</SectionTag>{list}</section>;
}

function Benefit({ glyph, title, body, featured = false }: { glyph: GlyphId; title: string; body: string; featured?: boolean }) {
  return (
    <article className="gk-benefit" {...(featured ? { 'data-featured': '' } : {})}>
      <span className="gk-benefit__mark" aria-hidden="true"><Glyph id={glyph} /></span>
      <div className="gk-benefit__words">
        <h4>{title}</h4>
        <p className="gk-sub">{body}</p>
      </div>
    </article>
  );
}

function FoundClan({ home, actions }: { home: ClanOutsideHome; actions: Actions }) {
  const policy = useCommunityPolicy();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [recruiting, setRecruiting] = useState(true);
  const [created, setCreated] = useState(false);
  const now = useNow(30_000);
  const locked = recruitmentLocked(home, now);
  const coreReady = home.creation.coreLevel >= home.creation.requiredCoreLevel;
  const identityReady = clanNameIsValid(name) && clanTagIsValid(tag);
  const canCreate = coreReady && home.creation.affordable && !locked && identityReady;

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!canCreate || actions.create.isPending) return;
    actions.create.mutate({ name, tag, description, recruiting }, {
      onSuccess: () => { setCreated(true); },
    });
  };

  return (
    <Section label={t('clan.found.heading')}>
      <Plate className="px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-chip border px-2 py-0.5 text-micro font-semibold ${coreReady ? 'border-v2-self/50 text-v2-self' : 'border-v2-warn/50 text-v2-warn'}`}
          >
            <CoreIcon className="size-3.5" />
            {t('clan.found.core', { current: home.creation.coreLevel, required: home.creation.requiredCoreLevel })}
          </span>
          <span className="text-micro text-v2-ink-3">{t('clan.found.cost')}</span>
          <PriceTag
            alloy={home.creation.cost.alloy}
            crystal={home.creation.cost.crystal}
            exact
          />
        </div>
        {locked ? (
          <p className="mt-3 text-caption text-v2-hostile">
            {t('clan.found.locked', { duration: duration(minutesUntil(home.creation.unlockedAt!, now)) })}
          </p>
        ) : null}
        <Note>{t('clan.found.identityNote')}</Note>

        <CommunityPolicyGate policy={policy}><form onSubmit={submit} className="mt-2 flex flex-col gap-2">
          <label>
            <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3 mb-1 block">{t('clan.found.nameLabel')}</span>
            <input
              id="clan-found-name"
              value={name}
              maxLength={CLAN.nameMaxChars}
              onChange={(event) => { setName(event.currentTarget.value); }}
              placeholder={t('clan.found.namePlaceholder')}
              className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self h-10"
            />
          </label>
          <label>
            <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3 mb-1 block">{t('clan.found.tagLabel')}</span>
            <input
              value={tag}
              maxLength={CLAN.tagMaxChars}
              onChange={(event) => { setTag(event.currentTarget.value.toUpperCase()); }}
              placeholder="ORB"
              autoCapitalize="characters"
              className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self h-10 uppercase"
            />
          </label>
          <label>
            <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3 mb-1 block">{t('clan.found.descriptionLabel')}</span>
            <textarea
              value={description}
              rows={3}
              onChange={(event) => {
                setDescription(Array.from(event.currentTarget.value).slice(0, CLAN.descriptionMaxChars).join(''));
              }}
              placeholder={t('clan.found.descriptionPlaceholder')}
              className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 py-2 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self resize-none"
            />
            <span className="mt-1 block text-right text-micro text-v2-ink-3">
              {t('clan.charactersLeft', { count: CLAN.descriptionMaxChars - Array.from(description).length })}
            </span>
          </label>
          <label className="flex items-center gap-2 rounded-control border border-v2-line bg-v2-deep px-3 py-2">
            <input
              type="checkbox"
              checked={recruiting}
              onChange={(event) => { setRecruiting(event.currentTarget.checked); }}
              className="size-4 accent-[var(--color-v2-self)]"
            />
            <span>
              <span className="block text-caption font-semibold text-v2-ink">{t('clan.found.recruiting')}</span>
              <span className="block text-micro text-v2-ink-3">{t('clan.found.recruitingHint')}</span>
            </span>
          </label>
          <Button type="submit" full variant="primary" disabled={!canCreate || actions.create.isPending}>
            {t('clan.found.submit')}
          </Button>
        </form></CommunityPolicyGate>
        {created ? <p role="status" className="mt-3 text-caption text-v2-self">{t('clan.found.created')}</p> : null}
        <MutationError mutation={actions.create} />
      </Plate>
    </Section>
  );
}

function ClanOverview({
  home,
  depot,
  events,
  standings,
  actions,
}: {
  home: ClanMemberHome;
  depot: ReturnType<typeof useClanDepot>;
  events: ReturnType<typeof useClanEvents>;
  standings: ReturnType<typeof useClanLeaderboard>;
  actions: Actions;
}) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const history = events.data?.pages.flatMap((page) => page.events) ?? [];

  return (
    <div className="gk-clan__parts">
      <ClanSeats members={home.members} now={now} />

      {!home.clan.mature ? (
        <div className="gk-well gk-clan__state">
          <p className="gk-inote" data-tone="self"><Glyph id="clock" />{t('clan.adaptation.title')}</p>
          <p className="gk-sub">{t('clan.adaptation.openNow')}</p>
          <p className="gk-sub gk-tone-self">{t('clan.adaptation.opensLater', { duration: duration(minutesUntil(home.clan.matureAt, now)) })}</p>
        </div>
      ) : (
        <div className="gk-well gk-clan__state" data-tone="good">
          <p className="gk-inote" data-tone="good"><Glyph id="check" />{t('clan.adaptation.readyTitle')}</p>
          <p className="gk-sub">{t('clan.adaptation.readyBody')}</p>
        </div>
      )}

      <ClanBenefits member />
      <p className="gk-inote" data-tone="warn"><Glyph id="attack" /><span><b>{t('clan.rules.limitTitle')}</b> {t('clan.rules.limitBody')}</span></p>

      <ClanStandings home={home} standings={standings} />

      <section className="gk-clan__part">
        <SectionTag as="h3">{t('clan.depot.heading')}</SectionTag>
        {depot.isError ? (
          <Unreachable what={t('clan.depot.heading')} onRetry={() => { void depot.refetch(); }} />
        ) : !depot.data ? (
          <Waiting>{t('clan.depot.waiting')}</Waiting>
        ) : (
          <div className="gk-well gk-clan__depot">
            <p className="gk-sub">{t('clan.depot.body')}</p>
            <ResourceFigures resources={depot.data.resources} />
            <GameButton tone="action" wide glyph="crate"
              disabledReason={resourceTotal(depot.data.resources) <= 0 ? t('clan.depot.claim') : null}
              pending={actions.claimDepot.isPending}
              onPress={() => { actions.claimDepot.mutate(); }}>
              {t('clan.depot.claim')}
            </GameButton>
            <p className="gk-sub">{t('clan.depot.claimHint')}</p>
            {actions.claimDepot.isError ? <p role="alert" className="gk-inote" data-tone="warn">{describeError(actions.claimDepot.error)}</p> : null}
          </div>
        )}
      </section>

      <section className="gk-clan__part">
        <SectionTag as="h3">{t('clan.history.heading')}</SectionTag>
        {!home.clan.mature ? (
          <p className="gk-inote"><Glyph id="clock" />{t('clan.history.adapting')}</p>
        ) : events.isError ? (
          <Unreachable what={t('clan.history.heading')} onRetry={() => { void events.refetch(); }} />
        ) : !events.data ? (
          <Waiting>{t('clan.history.waiting')}</Waiting>
        ) : history.length === 0 ? (
          <p className="gk-sub">{t('clan.history.empty')}</p>
        ) : (
          <ol className="gk-well gk-clanlog">
            {history.map((event) => <ClanEventRow key={event.id} event={event} now={now} />)}
          </ol>
        )}
        {events.hasNextPage ? (
          <GameButton size="sm" glyph="history" pending={events.isFetchingNextPage} onPress={() => { void events.fetchNextPage(); }}>
            {events.isFetchingNextPage ? t('clan.history.loadingOlder') : t('clan.history.older')}
          </GameButton>
        ) : null}
      </section>
    </div>
  );
}

function ClanStrengthPanel({
  strength,
}: {
  strength: ReturnType<typeof useClanStrength>;
}) {
  const { t } = useTranslation();
  if (strength.isError) {
    return (
      <Unreachable
        what={t('clan.strength.heading')}
        onRetry={() => { void strength.refetch(); }}
      />
    );
  }
  if (!strength.data) return <Waiting>{t('clan.strength.waiting')}</Waiting>;
  return <ClanStrengthView strength={strength.data} />;
}

function ClanStrengthView({ strength }: { strength: ClanStrength }) {
  const { t } = useTranslation();
  const largest = Math.max(1, ...strength.composition.map((entry) => entry.count));
  /**
   * The clan's strongest member, so every bar in the roster shares one scale.
   *
   * Floored at one: a brand-new clan has nobody with any Dominion at all, and
   * dividing by that would put `NaN%` into a style attribute on the first screen
   * a founder ever sees.
   */
  const strongest = Math.max(1, ...strength.members.map((member) => member.dominion));

  const figure = (label: string, value: string, tone?: string, hint?: string, wide = false) => (
    <div className="gk-figure" {...(wide ? { 'data-wide': '' } : {})}>
      <dt className="gk-label">{label}</dt>
      <dd className="gk-num gk-figure__value" {...(tone ? { 'data-tone': tone } : {})}>{value}</dd>
      {hint !== undefined && <dd className="gk-figure__sub">{hint}</dd>}
    </div>
  );

  return (
    <div className="gk-clan__parts">
      <section className="gk-well gk-might">
        <p className="gk-label gk-tone-self">[{strength.clan.tag}] {strength.clan.name}</p>
        <h2 className="gk-might__title">{t('clan.strength.title')}</h2>
        <p className="gk-sub">{t('clan.strength.body')}</p>
        <dl className="gk-figures gk-figures--two gk-might__head">
          {figure(t('clan.strength.memberDominion'), full(strength.totals.memberDominion), 'self', t('clan.strength.memberDominionHint'))}
          {figure(t('clan.strength.ships'), full(strength.totals.ships), 'crystal', t('clan.strength.shipsHint'))}
        </dl>
      </section>

      <section className="gk-clan__part">
        <SectionTag as="h3">{t('clan.strength.totalsHeading')}</SectionTag>
        <dl className="gk-well gk-figures gk-figures--two gk-might__totals">
          {figure(t('clan.strength.clanDominion'),
            strength.totals.clanDominion === 0 ? full(0) : signed(strength.totals.clanDominion),
            strength.totals.clanDominion > 0 ? 'self' : undefined, t('clan.strength.clanDominionHint'))}
          {figure(t('clan.strength.worlds'), full(strength.totals.worlds))}
          {figure(t('clan.strength.fleetValue'), full(strength.totals.fleetValue), 'alloy')}
          {figure(t('clan.strength.groundDefences'), full(strength.totals.groundDefences))}
          {figure(t('clan.strength.activeFlights'), full(strength.totals.activeFlights),
            strength.totals.activeFlights > 0 ? 'crystal' : undefined, t('clan.strength.activeFlightsHint'), true)}
        </dl>
      </section>

      <section className="gk-clan__part">
        <SectionTag as="h3" aside={t('clan.strength.shipsCount', { count: strength.totals.ships })}>{t('clan.strength.compositionHeading')}</SectionTag>
        {strength.composition.length === 0 ? (
          <p className="gk-sub">{t('clan.strength.noShips')}</p>
        ) : (
          <ol className="gk-well gk-might__list">
            {strength.composition.map((entry) => {
              const art = HULL_ART[entry.hull];
              return (
                <li key={entry.hull} className="gk-might__hull">
                  <span className="gk-might__art" aria-hidden="true">
                    {art ? <img src={art} alt="" width={32} height={32} loading="lazy" /> : <HullMark hull={entry.hull} />}
                  </span>
                  <span className="gk-might__name">{hullName(entry.hull) ?? entry.hull}</span>
                  <span className="gk-num gk-might__count">{full(entry.count)}</span>
                  <span className="gk-might__bar" aria-hidden="true">
                    <span style={{ width: `${String((entry.count / largest) * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/*
        WHO IS PULLING THEIR WEIGHT, ANSWERED BY EYE (owner). Each member's Dominion is a bar against
        the clan's strongest, so the pecking order is the shape of the column; ships and worlds stay
        as figures, the working rather than the standing.
      */}
      <section className="gk-clan__part">
        <SectionTag as="h3" aside={t('clan.strength.membersCount', { count: strength.members.length })}>{t('clan.strength.membersHeading')}</SectionTag>
        <ol className="gk-well gk-might__list">
          {strength.members.map((member) => {
            const line = t('clan.strength.memberLine', { dominion: full(member.dominion), ships: full(member.ships), worlds: full(member.worlds) });
            return (
              <li key={member.playerId} className="gk-might__member">
                <span className="gk-might__name">{member.username}</span>
                {member.role === 'LEADER' ? <span className="gk-chip gk-clan__role">{t('clan.leader')}</span> : null}
                <span className="gk-might__bar" role="img" aria-label={line}>
                  <span data-member-share style={{ width: `${String(Math.max(0, Math.min(100, (member.dominion / strongest) * 100)))}%` }} />
                </span>
                <span className="gk-sub gk-num">{line}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function ClanSeats({ members, now }: { members: readonly Member[]; now: number }) {
  const { t } = useTranslation();
  return (
    <section className="gk-clan__part">
      <SectionTag as="h3" aside={t('clan.seats.count', { members: members.length })}>{t('clan.seats.heading')}</SectionTag>
      <ul className="gk-seats" aria-label={t('clan.seats.heading')}>
        {Array.from({ length: CLAN.maxMembers }, (_, slot) => {
          const member = members.find((candidate) => candidate.slot === slot);
          if (!member) {
            return (
              <li key={slot} aria-label={t('clan.seats.openLabel', { slot: slot + 1 })} data-clan-seat data-open="" className="gk-seat">
                <span className="gk-seat__coin" aria-hidden="true"><Glyph id="plus" /></span>
                <span className="gk-seat__state">{t('clan.seats.open')}</span>
              </li>
            );
          }
          const initial = Array.from(member.username)[0]?.toLocaleUpperCase() ?? '•';
          return (
            <li key={slot} aria-label={t('clan.seats.memberLabel', { slot: slot + 1, name: member.username })} data-clan-seat
              title={member.username} className="gk-seat" {...(member.role === 'LEADER' ? { 'data-leader': '' } : {})}>
              <span className="gk-seat__coin gk-num" aria-hidden="true">{initial}</span>
              <span className="gk-seat__name">{member.username}</span>
              <span className="gk-seat__state" data-tone={member.mature ? 'self' : 'plain'}>
                {member.role === 'LEADER'
                  ? t('clan.seats.leader')
                  : member.mature
                    ? t('clan.seats.ready')
                    : duration(minutesUntil(member.matureAt, now))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClanStandings({
  home,
  standings,
}: {
  home: ClanMemberHome;
  standings: ReturnType<typeof useClanLeaderboard>;
}) {
  const { t } = useTranslation();
  const leaders = standings.data?.clans.slice(0, 5) ?? [];
  const mine = standings.data?.clans.find((clan) => clan.id === home.clan.id);
  const rows = mine && !leaders.some((clan) => clan.id === mine.id) ? [...leaders, mine] : leaders;
  /**
   * The widest score on the board, so every bar shares one scale. ABSOLUTE, because Dominion is
   * zero-sum and a clan can sit below the line: its bar grows LEFT of the centre, so "behind" is a
   * direction rather than a minus sign to notice. A ladder is a comparison, so it is drawn as one.
   */
  const widest = Math.max(1, ...rows.map((clan) => Math.abs(clan.score)));

  return (
    <section className="gk-clan__part">
      <SectionTag as="h3" aside={t('clan.standings.aside')}>{t('clan.standings.heading')}</SectionTag>
      {standings.isError ? (
        <Unreachable what={t('clan.standings.heading')} onRetry={() => { void standings.refetch(); }} />
      ) : !standings.data ? (
        <Waiting>{t('clan.standings.waiting')}</Waiting>
      ) : rows.length === 0 ? (
        <p className="gk-sub">{t('clan.standings.empty')}</p>
      ) : (
        <ol className="gk-well gk-standings">
          {rows.map((clan, index) => (
            <li key={clan.id} aria-current={clan.self ? 'true' : undefined} className="gk-standing"
              {...(clan.self ? { 'data-self': '' } : {})} {...(index === 5 ? { 'data-apart': '' } : {})}>
              <span className="gk-standing__rank gk-num">{clan.rank}</span>
              <span className="gk-standing__who">
                <span className="gk-standing__name"><ClanTag tag={clan.tag} tier={clanTagTier(clan.level)} className="gk-standing__tag" /> {clan.name}</span>
                <span className="gk-sub">
                  {t('clan.standings.crew', { members: clan.memberCount })}
                  {clan.watches ? ` · ${t('clan.standings.watches', { count: clan.watches })}` : ''}
                  {clan.self ? ` · ${t('clan.you')}` : ''}
                </span>
              </span>
              <span className="gk-standing__bar" aria-hidden="true">
                <span data-clan-score className="gk-standing__fill" data-side={clan.score < 0 ? 'down' : 'up'}
                  style={{ width: `${String((Math.abs(clan.score) / widest) * 50)}%` }} />
              </span>
              <span className="gk-standing__score gk-num" data-tone={clan.score > 0 ? 'self' : clan.score < 0 ? 'hostile' : 'plain'}>
                {clan.score === 0 ? full(0) : signed(clan.score)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ClanMembers({
  home,
  commanders,
  selfPlayerId,
  actions,
}: {
  home: ClanMemberHome;
  commanders: readonly Leaderboard['ladder'][number][];
  selfPlayerId: string | undefined;
  actions: Actions;
}) {
  const policy = useCommunityPolicy();
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<{ kind: 'kick' | 'leadership' | 'leave' | 'disband'; member?: Member } | null>(null);
  const treasury = useClanWar(confirm?.kind === 'disband' && home.clan.role === 'LEADER');
  const burn = treasury.data?.treasury;
  const burnsTreasury = burn !== undefined
    && burn.alloy + burn.crystal + burn.deuterium > 0;
  const [hostileRequest, setHostileRequest] = useState<string | null>(null);
  const [invitee, setInvitee] = useState('');
  const [description, setDescription] = useState(home.clan.description);
  const [recruiting, setRecruiting] = useState(home.clan.recruiting);
  const [saved, setSaved] = useState(false);
  const now = useNow(30_000);
  const candidates = commanders.filter((candidate) =>
    candidate.playerId !== selfPlayerId && candidate.clan == null);

  const accept = (requestId: string, acknowledgeHostile: boolean): void => {
    actions.accept.mutate({ requestId, acknowledgeHostile }, {
      onSuccess: () => { setHostileRequest(null); },
      onError: (error) => {
        if (isHostileAck(error)) setHostileRequest(requestId);
      },
    });
  };

  const runConfirm = (): void => {
    if (!confirm) return;
    if (confirm.kind === 'kick' && confirm.member) {
      actions.kick.mutate(confirm.member.playerId, { onSuccess: () => { setConfirm(null); } });
    } else if (confirm.kind === 'leadership' && confirm.member) {
      actions.leadership.mutate(confirm.member.playerId, { onSuccess: () => { setConfirm(null); } });
    } else if (confirm.kind === 'leave') {
      actions.leave.mutate(undefined, { onSuccess: () => { setConfirm(null); } });
    } else if (confirm.kind === 'disband') {
      if (!treasury.data) return;
      actions.disband.mutate(burnsTreasury, { onSuccess: () => { setConfirm(null); } });
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Section label={t('clan.members.heading')} aside={`${String(home.members.length)} / ${String(CLAN.maxMembers)}`}>
        <ol className="flex flex-col gap-2">
          {home.members.map((member) => {
            const self = member.playerId === selfPlayerId;
            return (
              <li key={member.playerId}>
                <Plate className="px-2 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="font-semibold truncate text-v2-ink">{member.username}</strong>
                        {self ? <Chip tone="crystal">{t('clan.you')}</Chip> : null}
                        {member.role === 'LEADER' ? <Chip tone="opportunity">{t('clan.leader')}</Chip> : null}
                      </div>
                      <p className="mt-1 text-label text-v2-ink-3">
                        {member.mature ? t('clan.members.ready') : t('clan.members.adapting')}
                        {' · '}
                        {member.activeRecently ? t('clan.members.active') : t('clan.members.away')}
                      </p>
                    </div>
                    <span className={`size-2 shrink-0 rounded-full ${member.activeRecently ? 'bg-v2-self' : 'bg-v2-line-hi'}`} aria-hidden />
                  </div>
                  {home.clan.role === 'LEADER' && !self ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-v2-line pt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        ariaLabel={t('clan.members.transferTo', { name: member.username })}
                        onClick={() => { setConfirm({ kind: 'leadership', member }); }}
                      >
                        {t('clan.members.transfer')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        ariaLabel={t('clan.members.removeName', { name: member.username })}
                        onClick={() => { setConfirm({ kind: 'kick', member }); }}
                      >
                        {t('clan.members.remove')}
                      </Button>
                    </div>
                  ) : null}
                </Plate>
              </li>
            );
          })}
        </ol>
        {confirm?.member ? (
          <Confirmation
            title={confirm.kind === 'kick'
              ? t('clan.members.removeConfirmTitle', { name: confirm.member.username })
              : t('clan.members.transferConfirmTitle', { name: confirm.member.username })}
            body={confirm.kind === 'kick'
              ? t('clan.members.removeConfirmBody')
              : t('clan.members.transferConfirmBody')}
            confirm={confirm.kind === 'kick'
              ? t('clan.members.removeConfirm', { name: confirm.member.username })
              : t('clan.members.transferConfirm', { name: confirm.member.username })}
            onCancel={() => { setConfirm(null); }}
            onConfirm={runConfirm}
            busy={actions.kick.isPending || actions.leadership.isPending}
          />
        ) : null}
        <MutationError mutation={actions.kick} />
        <MutationError mutation={actions.leadership} />
      </Section>

      {home.clan.role === 'LEADER' ? (
        <>
          <Section label={t('clan.applications.heading')} aside={`${String(home.requests.filter((request) => request.kind === 'APPLICATION').length)} / ${String(CLAN.maxClanApplications)}`}>
            {home.requests.filter((request) => request.kind === 'APPLICATION').length === 0 ? (
              <EmptyState title={t('clan.applications.empty')} />
            ) : (
              home.requests.filter((request) => request.kind === 'APPLICATION').map((request) => (
                <Plate key={request.id} className="px-2 py-2">
                  <p className="font-semibold text-v2-ink">{request.username}</p>
                  <p className="mt-1 text-label text-v2-ink-3">{t('clan.applications.expires', { duration: duration(minutesUntil(request.expiresAt, now)) })}</p>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="primary" disabled={actions.accept.isPending} onClick={() => { accept(request.id, false); }}>
                      {t('clan.requests.accept')}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={actions.reject.isPending} onClick={() => { actions.reject.mutate(request.id); }}>
                      {t('clan.requests.decline')}
                    </Button>
                  </div>
                  {hostileRequest === request.id ? (
                    <Confirmation
                      title={t('clan.requests.hostileTitle')}
                      body={t('clan.requests.hostileBody')}
                      confirm={t('clan.requests.hostileConfirm')}
                      onCancel={() => { setHostileRequest(null); }}
                      onConfirm={() => { accept(request.id, true); }}
                      busy={actions.accept.isPending}
                    />
                  ) : null}
                </Plate>
              ))
            )}
            <MutationError mutation={actions.accept} />
            <MutationError mutation={actions.reject} />
          </Section>

          <Section label={t('clan.invite.heading')}>
            <Plate className="px-2 py-2">
              <p className="text-caption leading-relaxed text-v2-ink-2">{t('clan.invite.body')}</p>
              <label className="mt-3 block">
                <span className="sr-only">{t('clan.invite.choose')}</span>
                <select value={invitee} onChange={(event) => { setInvitee(event.currentTarget.value); }} className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self h-10">
                  <option value="">{t('clan.invite.choose')}</option>
                  {candidates.map((candidate) => <option key={candidate.playerId} value={candidate.playerId}>{candidate.username}</option>)}
                </select>
              </label>
              <Button
                full
                className="mt-3"
                variant="primary"
                disabled={!invitee || actions.invite.isPending || home.members.length >= CLAN.maxMembers}
                onClick={() => { actions.invite.mutate(invitee, { onSuccess: () => { setInvitee(''); } }); }}
              >
                {t('clan.invite.send')}
              </Button>
              <Note>{t('clan.invite.limit')}</Note>
              <MutationError mutation={actions.invite} />
            </Plate>
          </Section>

          <Section label={t('clan.settings.heading')}><CommunityPolicyGate policy={policy}>
            <Plate className="px-2 py-2">
              <label>
                <span className="text-micro font-semibold uppercase tracking-wide text-v2-ink-3 mb-1 block">{t('clan.settings.description')}</span>
                <textarea
                  value={description}
                  rows={3}
                  onChange={(event) => {
                    setDescription(Array.from(event.currentTarget.value).slice(0, CLAN.descriptionMaxChars).join(''));
                    setSaved(false);
                  }}
                  className="w-full rounded-control border border-v2-line-hi bg-v2-deep px-3 py-2 text-caption text-v2-ink placeholder:text-v2-ink-3 outline-none focus:border-v2-self resize-none"
                />
              </label>
              <label className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={recruiting}
                  onChange={(event) => { setRecruiting(event.currentTarget.checked); setSaved(false); }}
                  className="size-4 accent-[var(--color-v2-self)]"
                />
                <span className="font-semibold text-v2-ink">{t('clan.settings.recruiting')}</span>
              </label>
              <Button
                className="mt-2"
                variant="primary"
                disabled={actions.settings.isPending || (description === home.clan.description && recruiting === home.clan.recruiting)}
                onClick={() => {
                  actions.settings.mutate({ description, recruiting }, { onSuccess: () => { setSaved(true); } });
                }}
              >
                {t('clan.settings.save')}
              </Button>
              {saved ? <p role="status" className="mt-2 text-caption text-v2-self">{t('clan.settings.saved')}</p> : null}
              <Note>{t('clan.settings.identityLocked')}</Note>
              <MutationError mutation={actions.settings} />
            </Plate>
          </CommunityPolicyGate></Section>
        </>
      ) : null}

      <Section label={t('clan.danger.heading')}>
        <Plate tone="threat" className="px-2 py-2">
          <p className="text-caption leading-relaxed text-v2-ink-2">
            {home.clan.role === 'LEADER' ? t('clan.danger.leaderBody') : t('clan.danger.memberBody')}
          </p>
          <Button
            full
            className="mt-2"
            variant="ghost"
            onClick={() => { setConfirm({ kind: home.clan.role === 'LEADER' ? 'disband' : 'leave' }); }}
          >
            {home.clan.role === 'LEADER' ? t('clan.danger.disband') : t('clan.danger.leave')}
          </Button>
          {confirm && !confirm.member ? (
            <Confirmation
              title={confirm.kind === 'disband' ? t('clan.danger.disbandTitle') : t('clan.danger.leaveTitle')}
              body={confirm.kind === 'disband'
                ? treasury.isError
                  ? t('clanWar.treasuryUnknown')
                  : burnsTreasury
                    ? t('clanWar.disbandBurn', {
                      alloy: full(burn.alloy), crystal: full(burn.crystal),
                      deuterium: full(burn.deuterium),
                    })
                    : t('clan.danger.disbandConfirmBody')
                : t('clan.danger.leaveConfirmBody')}
              confirm={confirm.kind === 'disband' ? t('clan.danger.disbandConfirm') : t('clan.danger.leaveConfirm')}
              onCancel={() => { setConfirm(null); }}
              onConfirm={runConfirm}
              busy={actions.disband.isPending || actions.leave.isPending
                || (confirm.kind === 'disband' && !treasury.data)}
            />
          ) : null}
          <MutationError mutation={actions.disband} />
          <MutationError mutation={actions.leave} />
        </Plate>
      </Section>
    </div>
  );
}

function ClanAidPanel({
  home,
  presence,
  selfPlayerId,
  transfers,
  loading,
  actions,
}: {
  home: ClanMemberHome;
  presence: GalaxyView['clanPresence'];
  selfPlayerId: string | undefined;
  transfers: ClanAid['transfers'];
  loading: boolean;
  actions: Actions;
}) {
  const { t } = useTranslation();
  const now = useNow(30_000);
  const { worlds } = useWorld();
  const recipients = home.members.filter((member) =>
    member.playerId !== selfPlayerId && member.mature && member.aidEnabled);
  const [originId, setOriginId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [fleet, setFleet] = useState<Fleet>({});
  const [cargo, setCargo] = useState<Resources>({ ...ZERO });
  const [quotedKey, setQuotedKey] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);
  const origin = worlds.find((world) => world.planet.id === originId) ?? worlds[0];
  const launchBlocked = launchFault(origin?.faults, 'fleet') !== null;
  const recipient = recipients.find((member) => member.playerId === recipientId) ?? recipients[0];
  const targets = recipient
    ? presence?.members.find((member) => member.playerId === recipient.playerId)?.worlds ?? []
    : [];
  const target = targets.find((world) => world.planetId === targetId) ?? targets[0];
  const payload: ClanAidInput | null = origin && recipient && target
    ? {
        originPlanetId: origin.planet.id,
        recipientPlayerId: recipient.playerId,
        targetPlanetId: target.planetId,
        fleet,
        cargo,
      }
    : null;
  const payloadKey = payload ? JSON.stringify(payload) : '';
  const quote = quotedKey === payloadKey ? actions.quoteAid.data : undefined;
  /** The sender's newcomer shield, still standing, holds the aid home. R4, 2026-09-23. */
  const shieldedUntil = quote?.senderShieldUntil != null && quote.senderShieldUntil.getTime() > now
    ? quote.senderShieldUntil
    : null;
  /*
    CARGO HOLDS LIFTS THIS HOLD TOO, SINCE D197. The sheet has to quote the figure
    the server will check, so it reads the same research the server does —
    `techOf` off the origin world's own payload, which is where the client learns
    a commander's levels at all.
  */
  const cargoCapacity = clanTransferCargoCapacity(fleet, origin ? techOf(origin) : {});
  const cargoUsed = resourceTotal(cargo);
  const originHasCargo = origin !== undefined
    && cargo.alloy <= origin.planet.alloy
    && cargo.crystal <= origin.planet.crystal
    && cargo.deuterium <= origin.planet.deuterium;
  /**
   * WHAT THE SENDER BURNS PUTTING THIS IN THE AIR. T6.
   *
   * An empty hold is a one-leg ship gift. Loading any resource turns the same
   * fleet into a two-leg delivery whose ships come home. The sender prepays the
   * actual plan through `missionFuel`, the same function `launchClanAid` charges.
   *
   * DRAWN LIVE RATHER THAN READ OFF THE QUOTE. `quoteClanAid` publishes `fuel` and
   * `hasFuel`, and both were ignored here — so this form's only account of the
   * flight's cost was a refusal after two taps. A figure that moves while the
   * convoy is packed is the one that can change the decision, and it is the same
   * shape the transfer sheet draws for the same act.
   *
   * THE HOLD COMES OFF THE TOP, exactly as the server's guard counts it: deuterium
   * loaded as cargo has already left this world as far as the flight is concerned.
   */
  const resourceDelivery = cargoUsed > 0;
  const fuel = origin && target && fleetCount(fleet) > 0
    ? missionFuel(
        fleet,
        distance(origin.planet.position, target.position),
        resourceDelivery ? 2 : 1,
      )
    : 0;
  const spendableDeuterium = (origin?.planet.deuterium ?? 0) - cargo.deuterium;
  const fuelled = spendableDeuterium >= fuel;
  const validPayload = payload !== null
    && fleetCount(fleet) > 0
    && cargoUsed <= cargoCapacity
    && originHasCargo;

  const updateFleet = (hull: HullId, count: number): void => {
    setFleet((current) => ({ ...current, [hull]: count }));
    setQuotedKey(null);
    setLaunched(false);
  };
  const updateCargo = (kind: keyof Resources, value: number): void => {
    const available = origin?.planet[kind] ?? 0;
    setCargo((current) => ({
      ...current,
      [kind]: Math.min(available, Math.max(0, Math.floor(value || 0))),
    }));
    setQuotedKey(null);
    setLaunched(false);
  };

  if (!home.clan.mature) {
    return (
      <div data-clan-aid className="gk gk-aid">
        <div className="gk-well gk-aid__quote">
          <p className="gk-inote" data-tone="self"><Glyph id="clock" />{t('clan.aid.adaptingTitle')}</p>
          <p className="gk-sub">{t('clan.aid.adaptingBody', { duration: duration(minutesUntil(home.clan.matureAt, now)) })}</p>
        </div>
      </div>
    );
  }

  // The verb on the hold is short; whether the transport comes home is the chip above the route.
  const sendLabel = t('clan.aid.sendHeading');
  const atHome = CLAN_TRANSFERABLE_HULLS.filter((hull) => (origin?.fleet[hull] ?? 0) > 0);
  const aidError = (mutation: Pick<UseMutationResult, 'isError' | 'error'>) => mutation.isError
    ? <p role="alert" className="gk-inote" data-tone="warn">{describeError(mutation.error)}</p>
    : null;
  const bays: Cell[] = quote
    ? Array.from({ length: quote.bay.total }, (_unused, index): Cell => (index < quote.bay.used ? 'flight' : 'ready'))
    : [];

  return (
    <div data-clan-aid className="gk gk-aid">
      <section className="gk-aid__part">
        {/* Receiving is a state the commander throws, so it is a switch, not a button that renames itself. */}
        <Toggle checked={home.clan.aidEnabled} label={t('clan.aid.receiveHeading')}
          sub={home.clan.aidEnabled ? t('clan.aid.receiving') : t('clan.aid.paused')}
          onChange={(next) => { if (!actions.aidPolicy.isPending) actions.aidPolicy.mutate(next); }} />
        <p className="gk-sub">{t('clan.aid.receiveHint')}</p>
        {aidError(actions.aidPolicy)}
      </section>

      <section className="gk-aid__part">
        <SectionTag as="h3">{t('clan.aid.sendHeading')}</SectionTag>
        <p className="gk-sub">{t('clan.aid.explainer')}</p>
        <div className="gk-aid__chips">
          <span className="gk-chip" data-tone="self">{t('clan.aid.speed')}</span>
          <span className="gk-chip" data-tone="good">{t('clan.aid.extraBay')}</span>
          <span className="gk-chip">{t(resourceDelivery ? 'clan.aid.returns' : 'clan.aid.noRecall')}</span>
        </div>

        {worlds.length === 0 ? (
          <p className="gk-inote" data-tone="warn">{t('clan.aid.noOrigin')}</p>
        ) : recipients.length === 0 ? (
          <div className="gk-well gk-aid__quote">
            <p className="gk-inote" data-tone="warn">{t('clan.aid.noRecipient')}</p>
            <p className="gk-sub">{t('clan.aid.noRecipientHint')}</p>
          </div>
        ) : (
          <>
            <div className="gk-aid__route">
              <Picker label={t('clan.aid.origin')} value={origin?.planet.id ?? ''}
                onChange={(value) => { setOriginId(value); setFleet({}); setCargo({ ...ZERO }); setQuotedKey(null); setLaunched(false); }}
                options={worlds.map((world) => ({ id: world.planet.id, label: world.planet.name }))} />
              <Picker label={t('clan.aid.recipient')} value={recipient?.playerId ?? ''}
                onChange={(value) => { setRecipientId(value); setTargetId(''); setQuotedKey(null); setLaunched(false); }}
                options={recipients.map((member) => ({ id: member.playerId, label: member.username }))} />
              <Picker label={t('clan.aid.target')} value={target?.planetId ?? ''}
                onChange={(value) => { setTargetId(value); setQuotedKey(null); setLaunched(false); }}
                options={targets.map((world) => ({ id: world.planetId, label: world.name }))} />
            </div>

            <section className="gk-aid__part">
              <p className="gk-label">{t(resourceDelivery ? 'clan.aid.transportShips' : 'clan.aid.ships')}</p>
              {/* A hull with none at home is not a choice, so it takes no row. */}
              {atHome.length === 0 && <p className="gk-inote" data-tone="warn">{t('clan.aid.noShips')}</p>}
              {atHome.map((hull) => {
                const available = origin?.fleet[hull] ?? 0;
                const name = hullName(hull) ?? hull;
                const art = HULL_ART[hull];
                const packed = fleet[hull] ?? 0;
                return (
                  <div key={hull} data-hull-row={hull} className="gk-lrow" {...(packed > 0 ? { 'data-chosen': '' } : {})}>
                    <span data-art className="gk-lrow__art" {...(available > 0 ? {} : { 'data-none': '' })}>
                      {art ? <img src={art} alt="" aria-hidden width={36} height={36} loading="lazy" /> : <HullMark hull={hull} className="gk-lrow__mark" />}
                    </span>
                    <span className="gk-lrow__name">{name}</span>
                    <span className="gk-sub gk-num gk-lrow__info">{t('clan.aid.available', { count: available })}</span>
                    <QuantityStepper
                      look="kit"
                      value={packed}
                      min={0}
                      max={available}
                      onChange={(value) => { updateFleet(hull, value); }}
                      decreaseLabel={t('clan.aid.fewer', { name })}
                      increaseLabel={t('clan.aid.more', { name })}
                      valueLabel={t('clan.aid.shipCount', { name })}
                      maxLabel={t('clan.aid.allShips', { name })}
                      maxText={t('clan.aid.max')}
                    />
                  </div>
                );
              })}
            </section>

            <section className="gk-aid__part">
              <p className="gk-label">{t('clan.aid.cargo')}</p>
              {/* The hold as a figure that moves while it is loaded: overfilling shows while it happens. */}
              <p className="gk-inote" {...(cargoUsed > cargoCapacity ? { 'data-tone': 'hostile' } : cargoCapacity > 0 ? {} : { 'data-tone': 'warn' })}>
                <Glyph id="crate" />{t('clan.aid.cargoUse', { used: full(cargoUsed), capacity: full(cargoCapacity) })}
              </p>
              <p className="gk-sub">{t('clan.aid.transportOnly')}</p>
              <div className="gk-cargo">
                {(['alloy', 'crystal', 'deuterium'] as const).map((kind) => {
                  const stock = Math.floor(origin?.planet[kind] ?? 0);
                  const room = Math.max(0, cargoCapacity - (cargoUsed - cargo[kind]));
                  return (
                    <div key={kind} data-cargo-row={kind} className="gk-well gk-cargo__row">
                      <span className="gk-cargo__head">
                        <img src={RESOURCE_ART[kind]} alt="" aria-hidden />
                        <span className="gk-label">{t(`clan.resources.${kind}`)}</span>
                      </span>
                      <SpendBar inline stock={stock} spend={cargo[kind]} tone={kind} label={t('clan.aid.cargo')} />
                      <Slider label={t(`clan.resources.${kind}`)} value={cargo[kind]} max={Math.min(stock, room)}
                        onChange={(value) => { updateCargo(kind, value); }} />
                    </div>
                  );
                })}
              </div>
            </section>

            {fuel > 0 && (
              <div data-aid-fuel className="gk-well gk-cargo__fuel">
                {/* The tank minus what the flight burns, after the hold takes its deuterium: the server's own sum. */}
                <SpendBar inline stock={Math.max(0, spendableDeuterium)} spend={fuel} tone="deuterium" label={t('clan.aid.fuel')} />
              </div>
            )}
            <GameButton tone="action" wide glyph="eye" disabledReason={validPayload ? null : t('clan.aid.check')}
              pending={actions.quoteAid.isPending}
              onPress={() => {
                if (!payload) return;
                actions.quoteAid.mutate(payload, { onSuccess: () => { setQuotedKey(payloadKey); } });
              }}>
              {t('clan.aid.check')}
            </GameButton>
            {aidError(actions.quoteAid)}

            {quote ? (
              <div data-aid-quote className="gk-well gk-aid__quote">
                <dl className="gk-figures gk-figures--two">
                  <div className="gk-figure">
                    <dt className="gk-label">{t('clan.aid.arrival')}</dt>
                    <dd className="gk-num gk-figure__value" data-tone="self">{duration(quote.travelMinutes)}</dd>
                  </div>
                  <div className="gk-figure">
                    <dt className="gk-label">{t('clan.aid.receiverRoom')}</dt>
                    <dd className="gk-num gk-figure__value" data-tone={quote.withinAllowance ? 'good' : 'hostile'}>
                      {quote.withinAllowance ? t('clan.aid.fits') : t('clan.aid.overLimit')}
                    </dd>
                  </div>
                </dl>
                {/* The receiver's bays: a shipment needs a free one at the far end to land at all. */}
                <div className="gk-aid__bays">
                  <Cells cells={bays} label={t('clan.aid.bayUse', { used: quote.bay.used, total: quote.bay.total })} />
                  <span className="gk-chip" data-tone={quote.bay.available ? 'good' : 'hostile'}>
                    {quote.bay.available ? t('clan.aid.bayReady') : t('clan.aid.bayFull')}
                  </span>
                </div>
                {!quote.canLand ? <p className="gk-inote" data-tone="hostile">{t('clan.aid.cannotLand')}</p> : null}
                {!quote.canFinishBeforeSeasonEnd ? <p className="gk-inote" data-tone="hostile">{t('clan.aid.tooLate')}</p> : null}
                {/* Said here, before the hold, rather than as a refusal on commit. R4, 2026-09-23. */}
                {shieldedUntil !== null ? (
                  <p data-aid-shielded className="gk-inote" data-tone="hostile">
                    {t('clan.aid.senderShielded', { duration: duration(minutesUntil(shieldedUntil, now)) })}
                  </p>
                ) : null}
                <p className="gk-sub">
                  {t(resourceDelivery ? 'clan.aid.plannedReturn' : 'clan.aid.possibleReturn', {
                    duration: duration(minutesUntil(quote.possibleReturnAt, now)),
                  })}
                </p>
                <div className="gk-aid__limit"><span>{t('clan.aid.remainingLimit')}</span><CostLine cost={quote.remaining} /></div>
                <div className="gk-aid__limit"><span>{t('clan.aid.limitValue')}</span><CostLine cost={quote.value} /></div>
                {quote.nextReleaseAt ? (
                  <p className="gk-sub">{t('clan.aid.nextLimit', { duration: duration(minutesUntil(quote.nextReleaseAt, now)) })}</p>
                ) : null}
                {/*
                  A GIFT CANNOT BE CALLED BACK: the kit's FINAL hold, 1.5 s (K4, D5). The reasons it is
                  refused are stated above it, so the refused face keeps the verb. `fuelled` is the live
                  read of the sender's own store, which is what the launch refuses on.
                */}
                <GameHold weight="final" glyph="share" commitSound="launch" label={sendLabel}
                  disabledReason={launchBlocked
                    ? t('faults.launchBlock.SHIPYARD_REVOLT')
                    : shieldedUntil !== null || !quote.canLand || !quote.withinAllowance || !quote.bay.available
                      || !quote.canFinishBeforeSeasonEnd || !fuelled || actions.launchAid.isPending
                      ? sendLabel
                      : null}
                  onCommit={() => {
                    if (!payload) return;
                    actions.launchAid.mutate(payload, { onSuccess: () => { setLaunched(true); setFleet({}); setCargo({ ...ZERO }); setQuotedKey(null); } });
                  }} />
              </div>
            ) : null}
            {launched ? <p role="status" className="gk-inote" data-tone="good">{t('clan.aid.launched')}</p> : null}
            {aidError(actions.launchAid)}
          </>
        )}
      </section>

      <section className="gk-aid__part">
        <SectionTag as="h3">{t('clan.aid.transfersHeading')}</SectionTag>
        {loading ? (
          <p role="status" className="gk-sub">{t('clan.aid.transfersWaiting')}</p>
        ) : transfers.length === 0 ? (
          <p className="gk-sub">{t('clan.aid.transfersEmpty')}</p>
        ) : (
          <ol className="gk-aid__transfers">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="gk-well gk-aid__transfer">
                <span className="gk-aid__who">
                  {transfer.direction === 'OUTGOING'
                    ? t('clan.aid.toCommander', { name: transfer.counterpart.username })
                    : t('clan.aid.fromCommander', { name: transfer.counterpart.username })}
                </span>
                <span className="gk-chip" data-tone={transfer.status === 'DELIVERED' ? 'good' : transfer.status === 'RETURNING' ? 'hostile' : 'self'}>
                  {t(`clan.aid.status.${transfer.status}`)}
                </span>
                <span className="gk-sub">{transfer.origin.name} → {transfer.target.name}</span>
                <span className="gk-sub gk-num">{t('clan.aid.manifest', { ships: fleetCount(transfer.fleet), cargo: full(resourceTotal(transfer.cargo)) })}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ClanEventRow({ event, now }: { event: ClanEvent; now: number }) {
  const { t } = useTranslation();
  return (
    <li className="gk-clanlog__row">
      <p>{describeClanEvent(event, t)}</p>
      <p className="gk-sub">{chatRelativeTime(event.occurredAt, now, t)}</p>
    </li>
  );
}

function describeClanEvent(event: ClanEvent, t: TFunction): string {
  const actor = event.actorName ?? t('clan.history.someone');
  const subject = event.subjectName ?? t('clan.history.someone');
  switch (event.kind) {
    case 'CREATED': return t('clan.history.events.created', { actor });
    case 'JOINED': return t('clan.history.events.joined', { subject });
    case 'LEFT': return t('clan.history.events.left', { subject });
    case 'KICKED': return t('clan.history.events.kicked', { actor, subject });
    case 'INVITED': return t('clan.history.events.invited', { actor, subject });
    case 'LEADERSHIP_TRANSFERRED': return t('clan.history.events.leadership', { actor, subject });
    case 'LEADERSHIP_RECLAIMED': return t('clan.history.events.leadershipReclaimed', { subject });
    case 'MEMBER_RECLAIMED': return t('clan.history.events.memberReclaimed', { subject });
    case 'SETTINGS_CHANGED': return t('clan.history.events.settings', { actor });
    default: return t('clan.history.events.other');
  }
}

function Confirmation({
  title,
  body,
  confirm,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  body: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Plate tone="threat" className="mt-2 px-2 py-2" as="aside">
      <p className="font-semibold text-v2-hostile">{title}</p>
      <p className="mt-2 text-caption leading-relaxed text-v2-ink-2">{body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onConfirm}>{confirm}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>{t('clan.cancel')}</Button>
      </div>
    </Plate>
  );
}

function ResourceFigures({
  resources,
  label,
}: {
  resources: Resources;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="gk-depot">
      {label ? <p className="gk-label">{label}</p> : null}
      <div className="gk-depot__row">
        {(['alloy', 'crystal', 'deuterium'] as const).map((of) => (
          <div key={of} className="gk-depot__cell" data-resource={of}>
            <img src={RESOURCE_ART[of]} alt="" aria-hidden />
            <span className="gk-num gk-depot__value">{full(resources[of])}</span>
            <span className="gk-label">{t(`clan.resources.${of}`)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MutationError({ mutation }: { mutation: Pick<UseMutationResult, 'isError' | 'error'> }) {
  return mutation.isError
    ? <p role="alert" className="mt-3 text-caption leading-relaxed text-v2-hostile">{describeError(mutation.error)}</p>
    : null;
}

function resourceTotal(resources: Resources): number {
  return resources.alloy + resources.crystal + resources.deuterium;
}

function isHostileAck(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'CLAN_HOSTILE_FLIGHT_ACK_REQUIRED';
}
