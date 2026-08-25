import { useTranslation } from 'react-i18next';

export function DiscReadout({
  shardName,
  shard,
  online,
  children,
}: {
  shardName?: string;
  shard: string;
  online?: number;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const showServer = shardName !== undefined && shardName !== '';

  return (
    <div className="pointer-events-auto plate plate-inset max-w-[calc(100vw-1.5rem)] px-2 py-1">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="legend flex min-w-0 items-baseline gap-1 text-micro tracking-label">
          <span className="shrink-0">{t('galaxy.discLabel')}</span>
          {showServer ? (
            <span className="min-w-0 truncate text-faint" title={`${shardName} (${shard})`}>
              · {t('galaxy.serverLabel', { name: shardName, code: shard })}
            </span>
          ) : null}
        </p>
        {online !== undefined ? (
          <p className="flex shrink-0 items-center gap-1 text-micro leading-none text-dim">
            <span className="size-1 rounded-full bg-opportunity" aria-hidden="true" />
            {t('galaxy.online', { count: online })}
          </p>
        ) : null}
      </div>
      <p className="num mt-1 truncate text-micro leading-tight text-bone">{children}</p>
    </div>
  );
}
