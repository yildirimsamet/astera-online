import { useTranslation } from 'react-i18next';

/** The one line that turns a wreck or an outpost into the place everyone is racing to. */
export function PartHere() {
  const { t } = useTranslation();
  return (
    <p data-testid="part-here" className="flex items-center gap-1.5 text-micro font-semibold leading-snug text-v2-deut">
      <span aria-hidden="true" className="size-2 shrink-0 rotate-45 bg-v2-deut shadow-[0_0_6px_var(--color-v2-deut)]" />
      {t('starter.jump.partHere')}
    </p>
  );
}
