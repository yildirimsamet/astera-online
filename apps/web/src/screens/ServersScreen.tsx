import { AccountSecurityEntry } from './AccountSecuritySheet.js';
import { AccountDeletionEntry } from './AccountDeletionSheet.js';
import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { SERVERS } from '@astera/rules';
import { useServers } from '../api/queries.js';
import type { HistoricalSeasonResult, ServerRow } from '../api/schemas.js';
import { Banner, DoorRow, GameButton, ProgressBar } from '../game-ui/index.js';
import { SeasonRecap, useSeasonRecapOpening } from './SeasonRecap.js';
import { NextSeason } from '../ui/NextSeason.js';

/**
 * CHOOSING A GALAXY. D21. On the kit since C29 (2026-11-15).
 *
 * Two galaxies, `SERVERS.capacity` commander seats each, and exactly one of them will take you. The list
 * could therefore have been a single button — and it deliberately is not.
 *
 * WHY SHOW BOTH WHEN ONE MAY BE REFUSED. Because the shape of the world is the
 * first thing this game says about itself. A player who sees `Vantage 238/300` above
 * one locked door learns three things before they have pressed anything: that
 * there is a finite number of people in here, that they are being put with everyone
 * else rather than sprinkled across empty rooms, and that the galaxy they are about
 * to enter is nearly full of real commanders. A lone "Play" button says none of it.
 *
 * It is also the honest form of the rule. Sequential fill exists to stop the
 * project's second-highest risk — the empty shard — and a rule the player can see
 * is a rule they can trust rather than a queue they suspect.
 */
export function ServersScreen({
  displayName,
  onChoose,
  onSignOut,
  latestResult,
  error,
}: {
  displayName: string;
  onChoose: (code: string) => void;
  onSignOut: () => void;
  latestResult?: HistoricalSeasonResult | null;
  error?: string;
}) {
  const { t } = useTranslation();
  const servers = useServers();
  const [chosen, setChosen] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const openRecord = useCallback(() => {
    setRecordOpen(true);
  }, []);
  useSeasonRecapOpening(latestResult ? 'frozen' : undefined, latestResult, openRecord);

  const rows = servers.data?.servers ?? [];
  const open = rows.find((s) => s.status === 'open');
  /**
   * A galaxy that has frozen but not yet rolled over. Somebody arriving in that
   * window sees a list with nothing to join and no reason given; this is the reason.
   *
   * `closed` is the only status that means the season is not live. `full` and
   * `locked` are live galaxies with no seat for THIS caller, which is a different
   * sentence entirely — saying "a new galaxy is opening" there would be a lie.
   */
  const settling = rows.find((s) => s.status === 'closed' && s.endsAt !== null);

  return (
    <main className="gk gk-servers">
      <div className="gk-servers__column">
        <header className="gk-servers__head">
          <div className="min-w-0">
            <p className="gk-label">{t('servers.commanderLabel')}</p>
            <h1 className="gk-servers__name gk-display gk-outlined">{displayName}</h1>
          </div>
          <GameButton size="sm" tone="ghost" glyph="back" onPress={onSignOut}>{t('servers.signOut')}</GameButton>
        </header>

        <p className="gk-copy">{t('servers.rule', { seats: SERVERS.capacity })}</p>

        {latestResult && (
          <DoorRow glyph="ranking" tone="gold" title={t('seasonRecap.latestLabel')} sub={t('seasonRecap.latestHint')} onPress={openRecord} />
        )}

        {error !== undefined && <Banner tone="hostile" role="alert" title={error} />}

        {servers.isPending && <p className="gk-acct__note">{t('servers.loading')}</p>}

        {servers.isError && <>
          <Banner tone="hostile" role="alert" title={t('servers.unreachable')} />
          <GameButton wide pending={servers.isFetching} onPress={() => { void servers.refetch(); }}>{t('servers.retry')}</GameButton>
        </>}

        <ul className="gk-servers__list" aria-label={t('servers.listLabel')}>
          {rows.map((server) => (
            <ServerCard
              key={server.code}
              server={server}
              busy={chosen === server.code}
              disabled={chosen !== null}
              onChoose={() => {
                setChosen(server.code);
                onChoose(server.code);
              }}
            />
          ))}
        </ul>

        {servers.isSuccess && rows.length === 0 && <p className="gk-acct__note">{t('servers.noneOpen')}</p>}

        {servers.isSuccess && !open && settling?.endsAt && <NextSeason endsAt={settling.endsAt} />}

        {servers.isSuccess && rows.length > 0 && !open && !settling && <p className="gk-acct__note">{t('servers.allFull')}</p>}

        <div className="gk-acct__doors">
          <AccountSecurityEntry />
          <AccountDeletionEntry />
        </div>
      </div>

      {recordOpen && latestResult && (
        <SeasonRecap
          result={latestResult}
          galaxy={latestResult.shardName}
          canExplore={false}
          {...(settling?.endsAt ? { endsAt: settling.endsAt } : {})}
          onClose={() => {
            setRecordOpen(false);
          }}
        />
      )}
    </main>
  );
}

/**
 * What each status means, in the player's language rather than the server's.
 *
 * A map to KEYS rather than to sentences: a table of finished strings is built
 * once at module load and would still be English after the switcher was pressed.
 */
const EXPLAIN = {
  open: 'servers.status.open',
  full: 'servers.status.full',
  locked: 'servers.status.locked',
  closed: 'servers.status.closed',
} as const satisfies Record<ServerRow['status'], string>;

function ServerCard({
  server,
  busy,
  disabled,
  onChoose,
}: {
  server: ServerRow;
  busy: boolean;
  disabled: boolean;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  const joinable = server.status === 'open' && !server.yours;
  const full = server.capacity > 0 && server.planets >= server.capacity;

  return (
    <li>
      <div data-galaxy={server.code} data-status={server.status} className={`gk-cut gk-galaxy${server.yours || joinable ? ' gk-cut--self' : ''}`}>
        <div className="gk-galaxy__text">
          <div className="gk-galaxy__title">
            <h2 className="gk-galaxy__name gk-display gk-outlined">{server.name}</h2>
            {/* A galaxy opened outside `bootstrapServers` has no name and falls
                back to its code, and "EU-1  EU-1" reads as a rendering bug. */}
            {server.name !== server.code && <span className="gk-label">{server.code}</span>}
          </div>

          {/* The population bar. Fifty is a number a player can hold in their head,
              so the figure is exact and the bar is only there to be read at a
              glance — not the other way round. */}
          <div className="gk-galaxy__seats">
            <ProgressBar value={server.planets} max={server.capacity} tone={full ? 'alloy' : 'crystal'} />
            <span className="gk-galaxy__count gk-num">{server.planets}/{server.capacity}</span>
          </div>

          <p className="gk-galaxy__state">
            {server.online > 0 ? (
              <>
                <Trans
                  i18nKey="servers.online"
                  values={{ amount: server.online }}
                  components={[<span key="n" className="gk-galaxy__online" />]}
                />
                {' · '}
              </>
            ) : null}
            {server.yours ? t('servers.yours') : t(EXPLAIN[server.status])}
          </p>
        </div>

        {/**
         * `yours` normally cannot be true on this screen — a commander with a
         * planet is sent to their galaxy, not here. It happens when they joined in
         * ANOTHER TAB while this one was open, and the right answer then is a way
         * in rather than a row with no control on it. The press is the same call:
         * joining a galaxy you are already in returns the planet you already have.
         */}
        {(server.yours || joinable) && (
          <GameButton tone="action" glyph="rocket" pending={disabled} onPress={onChoose}>
            {busy ? t('servers.joining') : server.yours ? t('servers.enter') : t('servers.join')}
          </GameButton>
        )}
      </div>
    </li>
  );
}
