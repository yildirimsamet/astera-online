import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it } from 'vitest';
import type { ChatMedia } from '@astera/rules';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { AdminContentReports } from '../src/screens/AdminContentReports.js';

const id = '11111111-1111-4111-8111-111111111111';
function show(media: ChatMedia) {
  const api = new Api({ fetch: () => Promise.resolve(new Response(JSON.stringify({ reports: [{
    id, kind: 'message', channel: 'clan', messageId: id, reason: 'OTHER', details: '',
    evidence: { username: 'Scout', playerId: id, content: '', media }, status: 'PENDING', createdAt: new Date(), targetUsername: 'Scout',
  }] }))) });
  const q = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={q}><ApiProvider api={api}><AdminContentReports /></ApiProvider></QueryClientProvider>);
}
it('loads only the exact report attachment after an explicit operator action and lets it be closed', async () => {
  show({ kind: 'image', assetId: id, mimeType: 'image/png' });
  const review = await screen.findByRole('button', { name: 'Review attached media' });
  expect(screen.queryByRole('img')).toBeNull(); expect(document.querySelector('iframe,video')).toBeNull();
  fireEvent.click(review);
  expect(await screen.findByRole('img', { name: 'Reported attachment' })).toHaveAttribute('src', `/api/admin/content-reports/${id}/media`);
  fireEvent.click(screen.getByRole('button', { name: 'Close attachment' })); expect(screen.queryByRole('img')).toBeNull();
});
it('shows a truthful error for an erased attachment and allows a fresh explicit attempt', async () => {
  show({ kind: 'image', assetId: id, mimeType: 'image/png' });
  fireEvent.click(await screen.findByRole('button', { name: 'Review attached media' }));
  fireEvent.error(await screen.findByRole('img', { name: 'Reported attachment' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('The attachment could not be loaded');
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close attachment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review attached media' }));
  expect(await screen.findByRole('img', { name: 'Reported attachment' })).toBeInTheDocument();
});
it('offers video controls without autoplay or an eager download', async () => {
  show({ kind: 'video', assetId: id, mimeType: 'video/mp4' });
  expect(document.querySelector('video')).toBeNull();
  fireEvent.click(await screen.findByRole('button', { name: 'Review attached media' }));
  const video = await screen.findByLabelText('Reported video'); expect(video).toHaveAttribute('controls');
  expect(video).toHaveAttribute('preload', 'none'); expect(video).not.toHaveAttribute('autoplay');
});
it('offers an explicit external YouTube link without constructing an iframe or third-party image', async () => {
  show({ kind: 'youtube', videoId: 'abcdefghijk' });
  const link = await screen.findByRole('link', { name: 'Open video on YouTube' });
  expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abcdefghijk');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer'); expect(document.querySelector('iframe,img,video')).toBeNull();
});
