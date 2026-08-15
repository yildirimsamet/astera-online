import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Api } from './api/client.js';
import { ApiProvider } from './api/context.js';
import { ToastProvider } from './ui/Toast.js';
import { App } from './App.js';
import './styles.css';

const api = new Api();

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
