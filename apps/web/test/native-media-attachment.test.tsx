import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Api } from '../src/api/client.js';
import { ApiProvider } from '../src/api/context.js';
import { ChatMediaAttachment } from '../src/screens/ChatMediaAttachment.js';
import type { AuthTransport } from '../src/platform/authTransport.js';

const image = { kind: 'image' as const, assetId: 'private-image', mimeType: 'image/png' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function native() {
  const request = vi.fn<AuthTransport['request']>();
  const api = new Api({ authTransport: { request, clear: vi.fn().mockResolvedValue(undefined) } });
  const release = vi.fn();
  const source = vi.spyOn(api, 'chatMediaSource').mockResolvedValue({ url: 'blob:private-image', release });
  return { api, source, release };
}
it('renders native images from an authenticated object URL and releases them on leaving', async () => {
  const { api, source, release } = native();
  const view = render(<ApiProvider api={api}><ChatMediaAttachment media={image} channel="dm" messageId="message" /></ApiProvider>);
  await waitFor(() => { expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:private-image'); });
  expect(source).toHaveBeenCalledWith(image, 'dm', 'message', expect.any(AbortSignal));
  const signal: AbortSignal | undefined = source.mock.calls[0]?.[3];
  view.unmount();
  expect(signal?.aborted).toBe(true); expect(release).toHaveBeenCalledOnce();
});
it('downloads native videos only after the player chooses to play', async () => {
  const { api, source } = native();
  const view = render(<ApiProvider api={api}><ChatMediaAttachment media={{ ...image, kind: 'video', mimeType: 'video/mp4' }} channel="general" messageId="message" /></ApiProvider>);
  expect(source).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
  await waitFor(() => { expect(view.container.querySelector('source')).toHaveAttribute('src', 'blob:private-image'); });
  expect(source).toHaveBeenCalledOnce();
});
it('does not reuse an image request to eagerly download a different video on rerender', async () => {
  const { api, source } = native();
  const view = render(<ApiProvider api={api}><ChatMediaAttachment media={image} /></ApiProvider>);
  await waitFor(() => { expect(source).toHaveBeenCalledOnce(); });
  source.mockClear();
  view.rerender(<ApiProvider api={api}><ChatMediaAttachment media={{ kind: 'video', assetId: 'another-video', mimeType: 'video/mp4' }} /></ApiProvider>);
  expect(source).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
});
it('releases a late source even when a download mock ignores its abort signal', async () => {
  const { api, source, release } = native();
  let resolve: ((value: { url: string; release: () => void }) => void) | undefined;
  source.mockImplementation(() => new Promise(done => { resolve = done; }));
  const view = render(<ApiProvider api={api}><ChatMediaAttachment media={image} /></ApiProvider>);
  await waitFor(() => { expect(source).toHaveBeenCalledOnce(); });
  view.unmount(); resolve?.({ url: 'blob:late', release });
  await waitFor(() => { expect(release).toHaveBeenCalledOnce(); });
});
it('keeps browser images and YouTube embeds on their current paths', () => {
  const api = new Api({ authTransport: null });
  const source = vi.spyOn(api, 'chatMediaSource');
  const view = render(<ApiProvider api={api}><ChatMediaAttachment media={image} /></ApiProvider>);
  expect(screen.getByRole('img')).toHaveAttribute('src', '/api/chat/media/private-image');
  expect(source).not.toHaveBeenCalled();
  view.rerender(<ApiProvider api={api}><ChatMediaAttachment media={{ kind: 'youtube', videoId: 'dQw4w9WgXcQ' }} /></ApiProvider>);
  expect(screen.getByTitle('YouTube video')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  expect(source).not.toHaveBeenCalled();
});
