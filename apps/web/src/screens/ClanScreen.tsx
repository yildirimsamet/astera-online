import {
  CLAN,
  CLAN_TRANSFERABLE_HULLS,
  clanNameIsValid,
  clanTagIsValid,
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
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import type { UseMutationResult } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  useClanActions,
  useClanAid,
  useClanDepot,
  useClanDirectory,
  useClanEvents,
  useClanHome,
  useClanLeaderboard,
  useClanStrength,
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
import { full, signed } from '../lib/format.js';
import { duration, minutesUntil, useNow } from '../lib/time.js';
import { useWorld } from '../api/world.js';
import { QuantityStepper } from '../ui/QuantityStepper.js';
import { CapacityBar } from '../ui/CapacityBar.js';
import { SpendBar } from '../ui/SpendBar.js';
import { Tally } from '../ui/Tally.js';
import { RESOURCE_ART } from '../ui/assets.js';
import {
  ClanIcon,
  ClockIcon,
  CoreIcon,
  GalaxyIcon,
  LeaderboardIcon,
} from '../ui/icons/index.js';
import {
  Button,
  Chip,
  EmptyState,
  Note,
  Plate,
  PriceTag,
  Section,
  Segmented,
  Stat,
  Unreachable,
  Waiting,
} from '../ui/kit/index.js';

type ClanTab = 'overview' | 'strength' | 'members' | 'aid';
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
export function ClanScreen() {
  const { t } = useTranslation();
  const home = useClanHome();
  const actions = useClanActions();
  const galaxy = useGalaxy();
  const [tab, setTab] = useState<ClanTab>('overview');
  const marked = useRef(false);
  const liveHome = useLiveClanHome(home.data);
  const member: ClanMemberHome | null = liveHome?.state === 'MEMBER' ? liveHome : null;

  const depot = useClanDepot(home.data !== undefined);
  const events = useClanEvents(member?.clan.mature === true && tab === 'overview');
  const standings = useClanLeaderboard(member !== null && tab === 'overview');
  const aid = useClanAid(member !== null && tab === 'aid');
  const strength = useClanStrength(member !== null && tab === 'strength');
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

  const tabs = [
    { id: 'overview' as const, label: t('clan.tabs.overview') },
    { id: 'strength' as const, label: t('clan.tabs.strength') },
    { id: 'members' as const, label: t('clan.tabs.members') },
    { id: 'aid' as const, label: t('clan.tabs.aid') },
  ];

  return (
    <div className="flex flex-col">
      <ClanHeader home={inside} />
      <div className="sticky top-0 z-10 border-y border-line-soft bg-void px-3 py-2">
        <Segmented
          segments={tabs}
          value={tab}
          onSelect={setTab}
          label={t('clan.tabs.label')}
          role="tablist"
          size="sm"
          panelId={(id) => `clan-panel-${id}`}
          tabId={(id) => `clan-tab-${id}`}
        />
      </div>

      <div
        id={`clan-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`clan-tab-${tab}`}
        className="px-4 py-4"
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
  return (
    <header className="relative overflow-hidden px-4 pb-5 pt-2">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_20%,rgba(89,200,255,0.13),transparent_42%)]" />
      <div className="relative flex items-start gap-3">
        <span className="socket grid size-12 shrink-0 place-items-center rounded-control text-crystal">
          <ClanIcon className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="crystal">[{home.clan.tag}]</Chip>
            {home.clan.role === 'LEADER' ? <Chip tone="opportunity">{t('clan.leader')}</Chip> : null}
          </div>
          <h3 className="headline mt-2 break-words text-pretty text-readout text-bone">{home.clan.name}</h3>
          <p className="mt-1 text-caption leading-relaxed text-dim">
            {home.clan.description || t('clan.noDescription')}
          </p>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-3">
        <Plate sunk className="px-3 py-3">
          <Stat label={t('clan.membersCountLabel')} value={`${String(home.members.length)} / ${String(CLAN.maxMembers)}`} size="sm" />
        </Plate>
        <Plate sunk className="px-3 py-3">
          <Stat
            label={t('clan.scoreLabel')}
            value={home.clan.score === 0 ? full(0) : signed(home.clan.score)}
            tone={home.clan.score > 0 ? 'opportunity' : home.clan.score < 0 ? 'threat' : 'dim'}
            size="sm"
          />
        </Plate>
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
    <div className="flex flex-col gap-7 px-4 py-2">
      <header className="plate plate-cut relative overflow-hidden px-5 py-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(89,200,255,0.16),transparent_45%)]" />
        <ClanIcon className="relative size-7 text-crystal" />
        <p className="legend relative mt-4 text-crystal">{t('clan.outside.eyebrow')}</p>
        <h3 className="headline relative mt-2 text-readout text-bone">{t('clan.outside.title')}</h3>
        <p className="relative mt-3 max-w-[42ch] text-body leading-relaxed text-dim">
          {t('clan.outside.body')}
        </p>
      </header>

      <Section label={t('clan.benefits.heading')}>
        <Benefit icon={<GalaxyIcon className="size-5" />} title={t('clan.benefits.safeTitle')} body={t('clan.benefits.safeBody')} />
        <Benefit icon={<LeaderboardIcon className="size-5" />} title={t('clan.benefits.lootTitle')} body={t('clan.benefits.lootBody')} />
        <Benefit icon={<ClockIcon className="size-5" />} title={t('clan.benefits.aidTitle')} body={t('clan.benefits.aidBody')} />
        <Benefit icon={<ClanIcon className="size-5" />} title={t('clan.benefits.recordTitle')} body={t('clan.benefits.recordBody')} />
      </Section>

      {hasDepot ? (
        <Section label={t('clan.depot.formerHeading')}>
          <Plate tone="opportunity" className="px-4 py-4">
            <p className="text-body text-bone">{t('clan.depot.formerBody')}</p>
            <ResourceFigures resources={depot} className="mt-3" />
            <Button
              className="mt-4"
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
          <div className="flex flex-col gap-3">
            {home.requests.map((request) => {
              const pending = request.status === 'PENDING';
              return (
                <Plate key={request.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="name truncate text-bone">[{request.clanTag}] {request.clanName}</p>
                      <p className="mt-1 text-caption text-faint">
                        {request.kind === 'INVITATION'
                          ? t('clan.requests.invitation')
                          : t(`clan.requests.status.${request.status}`)}
                      </p>
                    </div>
                    {pending ? <Chip tone="opportunity">{duration(minutesUntil(request.expiresAt, now))}</Chip> : null}
                  </div>
                  {pending && request.kind === 'INVITATION' ? (
                    <div className="mt-4 flex flex-wrap gap-2">
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
                      className="mt-4"
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
              value={searchDraft}
              maxLength={40}
              onChange={(event) => { setSearchDraft(event.currentTarget.value); }}
              placeholder={t('clan.directory.search')}
              className="field min-h-11"
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
          <ol className="flex flex-col gap-3">
            {listedClans.map((clan) => {
              const applied = pendingApplications.has(clan.id);
              const fullClan = clan.memberCount >= CLAN.maxMembers;
              const canApply = clan.recruiting && !fullClan && !applied && !locked;
              return (
                <li key={clan.id}>
                  <Plate className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className="socket grid size-8 shrink-0 place-items-center rounded-control text-crystal">
                        <ClanIcon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone="crystal">[{clan.tag}]</Chip>
                          <strong className="name truncate text-bone">{clan.name}</strong>
                        </div>
                        <p className="mt-2 text-caption leading-relaxed text-dim">
                          {clan.description || t('clan.noDescription')}
                        </p>
                        <p className="mt-2 text-label text-faint">
                          {t('clan.directory.meta', {
                            leader: clan.leaderName,
                            members: clan.memberCount,
                            score: clan.score === 0 ? full(0) : signed(clan.score),
                          })}
                        </p>
                      </div>
                    </div>
                    <Button
                      full
                      className="mt-4"
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
        {notice ? <p role="status" className="text-caption text-opportunity">{notice}</p> : null}
        <MutationError mutation={actions.apply} />
      </Section>

      <FoundClan home={home} actions={actions} />
    </div>
  );
}

function Benefit({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Plate className="flex items-start gap-3 px-4 py-4">
      <span className="socket grid size-10 shrink-0 place-items-center rounded-control text-crystal">{icon}</span>
      <span className="min-w-0">
        <strong className="name block text-bone">{title}</strong>
        <span className="mt-1 block text-caption leading-relaxed text-dim">{body}</span>
      </span>
    </Plate>
  );
}

function FoundClan({ home, actions }: { home: ClanOutsideHome; actions: Actions }) {
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
      <Plate className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className={`rounded-control border px-3 py-3 ${coreReady ? 'border-opportunity/30 bg-opportunity/5' : 'border-line-soft bg-deep'}`}>
            <CoreIcon className="size-5 text-crystal" />
            <p className="name mt-2 text-bone">
              {t('clan.found.core', { current: home.creation.coreLevel, required: home.creation.requiredCoreLevel })}
            </p>
          </div>
          <div className={`rounded-control border px-3 py-3 ${home.creation.affordable ? 'border-opportunity/30 bg-opportunity/5' : 'border-line-soft bg-deep'}`}>
            <p className="legend">{t('clan.found.cost')}</p>
            <PriceTag
              className="mt-3"
              alloy={home.creation.cost.alloy}
              crystal={home.creation.cost.crystal}
              exact
            />
          </div>
        </div>
        {locked ? (
          <p className="mt-3 text-caption text-threat">
            {t('clan.found.locked', { duration: duration(minutesUntil(home.creation.unlockedAt!, now)) })}
          </p>
        ) : null}
        <Note>{t('clan.found.identityNote')}</Note>

        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label>
            <span className="legend mb-1 block">{t('clan.found.nameLabel')}</span>
            <input
              value={name}
              maxLength={CLAN.nameMaxChars}
              onChange={(event) => { setName(event.currentTarget.value); }}
              placeholder={t('clan.found.namePlaceholder')}
              className="field min-h-11"
            />
          </label>
          <label>
            <span className="legend mb-1 block">{t('clan.found.tagLabel')}</span>
            <input
              value={tag}
              maxLength={CLAN.tagMaxChars}
              onChange={(event) => { setTag(event.currentTarget.value.toUpperCase()); }}
              placeholder="ORB"
              autoCapitalize="characters"
              className="field min-h-11 uppercase"
            />
          </label>
          <label>
            <span className="legend mb-1 block">{t('clan.found.descriptionLabel')}</span>
            <textarea
              value={description}
              rows={3}
              onChange={(event) => {
                setDescription(Array.from(event.currentTarget.value).slice(0, CLAN.descriptionMaxChars).join(''));
              }}
              placeholder={t('clan.found.descriptionPlaceholder')}
              className="field resize-none"
            />
            <span className="mt-1 block text-right text-micro text-faint">
              {t('clan.charactersLeft', { count: CLAN.descriptionMaxChars - Array.from(description).length })}
            </span>
          </label>
          <label className="plate plate-sunk flex items-center gap-3 px-3 py-3">
            <input
              type="checkbox"
              checked={recruiting}
              onChange={(event) => { setRecruiting(event.currentTarget.checked); }}
              className="size-5 accent-[var(--color-crystal)]"
            />
            <span>
              <span className="name block text-bone">{t('clan.found.recruiting')}</span>
              <span className="mt-1 block text-label text-faint">{t('clan.found.recruitingHint')}</span>
            </span>
          </label>
          <Button type="submit" full size="lg" variant="primary" disabled={!canCreate || actions.create.isPending}>
            {t('clan.found.submit')}
          </Button>
        </form>
        {created ? <p role="status" className="mt-3 text-caption text-opportunity">{t('clan.found.created')}</p> : null}
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
    <div className="flex flex-col gap-7">
      <ClanSeats members={home.members} now={now} />

      {!home.clan.mature ? (
        <Plate tone="lit" cut className="px-4 py-4">
          <div className="flex items-start gap-3">
            <ClockIcon className="mt-0.5 size-5 shrink-0 text-crystal" />
            <div>
              <p className="name text-bone">{t('clan.adaptation.title')}</p>
              <p className="mt-1 text-caption leading-relaxed text-dim">
                {t('clan.adaptation.openNow')}
              </p>
              <p className="mt-2 text-caption leading-relaxed text-crystal">
                {t('clan.adaptation.opensLater', {
                  duration: duration(minutesUntil(home.clan.matureAt, now)),
                })}
              </p>
            </div>
          </div>
        </Plate>
      ) : (
        <Plate tone="opportunity" className="px-4 py-4">
          <p className="name text-opportunity">{t('clan.adaptation.readyTitle')}</p>
          <p className="mt-1 text-caption leading-relaxed text-dim">{t('clan.adaptation.readyBody')}</p>
        </Plate>
      )}

      <Section label={t('clan.benefits.activeHeading')}>
        <div className="grid grid-cols-2 gap-3">
          <SmallRule title={t('clan.rules.peaceTitle')} body={t('clan.rules.peaceBody')} />
          <SmallRule title={t('clan.rules.aidTitle')} body={t('clan.rules.aidBody')} />
          <SmallRule title={t('clan.rules.lootTitle')} body={t('clan.rules.lootBody')} />
          <SmallRule title={t('clan.rules.limitTitle')} body={t('clan.rules.limitBody')} />
        </div>
      </Section>

      <ClanStandings home={home} standings={standings} />

      <Section label={t('clan.depot.heading')}>
        {depot.isError ? (
          <Unreachable what={t('clan.depot.heading')} onRetry={() => { void depot.refetch(); }} />
        ) : !depot.data ? (
          <Waiting>{t('clan.depot.waiting')}</Waiting>
        ) : (
          <Plate className="px-4 py-4">
            <p className="text-caption leading-relaxed text-dim">{t('clan.depot.body')}</p>
            <ResourceFigures resources={depot.data.resources} className="mt-4" />
            <Button
              full
              className="mt-4"
              variant="primary"
              disabled={resourceTotal(depot.data.resources) <= 0 || actions.claimDepot.isPending}
              onClick={() => { actions.claimDepot.mutate(); }}
            >
              {t('clan.depot.claim')}
            </Button>
            <Note>{t('clan.depot.claimHint')}</Note>
            <MutationError mutation={actions.claimDepot} />
          </Plate>
        )}
      </Section>

      <Section label={t('clan.history.heading')}>
        {!home.clan.mature ? (
          <Plate sunk className="px-4 py-5 text-center">
            <ClockIcon className="mx-auto size-5 text-faint" />
            <p className="mt-2 text-caption text-dim">{t('clan.history.adapting')}</p>
          </Plate>
        ) : events.isError ? (
          <Unreachable what={t('clan.history.heading')} onRetry={() => { void events.refetch(); }} />
        ) : !events.data ? (
          <Waiting>{t('clan.history.waiting')}</Waiting>
        ) : history.length === 0 ? (
          <EmptyState title={t('clan.history.empty')} />
        ) : (
          <ol className="divide-y divide-line-soft rounded-plate border border-line-soft bg-deep/60">
            {history.map((event) => <ClanEventRow key={event.id} event={event} now={now} />)}
          </ol>
        )}
        {events.hasNextPage ? (
          <Button size="sm" variant="ghost" disabled={events.isFetchingNextPage} onClick={() => { void events.fetchNextPage(); }}>
            {events.isFetchingNextPage ? t('clan.history.loadingOlder') : t('clan.history.older')}
          </Button>
        ) : null}
      </Section>
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

  return (
    <div className="flex flex-col gap-7">
      <Plate tone="opportunity" cut="lg" className="relative overflow-hidden px-4 py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,color-mix(in_srgb,var(--color-opportunity)_19%,transparent),transparent_46%)]" />
        <div className="relative">
          <p className="legend text-opportunity">[{strength.clan.tag}] {strength.clan.name}</p>
          <h2 className="headline mt-2 max-w-[18ch] text-title text-bone">
            {t('clan.strength.title')}
          </h2>
          <p className="mt-2 max-w-[44ch] text-caption leading-relaxed text-dim">
            {t('clan.strength.body')}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Plate sunk className="px-3 py-4">
              <Stat
                label={t('clan.strength.memberDominion')}
                value={full(strength.totals.memberDominion)}
                detail={t('clan.strength.memberDominionHint')}
                tone="opportunity"
                size="lg"
              />
            </Plate>
            <Plate sunk className="px-3 py-4">
              <Stat
                label={t('clan.strength.ships')}
                value={full(strength.totals.ships)}
                detail={t('clan.strength.shipsHint')}
                tone="crystal"
                size="lg"
              />
            </Plate>
          </div>
        </div>
      </Plate>

      <Section label={t('clan.strength.totalsHeading')}>
        <div className="grid grid-cols-2 gap-3">
          <Plate sunk className="px-3 py-3">
            <Stat
              label={t('clan.strength.clanDominion')}
              value={strength.totals.clanDominion === 0
                ? full(0)
                : signed(strength.totals.clanDominion)}
              detail={t('clan.strength.clanDominionHint')}
              tone={strength.totals.clanDominion > 0 ? 'opportunity' : 'dim'}
              size="sm"
            />
          </Plate>
          <Plate sunk className="px-3 py-3">
            <Stat label={t('clan.strength.worlds')} value={full(strength.totals.worlds)} size="sm" />
          </Plate>
          <Plate sunk className="px-3 py-3">
            <Stat label={t('clan.strength.fleetValue')} value={full(strength.totals.fleetValue)} size="sm" tone="alloy" />
          </Plate>
          <Plate sunk className="px-3 py-3">
            <Stat label={t('clan.strength.groundDefences')} value={full(strength.totals.groundDefences)} size="sm" />
          </Plate>
          <Plate sunk className="col-span-2 px-3 py-3">
            <Stat
              label={t('clan.strength.activeFlights')}
              value={full(strength.totals.activeFlights)}
              detail={t('clan.strength.activeFlightsHint')}
              size="sm"
              tone={strength.totals.activeFlights > 0 ? 'crystal' : 'dim'}
            />
          </Plate>
        </div>
      </Section>

      <Section label={t('clan.strength.compositionHeading')} aside={t('clan.strength.shipsCount', { count: strength.totals.ships })}>
        {strength.composition.length === 0 ? (
          <EmptyState title={t('clan.strength.noShips')} />
        ) : (
          <ol className="space-y-2">
            {strength.composition.map((entry) => (
              <li key={entry.hull} className="plate plate-sunk px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="name text-bone">{hullName(entry.hull) ?? entry.hull}</span>
                  <span className="num text-body text-crystal">{full(entry.count)}</span>
                </div>
                <div className="mt-2 flex h-1.5 gap-px" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, index) => (
                    <span
                      key={index}
                      className={`flex-1 rounded-cell ${index < Math.ceil((entry.count / largest) * 10) ? 'bg-crystal/80' : 'bg-line/60'}`}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {/*
        WHO IS PULLING THEIR WEIGHT, ANSWERED BY EYE. Owner instruction.

        This roster printed three figures per member — dominion, ships, worlds —
        so a full clan was fifteen numbers a reader had to compare across five
        rows to answer the one question anybody opens this list holding. Each
        member's Dominion is now a bar against the clan's strongest, so the
        pecking order is the shape of the column and the figures beside it are
        there to be checked rather than scanned.

        DOMINION IS THE BAR because Dominion is the score (invariants: score is
        Dominion, not net worth). Ships and worlds stay as figures: they are the
        working, not the standing.
      */}
      <Section label={t('clan.strength.membersHeading')} aside={t('clan.strength.membersCount', { count: strength.members.length })}>
        <ol className="divide-y divide-line-soft overflow-hidden rounded-plate border border-line-soft bg-deep/60">
          {strength.members.map((member) => (
            <li key={member.playerId} className="px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="name min-w-0 truncate text-bone">{member.username}</span>
                {member.role === 'LEADER' ? <Chip tone="opportunity">{t('clan.leader')}</Chip> : null}
              </div>
              <div
                className="socket mt-2 h-2 w-full overflow-hidden rounded-full"
                role="img"
                aria-label={t('clan.strength.memberLine', {
                  dominion: full(member.dominion),
                  ships: full(member.ships),
                  worlds: full(member.worlds),
                })}
              >
                <span
                  data-member-share
                  className="block h-full rounded-full bg-opportunity/70"
                  style={{
                    width: `${String(Math.max(0, Math.min(100, (member.dominion / strongest) * 100)))}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-caption text-dim">
                {t('clan.strength.memberLine', {
                  dominion: full(member.dominion),
                  ships: full(member.ships),
                  worlds: full(member.worlds),
                })}
              </p>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function ClanSeats({ members, now }: { members: readonly Member[]; now: number }) {
  const { t } = useTranslation();
  return (
    <Section
      label={t('clan.seats.heading')}
      aside={t('clan.seats.count', { members: members.length })}
    >
      <div className="grid grid-cols-5 gap-2" role="list" aria-label={t('clan.seats.heading')}>
        {Array.from({ length: CLAN.maxMembers }, (_, slot) => {
          const member = members.find((candidate) => candidate.slot === slot);
          if (!member) {
            return (
              <div
                key={slot}
                role="listitem"
                aria-label={t('clan.seats.openLabel', { slot: slot + 1 })}
                className="grid min-w-0 place-items-center rounded-control border border-dashed border-line-soft px-1 py-3"
              >
                <span className="grid size-8 place-items-center rounded-full border border-line-soft text-caption text-faint">+</span>
                <span className="legend mt-2 truncate text-micro">{t('clan.seats.open')}</span>
              </div>
            );
          }
          const initial = Array.from(member.username)[0]?.toLocaleUpperCase() ?? '•';
          return (
            <div
              key={slot}
              role="listitem"
              aria-label={t('clan.seats.memberLabel', { slot: slot + 1, name: member.username })}
              title={member.username}
              className="min-w-0 rounded-control border border-crystal/20 bg-crystal/5 px-1 py-3 text-center"
            >
              <span className="socket mx-auto grid size-8 place-items-center rounded-full text-caption text-crystal">
                {initial}
              </span>
              <span className="name mt-2 block truncate text-micro text-bone">{member.username}</span>
              <span className={`mt-1 block truncate text-micro ${member.mature ? 'text-opportunity' : 'text-crystal'}`}>
                {member.role === 'LEADER'
                  ? t('clan.seats.leader')
                  : member.mature
                    ? t('clan.seats.ready')
                    : duration(minutesUntil(member.matureAt, now))}
              </span>
            </div>
          );
        })}
      </div>
    </Section>
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
   * The widest score on the board, so every bar shares one scale.
   *
   * ABSOLUTE, because a clan's score can be negative — Dominion is zero-sum and a
   * clan that has been raided harder than it has raided sits below the line. The
   * bar for one of those grows LEFT from the centre, so "behind" is a direction
   * rather than a minus sign to notice.
   */
  const widest = Math.max(1, ...rows.map((clan) => Math.abs(clan.score)));

  return (
    <Section label={t('clan.standings.heading')} aside={t('clan.standings.aside')}>
      {standings.isError ? (
        <Unreachable what={t('clan.standings.heading')} onRetry={() => { void standings.refetch(); }} />
      ) : !standings.data ? (
        <Waiting>{t('clan.standings.waiting')}</Waiting>
      ) : rows.length === 0 ? (
        <EmptyState title={t('clan.standings.empty')} />
      ) : (
        <ol className="divide-y divide-line-soft rounded-plate border border-line-soft bg-deep/60">
          {rows.map((clan, index) => {
            const separated = index === 5;
            return (
              <li
                key={clan.id}
                aria-current={clan.self ? 'true' : undefined}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 ${
                  clan.self ? 'bg-crystal/8' : ''
                } ${separated ? 'border-t-2 border-crystal/25' : ''}`}
              >
                <span className={`num text-center text-body ${clan.self ? 'text-crystal' : 'text-faint'}`}>
                  {clan.rank}
                </span>
                <span className="min-w-0">
                  <span className="name block truncate text-bone">
                    <span className="text-crystal">[{clan.tag}]</span> {clan.name}
                  </span>
                  <span className="mt-1 block truncate text-micro text-faint">
                    {t('clan.standings.crew', { members: clan.memberCount })}
                    {clan.self ? ` · ${t('clan.you')}` : ''}
                  </span>
                </span>
                {/*
                  A LADDER IS A COMPARISON, SO IT IS DRAWN AS ONE. Owner
                  instruction.

                  Six signed figures in a column is a table a reader sorts in
                  their head to answer "how far behind are we". A bar off a centre
                  line answers it without being read: length is the gap, and the
                  SIDE is whether the clan is up or down on the season. The figure
                  keeps its place beside the bar, because a standing is eventually
                  something you quote.
                */}
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    aria-hidden
                    /*
                      ALWAYS DRAWN, and narrow enough to survive a 390px row
                      beside a rank, a name and a signed figure. Tailwind v4 has
                      no `xs` breakpoint, so hiding it below one would have hidden
                      it on every phone the game is played on.
                    */
                    className="relative block h-2 w-12 shrink-0 overflow-hidden rounded-full bg-line/50"
                  >
                    <span
                      data-clan-score
                      className={`absolute inset-y-0 ${
                        clan.score < 0 ? 'right-1/2 bg-threat/70' : 'left-1/2 bg-opportunity/70'
                      }`}
                      style={{ width: `${String((Math.abs(clan.score) / widest) * 50)}%` }}
                    />
                    <span className="absolute inset-y-0 left-1/2 w-px bg-bone/40" />
                  </span>
                  <span className={`num text-body ${clan.score > 0 ? 'text-opportunity' : clan.score < 0 ? 'text-threat' : 'text-dim'}`}>
                    {clan.score === 0 ? full(0) : signed(clan.score)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

function SmallRule({ title, body }: { title: string; body: string }) {
  return (
    <Plate sunk className="px-3 py-3">
      <p className="name text-bone">{title}</p>
      <p className="mt-1 text-label leading-relaxed text-faint">{body}</p>
    </Plate>
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
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState<{ kind: 'kick' | 'leadership' | 'leave' | 'disband'; member?: Member } | null>(null);
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
      actions.disband.mutate(undefined, { onSuccess: () => { setConfirm(null); } });
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <Section label={t('clan.members.heading')} aside={`${String(home.members.length)} / ${String(CLAN.maxMembers)}`}>
        <ol className="flex flex-col gap-3">
          {home.members.map((member) => {
            const self = member.playerId === selfPlayerId;
            return (
              <li key={member.playerId}>
                <Plate className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="name truncate text-bone">{member.username}</strong>
                        {self ? <Chip tone="crystal">{t('clan.you')}</Chip> : null}
                        {member.role === 'LEADER' ? <Chip tone="opportunity">{t('clan.leader')}</Chip> : null}
                      </div>
                      <p className="mt-1 text-label text-faint">
                        {member.mature ? t('clan.members.ready') : t('clan.members.adapting')}
                        {' · '}
                        {member.activeRecently ? t('clan.members.active') : t('clan.members.away')}
                      </p>
                    </div>
                    <span className={`size-2 shrink-0 rounded-full ${member.activeRecently ? 'bg-opportunity' : 'bg-line'}`} aria-hidden />
                  </div>
                  {home.clan.role === 'LEADER' && !self ? (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
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
                <Plate key={request.id} className="px-4 py-4">
                  <p className="name text-bone">{request.username}</p>
                  <p className="mt-1 text-label text-faint">{t('clan.applications.expires', { duration: duration(minutesUntil(request.expiresAt, now)) })}</p>
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
            <Plate className="px-4 py-4">
              <p className="text-caption leading-relaxed text-dim">{t('clan.invite.body')}</p>
              <label className="mt-3 block">
                <span className="sr-only">{t('clan.invite.choose')}</span>
                <select value={invitee} onChange={(event) => { setInvitee(event.currentTarget.value); }} className="field min-h-11">
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

          <Section label={t('clan.settings.heading')}>
            <Plate className="px-4 py-4">
              <label>
                <span className="legend mb-1 block">{t('clan.settings.description')}</span>
                <textarea
                  value={description}
                  rows={3}
                  onChange={(event) => {
                    setDescription(Array.from(event.currentTarget.value).slice(0, CLAN.descriptionMaxChars).join(''));
                    setSaved(false);
                  }}
                  className="field resize-none"
                />
              </label>
              <label className="mt-3 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={recruiting}
                  onChange={(event) => { setRecruiting(event.currentTarget.checked); setSaved(false); }}
                  className="size-5 accent-[var(--color-crystal)]"
                />
                <span className="name text-bone">{t('clan.settings.recruiting')}</span>
              </label>
              <Button
                className="mt-4"
                variant="primary"
                disabled={actions.settings.isPending || (description === home.clan.description && recruiting === home.clan.recruiting)}
                onClick={() => {
                  actions.settings.mutate({ description, recruiting }, { onSuccess: () => { setSaved(true); } });
                }}
              >
                {t('clan.settings.save')}
              </Button>
              {saved ? <p role="status" className="mt-2 text-caption text-opportunity">{t('clan.settings.saved')}</p> : null}
              <Note>{t('clan.settings.identityLocked')}</Note>
              <MutationError mutation={actions.settings} />
            </Plate>
          </Section>
        </>
      ) : null}

      <Section label={t('clan.danger.heading')}>
        <Plate tone="threat" className="px-4 py-4">
          <p className="text-caption leading-relaxed text-dim">
            {home.clan.role === 'LEADER' ? t('clan.danger.leaderBody') : t('clan.danger.memberBody')}
          </p>
          <Button
            full
            className="mt-4"
            variant="ghost"
            onClick={() => { setConfirm({ kind: home.clan.role === 'LEADER' ? 'disband' : 'leave' }); }}
          >
            {home.clan.role === 'LEADER' ? t('clan.danger.disband') : t('clan.danger.leave')}
          </Button>
          {confirm && !confirm.member ? (
            <Confirmation
              title={confirm.kind === 'disband' ? t('clan.danger.disbandTitle') : t('clan.danger.leaveTitle')}
              body={confirm.kind === 'disband' ? t('clan.danger.disbandConfirmBody') : t('clan.danger.leaveConfirmBody')}
              confirm={confirm.kind === 'disband' ? t('clan.danger.disbandConfirm') : t('clan.danger.leaveConfirm')}
              onCancel={() => { setConfirm(null); }}
              onConfirm={runConfirm}
              busy={actions.disband.isPending || actions.leave.isPending}
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
  const cargoCapacity = clanTransferCargoCapacity(fleet);
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
      <Plate tone="lit" cut className="px-5 py-6 text-center">
        <ClockIcon className="mx-auto size-7 text-crystal" />
        <h3 className="headline mt-3 text-title text-bone">{t('clan.aid.adaptingTitle')}</h3>
        <p className="mx-auto mt-2 max-w-[38ch] text-caption leading-relaxed text-dim">
          {t('clan.aid.adaptingBody', { duration: duration(minutesUntil(home.clan.matureAt, now)) })}
        </p>
      </Plate>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <Section label={t('clan.aid.receiveHeading')}>
        <Plate className="flex items-center gap-3 px-4 py-4">
          <div className="min-w-0 flex-1">
            <p className="name text-bone">{home.clan.aidEnabled ? t('clan.aid.receiving') : t('clan.aid.paused')}</p>
            <p className="mt-1 text-caption leading-relaxed text-faint">{t('clan.aid.receiveHint')}</p>
          </div>
          <Button
            size="sm"
            variant={home.clan.aidEnabled ? 'ghost' : 'primary'}
            disabled={actions.aidPolicy.isPending}
            onClick={() => { actions.aidPolicy.mutate(!home.clan.aidEnabled); }}
          >
            {home.clan.aidEnabled ? t('clan.aid.pause') : t('clan.aid.resume')}
          </Button>
        </Plate>
        <MutationError mutation={actions.aidPolicy} />
      </Section>

      <Section label={t('clan.aid.sendHeading')}>
        <Plate tone="lit" className="px-4 py-4">
          <p className="text-caption leading-relaxed text-dim">{t('clan.aid.explainer')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip tone="crystal">{t('clan.aid.speed')}</Chip>
            <Chip tone="opportunity">{t('clan.aid.extraBay')}</Chip>
            <Chip>{t(resourceDelivery ? 'clan.aid.returns' : 'clan.aid.noRecall')}</Chip>
          </div>
        </Plate>

        {worlds.length === 0 ? (
          <EmptyState title={t('clan.aid.noOrigin')} />
        ) : recipients.length === 0 ? (
          <EmptyState title={t('clan.aid.noRecipient')}>
            {t('clan.aid.noRecipientHint')}
          </EmptyState>
        ) : (
          <Plate className="px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <SelectField
                label={t('clan.aid.origin')}
                value={origin?.planet.id ?? ''}
                onChange={(value) => { setOriginId(value); setFleet({}); setCargo({ ...ZERO }); setQuotedKey(null); setLaunched(false); }}
                options={worlds.map((world) => ({ value: world.planet.id, label: world.planet.name }))}
              />
              <SelectField
                label={t('clan.aid.recipient')}
                value={recipient?.playerId ?? ''}
                onChange={(value) => { setRecipientId(value); setTargetId(''); setQuotedKey(null); setLaunched(false); }}
                options={recipients.map((member) => ({ value: member.playerId, label: member.username }))}
              />
              <SelectField
                label={t('clan.aid.target')}
                value={target?.planetId ?? ''}
                onChange={(value) => { setTargetId(value); setQuotedKey(null); setLaunched(false); }}
                options={targets.map((world) => ({ value: world.planetId, label: world.name }))}
              />
            </div>

            <div className="mt-5 border-t border-line-soft pt-4">
              <p className="legend">{t(resourceDelivery ? 'clan.aid.transportShips' : 'clan.aid.ships')}</p>
              <div className="mt-3 flex flex-col gap-3">
                {CLAN_TRANSFERABLE_HULLS.map((hull) => {
                  const available = origin?.fleet[hull] ?? 0;
                  return (
                    <div key={hull} className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="name truncate text-bone">{hullName(hull) ?? hull}</p>
                        <p className="mt-1 text-label text-faint">{t('clan.aid.available', { count: available })}</p>
                      </div>
                      <QuantityStepper
                        value={fleet[hull] ?? 0}
                        min={0}
                        max={available}
                        onChange={(value) => { updateFleet(hull, value); }}
                        decreaseLabel={t('clan.aid.fewer', { name: hullName(hull) ?? hull })}
                        increaseLabel={t('clan.aid.more', { name: hullName(hull) ?? hull })}
                        valueLabel={t('clan.aid.shipCount', { name: hullName(hull) ?? hull })}
                        maxLabel={t('clan.aid.allShips', { name: hullName(hull) ?? hull })}
                        maxText={t('clan.aid.max')}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-line-soft pt-4">
              <p className="legend">{t('clan.aid.cargo')}</p>
              {/*
                THE HOLD, IN THE BAR THE BUILD SHEET AND THE TRANSFER SHEET BOTH
                DRAW. "1,200 / 4,000" is a fraction the player converts into the
                thing they wanted, which is whether the next thousand fits — and
                the segment for THIS load grows as the numbers are typed, so
                overfilling is visible while it happens rather than at the moment
                the button refuses.
              */}
              <div className="mt-2">
                <CapacityBar
                  total={cargoCapacity}
                  used={0}
                  incoming={cargoUsed}
                  label={t('clan.aid.cargo')}
                />
              </div>
              <p className="mt-1 text-label text-faint">{t('clan.aid.haulerOnly')}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['alloy', 'crystal', 'deuterium'] as const).map((kind) => (
                  <label key={kind}>
                    <span className="legend mb-1 block truncate">{t(`clan.resources.${kind}`)}</span>
                    <input
                      type="number"
                      min={0}
                      max={origin?.planet[kind] ?? 0}
                      step={1}
                      value={cargo[kind]}
                      onChange={(event) => { updateCargo(kind, event.currentTarget.valueAsNumber); }}
                      className="field min-h-11 px-2 text-right num"
                    />
                  </label>
                ))}
              </div>
            </div>

            {fuel > 0 && (
              <div data-aid-fuel className="mt-5 rounded-control border border-line-soft px-3 py-3">
                {/*
                  THE TANK, MINUS WHAT THE FLIGHT BURNS — measured against what is
                  left AFTER the hold takes its deuterium, which is the exact sum
                  `assertFuel` uses on the server. Loading the last of the tank as
                  a delivery now visibly eats the fuel bar instead of producing a
                  refusal on commit with nothing on screen to explain it.
                */}
                <SpendBar
                  stock={Math.max(0, spendableDeuterium)}
                  spend={fuel}
                  tone="deuterium"
                  label={t('clan.aid.fuel')}
                />
              </div>
            )}
            <Button
              full
              className="mt-5"
              variant="primary"
              disabled={!validPayload || actions.quoteAid.isPending}
              onClick={() => {
                if (!payload) return;
                actions.quoteAid.mutate(payload, { onSuccess: () => { setQuotedKey(payloadKey); } });
              }}
            >
              {t('clan.aid.check')}
            </Button>
            <MutationError mutation={actions.quoteAid} />

            {quote ? (
              <Plate sunk className="mt-4 px-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <Stat label={t('clan.aid.arrival')} value={duration(quote.travelMinutes)} size="sm" tone="crystal" />
                  <Stat label={t('clan.aid.receiverRoom')} value={quote.withinAllowance ? t('clan.aid.fits') : t('clan.aid.overLimit')} size="sm" tone={quote.withinAllowance ? 'opportunity' : 'threat'} />
                </div>
                {/*
                  THE RECEIVER'S BAYS, AS THE SAME RACK THE HEADER AND THE WORLDS
                  LIST DRAW. A shipment needs a free bay at the far end, and "1 / 3"
                  is the one figure in this quote a sender reads to find out
                  whether it can land at all.
                */}
                <div className="mt-3 flex items-center justify-between gap-3 rounded-control border border-line-soft px-3 py-2">
                  <Tally
                    used={quote.bay.used}
                    total={quote.bay.total}
                    tone={quote.bay.available ? 'crystal' : 'threat'}
                    label={t('clan.aid.bayUse', { used: quote.bay.used, total: quote.bay.total })}
                  />
                  <Chip tone={quote.bay.available ? 'opportunity' : 'threat'}>
                    {quote.bay.available ? t('clan.aid.bayReady') : t('clan.aid.bayFull')}
                  </Chip>
                </div>
                {!quote.canLand ? <p className="mt-3 text-caption text-threat">{t('clan.aid.cannotLand')}</p> : null}
                {!quote.canFinishBeforeSeasonEnd ? <p className="mt-3 text-caption text-threat">{t('clan.aid.tooLate')}</p> : null}
                <p className="mt-3 text-label text-faint">
                  {t(resourceDelivery ? 'clan.aid.plannedReturn' : 'clan.aid.possibleReturn', {
                    duration: duration(minutesUntil(quote.possibleReturnAt, now)),
                  })}
                </p>
                <ResourceFigures resources={quote.remaining} className="mt-4" label={t('clan.aid.remainingLimit')} />
                <ResourceFigures resources={quote.value} className="mt-4" label={t('clan.aid.limitValue')} />
                {quote.nextReleaseAt ? (
                  <p className="mt-3 text-label text-faint">
                    {t('clan.aid.nextLimit', {
                      duration: duration(minutesUntil(quote.nextReleaseAt, now)),
                    })}
                  </p>
                ) : null}
                <Button
                  full
                  className="mt-4"
                  variant="commit"
                  // `fuelled` is the live read of the sender's own store; the
                  // quote's `hasFuel` is a snapshot of the same sum taken one
                  // round trip ago, and the launch refuses on the live one.
                  disabled={!quote.canLand || !quote.withinAllowance || !quote.bay.available || !quote.canFinishBeforeSeasonEnd || !fuelled || actions.launchAid.isPending}
                  onClick={() => {
                    if (!payload) return;
                    actions.launchAid.mutate(payload, { onSuccess: () => { setLaunched(true); setFleet({}); setCargo({ ...ZERO }); setQuotedKey(null); } });
                  }}
                >
                  {t(resourceDelivery ? 'clan.aid.launchDelivery' : 'clan.aid.launch')}
                </Button>
              </Plate>
            ) : null}
            {launched ? <p role="status" className="mt-3 text-caption text-opportunity">{t('clan.aid.launched')}</p> : null}
            <MutationError mutation={actions.launchAid} />
          </Plate>
        )}
      </Section>

      <Section label={t('clan.aid.transfersHeading')}>
        {loading ? (
          <Waiting>{t('clan.aid.transfersWaiting')}</Waiting>
        ) : transfers.length === 0 ? (
          <EmptyState title={t('clan.aid.transfersEmpty')} />
        ) : (
          <ol className="flex flex-col gap-3">
            {transfers.map((transfer) => (
              <li key={transfer.id}>
                <Plate className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="name truncate text-bone">
                        {transfer.direction === 'OUTGOING'
                          ? t('clan.aid.toCommander', { name: transfer.counterpart.username })
                          : t('clan.aid.fromCommander', { name: transfer.counterpart.username })}
                      </p>
                      <p className="mt-1 text-label text-faint">
                        {transfer.origin.name} → {transfer.target.name}
                      </p>
                    </div>
                    <Chip tone={transfer.status === 'DELIVERED' ? 'opportunity' : transfer.status === 'RETURNING' ? 'threat' : 'crystal'}>
                      {t(`clan.aid.status.${transfer.status}`)}
                    </Chip>
                  </div>
                  <p className="mt-3 text-caption text-dim">
                    {t('clan.aid.manifest', { ships: fleetCount(transfer.fleet), cargo: full(resourceTotal(transfer.cargo)) })}
                  </p>
                </Plate>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function ClanEventRow({ event, now }: { event: ClanEvent; now: number }) {
  const { t } = useTranslation();
  return (
    <li className="px-4 py-3">
      <p className="text-body text-bone">{describeClanEvent(event, t)}</p>
      <p className="mt-1 text-micro text-faint">{chatRelativeTime(event.occurredAt, now, t)}</p>
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
    <Plate tone="threat" className="mt-4 px-4 py-4" as="aside">
      <p className="name text-threat-ink">{title}</p>
      <p className="mt-2 text-caption leading-relaxed text-dim">{body}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={onConfirm}>{confirm}</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>{t('clan.cancel')}</Button>
      </div>
    </Plate>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label>
      <span className="legend mb-1 block">{label}</span>
      <select value={value} onChange={(event) => { onChange(event.currentTarget.value); }} className="field min-h-11">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/**
 * THE THREE SUBSTANCES, WEARING THE FACES THE HEADER TAUGHT. Owner instruction.
 *
 * Alloy and Crystal had line glyphs here and deuterium had the LETTER D in a
 * green that belongs to opportunity, on the one screen where a commander is
 * deciding how much of each to hand to somebody else. Every other surface in the
 * game — the header, a price, a cargo slider, a build sheet — identifies these by
 * their render, so this was the only place a player had to read a label to know
 * which pile they were looking at.
 */
function ResourceFigures({
  resources,
  className = '',
  label,
}: {
  resources: Resources;
  className?: string;
  label?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      {label ? <p className="legend mb-2">{label}</p> : null}
      <div className="grid grid-cols-3 gap-2">
        <ResourceFigure of="alloy" label={t('clan.resources.alloy')} value={resources.alloy} />
        <ResourceFigure of="crystal" label={t('clan.resources.crystal')} value={resources.crystal} />
        <ResourceFigure of="deuterium" label={t('clan.resources.deuterium')} value={resources.deuterium} />
      </div>
    </div>
  );
}

const RESOURCE_INK = {
  alloy: 'text-alloy',
  crystal: 'text-crystal',
  deuterium: 'text-deuterium',
} as const;

function ResourceFigure({
  of,
  label,
  value,
}: {
  of: 'alloy' | 'crystal' | 'deuterium';
  label: string;
  value: number;
}) {
  return (
    <div className="plate plate-sunk min-w-0 px-2 py-3 text-center">
      <img
        src={RESOURCE_ART[of]}
        alt=""
        aria-hidden
        className="mx-auto size-5 object-contain"
      />
      <p className={`readout mt-1 truncate text-body ${RESOURCE_INK[of]}`}>{full(value)}</p>
      <p className="legend mt-1 truncate text-micro">{label}</p>
    </div>
  );
}

function MutationError({ mutation }: { mutation: Pick<UseMutationResult, 'isError' | 'error'> }) {
  return mutation.isError
    ? <p role="alert" className="mt-3 text-caption leading-relaxed text-threat">{describeError(mutation.error)}</p>
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
