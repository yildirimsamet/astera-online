import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { keys } from '../../api/keys.js';
import { AnnouncementsScreen } from '../../screens/AnnouncementsScreen.js';
import { FeedbackScreen } from '../../screens/FeedbackScreen.js';
import { ATMOSPHERE } from '../../ui/atmosphere.js';
import { Sheet } from '../kit/Sheet.js';

/**
 * THE TEAM'S TWO CHANNELS IN THE GALLERY (C5, 2026-11-14): announcements with a new one on top,
 * the same page with none yet, and the feedback form — each in the sheet the menu opens, so the
 * camera and the audit see them at 350 px without a live server. Every write answers 404.
 *
 * Development only (`v2-gallery.html`); nothing here is imported by the game.
 */

const NOW = Date.now();
const noop = (): void => undefined;
const at = (hours: number): string => new Date(NOW - hours * 3_600_000).toISOString();

const NEWS = [
  {
    id: '6f1d1c0e-2b6a-4d7e-9a51-0c1f5a2b3c01', title: 'Asteroid yağmuru bu akşam', seen: false, publishedAt: at(2),
    bodyHtml: '<p>Saat <strong>21:00</strong>\'de kuzey kuşağına zengin bir asteroit yağmuru düşüyor. Madencilerini erkenden yola çıkar; ilk gelen en iyi kayaları alır.</p>',
  },
  {
    id: '6f1d1c0e-2b6a-4d7e-9a51-0c1f5a2b3c02', title: 'Sezon 19 başladı', seen: true, publishedAt: at(50),
    bodyHtml: '<p>Yeni sezonda klan koridorları iki kat hızlı. Ayrıntılar:</p><ul><li>Onur tablosu sıfırlandı</li><li>Anıtlar yeni sahiplerini bekliyor</li></ul>',
  },
];

function answer(view: string): typeof fetch {
  return (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const body = url.endsWith('/api/announcements') ? { announcements: view === 'announcements-empty' ? [] : NEWS } : null;
    return Promise.resolve(body === null ? new Response('{}', { status: 404 }) : new Response(JSON.stringify(body), { status: 200 }));
  };
}

function seed(view: string): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const announcements = view === 'announcements-empty' ? [] : NEWS.map((row) => ({ ...row, publishedAt: new Date(row.publishedAt) }));
  client.setQueryData(keys.announcements, { announcements });
  return client;
}

function Stage({ view }: { view: string }) {
  const { t } = useTranslation();
  if (view === 'feedback') {
    return (
      <Sheet detents={['full']} eyebrow={t('community.feedback.eyebrow')} title={t('community.feedback.title')} onClose={noop}>
        <FeedbackScreen />
      </Sheet>
    );
  }
  return (
    <Sheet detents={['full']} eyebrow={t('community.announcements.eyebrow')} headerArt={ATMOSPHERE.announcements}
      title={t('community.announcements.title')} onClose={noop}>
      <AnnouncementsScreen />
    </Sheet>
  );
}

export function GalleryCommunity({ view }: { view: string }) {
  const [client] = useState(() => seed(view));
  const [api] = useState(() => new Api({ fetch: answer(view) }));
  return (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <Stage view={view} />
      </ApiProvider>
    </QueryClientProvider>
  );
}
