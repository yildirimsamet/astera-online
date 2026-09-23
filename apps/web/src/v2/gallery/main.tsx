import { StrictMode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/index.js';
import { syncDocumentLanguage } from '../../i18n/document.js';
import { Api } from '../../api/client.js';
import { ApiProvider } from '../../api/context.js';
import { ToastProvider } from '../../ui/Toast.js';
import { Gallery } from './Gallery.js';
import '../../styles.css';

// As the game does: `<html lang>` follows the language, which is what hyphenation reads.
syncDocumentLanguage();

/** `?lng=tr` draws the gallery in another language; `?view=` draws one sheet open. */
const params = new URLSearchParams(window.location.search);
const language = params.get('lng');
if (language) void i18n.changeLanguage(language);

/*
  THE SHEETS THAT READ QUERIES DRAW HERE TOO. The fetch never answers, so every query stays
  pending and every mutation waits: the camera sees the sheet a player sees before the
  network has said anything, and nothing here can reach a server.
*/
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = new Api({ fetch: () => new Promise<Response>(() => undefined) });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={client}>
          <ApiProvider api={api}>
            <ToastProvider>
              <Gallery view={params.get('view')} />
            </ToastProvider>
          </ApiProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}
