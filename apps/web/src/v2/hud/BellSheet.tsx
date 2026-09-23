import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from '../kit/Segmented.js';
import { Sheet } from '../kit/Sheet.js';

export type BellTab = 'signals' | 'chronicle' | 'chat';

export interface BellSheetProps {
  tab: BellTab;
  onTab: (tab: BellTab) => void;
  onClose: () => void;
  /** Signals not yet seen before this opening. */
  unseen: number;
  /** Chat messages unread across the general and clan channels. */
  chatUnread: number;
  /** Each tab's body, composed by the host with its own routes. */
  signals: ReactNode;
  chronicle: ReactNode;
  chat: ReactNode;
}

/** Chat is a page; the feed and the chronicle are as tall as what they hold, up to half. */
const PAGE = ['full'] as const;
const FEED = ['half', 'full'] as const;

/**
 * THE BELL SHEET. Decision K1 (docs/ui-v2/gozlemevi.md).
 *
 * News about you, news about the galaxy and the people in it were three buttons
 * scattered over the disc — Signals in the header, the chronicle and chat in two
 * corners. They are one sheet under one bell with three tabs, so every corner of
 * the galaxy holds at most one thing. Chat's unread dot rides its tab.
 *
 * The host owns which tab is open, so a deep link (a clan chat notification) can
 * open the sheet on the right one. Chat's log owns its own scrolling.
 */
export function BellSheet({ tab, onTab, onClose, unseen, chatUnread, signals, chronicle, chat }: BellSheetProps) {
  const { t } = useTranslation();

  return (
    <Sheet
      // Named for all three tabs: a "Signals" title over the chronicle misled (seen on the gallery).
      title={t('bell.title')}
      {...(tab === 'signals' && unseen > 0 ? { eyebrow: t('signals.eyebrowUnread', { count: unseen }) } : {})}
      onClose={onClose}
      // Remounted on entering or leaving chat so it opens at the height that tab needs.
      key={tab === 'chat' ? 'page' : 'feed'}
      detents={tab === 'chat' ? PAGE : FEED}
      contained={tab === 'chat'}
    >
      <div className="mb-2 shrink-0">
        <Segmented
          label={t('bell.label')}
          value={tab}
          onChange={onTab}
          options={[
            { id: 'signals', label: t('bell.signals') },
            { id: 'chronicle', label: t('bell.chronicle') },
            {
              id: 'chat',
              label: t('bell.chat'),
              dot: chatUnread > 0,
              dotLabel: t('bell.chatUnread', { count: chatUnread }),
            },
          ]}
        />
      </div>
      {tab === 'signals' ? signals : tab === 'chronicle' ? chronicle : <div className="min-h-0 flex-1">{chat}</div>}
    </Sheet>
  );
}
