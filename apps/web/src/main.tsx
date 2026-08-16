import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from './api/client.js';
import { ApiProvider } from './api/context.js';
import { ToastProvider } from './ui/Toast.js';
import { App } from './App.js';
import './styles.css';

const api = new Api();

/**
 * A handle on the API, in development only.
 *
 * Setting up a scenario worth photographing — a telescope installed, a watch
 * assigned, a probe in the air — takes half a dozen calls as the signed-in player,
 * and driving them through the interface is slow and brittle. Stripped from
 * production by the `DEV` guard.
 */
if (import.meta.env.DEV) {
  (window as unknown as { __api?: Api }).__api = api;
}

const client = new QueryClient({
  defaultOptions: {
    queries: {
      // The server is the only authority; a failed read is worth one more try and
      // then a visible failure, never a silent stale render.
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('no #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ApiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
