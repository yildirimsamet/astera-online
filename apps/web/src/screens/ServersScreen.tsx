import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useServers } from '../api/queries.js';
import type { ServerRow } from '../api/schemas.js';
import { Button } from '../ui/kit/index.js';

/**
 * CHOOSING A GALAXY. D21.
 *
 * Ten galaxies, fifty worlds each, and exactly one of them will take you. The list
 * could therefore have been a single button — and it deliberately is not.
 *
 * WHY SHOW ALL TEN WHEN NINE ARE REFUSED. Because the shape of the world is the
 * first thing this game says about itself. A player who sees `Vantage 38/50` above
 * nine locked doors learns three things before they have pressed anything: that
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
  error,
}: {
  displayName: string;
  onChoose: (code: string) => void;
  onSignOut: () => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const servers = useServers();
  const [chosen, setChosen] = useState<string | null>(null);

  const rows = servers.data?.servers ?? [];
  const open = rows.find((s) => s.status === 'open');

  return (
    <main className="min-h-dvh bg-void px-5 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(28px+env(safe-area-inset-top))]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="legend">{t('servers.commanderLabel')}</p>
          <h1 className="mt-1 font-display text-[24px] uppercase tracking-[0.05em] text-bone">
            {displayName}
          </h1>
        </div>
        <Button size="sm" variant="ghost" onClick={onSignOut}>
          {t('servers.signOut')}
        </Button>
      </header>

      <p className="mt-6 max-w-md text-[14px] leading-relaxed text-dim">{t('servers.rule')}</p>

      {error !== undefined && (
        <p className="mt-4 text-[13px] text-alert" role="alert">
          {error}
        </p>
      )}

      {servers.isPending && <p className="legend mt-8 animate-pulse">{t('servers.loading')}</p>}

      {servers.isError && (
        <div className="mt-8">
          <p className="text-[14px] text-alert">{t('servers.unreachable')}</p>
          <Button
            className="mt-3"
            onClick={() => {
              void servers.refetch();
            }}
          >
            {t('servers.retry')}
          </Button>
        </div>
      )}

      <ul className="mt-6 flex flex-col gap-2" aria-label={t('servers.listLabel')}>
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

      {servers.isSuccess && rows.length === 0 && (
        <p className="mt-8 text-[14px] text-dim">{t('servers.noneOpen')}</p>
      )}

      {servers.isSuccess && rows.length > 0 && !open && (
        <p className="mt-6 text-[13px] text-faint">{t('servers.allFull')}</p>
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
  const fill = server.capacity > 0 ? Math.min(1, server.planets / server.capacity) : 0;

  return (
    <li>
      <div
        className={`plate plate-cut plate-cut-sm flex items-center gap-4 p-4 ${
          server.yours ? 'plate-opportunity' : joinable ? 'plate-lit' : ''
        } ${server.status === 'locked' || server.status === 'closed' ? 'opacity-55' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-[17px] uppercase tracking-[0.04em] text-bone">
              {server.name}
            </h2>
            {/* A galaxy opened outside `bootstrapServers` has no name and falls
                back to its code, and "EU-1  EU-1" reads as a rendering bug. */}
            {server.name !== server.code && <span className="legend">{server.code}</span>}
          </div>

          {/* The population bar. Fifty is a number a player can hold in their head,
              so the figure is exact and the bar is only there to be read at a
              glance — not the other way round. */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-well">
              <div
                className={`h-full rounded-full ${fill >= 1 ? 'bg-alloy' : 'bg-crystal'}`}
                style={{ width: `${String(Math.round(fill * 100))}%` }}
              />
            </div>
            <span className="readout shrink-0 text-[12px] text-dim">
              {server.planets}/{server.capacity}
            </span>
          </div>

          <p className="mt-1.5 text-[11px] text-faint">
            {server.online > 0 ? (
              <>
                <Trans
                  i18nKey="servers.online"
                  values={{ amount: server.online }}
                  components={[<span key="n" className="text-opportunity" />]}
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
          <Button size="sm" variant="primary" disabled={disabled} onClick={onChoose}>
            {busy ? t('servers.joining') : server.yours ? t('servers.enter') : t('servers.join')}
          </Button>
        )}
      </div>
    </li>
  );
}
