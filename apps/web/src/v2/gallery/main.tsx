import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n/index.js';
import { syncDocumentLanguage } from '../../i18n/document.js';
import { ToastProvider } from '../../ui/Toast.js';
import { Gallery } from './Gallery.js';
import '../../styles.css';

// As the game does: `<html lang>` follows the language, which is what hyphenation reads.
syncDocumentLanguage();

/** `?lng=tr` draws the gallery in another language; `?view=` draws one sheet open. */
const params = new URLSearchParams(window.location.search);
const language = params.get('lng');
if (language) void i18n.changeLanguage(language);

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <ToastProvider>
          <Gallery view={params.get('view')} />
        </ToastProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}
