import { useTranslation } from 'react-i18next';

export function ArenaEntry({ onEnter }: { onEnter: () => void }) {
  const { t } = useTranslation();
  return <section className="mx-3 overflow-hidden rounded-xl border border-v2-line bg-v2-deep p-5 font-v2-ui text-v2-ink">
    <div aria-hidden className="relative my-4 h-36 overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--color-v2-self)/15%,transparent_70%)]">
      <svg viewBox="0 0 300 150" className="mx-auto h-full w-full text-v2-self" fill="none" stroke="currentColor">
        <ellipse cx="150" cy="80" rx="104" ry="42" strokeOpacity=".18" />
        <ellipse cx="150" cy="80" rx="76" ry="30" strokeOpacity=".3" />
        <path d="m150 22 24 71 36 33-48-16-12 18-12-18-48 16 36-33z" fill="currentColor" fillOpacity=".1" />
        <path d="m150 45 9 49-9 15-9-15zm-32 68-15 14m79-14 15 14" />
      </svg>
    </div>
    <p className="font-v2-mono text-v2-label uppercase tracking-widest text-v2-self">{t('arena.trial')}</p>
    <h2 className="mt-2 text-v2-title font-semibold">{t('arena.title')}</h2>
    <p className="mt-3 text-v2-body leading-relaxed text-v2-ink-2">{t('arena.intro')}</p>
    <p className="mt-4 text-v2-caption text-v2-ink-3">{t('arena.trialNote')}</p>
    <button className="mt-6 min-h-12 w-full rounded-lg border border-v2-self bg-v2-self/10 font-semibold text-v2-self"
      onClick={onEnter}>{t('arena.enter')}</button>
  </section>;
}
