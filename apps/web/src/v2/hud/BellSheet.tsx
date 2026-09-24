import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from '../kit/Segmented.js';
import { Sheet } from '../kit/Sheet.js';

export type BellTab = 'signals' | 'chronicle';

export interface BellSheetProps {
  tab: BellTab;
  onTab: (tab: BellTab) => void;
  onClose: () => void;
  /** Signals not yet seen before this opening. */
  unseen: number;
  /** Each tab's body, composed by the host with its own routes. */
  signals: ReactNode;
  chronicle: ReactNode;
}

/** The feed and the chronicle are as tall as what they hold, up to half. */
const FEED = ['half', 'full'] as const;

/**
 * THE BELL SHEET. Decision K1 (docs/ui-v2/gozlemevi.md).
 *
 * What happened: news about you (Signals) and about the galaxy (the Chronicle), one
 * sheet under one bell. Chat was its third tab until the owner moved it back to a
 * button of its own on the galaxy (2026-09-24) — talking is not news, and a thumb
 * should reach it without opening anything first (`ChatHost`).
 *
 * The host owns which tab is open, so a deep link can open the sheet on the right one.
 */
export function BellSheet({ tab, onTab, onClose, unseen, signals, chronicle }: BellSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet
      // Named for both tabs: a "Signals" title over the chronicle misled (seen on the gallery).
      title={t('bell.title')}
      {...(tab === 'signals' && unseen > 0 ? { eyebrow: t('signals.eyebrowUnread', { count: unseen }) } : {})}
      onClose={onClose}
      detents={FEED}
    >
      <div className="mb-2 shrink-0">
        <Segmented
          label={t('bell.label')}
          value={tab}
          onChange={onTab}
          options={[
            { id: 'signals', label: t('bell.signals') },
            { id: 'chronicle', label: t('bell.chronicle') },
          ]}
        />
      </div>
      {tab === 'signals' ? signals : chronicle}
    </Sheet>
  );
}
